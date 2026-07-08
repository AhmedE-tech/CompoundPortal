import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { LiveSessionTile, LiveSessionsResponse } from '../types';

function useCairoTime(): string {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Africa/Cairo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-live-red animate-pulse-live" aria-label="Live" />
      <span className="text-live-red text-[11px] font-semibold uppercase tracking-wide">LIVE</span>
    </span>
  );
}

function SessionTile({ tile, onClick }: { tile: LiveSessionTile; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-video bg-[#1C1C1C] rounded-[8px] border-2 border-transparent hover:border-gold transition-colors cursor-pointer overflow-hidden shadow-sm"
    >
      {/* Top left: live indicator */}
      <div className="absolute top-3 left-3">
        <LiveDot />
      </div>

      {/* Center: watch prompt (hover) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-white/90 text-[13px] font-medium">Watch</span>
      </div>

      {/* Bottom left: session label */}
      <div className="absolute bottom-3 left-3">
        <span className="text-white text-[13px] font-medium">{tile.display_label}</span>
      </div>

      {/* Bottom right: elapsed time */}
      <div className="absolute bottom-3 right-3">
        <span className="text-white/70 text-[12px]">{tile.started_ago_minutes}m</span>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const { sessionToken, compound, logout } = useAuth();
  const navigate = useNavigate();
  const cairoTime = useCairoTime();

  const [tiles, setTiles] = useState<LiveSessionTile[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const { data, error } = await supabase.rpc('compound_get_live_sessions', {
        p_session_token: sessionToken,
      });
      if (error) throw error;
      const response = data as LiveSessionsResponse;
      setTiles(response.tiles ?? []);
      setCompletedCount(response.todays_completed_count ?? 0);
    } catch {
      // Silent fail — polling will retry
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  // Initial fetch + polling
  useEffect(() => {
    fetchSessions();
    pollingRef.current = setInterval(fetchSessions, 15_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchSessions]);

  // Refetch on visibility change
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) fetchSessions();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fetchSessions]);

  const liveCount = tiles.length;

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            <span className="text-gold text-[15px] font-bold tracking-wide">Enaya</span>
            <span className="text-border">·</span>
            <span className="text-text-main text-[13px]">{compound?.name}</span>
            <span className="text-text-muted text-[11px]">{compound?.code}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-text-muted text-[12px] font-medium">{cairoTime}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-text-muted text-[13px] hover:text-text-main transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Top strip */}
      <div className="bg-gold-light border-b border-border">
        <div className="flex items-center justify-between h-8 px-6">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text-main">{liveCount}</span>
            <span className="text-[12px] text-text-muted">sessions in progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-muted">today's completed:</span>
            <span className="text-[13px] font-semibold text-text-main">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-text-muted text-[13px]">Loading...</span>
          </div>
        ) : liveCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" role="status">
            <span className="text-[72px] font-semibold text-border leading-none">0</span>
            <span className="text-text-muted text-[13px] mt-3">no sessions in progress right now</span>
            <span className="text-text-secondary text-[11px] mt-2">The page will refresh automatically.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiles.map((tile) => (
              <SessionTile
                key={tile.session_short_id}
                tile={tile}
                onClick={() => navigate(`/watch/${tile.session_short_id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
