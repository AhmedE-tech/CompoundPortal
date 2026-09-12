import { useRef } from 'react';
import { Clock, Lock, X } from 'lucide-react';
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

function GoldCta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-gold px-5 py-2.5 text-[12px] font-semibold text-ink transition-colors hover:bg-gold-hover"
    >
      {children}
    </button>
  );
}

function PendingRing() {
  return (
    <div className="relative mx-auto mb-[22px] grid h-[76px] w-[76px] place-items-center rounded-full bg-gold-tint">
      <span
        aria-hidden="true"
        className="absolute -inset-1 rounded-full border-2 border-transparent border-t-gold border-r-gold-soft animate-spin-slow"
      />
      <Lock size={32} className="text-gold-soft" />
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
  const { user, compound } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const { paused, resume } = useScreenshotDeterrence(panelRef);
  const showWatermark = roster.phase === 'ready';

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[rgba(6,7,9,0.78)] p-5 backdrop-blur-[3px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Client roster"
        className="relative w-full max-w-[440px] max-h-[80vh] overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,var(--color-surface-2),var(--color-surface-1))] border border-border-strong rounded-[var(--radius-lg)] shadow-md"
      >
        {showWatermark && <WatermarkOverlay displayName={user?.display_name ?? 'Enaya'} />}

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4 border-b border-border px-[22px] py-5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 className="text-[15px] font-semibold text-text-main">Client Roster</h3>
              <span className="truncate text-[11.5px] text-text-subtle">
                {compound?.name ?? user?.display_name}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close client roster"
              className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] bg-surface-3 text-text-muted transition-all hover:bg-surface-hover hover:text-text-main"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-[28px] py-[34px]" aria-live="polite">
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
      <div className="text-center">
        <h4 className="mb-2.5 text-[17px] font-semibold tracking-[-0.01em] text-text-main">
          Request interrupted
        </h4>
        <p className="mx-auto max-w-[320px] text-[13px] leading-[1.6] text-text-muted">
          {error ?? "Couldn't reach the client roster right now."}
        </p>
        <div className="mt-5">
          <GoldCta onClick={roster.retry}>Try again</GoldCta>
        </div>
      </div>
    );
  }

  if (phase === 'expired') {
    return (
      <div className="text-center">
        <h4 className="mb-2.5 text-[17px] font-semibold tracking-[-0.01em] text-text-main">
          Your client access has expired.
        </h4>
        <p className="mx-auto max-w-[320px] text-[13px] leading-[1.6] text-text-muted">
          Request approval again to keep viewing.
        </p>
        <div className="mt-5">
          <GoldCta onClick={roster.retry}>Request again</GoldCta>
        </div>
      </div>
    );
  }

  if (phase === 'ready') {
    const expiresAt = accessExpiresAt
      ? ACCESS_EXPIRES.format(new Date(accessExpiresAt))
      : null;
    return (
      <div className="text-left">
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

  return (
    <div className="text-center">
      <PendingRing />
      <h4 className="mb-2.5 text-[17px] font-semibold tracking-[-0.01em] text-text-main">
        Request sent
      </h4>
      <p className="mx-auto max-w-[320px] text-[13px] leading-[1.6] text-text-muted">
        We've asked Enaya to approve your access to this compound's client roster. This window will
        open automatically once it's granted.
      </p>
      <div className="mt-5 inline-flex items-center justify-center gap-2.5 rounded-[var(--radius-sm)] bg-surface-3 px-4 py-3 text-[12px] text-text-subtle">
        <Clock size={15} className="shrink-0 text-gold-soft" />
        Waiting for admin approval — refreshing automatically
      </div>
    </div>
  );
}