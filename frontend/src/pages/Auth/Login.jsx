import { useEffect, useRef, useState } from 'react'
import './auth.css'

function Login({ role, onSubmit, onBack, onSignupClick, onGuestClick }) {
  const [email,     setEmail]    = useState('')
  const [password,  setPassword] = useState('')
  const [showPass,  setShowPass] = useState(false)
  const [error,     setError]    = useState('')
  const [isLoading, setIsLoading]= useState(false)
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)

  useEffect(() => {
    setEmail('')
    setPassword('')
    setError('')

    const clearAutofill = () => {
      if (document.activeElement !== emailInputRef.current && emailInputRef.current) {
        emailInputRef.current.value = ''
      }
      if (document.activeElement !== passwordInputRef.current && passwordInputRef.current) {
        passwordInputRef.current.value = ''
      }
      setEmail('')
      setPassword('')
    }

    const frameId = window.requestAnimationFrame(clearAutofill)
    const timerId = window.setTimeout(clearAutofill, 120)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timerId)
    }
  }, [role])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await onSubmit?.({ email, password, role })
    } catch (err) {
      setError(err?.message ?? 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleLabel = () => ({
    manufacturer: 'Manufacturer',
    transporter:  'Transporter',
    dealer:       'Dealer',
    retail:       'Retail Shop',
    retailshop:   'Retail Shop',
    admin:        'Admin',
    Admin:        'Admin',
    Manufacturer: 'Manufacturer',
    Transporter:  'Transporter',
    Dealer:       'Dealer',
    RetailShop:   'Retail Shop',
  })[role] || role

  return (
    <main className="auth-scene">
      <form onSubmit={handleSubmit} className="auth-panel" autoComplete="off">

        {/* ── Role Badge ── */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 14px',
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.25)',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#22d3ee',
            marginBottom: 16,
          }}>
            {getRoleLabel()}
          </div>
        </div>

        {/* ── Title ── */}
        <h2 className="auth-panel-title">Welcome Back</h2>
        <p className="auth-panel-subtitle">
          Sign in to your {getRoleLabel()} account
        </p>

        {/* ── Email ── */}
        <div className="auth-field-group">
          <label htmlFor="login-email" className="auth-field-label">
            Email Address
          </label>
          <input
            ref={emailInputRef}
            id="login-email"
            type="email"
            name="login_identifier"
            required
            placeholder="you@example.com"
            className="auth-field-input"
            autoComplete="off"
            data-lpignore="true"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* ── Password ── */}
        <div className="auth-field-group">
          <label htmlFor="login-password" className="auth-field-label">
            Password
          </label>
          <div className="auth-password-wrapper">
            <input
              ref={passwordInputRef}
              id="login-password"
              type={showPass ? 'text' : 'password'}
              name="login_secret"
              required
              placeholder="Enter your password"
              className="auth-field-input"
              autoComplete="new-password"
              data-lpignore="true"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {!!error && <div className="auth-error-box">{error}</div>}

        {/* ── Actions ── */}
        <div className="auth-actions">

          {/* LOGIN only */}
          <button
            type="submit"
            disabled={isLoading}
            className="auth-btn-primary"
          >
            {isLoading ? 'Signing in...' : 'Login'}
          </button>

          {/* GUEST */}
          <button
            type="button"
            onClick={onGuestClick}
            disabled={isLoading}
            className="auth-btn-guest"
          >
            Continue as Guest
          </button>

          {/* BACK */}
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="auth-btn-ghost"
          >
            Back
          </button>

        </div>

        {/* ── Switch to signup ── */}
        <p className="auth-switch-row">
          Don't have an account?{' '}
          <button
            type="button"
            className="auth-switch-link"
            onClick={onSignupClick}
          >
            Sign up free
          </button>
        </p>

      </form>
    </main>
  )
}

export default Login

