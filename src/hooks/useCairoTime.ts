import { useEffect, useState } from 'react';

const CAIRO_TIME_OPTIONS = {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
} as const;

const CAIRO_DATE_OPTIONS = {
  timeZone: 'Africa/Cairo',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
} as const;

function cairoTimeNow(): string {
  return new Date().toLocaleTimeString('en-US', CAIRO_TIME_OPTIONS);
}

function cairoDateToday(): string {
  return new Date().toLocaleDateString('en-GB', CAIRO_DATE_OPTIONS);
}

export function useCairoTime(): string {
  const [time, setTime] = useState(cairoTimeNow);

  useEffect(() => {
    const id = setInterval(() => setTime(cairoTimeNow()), 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

export function useCairoDate(): string {
  const [date] = useState(cairoDateToday);
  return date;
}