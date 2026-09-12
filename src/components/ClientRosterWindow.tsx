import { useRef } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useScreenshotDeterrence, useWatermarkStamp } from '../utils/screenshotDeterrence';
import type { UseClientRoster } from '../hooks/useClientRoster';

const ACCESS_EXPIRES = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function WatermarkOverlay({ displayName }: { displayName: string }) {
  const stamp = useWatermarkStamp();
  const label = `${displayName} · ${stamp}`;
  const tiles = Array.from({ length: 12 });

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none select-none grid grid-cols-2 sm:grid-cols-3 place-items-center gap-y-10"
    >
      {tiles.map((_, index) => (
        <span
          key={index}
          className="text-text-muted opacity-[0.06] text-[10px] font-mono whitespace-nowrap tracking-wider"
          style={{ transform: 'rotate(-15deg)' }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export default function ClientRosterWindow({
  roster,
  onClose,
}: {
  roster: UseClientRoster;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const { paused, resume } = useScreenshotDeterrence(panelRef);
  const showWatermark = roster.phase === 'ready';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Client roster"
        className="relative w-full max-w-xl max-h-[80vh] overflow-y-auto overscroll-contain bg-surface-2 border border-border rounded-[var(--radius-md)] shadow-md"
      >
        {showWatermark && <WatermarkOverlay displayName={user?.display_name ?? 'Enaya'} />}

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-text-main text-[14px] font-medium">Client roster</span>
              <span className="truncate text-text-subtle text-[12px]">{user?.display_name}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close client roster"
              className="shrink-0 text-text-muted hover:text-gold-soft transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5" aria-live="polite">
            <RosterBody roster={roster} />
          </div>
        </div>

        {paused && (
          <button
            onClick={resume}
            className="absolute inset-0 z-20 flex items-center justify-center bg-ink text-text-muted text-[13px]"
            aria-label="Resume viewing"
          >
            Paused — click to resume
          </button>
        )}
      </div>
    </div>
  );
}

function RosterBody({ roster }: { roster: UseClientRoster }) {
  const { phase, clients, accessExpiresAt, error } = roster;

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-text-muted text-[13px]">{error ?? "Couldn't load your clients right now."}</p>
        <button
          onClick={roster.retry}
          className="text-gold-soft text-[12px] font-medium hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase === 'expired') {
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-text-main text-[13px] font-medium">Your client access has expired.</p>
          <p className="text-text-subtle text-[12px]">Request approval again to keep viewing.</p>
        </div>
        <button
          onClick={roster.retry}
          className="px-4 py-2 bg-gold text-ink text-[12px] font-semibold rounded-[6px] hover:bg-gold-hover transition-colors"
        >
          Request again
        </button>
      </div>
    );
  }

  if (phase === 'ready') {
    const expiresAt = accessExpiresAt
      ? ACCESS_EXPIRES.format(new Date(accessExpiresAt))
      : null;
    return (
      <div>
        {expiresAt && (
          <p className="mb-4 text-text-subtle text-[12px]">
            Access expires {expiresAt}
          </p>
        )}
        <ul className="divide-y divide-border">
          {clients.map((client, clientIndex) => (
            <li key={`${client.full_name}-${clientIndex}`} className="py-3">
              <p className="mb-1.5 text-text-main text-[13px] font-medium">{client.full_name}</p>
              {client.vehicles.length === 0 ? (
                <p className="text-text-subtle text-[12px]">No vehicles on file</p>
              ) : (
                <ul className="space-y-1">
                  {client.vehicles.map((vehicle, vehicleIndex) => (
                    <li
                      key={`${vehicle.license_plate ?? vehicleIndex}-${vehicleIndex}`}
                      className="flex flex-wrap items-baseline gap-x-2 text-[12px]"
                    >
                      <span className="text-text-muted">{vehicle.location ?? '—'}</span>
                      <span className="text-text-subtle" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-text-muted">
                        {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
                      </span>
                      {vehicle.license_plate && (
                        <span className="font-mono text-text-subtle">{vehicle.license_plate}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {clients.length === 0 && (
          <p className="text-text-muted text-[12px]">No clients on record.</p>
        )}
        <p className="mt-4 text-text-subtle text-[11px]">
          Viewing only — no export available.
        </p>
      </div>
    );
  }

  if (phase === 'pending') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full bg-gold animate-pulse-live"
            aria-hidden="true"
          />
          <span className="text-text-main text-[13px]">
            Request sent — waiting for Enaya admin approval
          </span>
        </div>
        <p className="text-text-subtle text-[12px] leading-relaxed">
          This page will refresh automatically until your request is approved.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="w-3 h-3 rounded-full bg-gold animate-pulse-live" aria-hidden="true" />
      <span className="text-text-muted text-[13px]">Requesting access…</span>
    </div>
  );
}