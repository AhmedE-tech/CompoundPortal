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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-ink)',
        padding: '16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div
          style={{
            background: 'var(--color-bg-surface-1)',
            padding: '36px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            width: '100%',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Logo — the real gold Enaya mark, with a barely-visible gold halo (decorative only) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '22px',
              position: 'relative',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: -24,
                background:
                  'radial-gradient(closest-side, rgba(201,162,39,0.10), transparent)',
              }}
            />
            <img
              src="/enaya-logo.png"
              alt="Enaya"
              width="180"
              height="115"
              style={{ height: 'auto', position: 'relative', display: 'block' }}
            />
          </div>

          {/* Caption */}
          <p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              marginBottom: '28px',
              fontSize: '11px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            Compound Portal
          </p>

          {/* Forced logout message */}
          {forcedMessage && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                background: 'rgba(229, 72, 77, 0.12)',
                border: '1px solid rgba(229, 72, 77, 0.22)',
                color: 'var(--color-error)',
                fontSize: '12px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {forcedMessage}
            </div>
          )}

          {/* ALREADY_LOGGED_IN blocking state */}
          {loginErrorType === 'ALREADY_LOGGED_IN' ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p
                style={{
                  color: 'var(--color-text-main)',
                  fontSize: '15px',
                  fontWeight: 500,
                  lineHeight: 1.6,
                  marginBottom: '16px',
                }}
              >
                This compound is already logged in from another device.
              </p>
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '12.5px',
                  lineHeight: 1.6,
                  marginBottom: '8px',
                }}
              >
                To keep costs and security controlled, only one device can watch at a time.
                Please log out from the other device first.
              </p>
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '12.5px',
                  lineHeight: 1.6,
                  marginBottom: '20px',
                }}
              >
                If you can't access the other device, contact Enaya support to force a logout.
              </p>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                <p>Support: +20 X XXX XXXX</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label
                  htmlFor="email"
                  className="form-label"
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontWeight: 500,
                    fontSize: '12px',
                  }}
                >
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
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    background: 'var(--color-bg-surface-2)',
                    color: 'var(--color-text-main)',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  placeholder="you@compound.com"
                  disabled={status === 'loading'}
                  onFocus={(e) => {
                    const el = e.target as HTMLInputElement;
                    el.style.borderColor = 'var(--color-gold-accent)';
                    el.style.boxShadow = '0 0 0 3px var(--color-gold-tint)';
                  }}
                  onBlur={(e) => {
                    const el = e.target as HTMLInputElement;
                    el.style.borderColor = 'var(--color-border)';
                    el.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label
                  htmlFor="password"
                  className="form-label"
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontWeight: 500,
                    fontSize: '12px',
                  }}
                >
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
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    background: 'var(--color-bg-surface-2)',
                    color: 'var(--color-text-main)',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  placeholder="••••••••"
                  disabled={status === 'loading'}
                  onFocus={(e) => {
                    const el = e.target as HTMLInputElement;
                    el.style.borderColor = 'var(--color-gold-accent)';
                    el.style.boxShadow = '0 0 0 3px var(--color-gold-tint)';
                  }}
                  onBlur={(e) => {
                    const el = e.target as HTMLInputElement;
                    el.style.borderColor = 'var(--color-border)';
                    el.style.boxShadow = 'none';
                  }}
                />
              </div>

              {error && loginErrorType !== 'ALREADY_LOGGED_IN' && (
                <p
                  className="error-message"
                  style={{
                    color: 'var(--color-error)',
                    fontSize: '12px',
                    marginTop: '-8px',
                    marginBottom: '12px',
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading' || !email || !password}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--color-gold-accent)',
                  color: '#0E0F12',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '13px',
                  transition: 'background 0.2s',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: status === 'loading' || !email || !password ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!(status === 'loading' || !email || !password)) {
                    (e.target as HTMLButtonElement).style.backgroundColor = 'var(--color-gold-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--color-gold-accent)';
                }}
              >
                {status === 'loading' ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--color-text-subtle)',
            marginTop: '24px',
          }}
        >
          Enaya Compound Portal · v1.0
        </p>
      </div>
    </div>
  );
}