import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ClientRosterResponse, RosterClient, RosterRequestResponse } from '../types';

export type RosterPhase = 'requesting' | 'pending' | 'ready' | 'expired' | 'error';

const POLL_INTERVAL_MS = 10_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const REQUEST_ERROR_MESSAGE = "Couldn't load your clients right now.";

export interface UseClientRoster {
  phase: RosterPhase;
  clients: RosterClient[];
  accessExpiresAt: string | null;
  error: string | null;
  open: () => void;
  retry: () => void;
  close: () => void;
}

type FetchOutcome = 'ready' | 'pending' | 'expired' | 'error';

export function useClientRoster(sessionToken: string | null): UseClientRoster {
  const [phase, setPhase] = useState<RosterPhase>('requesting');
  const [clients, setClients] = useState<RosterClient[]>([]);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearExpiry = useCallback(() => {
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
  }, []);

  const fetchRoster = useCallback(async (): Promise<FetchOutcome> => {
    if (!sessionToken) return 'error';
    const { data, error: rpcError } = await supabase.rpc('compound_get_client_roster', {
      p_session_token: sessionToken,
    });
    if (rpcError) {
      const message = String(rpcError.message ?? rpcError);
      if (message.includes('ROSTER_ACCESS_NOT_GRANTED')) return 'pending';
      return 'error';
    }

    const response = data as ClientRosterResponse;
    setClients(response.clients ?? []);
    setAccessExpiresAt(response.access_expires_at ?? null);

    clearExpiry();
    const remainingMs = new Date(response.access_expires_at).getTime() - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'expired';
    expiryRef.current = setTimeout(() => {
      clearPoll();
      setPhase('expired');
    }, Math.min(remainingMs, MAX_TIMEOUT_MS));
    return 'ready';
  }, [sessionToken, clearExpiry, clearPoll]);

  const requestRoster = useCallback(async (): Promise<'pending' | 'ready' | 'error'> => {
    if (!sessionToken) return 'error';
    const { data, error: rpcError } = await supabase.rpc('compound_request_client_roster', {
      p_session_token: sessionToken,
    });
    if (rpcError) return 'error';

    const response = data as RosterRequestResponse;
    if (response.already_granted) {
      const outcome = await fetchRoster();
      if (outcome === 'error') return 'error';
      if (outcome === 'expired') return 'pending';
      return 'ready';
    }
    return 'pending';
  }, [sessionToken, fetchRoster]);

  const open = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setError(null);
    setPhase('requesting');

    void (async () => {
      const outcome = await requestRoster();
      if (!startedRef.current) return;
      if (outcome === 'ready') {
        setPhase('ready');
        return;
      }
      if (outcome === 'error') {
        setError(REQUEST_ERROR_MESSAGE);
        setPhase('error');
        return;
      }

      // Pending approval — poll until granted or the window closes.
      setPhase('pending');
      clearPoll();
      pollRef.current = setInterval(() => {
        void (async () => {
          const result = await fetchRoster();
          if (!startedRef.current) {
            clearPoll();
            return;
          }
          if (result === 'ready') {
            clearPoll();
            setPhase('ready');
          } else if (result === 'expired') {
            clearPoll();
            setPhase('expired');
          } else if (result === 'error') {
            clearPoll();
            setError(REQUEST_ERROR_MESSAGE);
            setPhase('error');
          }
        })();
      }, POLL_INTERVAL_MS);
    })();
  }, [requestRoster, fetchRoster, clearPoll]);

  const retry = useCallback(() => {
    startedRef.current = false;
    open();
  }, [open]);

  const close = useCallback(() => {
    startedRef.current = false;
    clearPoll();
    clearExpiry();
  }, [clearPoll, clearExpiry]);

  useEffect(() => () => close(), [close]);

  return { phase, clients, accessExpiresAt, error, open, retry, close };
}