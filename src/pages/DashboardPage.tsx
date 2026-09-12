import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, LogOut, MessageSquareWarning, Play, Users, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCairoDate, useCairoTime } from '../hooks/useCairoTime';
import { useClientRoster } from '../hooks/useClientRoster';
import ClientRosterWindow from '../components/ClientRosterWindow';
import type { LiveSessionTile, LiveSessionsResponse } from '../types';

// Reusable container constraint — inline style guarantees it works
// regardless of Tailwind JIT / arbitrary value support
const CONTAINER_STYLE: React.CSSProperties = {
  maxWidth: '1200px',
  width: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',
};

const STARTED_AT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function startedTime(startedAgoMinutes: number): string {
  return STARTED_AT.format(new Date(Date.now() - startedAgoMinutes * 60_000));
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-live-red animate-pulse-live" aria-label="Live" />
      <span className="text-live-red text-[11px] font-bold uppercase tracking-[0.06em]">LIVE</span>
    </span>
  );
}

function Tab({
  active = false,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  const base =
    'inline-flex items-center gap-2 border-b-2 px-1 py-[15px] text-[13.5px] font-medium transition-colors mx-3 max-[560px]:mx-2 first:ml-0';
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`${base} ${
        active
          ? 'border-gold text-gold-bright'
          : 'border-transparent text-text-muted hover:text-text-main'
      }`}
    >
      {icon}
      <span className="max-[560px]:text-[13px]">{children}</span>
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  stripeClass,
  iconBoxClass,
  icon,
}: {
  label: string;
  value: number;
  sub: string;
  stripeClass: string;
  iconBoxClass: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat-surface relative overflow-hidden border border-border p-[22px] rounded-[var(--radius-md)]">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[3px] ${stripeClass}`}
      />
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {label}
        </span>
        <span
          className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] ${iconBoxClass}`}
        >
          {icon}
        </span>
      </div>
      <div className="font-display text-[44px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-text-main">
        {value}
      </div>
      <div className="mt-2 text-[12px] text-text-subtle">{sub}</div>
    </div>
  );
}

function SessionTile({ tile, onClick }: { tile: LiveSessionTile; onClick: () => void }) {
  const meta = [tile.vehicle_type_generic, `started ${startedTime(tile.started_ago_minutes)}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      onClick={onClick}
      className="tile-surface group relative aspect-[16/10] overflow-hidden rounded-[var(--radius-md)] border border-border text-left transition-all duration-[0.18s] cursor-pointer hover:-translate-y-0.5 hover:shadow-gold"
    >
      {/* Top line: LIVE pill + elapsed */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(229,72,77,0.9)] px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-white">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse-live" aria-hidden="true" />
          Live
        </span>
        <span className="rounded-[6px] bg-[rgba(0,0,0,0.35)] px-2 py-[3px] font-mono text-[11px] tabular-nums text-[rgba(255,255,255,0.75)]">
          {tile.started_ago_minutes}m
        </span>
      </div>

      {/* Hover play affordance */}
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-[0.18s] group-hover:opacity-100"
      >
        <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-[rgba(201,162,39,0.92)] shadow-[0_6px_24px_rgba(0,0,0,0.4)]">
          <Play size={22} className="ml-[3px] text-[#141210]" fill="currentColor" />
        </span>
      </span>

      {/* Bottom: label + meta */}
      <div className="absolute bottom-3 left-3.5 right-3.5">
        <div className="truncate text-[13.5px] font-semibold text-white">
          {tile.display_label}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-[rgba(255,255,255,0.65)]">{meta}</div>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const { sessionToken, compound, user, logout } = useAuth();
  const navigate = useNavigate();
  const cairoTime = useCairoTime();
  const cairoDate = useCairoDate();

  const canViewLive = user?.permissions.view_live ?? false;
  const canViewComplaints = user?.permissions.view_complaints ?? false;
  const canViewClients = user?.permissions.view_clients ?? false;
  const hasSecondaryActions = canViewComplaints || canViewClients;

  const roster = useClientRoster(sessionToken);
  const [rosterOpen, setRosterOpen] = useState(false);

  const [tiles, setTiles] = useState<LiveSessionTile[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
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
      setClientsCount(response.compound_clients_count ?? 0);
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
  const userInitial = user?.display_name?.trim().charAt(0).toUpperCase() ?? '?';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Tall brand bar — sticky header */}
      <header className="topbar-surface sticky top-0 z-20 w-full border-b border-border backdrop-blur-[8px]">
        <div
          style={CONTAINER_STYLE}
          className="flex items-center justify-between gap-6 px-6 py-[18px]"
        >
          {/* Left: big logo + divider + compound identity */}
          <div className="flex min-w-0 items-center gap-3.5">
            <img
              src="/enaya-logo.png"
              alt="Enaya"
              className="h-[52px] w-auto shrink-0 max-[560px]:h-[42px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
            />
            <span className="h-[38px] w-px shrink-0 bg-border-strong" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="max-[560px]:text-[15px] truncate text-[17px] font-semibold leading-[1.1] tracking-[-0.01em] text-text-main">
                {compound?.name}
              </span>
              <span className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-gold-soft">
                {compound?.code}
              </span>
            </div>
          </div>

          {/* Right: clock block + user chip + Logout */}
          <div className="flex shrink-0 items-center gap-[22px] max-[560px]:gap-[14px]">
            <div className="flex flex-col items-end gap-0.5 leading-none max-[560px]:hidden">
              <span className="font-mono text-[19px] font-medium tabular-nums tracking-[0.02em] text-text-main">
                {cairoTime}
              </span>
              <span className="text-[11.5px] tracking-[0.02em] text-text-muted">{cairoDate}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--color-gold),#9c7d1a)] text-[14px] font-bold text-[#141210] shadow-[0_0_0_1px_rgba(201,162,39,0.35)]"
              >
                {userInitial}
              </span>
              <div className="flex flex-col gap-px leading-[1.15] max-[560px]:hidden">
                <span className="text-[13.5px] font-semibold text-text-main">
                  {user?.display_name}
                </span>
                {user?.role_label && (
                  <span className="text-[11px] capitalize text-text-muted">
                    {user.role_label.toLowerCase()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-[7px] rounded-[var(--radius-sm)] border border-border-strong px-3.5 py-2 text-[12.5px] font-medium text-text-muted transition-all hover:border-[rgba(201,162,39,0.35)] hover:text-text-main"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Real navigation tabs — permission-gated (replaces the old text-link actions row) */}
      <nav className="border-b border-border bg-[rgba(12,13,16,0.4)]">
        <div style={CONTAINER_STYLE} className="flex flex-wrap items-center gap-1.5 px-6">
          <Tab active onClick={() => navigate('/dashboard')} icon={<Video size={17} />}>
            Live Sessions
          </Tab>
          {canViewComplaints && (
            <Tab onClick={() => navigate('/complaints')} icon={<MessageSquareWarning size={17} />}>
              Complaints
            </Tab>
          )}
          {canViewClients && (
            <Tab
              onClick={() => {
                roster.open();
                setRosterOpen(true);
              }}
              icon={<Users size={17} />}
            >
              My Clients
            </Tab>
          )}
        </div>
      </nav>

      {/* Body */}
      <main className="flex-1">
        {loading ? (
          <div style={CONTAINER_STYLE} className="flex min-h-[50vh] items-center justify-center px-6">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-gold animate-pulse-live" aria-hidden="true" />
              <span className="text-[13px] text-text-muted">Loading…</span>
            </div>
          </div>
        ) : (
          <div style={CONTAINER_STYLE} className="px-6">
            {/* Stat cards */}
            <section className="grid grid-cols-3 max-[820px]:grid-cols-1 gap-4 py-7">
              <StatCard
                label="In Progress"
                value={liveCount}
                sub="wash sessions live right now"
                stripeClass="bg-live-red"
                iconBoxClass="bg-[rgba(229,72,77,0.14)] text-live-red"
                icon={<Video size={17} />}
              />
              <StatCard
                label="Completed Today"
                value={completedCount}
                sub="finished since midnight"
                stripeClass="bg-success"
                iconBoxClass="bg-[rgba(70,167,88,0.14)] text-success"
                icon={<CircleCheck size={17} />}
              />
              <StatCard
                label="Registered Clients"
                value={clientsCount}
                sub="living in this compound"
                stripeClass="bg-gold"
                iconBoxClass="bg-gold-tint text-gold-soft"
                icon={<Users size={17} />}
              />
            </section>

            {!canViewLive ? (
              <section
                role="status"
                className="flex min-h-[45vh] items-center justify-center py-16 text-center"
              >
                <div className="flex flex-col items-center gap-4">
                  <img
                    src="/enaya-emblem.png"
                    alt=""
                    aria-hidden="true"
                    width="110"
                    height="64"
                    className="opacity-[0.15]"
                  />
                  <p className="text-[14px] text-text-muted">
                    Live viewing isn't enabled for your account — contact Enaya
                  </p>
                  {hasSecondaryActions && (
                    <p className="text-[11px] uppercase tracking-[0.12em] text-text-subtle">
                      complaints and the client roster are available in the tabs above
                    </p>
                  )}
                </div>
              </section>
            ) : liveCount === 0 ? (
              <section
                role="status"
                className="flex min-h-[45vh] items-center justify-center py-16 text-center"
              >
                <div className="flex flex-col items-center gap-4">
                  <img
                    src="/enaya-emblem.png"
                    alt=""
                    aria-hidden="true"
                    width="110"
                    height="64"
                    className="opacity-[0.15]"
                  />
                  <p className="text-[14px] text-text-muted">No active wash sessions right now</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-text-subtle">
                    the page will refresh automatically
                  </p>
                </div>
              </section>
            ) : (
              <>
                {/* Section head */}
                <div className="mb-4 flex items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2.5 text-[15px] font-semibold text-text-main">
                    Live now
                    <LiveDot />
                  </div>
                  <span className="text-[12px] text-text-subtle">Updates automatically</span>
                </div>

                {/* Live tiles */}
                <section className="grid grid-cols-3 max-[820px]:grid-cols-2 max-[560px]:grid-cols-1 gap-[18px] pb-12">
                  {tiles.map((tile) => (
                    <SessionTile
                      key={tile.session_short_id}
                      tile={tile}
                      onClick={() => navigate(`/watch/${tile.session_short_id}`)}
                    />
                  ))}
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {/* Client roster modal — launched from the "My Clients" tab, not a route */}
      {rosterOpen && (
        <ClientRosterWindow
          roster={roster}
          onClose={() => {
            roster.close();
            setRosterOpen(false);
          }}
        />
      )}
    </div>
  );
}