import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCairoDate, useCairoTime } from '../hooks/useCairoTime';
import type { Complaint } from '../types';

const CAIRO_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const URGENT_PRIORITIES = ['urgent', 'high', 'critical'];

const CONTAINER_STYLE: React.CSSProperties = {
  maxWidth: '1200px',
  width: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',
};

function labelize(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function statusClasses(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('open') || normalized.includes('pending')) {
    return 'bg-gold-tint text-gold-soft';
  }
  if (normalized.includes('resolved') || normalized.includes('closed')) {
    return 'bg-[rgba(70,167,88,0.12)] text-success';
  }
  return 'bg-surface-3 text-text-muted';
}

function isUrgent(priority: string | null): boolean {
  return !!priority && URGENT_PRIORITIES.includes(priority.toLowerCase());
}

function formatDate(value: string): string {
  return CAIRO_DATE.format(new Date(value));
}

function mapError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('PERMISSION_DENIED')) {
    return "You don't have access to complaints.";
  }
  return "Couldn't load complaints right now.";
}

export default function ComplaintsPage() {
  const { sessionToken, compound, user } = useAuth();
  const navigate = useNavigate();
  const cairoTime = useCairoTime();
  const cairoDate = useCairoDate();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc('compound_get_complaints', {
        p_session_token: sessionToken,
      });
      if (cancelled) return;
      if (rpcError) {
        setError(mapError(rpcError));
        setLoading(false);
        return;
      }
      const response = data as { complaints: Complaint[] | null };
      setComplaints(response.complaints ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Tall brand bar — same treatment as the dashboard (back button instead of Logout) */}
      <header className="topbar-surface sticky top-0 z-20 w-full border-b border-border backdrop-blur-[8px]">
        <div
          style={CONTAINER_STYLE}
          className="flex items-center justify-between gap-6 px-6 py-[18px]"
        >
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
                {user?.display_name?.trim().charAt(0).toUpperCase() ?? '?'}
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
              onClick={() => navigate('/dashboard')}
              aria-label="Back to dashboard"
              className="flex items-center gap-[7px] rounded-[var(--radius-sm)] border border-border-strong px-3.5 py-2 text-[12.5px] font-medium text-text-muted transition-all hover:border-[rgba(201,162,39,0.35)] hover:text-text-main"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-4">
        <div style={CONTAINER_STYLE}>
          <h1 className="pt-6 pb-1 text-[20px] font-semibold tracking-[-0.01em] text-text-main">
            Complaints
          </h1>
          {loading ? (
            <div className="flex items-center gap-3" role="status">
              <span className="w-3 h-3 rounded-full bg-gold animate-pulse-live" aria-hidden="true" />
              <span className="text-text-muted text-[13px]">Loading…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-start gap-5">
              <p className="text-text-muted text-[13px]">{error}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gold-soft text-[12px] font-medium hover:underline"
              >
                Back to dashboard
              </button>
            </div>
          ) : complaints.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-center" role="status">
              <img
                src="/enaya-emblem.png"
                alt=""
                aria-hidden="true"
                width="110"
                height="64"
                className="opacity-[0.15]"
              />
              <p className="text-text-muted text-[14px]">No complaints on record.</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gold-soft text-[12px] font-medium hover:underline"
              >
                Back to dashboard
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-0">
              {complaints.map((complaint) => (
                <li
                  key={complaint.reference}
                  className="flex flex-wrap items-center gap-x-5 gap-y-1.5 py-3.5 border-b border-border"
                >
                  <span className="text-text-main text-[12px] font-mono">
                    {complaint.reference}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${statusClasses(
                      complaint.status,
                    )}`}
                  >
                    {labelize(complaint.status)}
                  </span>
                  {complaint.type && (
                    <span className="text-text-muted text-[12px]">{labelize(complaint.type)}</span>
                  )}
                  {complaint.priority && (
                    <span className="flex items-center gap-1.5 text-text-muted text-[12px]">
                      {isUrgent(complaint.priority) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-live-red" aria-hidden="true" />
                      )}
                      {labelize(complaint.priority)}
                    </span>
                  )}
                  <span className="text-text-subtle text-[12px]">
                    Created {formatDate(complaint.created_at)}
                  </span>
                  {complaint.resolved_at && (
                    <span className="text-success text-[12px]">
                      Resolved {formatDate(complaint.resolved_at)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}