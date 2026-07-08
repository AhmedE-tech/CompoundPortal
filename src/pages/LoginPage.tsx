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
      <div className="w-full max-w-[380px]">
        <div className="bg-white rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-border p-9">
          {/* Title */}
          <h1 className="text-center text-[1.35rem] text-text-main mb-1.5">Enaya</h1>
          <p className="text-center text-text-muted text-[12.5px] mb-7">Compound Portal</p>

          {/* Forced logout message */}
          {forcedMessage && (
            <div className="mb-4 p-3 bg-error/10 border border-error/20 text-error text-[12px] rounded-[6px]">
              {forcedMessage}
            </div>
          )}

          {/* ALREADY_LOGGED_IN blocking state */}
          {loginErrorType === 'ALREADY_LOGGED_IN' ? (
            <div className="text-center py-6">
              <p className="text-text-main text-[15px] font-medium leading-relaxed mb-3">
                This compound is already logged in from another device.
              </p>
              <p className="text-text-muted text-[12.5px] leading-relaxed mb-2">
                To keep costs and security controlled, only one device can watch at a time.
                Please log out from the other device first.
              </p>
              <p className="text-text-muted text-[12.5px] leading-relaxed mb-5">
                If you can't access the other device, contact Enaya support to force a logout.
              </p>
              <div className="text-[12.5px] text-text-muted">
                <p>Support: +20 X XXX XXXX</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-[18px]">
                <label htmlFor="email" className="block mb-1.5 font-medium text-[12px] text-text-main">
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
                  className="w-full px-2.5 py-2 rounded-[6px] border border-border bg-white text-text-main text-[13px] outline-none transition-colors focus:border-gold"
                  placeholder="you@compound.com"
                  disabled={status === 'loading'}
                />
              </div>

              <div className="mb-[18px]">
                <label htmlFor="password" className="block mb-1.5 font-medium text-[12px] text-text-main">
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
                  className="w-full px-2.5 py-2 rounded-[6px] border border-border bg-white text-text-main text-[13px] outline-none transition-colors focus:border-gold"
                  placeholder="••••••••"
                  disabled={status === 'loading'}
                />
              </div>

              {error && loginErrorType !== 'ALREADY_LOGGED_IN' && (
                <p className="text-error text-[12px] mt-[-8px] mb-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading' || !email || !password}
                className="w-full py-2.5 bg-gold text-white rounded-[6px] font-semibold text-[13px] transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[12px] text-text-muted mt-6">
          Enaya Compound Portal · v1.0
        </p>
      </div>
    </div>
  );
}
