import { useEffect, useState, type RefObject } from 'react';

// Deterrence only — the web cannot block OS screenshots; the real control
// is the request-approval gate. Applies light friction, not a guarantee.

const CAIRO_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function useWatermarkStamp(): string {
  const [stamp, setStamp] = useState(() => CAIRO_CLOCK.format(new Date()));

  useEffect(() => {
    const id = setInterval(() => setStamp(CAIRO_CLOCK.format(new Date())), 15_000);
    return () => clearInterval(id);
  }, []);

  return stamp;
}

export function useScreenshotDeterrence(
  rootRef: RefObject<HTMLElement | null>,
): { paused: boolean; resume: () => void } {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prevUserSelect = root.style.userSelect;
    root.style.userSelect = 'none';

    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('beforeprint', prevent);

    const onBlur = () => setPaused(true);
    window.addEventListener('blur', onBlur);

    return () => {
      root.style.userSelect = prevUserSelect;
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('beforeprint', prevent);
      window.removeEventListener('blur', onBlur);
    };
  }, [rootRef]);

  const resume = () => setPaused(false);

  return { paused, resume };
}