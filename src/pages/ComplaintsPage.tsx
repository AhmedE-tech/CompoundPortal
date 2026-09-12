import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Complaint } from '../types';

const CAIRO_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const URGENT_PRIORITIES = ['urgent', 'high', 'critical'];

const CONTAINER_STYLE: React.CSSProperties = {
  maxWidth: '1280px',
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
    <div className="min-h-screen bg-ink flex flex-col">
      <header className="w-full border-b border-border bg-surface-1">
        <div
          style={CONTAINER_STYLE}
          className="px-4 sm:px-8 py-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              aria-label="Back to dashboard"
              className="shrink-0 flex items-center gap-1.5 text-text-muted hover:text-gold-soft transition-colors"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline text-[12px]">Back</span>
            </button>
            <span className="w-px h-5 bg-border-strong shrink-0" aria-hidden="true" />
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-text-main text-[14px] font-medium truncate">Complaints</h1>
              <span className="hidden sm:inline text-text-subtle text-[11px] font-mono tracking-wide truncate">
                {compound?.name}
              </span>
            </div>
          </div>

          <span className="hidden sm:inline text-text-muted text-[12px] font-medium truncate max-w-[180px]">
            {user?.display_name}
            {user?.role_label ? ` · ${user.role_label}` : ''}
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-10">
        <div style={CONTAINER_STYLE}>
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