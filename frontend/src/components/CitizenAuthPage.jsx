import { useState } from 'react';

export default function CitizenAuthPage({ mode, onNavigate, onAuthenticated }) {
  const isSignup = mode === 'signup';
  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (isSignup && values.password !== values.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await onAuthenticated(isSignup
        ? { fullName: values.fullName, email: values.email, password: values.password }
        : { email: values.email, password: values.password });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="citizen-auth-page">
      <section className="auth-story">
        <a className="brand auth-brand" href="/" onClick={(event) => {
          event.preventDefault();
          onNavigate('/');
        }}>
          <span className="brand-mark">N</span>
          <span className="brand-name">newgen<span>city</span></span>
        </a>
        <div className="auth-story-copy">
          <span className="hero-kicker"><i /> SONIPAT · CITIZEN SERVICES</span>
          <h1>Your voice<br />moves the <em>city.</em></h1>
          <p>Report local issues, follow every update, and help your city team focus on what matters.</p>
          <div className="auth-benefits">
            <span><i>01</i> One account for your city reports</span>
            <span><i>02</i> Case updates, from triage to resolution</span>
            <span><i>03</i> Your details stay out of public case feeds</span>
          </div>
        </div>
        <span className="auth-story-footer">NEWGEN CITY <i>·</i> SONIPAT, HARYANA</span>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <a className="auth-back-link" href="/" onClick={(event) => {
            event.preventDefault();
            onNavigate('/');
          }}>← Back to city overview</a>
          <div className="auth-heading">
            <span className="auth-icon" aria-hidden="true">{isSignup ? '＋' : '↗'}</span>
            <p className="eyebrow">CITIZEN PORTAL</p>
            <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
            <p>{isSignup
              ? 'Join NewGen City to keep your civic reports together.'
              : 'Sign in to see the reports you have shared with the city.'}</p>
          </div>

          <form className="citizen-auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  maxLength="100"
                  minLength="2"
                  required
                  value={values.fullName}
                  onChange={(event) => setValues({ ...values, fullName: event.target.value })}
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                autoComplete="email"
                autoCapitalize="none"
                maxLength="254"
                required
                type="email"
                value={values.email}
                onChange={(event) => setValues({ ...values, email: event.target.value })}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                maxLength="128"
                minLength={isSignup ? '10' : undefined}
                required
                type="password"
                value={values.password}
                onChange={(event) => setValues({ ...values, password: event.target.value })}
                placeholder={isSignup ? 'At least 10 characters' : 'Your password'}
              />
              {isSignup && <small>Use 10 or more characters.</small>}
            </label>
            {isSignup && (
              <label>
                Confirm password
                <input
                  autoComplete="new-password"
                  maxLength="128"
                  required
                  type="password"
                  value={values.confirmPassword}
                  onChange={(event) => setValues({ ...values, confirmPassword: event.target.value })}
                  placeholder="Enter your password again"
                />
              </label>
            )}
            {error && <p className="form-message error" role="alert">{error}</p>}
            <button className="button primary full-width auth-submit" disabled={busy}>
              {busy
                ? (isSignup ? 'Creating account…' : 'Signing in…')
                : (isSignup ? 'Create citizen account' : 'Sign in to NewGen City')}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New to NewGen City?'}
            {' '}
            <button type="button" onClick={() => onNavigate(isSignup ? '/signin' : '/signup')}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="auth-disclaimer">Citizen accounts are separate from staff operations access.</p>
        </div>
      </section>
    </main>
  );
}
