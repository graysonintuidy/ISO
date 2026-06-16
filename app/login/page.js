'use client';

import { useState } from 'react';
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import styles from './page.module.css';

const LOGO_URL = 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid email or password');
        setLoading(false);
        return;
      }

      // Success — full page navigation so AuthProvider remounts with the new cookie
      window.location.href = '/';
    } catch (err) {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        {/* Branding */}
        <div className={styles.brandSection}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.brandLogo}
            src={LOGO_URL}
            alt="National Beef logo"
          />
          <h1 className={styles.brandTitle}>AI Safety Monitor</h1>
          <p className={styles.brandSubtitle}>Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Error Message */}
          {error && (
            <div className={styles.errorMessage}>
              <AlertCircle size={16} className={styles.errorIcon} />
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="login-email">
              Email Address
            </label>
            <div className={styles.inputWrapper}>
              <Mail size={16} className={styles.inputIcon} />
              <input
                id="login-email"
                className={styles.input}
                type="email"
                placeholder="name@nationalbeef.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="login-password">
              Password
            </label>
            <div className={styles.inputWrapper}>
              <Lock size={16} className={styles.inputIcon} />
              <input
                id="login-password"
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className={styles.optionsRow}>
            <label className={styles.rememberLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || !email || !password}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              <>
                <LogIn size={16} />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className={styles.footer}>
          <p className={styles.footerText}>
            <Shield size={12} />
            Protected by Intuidy AI Platform
          </p>
        </div>
      </div>
    </div>
  );
}
