import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, status, error, loginErrorType, clearError } = useAuth();
  const location = useLocation();
  const forcedMessage = (location.state as { message?: string } | null)?.message;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await login(email, password);
  };

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <h1 className="font-display text-gold text-2xl tracking-wide">Enaya</h1>
          <p className="font-display text-slate text-lg mt-2">Compound Portal</p>
          <div className="h-px bg-slate-line mt-6" />
        </div>

        {/* Forced logout message */}
        {forcedMessage && (
          <div className="mb-4 p-3 bg-live-red/10 border border-live-red/20 text-live-red text-sm rounded-sm">
            {forcedMessage}
          </div>
        )}

        {/* ALREADY_LOGGED_IN blocking state */}
        {loginErrorType === 'ALREADY_LOGGED_IN' ? (
          <div className="text-center py-8">
            <p className="text-slate font-display text-lg leading-relaxed mb-4">
              This compound is already logged in from another device.
            </p>
            <p className="text-slate-muted text-sm leading-relaxed mb-2">
              To keep costs and security controlled, only one device can watch at a time.
              Please log out from the other device first.
            </p>
            <p className="text-slate-muted text-sm leading-relaxed mb-6">
              If you can't access the other device, contact Enaya support to force a logout.
            </p>
            <div className="text-sm text-slate-muted">
              <p>Support: +20 X XXX XXXX</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs text-slate-muted uppercase tracking-wider mb-1">
                Compound email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) clearError();
                }}
                className="w-full px-3 py-2.5 bg-ivory border border-slate-line text-slate text-base rounded-sm focus:outline-none focus:border-gold transition-colors"
                placeholder="you@compound.com"
                disabled={status === 'loading'}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs text-slate-muted uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                className="w-full px-3 py-2.5 bg-ivory border border-slate-line text-slate text-base rounded-sm focus:outline-none focus:border-gold transition-colors"
                placeholder="••••••••"
                disabled={status === 'loading'}
              />
            </div>

            {error && loginErrorType !== 'ALREADY_LOGGED_IN' && (
              <p className="text-live-red text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !email || !password}
              className="w-full py-2.5 bg-gold text-slate text-sm uppercase tracking-[0.08em] font-medium rounded-sm hover:bg-gold-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {status === 'loading' ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-muted mt-8">
          Enaya Compound Portal · v1.0
        </p>
      </div>
    </div>
  );
}
