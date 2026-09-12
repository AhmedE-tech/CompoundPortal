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

function useCairoDate(): string {
  const [date] = useState(() =>
    new Date().toLocaleDateString('en-GB', {
      timeZone: 'Africa/Cairo',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  );
  return date;
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
      className="group relative aspect-video bg-surface-2 rounded-[var(--radius-md)] border border-border hover:border-gold hover:shadow-gold transition cursor-pointer overflow-hidden"
    >
      {/* Top left: live indicator */}
      <div className="absolute top-3 left-3">
        <LiveDot />
      </div>

      {/* Center: watch prompt (hover) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-gold-soft text-[13px] font-medium tracking-wide">Watch</span>
      </div>

      {/* Bottom left: session label */}
      <div className="absolute bottom-3 left-3">
        <span className="text-text-main text-[13px] font-medium">{tile.display_label}</span>
      </div>

      {/* Bottom right: elapsed time */}
      <div className="absolute bottom-3 right-3">
        <span className="text-text-muted text-[12px] font-mono tabular-nums">{tile.started_ago_minutes}m</span>
      </div>
    </button>
  );
}

// Reusable container constraint — inline style guarantees it works
// regardless of Tailwind JIT / arbitrary value support
const CONTAINER_STYLE: React.CSSProperties = {
  maxWidth: '1280px',
  width: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',
};

export default function DashboardPage() {
  const { sessionToken, compound, logout } = useAuth();
  const navigate = useNavigate();
  const cairoTime = useCairoTime();
  const cairoDate = useCairoDate();

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
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Header — full-width background, content constrained via inline style */}
      <header className="sticky top-0 z-10 w-full border-b border-border bg-surface-1">
        <div
          style={CONTAINER_STYLE}
          className="px-4 sm:px-8 py-4 flex items-center justify-between gap-4"
        >
          {/* Left: emblem + wordmark logo, divider, compound identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <img src="/enaya-emblem.png" alt="Enaya" width="48" height="28" />
              <img
                src="/enaya-wordmark.png"
                alt="Enaya"
                width="64"
                height="18"
                className="hidden min-[400px]:block"
              />
            </div>
            <span className="w-px h-5 bg-border-strong shrink-0" aria-hidden="true" />
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-text-main text-[14px] font-medium truncate">
                {compound?.name}
              </span>
              <span className="hidden sm:inline text-text-subtle text-[11px] font-mono tracking-wide">
                {compound?.code}
              </span>
            </div>
          </div>

          {/* Right: Cairo date + clock, logout */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-text-muted text-[12px] font-medium">{cairoDate}</span>
              <span className="text-border-strong" aria-hidden="true">
                ·
              </span>
            </div>
            <span className="text-text-main text-[12px] font-medium font-mono tabular-nums">
              {cairoTime}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-text-muted text-[13px] hover:text-gold-soft transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Top strip — counters */}
      <div className="w-full bg-surface-1 border-t border-border">
        <div
          style={CONTAINER_STYLE}
          className="px-4 sm:px-8 h-10 flex justify-between items-center gap-6"
        >
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text-main tabular-nums">
              {liveCount}
            </span>
            <span className="text-[12px] text-text-muted">sessions in progress</span>
          </div>
          {/* Spec 2 slot: third counter "registered clients" — no data wired yet */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-muted">today's completed:</span>
            <span className="text-[13px] font-semibold text-text-main tabular-nums">
              {completedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <main className="flex-1 flex items-center justify-center px-8">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-gold animate-pulse-live" aria-hidden="true" />
            <span className="text-text-muted text-[13px]">Loading…</span>
          </div>
        </main>
      ) : liveCount === 0 ? (
        <main className="flex-1 flex items-center justify-center px-8">
          <div className="flex flex-col items-center gap-4 text-center" role="status">
            <img
              src="/enaya-emblem.png"
              alt=""
              aria-hidden="true"
              width="110"
              height="64"
              className="opacity-[0.15]"
            />
            <p className="text-text-muted text-[14px]">No active wash sessions right now</p>
            <p className="text-text-subtle text-[11px] uppercase tracking-[0.12em]">
              the page will refresh automatically
            </p>
          </div>
        </main>
      ) : (
        <main className="flex-1 px-4 sm:px-8 py-12">
          <div
            style={CONTAINER_STYLE}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {tiles.map((tile) => (
              <SessionTile
                key={tile.session_short_id}
                tile={tile}
                onClick={() => navigate(`/watch/${tile.session_short_id}`)}
              />
            ))}
          </div>
        </main>
      )}
    </div>
  );
}