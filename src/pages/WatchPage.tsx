import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AgoraRTC, { type IAgoraRTCClient, type ICameraVideoTrack, type IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { X, RotateCw, Maximize, Minimize } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { StreamTokenLog, StreamTokenResponse } from '../types';

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-live-red animate-pulse-live" aria-label="Live" />
      <span className="text-live-red text-[11px] font-semibold uppercase tracking-wide">LIVE</span>
    </span>
  );
}

type PlayerState = 'loading' | 'streaming' | 'ended' | 'error';

export default function WatchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessionToken, compound, forceLogout } = useAuth();
  const navigate = useNavigate();

  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');

  // Inactivity modal
  const [showInactivityModal, setShowInactivityModal] = useState(false);

  // Hard cap toast
  const [showHardCapToast, setShowHardCapToast] = useState(false);
  const [hardCapCountdown, setHardCapCountdown] = useState(30);

  // Refs
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef<string | null>(null);
  const sessionTokenRef = useRef(sessionToken);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardCapCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoTracksRef = useRef<{ video?: ICameraVideoTrack; audio?: IMicrophoneAudioTrack }>({});

  // Keep sessionToken ref updated
  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  const reportDisconnect = useCallback(
    async (reason: string) => {
      const logId = logIdRef.current;
      const token = sessionTokenRef.current;
      if (!logId || !token) return;
      try {
        await supabase.rpc('compound_report_stream_disconnect', {
          p_session_token: token,
          p_log_id: logId,
          p_reason: reason,
        });
      } catch {
        // ignore
      }
      logIdRef.current = null;
    },
    [],
  );

  const teardownAgora = useCallback(async () => {
    if (agoraClientRef.current) {
      try {
        if (videoTracksRef.current.video) {
          videoTracksRef.current.video.stop();
          videoTracksRef.current.video.close();
        }
        if (videoTracksRef.current.audio) {
          videoTracksRef.current.audio.stop();
          videoTracksRef.current.audio.close();
        }
        videoTracksRef.current = {};
        await agoraClientRef.current.leave();
      } catch {
        // ignore
      }
      agoraClientRef.current = null;
    }
  }, []);

  const navigateToDashboard = useCallback(
    (reason?: string) => {
      if (reason) reportDisconnect(reason);
      teardownAgora();
      clearAllTimers();
      navigate('/dashboard');
    },
    [navigate, reportDisconnect, teardownAgora],
  );

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (inactivityCountdownRef.current) clearInterval(inactivityCountdownRef.current);
    if (hardCapTimerRef.current) clearTimeout(hardCapTimerRef.current);
    if (hardCapCountdownRef.current) clearInterval(hardCapCountdownRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (tokenRefreshRef.current) clearTimeout(tokenRefreshRef.current);
  }, []);

  // --- Overlay auto-hide ---
  const showOverlayTemporarily = useCallback(() => {
    setOverlayVisible(true);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setOverlayVisible(false), 3000);
  }, []);

  // --- Inactivity detection ---
  const resetInactivityTimer = useCallback(() => {
    setShowInactivityModal(false);
    setShowHardCapToast(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (inactivityCountdownRef.current) clearInterval(inactivityCountdownRef.current);

    inactivityTimerRef.current = setTimeout(() => {
      setShowInactivityModal(true);
      let countdown = 30;
      inactivityCountdownRef.current = setInterval(() => {
        countdown -= 1;
        if (countdown <= 0) {
          navigateToDashboard('inactivity_timeout');
        }
      }, 1000);
    }, 180_000);
  }, [navigateToDashboard]);

  // --- Hard cap (15 min) ---
  const startHardCapTimer = useCallback(() => {
    if (hardCapTimerRef.current) clearTimeout(hardCapTimerRef.current);
    if (hardCapCountdownRef.current) clearInterval(hardCapCountdownRef.current);

    hardCapTimerRef.current = setTimeout(() => {
      setShowHardCapToast(true);
      let countdown = 30;
      setHardCapCountdown(countdown);
      hardCapCountdownRef.current = setInterval(() => {
        countdown -= 1;
        setHardCapCountdown(countdown);
        if (countdown <= 0) {
          navigateToDashboard('hard_cap');
        }
      }, 1000);
    }, 870_000);
  }, [navigateToDashboard]);

  // --- Heartbeat (15s while watching) ---
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      const token = sessionTokenRef.current;
      if (!token) return;
      const { error } = await supabase.rpc('compound_heartbeat', {
        p_session_token: token,
      });
      if (error) {
        forceLogout('You were logged out. Please sign in again.');
      }
    }, 15_000);
  }, [forceLogout]);

  // --- Token refresh at 8 min ---
  const scheduleTokenRefresh = useCallback(
    (appChannelInfo: { channel_name: string }) => {
      if (tokenRefreshRef.current) clearTimeout(tokenRefreshRef.current);
      tokenRefreshRef.current = setTimeout(async () => {
        try {
          const token = sessionTokenRef.current;
          if (!token) return;

          const { data: newLog, error: logErr } = await supabase.rpc('compound_request_stream_token', {
            p_session_token: token,
            p_session_id: sessionId,
          });
          if (logErr) throw logErr;
          const newLogData = newLog as StreamTokenLog;

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) throw new Error('No session');

          const res = await fetch(import.meta.env.VITE_STREAM_TOKEN_FN_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              compound_session_token: token,
              log_id: newLogData.log_id,
            }),
          });
          if (!res.ok) throw new Error('Token fetch failed');
          const tokenData: StreamTokenResponse = await res.json();

          if (agoraClientRef.current) {
            await agoraClientRef.current.renewToken(tokenData.token);
          }

          logIdRef.current = newLogData.log_id;

          scheduleTokenRefresh(appChannelInfo);
        } catch {
          navigateToDashboard('token_refresh_failed');
        }
      }, 480_000);
    },
    [navigateToDashboard, sessionId],
  );

  // --- Mouse/keyboard activity for inactivity timer ---
  useEffect(() => {
    const resetTimer = () => {
      resetInactivityTimer();
      showOverlayTemporarily();
    };
    document.addEventListener('mousemove', resetTimer);
    document.addEventListener('keydown', resetTimer);
    document.addEventListener('touchstart', resetTimer);
    resetInactivityTimer();
    return () => {
      document.removeEventListener('mousemove', resetTimer);
      document.removeEventListener('keydown', resetTimer);
      document.removeEventListener('touchstart', resetTimer);
    };
  }, [resetInactivityTimer, showOverlayTemporarily]);

  // --- Visibility API ---
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        navigateToDashboard('tab_hidden');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [navigateToDashboard]);

  // --- Update fit mode on video element ---
  useEffect(() => {
    const videoEl = videoContainerRef.current?.querySelector('video');
    if (videoEl) {
      videoEl.style.objectFit = fitMode;
    }
  }, [fitMode]);

  // --- Keyboard shortcuts for rotation and fit ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showInactivityModal || showHardCapToast) return;
      if (e.key === 'r' || e.key === 'R') handleRotate();
      if (e.key === 'f' || e.key === 'F') setFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showInactivityModal, showHardCapToast, handleRotate]);

  // --- Main stream initialization ---
  useEffect(() => {
    if (!sessionToken || !sessionId) return;

    let cancelled = false;

    async function startStream() {
      try {
        setPlayerState('loading');

        const { data: log, error: logErr } = await supabase.rpc('compound_request_stream_token', {
          p_session_token: sessionToken!,
          p_session_id: sessionId!,
        });
        if (logErr) throw logErr;
        const logData = log as StreamTokenLog;
        logIdRef.current = logData.log_id;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('No auth session');

        const res = await fetch(import.meta.env.VITE_STREAM_TOKEN_FN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            compound_session_token: sessionToken!,
            log_id: logData.log_id,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const code = body?.error?.code || body?.code || '';
          if (code === 'STREAM_NOT_LIVE' || code === 'SESSION_NOT_ACCESSIBLE') {
            if (!cancelled) {
              setPlayerState('ended');
              setErrorMessage(
                code === 'STREAM_NOT_LIVE'
                  ? 'This session has ended.'
                  : 'This session is not available.',
              );
            }
            return;
          }
          throw new Error('Token fetch failed');
        }

        const tokenData: StreamTokenResponse = await res.json();

        if (cancelled) return;

        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8', role: 'audience' });
        await client.setClientRole('audience');
        await client.join(tokenData.app_id, tokenData.channel_name, tokenData.token, tokenData.uid);

        if (cancelled) {
          await client.leave();
          return;
        }

        agoraClientRef.current = client;

        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (cancelled) return;
          if (mediaType === 'video' && user.videoTrack) {
            user.videoTrack.play(videoContainerRef.current!);
            const videoEl = videoContainerRef.current?.querySelector('video');
            if (videoEl) {
              videoEl.style.objectFit = fitMode;
            }
            setPlayerState('streaming');
            setElapsedMinutes(Math.floor((Date.now() - new Date().getTime()) / 60000));
          }
          if (mediaType === 'audio') {
            user.audioTrack?.play();
          }
        });

        client.on('user-unpublished', () => {
          setTimeout(() => {
            if (client.remoteUsers.length === 0 && !cancelled) {
              navigateToDashboard('session_ended_by_agent');
            }
          }, 5000);
        });

        startHeartbeat();
        scheduleTokenRefresh({ channel_name: tokenData.channel_name });
        startHardCapTimer();
        showOverlayTemporarily();

        const elapsedInterval = setInterval(() => {
          setElapsedMinutes((prev) => prev + 1);
        }, 60_000);

        return () => clearInterval(elapsedInterval);
      } catch {
        if (!cancelled) {
          setPlayerState('error');
          setErrorMessage('Something went wrong. Try again or return to dashboard.');
        }
      }
    }

    startStream();

    return () => {
      cancelled = true;
      clearAllTimers();
      teardownAgora();
    };
  }, [
    sessionToken,
    sessionId,
    navigateToDashboard,
    teardownAgora,
    clearAllTimers,
    startHeartbeat,
    scheduleTokenRefresh,
    startHardCapTimer,
    showOverlayTemporarily,
    fitMode,
  ]);

  const handleContinueWatching = () => {
    setShowInactivityModal(false);
    resetInactivityTimer();
  };

  const handleKeepWatching = async () => {
    setShowHardCapToast(false);
    if (hardCapCountdownRef.current) clearInterval(hardCapCountdownRef.current);
    if (hardCapTimerRef.current) clearTimeout(hardCapTimerRef.current);

    try {
      const token = sessionTokenRef.current;
      if (!token || !sessionId) return;
      const { data: newLog, error } = await supabase.rpc('compound_request_stream_token', {
        p_session_token: token,
        p_session_id: sessionId,
      });
      if (error) throw error;
      const logData = newLog as StreamTokenLog;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch(import.meta.env.VITE_STREAM_TOKEN_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          compound_session_token: token,
          log_id: logData.log_id,
        }),
      });
      if (!res.ok) throw new Error('Token refresh failed');
      const tokenData: StreamTokenResponse = await res.json();

      if (agoraClientRef.current) {
        await agoraClientRef.current.renewToken(tokenData.token);
      }
      logIdRef.current = logData.log_id;
      startHardCapTimer();
      scheduleTokenRefresh({ channel_name: tokenData.channel_name });
    } catch {
      navigateToDashboard('hard_cap_refresh_failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1C1C1C]">
      {/* Video container — ALWAYS in DOM so Agora can play() into it during loading */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0"
        style={{
          transform: `rotate(${rotation}deg)`,
          ...(rotation === 90 || rotation === 270
            ? { width: '100vh', height: '100vw', top: '50%', left: '50%', marginTop: '-50vw', marginLeft: '-50vh' }
            : {}),
        }}
      />

      {/* Loading overlay — rendered ON TOP of the video container */}
      {playerState === 'loading' && (
        <div className="absolute inset-0 z-10 bg-[#1C1C1C] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-gold animate-pulse-live" />
            <span className="text-white/90 text-[13px]">Connecting to live stream...</span>
          </div>
        </div>
      )}

      {/* Error/ended overlay — rendered ON TOP of the video container */}
      {(playerState === 'ended' || playerState === 'error') && (
        <div className="absolute inset-0 z-10 bg-[#1C1C1C] flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/90 text-[15px] font-medium mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 bg-gold text-white text-[13px] font-semibold rounded-[6px] hover:bg-gold-hover transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      )}

      {/* Overlay top bar */}
      <div
        className={`absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
          overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <LiveDot />
          <span className="text-white text-[13px]">
            Session #{sessionId?.slice(0, 8)}
          </span>
          <span className="text-white/70 text-[12px]">{elapsedMinutes}m</span>
        </div>

        {/* Center: video controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRotate}
            className="w-8 h-8 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Rotate video"
            title="Rotate 90°"
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={() => setFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'))}
            className="h-8 px-3 flex items-center gap-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors"
            aria-label="Toggle video fit"
            title={fitMode === 'contain' ? 'Fill viewport' : 'Fit to screen'}
          >
            {fitMode === 'contain' ? <Maximize size={14} /> : <Minimize size={14} />}
            <span>{fitMode === 'contain' ? 'Fill' : 'Fit'}</span>
          </button>
        </div>

        <button
          onClick={() => navigateToDashboard('user_close')}
          className="w-10 h-10 flex items-center justify-center text-white hover:text-gold transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Overlay bottom bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-6 py-3 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 ${
          overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span className="text-white/50 text-[11px]">
          Enaya Compound Portal — {compound?.name}
        </span>
      </div>

      {/* Inactivity modal */}
      {showInactivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white p-8 rounded-[10px] text-center max-w-sm shadow-lg">
            <p className="text-text-main text-[15px] font-semibold mb-4">Still watching?</p>
            <button
              onClick={handleContinueWatching}
              className="px-6 py-2.5 bg-gold text-white text-[13px] font-semibold rounded-[6px] hover:bg-gold-hover transition-colors"
            >
              Continue watching
            </button>
          </div>
        </div>
      )}

      {/* Hard cap toast */}
      {showHardCapToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white px-6 py-4 rounded-[8px] flex items-center gap-4 shadow-lg border border-border">
          <span className="text-text-main text-[13px]">
            Session will disconnect in {hardCapCountdown}s.
          </span>
          <button
            onClick={handleKeepWatching}
            className="px-4 py-1.5 bg-gold text-white text-[12px] font-semibold rounded-[6px] hover:bg-gold-hover transition-colors"
          >
            Keep watching
          </button>
          <button
            onClick={() => navigateToDashboard('hard_cap')}
            className="text-text-muted text-[12px] hover:text-text-main transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}