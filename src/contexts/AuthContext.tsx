import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getDeviceFingerprint } from '../utils/fingerprint';
import type { CompoundInfo, UserInfo } from '../types';

interface AuthState {
  authenticated: boolean;
  sessionToken: string | null;
  compound: CompoundInfo | null;
  user: UserInfo | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  loginErrorType: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: (message: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function mapErrorType(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('ALREADY_LOGGED_IN')) return 'ALREADY_LOGGED_IN';
  if (msg.includes('NOT_A_COMPOUND_USER')) return 'INVALID_CREDENTIALS';
  if (msg.includes('COMPOUND_INACTIVE')) return 'COMPOUND_INACTIVE';
  if (msg.includes('ACCOUNT_SUSPENDED')) return 'ACCOUNT_SUSPENDED';
  return 'GENERIC';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    sessionToken: null,
    compound: null,
    user: null,
    status: 'idle',
    error: null,
    loginErrorType: null,
  });

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    sessionTokenRef.current = state.sessionToken;
  }, [state.sessionToken]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null, status: 'idle', loginErrorType: null }));
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      if (document.hidden) return;
      const token = sessionTokenRef.current;
      if (!token) return;
      const { error } = await supabase.rpc('compound_heartbeat', {
        p_session_token: token,
      });
      if (error) {
        stopHeartbeat();
        await forceLogoutInner('You were logged out. Please sign in again.');
      }
    }, 30_000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const clearAllState = useCallback(() => {
    stopHeartbeat();
    setState({
      authenticated: false,
      sessionToken: null,
      compound: null,
      user: null,
      status: 'idle',
      error: null,
      loginErrorType: null,
    });
  }, [stopHeartbeat]);

  const forceLogoutInner = useCallback(
    async (message: string) => {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      clearAllState();
      navigate('/login', { state: { message } });
    },
    [clearAllState, navigate],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, status: 'loading', error: null, loginErrorType: null }));

      // If there's an existing Supabase session, sign out first
      const { data: existingSession } = await supabase.auth.getSession();
      if (existingSession.session) {
        await supabase.auth.signOut();
      }

      // Step 1: Supabase Auth
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authErr) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: 'Email or password is incorrect.',
          loginErrorType: 'INVALID_CREDENTIALS',
        }));
        return;
      }

      // Step 2: Claim compound session
      try {
        const fingerprint = await getDeviceFingerprint();
        const { data, error } = await supabase.rpc('compound_claim_session', {
          p_device_fingerprint: fingerprint,
          p_user_agent: navigator.userAgent,
          p_ip: null,
        });

        if (error) {
          const errorType = mapErrorType(error);
          await supabase.auth.signOut();

          if (errorType === 'ALREADY_LOGGED_IN') {
            setState((s) => ({
              ...s,
              status: 'error',
              error: 'ALREADY_LOGGED_IN',
              loginErrorType: 'ALREADY_LOGGED_IN',
            }));
          } else if (errorType === 'COMPOUND_INACTIVE') {
            setState((s) => ({
              ...s,
              status: 'error',
              error: 'This compound partnership is currently inactive. Contact Enaya support.',
              loginErrorType: 'COMPOUND_INACTIVE',
            }));
          } else if (errorType === 'ACCOUNT_SUSPENDED') {
            setState((s) => ({
              ...s,
              status: 'error',
              error: 'This account has been suspended. Contact Enaya support.',
              loginErrorType: 'ACCOUNT_SUSPENDED',
            }));
          } else {
            setState((s) => ({
              ...s,
              status: 'error',
              error: 'Email or password is incorrect.',
              loginErrorType: 'INVALID_CREDENTIALS',
            }));
          }
          return;
        }

        setState({
          authenticated: true,
          sessionToken: data.session_token,
          compound: data.compound,
          user: data.user,
          status: 'idle',
          error: null,
          loginErrorType: null,
        });

        startHeartbeat();
        navigate('/dashboard');
      } catch (err) {
        await supabase.auth.signOut();
        setState((s) => ({
          ...s,
          status: 'error',
          error: 'Something went wrong. Please try again or contact support.',
          loginErrorType: 'GENERIC',
        }));
      }
    },
    [startHeartbeat, navigate],
  );

  const logout = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (token) {
      try {
        await supabase.rpc('compound_logout', { p_session_token: token });
      } catch {
        // ignore
      }
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    clearAllState();
    navigate('/login');
  }, [clearAllState, navigate]);

  // On mount: if there's a Supabase session but no session token, sign out (refresh = re-auth)
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && !state.sessionToken) {
        await supabase.auth.signOut();
      }
    };
    checkSession();
  }, []);

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => stopHeartbeat();
  }, [stopHeartbeat]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        forceLogout: forceLogoutInner,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
