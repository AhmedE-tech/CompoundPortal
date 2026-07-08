import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AgoraRTC, { type IAgoraRTCClient, type ICameraVideoTrack, type IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { StreamTokenLog, StreamTokenResponse } from '../types';

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-live-red animate-pulse-live" aria-label="Live" />
      <span className="font-display text-live-red text-xs uppercase tracking-[0.12em]">LIVE</span>
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
        // Stop any local tracks
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
      // After 30 more seconds of no click, disconnect
      let countdown = 30;
      inactivityCountdownRef.current = setInterval(() => {
        countdown -= 1;
        if (countdown <= 0) {
          navigateToDashboard('inactivity_timeout');
        }
      }, 1000);
    }, 180_000); // 3 minutes
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
    }, 870_000); // 14:30
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

          // Get new log
          const { data: newLog, error: logErr } = await supabase.rpc('compound_request_stream_token', {
            p_session_token: token,
            p_session_id: sessionId,
          });
          if (logErr) throw logErr;
          const newLogData = newLog as StreamTokenLog;

          // Get signed token from edge function
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

          // Renew Agora token
          if (agoraClientRef.current) {
            await agoraClientRef.current.renewToken(tokenData.token);
          }

          logIdRef.current = newLogData.log_id;

          // Schedule next refresh
          scheduleTokenRefresh(appChannelInfo);
        } catch {
          navigateToDashboard('token_refresh_failed');
        }
      }, 480_000); // 8 minutes
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

  // --- Main stream initialization ---
  useEffect(() => {
    if (!sessionToken || !sessionId) return;

    let cancelled = false;

    async function startStream() {
      try {
        setPlayerState('loading');

        // 1. Request token log
        const { data: log, error: logErr } = await supabase.rpc('compound_request_stream_token', {
          p_session_token: sessionToken!,
          p_session_id: sessionId!,
        });
        if (logErr) throw logErr;
        const logData = log as StreamTokenLog;
        logIdRef.current = logData.log_id;

        // 2. Get signed token from edge function
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

        // 3. Initialize Agora client
        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8', role: 'audience' });
        await client.setClientRole('audience');
        await client.join(tokenData.app_id, tokenData.channel_name, tokenData.token, tokenData.uid);

        if (cancelled) {
          await client.leave();
          return;
        }

        agoraClientRef.current = client;

        // 4. Subscribe to remote tracks
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (cancelled) return;
          if (mediaType === 'video' && user.videoTrack) {
            user.videoTrack.play(videoContainerRef.current!);
            setPlayerState('streaming');
            setElapsedMinutes(Math.floor((Date.now() - new Date().getTime()) / 60000));
          }
          if (mediaType === 'audio') {
            user.audioTrack?.play();
          }
        });

        client.on('user-unpublished', () => {
          // Wait 5s to see if user comes back
          setTimeout(() => {
            if (client.remoteUsers.length === 0 && !cancelled) {
              navigateToDashboard('session_ended_by_agent');
            }
          }, 5000);
        });

        // Start all timers
        startHeartbeat();
        scheduleTokenRefresh({ channel_name: tokenData.channel_name });
        startHardCapTimer();
        showOverlayTemporarily();

        // Elapsed time updater
        const elapsedInterval = setInterval(() => {
          setElapsedMinutes((prev) => prev + 1);
        }, 60_000);

        return () => clearInterval(elapsedInterval);
      } catch (err) {
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
  ]);

  // --- Handle keep watching (inactivity) ---
  const handleContinueWatching = () => {
    setShowInactivityModal(false);
    resetInactivityTimer();
  };

  // --- Handle keep watching (hard cap) ---
  const handleKeepWatching = async () => {
    setShowHardCapToast(false);
    if (hardCapCountdownRef.current) clearInterval(hardCapCountdownRef.current);
    if (hardCapTimerRef.current) clearTimeout(hardCapTimerRef.current);

    // Request fresh token + restart 15 min timer
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

  // --- Render based on state ---

  if (playerState === 'loading') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-gold animate-pulse-live" />
          <span className="font-display text-ivory-warm text-base">Connecting to live stream...</span>
        </div>
      </div>
    );
  }

  if (playerState === 'ended' || playerState === 'error') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-ivory-warm text-xl mb-6">{errorMessage}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 bg-gold text-slate text-sm uppercase tracking-[0.08em] font-medium rounded-sm hover:bg-gold-dim transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // Streaming state
  return (
    <div className="fixed inset-0 bg-black">
      {/* Video container */}
      <div ref={videoContainerRef} className="absolute inset-0" />

      {/* Overlay top bar */}
      <div
        className={`absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
          overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <LiveDot />
          <span className="font-display text-ivory text-sm">
            Session #{sessionId?.slice(0, 8)}
          </span>
          <span className="font-mono text-ivory-warm text-sm">{elapsedMinutes}m</span>
        </div>
        <button
          onClick={() => navigateToDashboard('user_close')}
          className="w-10 h-10 flex items-center justify-center text-ivory hover:text-gold transition-colors"
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
        <span className="text-ivory-warm/60 text-xs">
          Enaya Compound Portal — {compound?.name}
        </span>
      </div>

      {/* Inactivity modal */}
      {showInactivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-slate-soft p-8 rounded-sm text-center max-w-sm">
            <p className="font-display text-ivory text-xl mb-4">Still watching?</p>
            <button
              onClick={handleContinueWatching}
              className="px-6 py-2.5 bg-gold text-slate text-sm uppercase tracking-[0.08em] font-medium rounded-sm hover:bg-gold-dim transition-colors"
            >
              Continue watching
            </button>
          </div>
        </div>
      )}

      {/* Hard cap toast */}
      {showHardCapToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-soft px-6 py-4 rounded-sm flex items-center gap-4">
          <span className="text-ivory-warm text-sm">
            Session will disconnect in {hardCapCountdown}s.
          </span>
          <button
            onClick={handleKeepWatching}
            className="px-4 py-1.5 bg-gold text-slate text-xs uppercase tracking-[0.08em] font-medium rounded-sm hover:bg-gold-dim transition-colors"
          >
            Keep watching
          </button>
          <button
            onClick={() => navigateToDashboard('hard_cap')}
            className="text-ivory-warm/60 text-xs hover:text-ivory transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
