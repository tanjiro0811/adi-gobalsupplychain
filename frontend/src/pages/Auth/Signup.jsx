import { useState } from 'react'
import { authApi } from '../../api/axiosInstance'
import './signup.css'

function Signup({ role, onSubmit, onBack }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // OTP verification states
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [tempFormData, setTempFormData] = useState(null)

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const validatePassword = (pwd) => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number'
    }
    if (!/[!@#$%^&*]/.test(pwd)) {
      return 'Password must contain at least one special character (!@#$%^&*)'
    }
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    // Validation
    if (!name.trim()) {
      setError('Please enter your full name')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      await authApi.post('/auth/send-otp', { email, name })

      // Store form data temporarily
      setTempFormData({ name, email, password, role })

      // Show OTP modal
      setShowOtpModal(true)
      startResendTimer()
    } catch (submitError) {
      setError(submitError?.message ?? 'Failed to send verification code')
    } finally {
      setIsLoading(false)
    }
  }

  const startResendTimer = () => {
    setResendTimer(60)
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value.slice(-1) // Take only last character

    setOtp(newOtp)
    setOtpError('')

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    const otpValue = otp.join('')

    if (otpValue.length !== 6) {
      setOtpError('Please enter complete 6-digit OTP')
      return
    }

    setIsVerifyingOtp(true)
    setOtpError('')

    try {
      await authApi.post('/auth/verify-otp', { email: tempFormData.email, otp: otpValue })

      // If OTP is valid, create account
      await onSubmit?.(tempFormData)

      setShowOtpModal(false)
    } catch (verifyError) {
      setOtpError(verifyError?.message ?? 'OTP verification failed. Please try again.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendTimer > 0) return

    try {
      await authApi.post('/auth/send-otp', {
        email: tempFormData.email,
        name: tempFormData.name,
      })

      setOtp(['', '', '', '', '', ''])
      setOtpError('')
      startResendTimer()
    } catch (resendError) {
      setOtpError(resendError?.message ?? 'Failed to resend OTP')
    }
  }

  const handleCloseOtpModal = () => {
    setShowOtpModal(false)
    setOtp(['', '', '', '', '', ''])
    setOtpError('')
    setTempFormData(null)
  }

  const getPasswordStrength = () => {
    if (!password) return null

    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[!@#$%^&*]/.test(password)) strength++

    if (strength <= 2) return { label: 'Weak', color: '#ef4444' }
    if (strength <= 3) return { label: 'Medium', color: '#f59e0b' }
    if (strength <= 4) return { label: 'Good', color: '#3b82f6' }
    return { label: 'Strong', color: '#22c55e' }
  }

  const passwordStrength = getPasswordStrength()

  return (
    <main className="auth-scene auth-signup-theme">
      <form onSubmit={handleSubmit} className="auth-panel auth-signup-panel">
        <h2 className="auth-panel-title">
          Signup
          <span className="signup-role-label">({role})</span>
        </h2>
        <p className="auth-panel-subtitle">Create your account to continue.</p>

        <div className="auth-field-group">
          <label htmlFor="signup-name" className="auth-field-label">
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            required
            placeholder="Enter your full name"
            className="auth-field-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="auth-field-group">
          <label htmlFor="signup-email" className="auth-field-label">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            placeholder="your.email@example.com"
            className="auth-field-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="auth-field-group">
          <label htmlFor="signup-password" className="auth-field-label">
            Create Password
          </label>
          <div className="auth-password-wrapper">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="At least 8 characters"
              className="auth-field-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Show Less' : 'Show'}
            </button>
          </div>

          {password && passwordStrength && (
            <div className="password-strength-container">
              <div className="password-strength-bar">
                <div
                  className="password-strength-fill"
                  style={{
                    width: `${passwordStrength.label === 'Weak' ? 25 : passwordStrength.label === 'Medium' ? 50 : passwordStrength.label === 'Good' ? 75 : 100}%`,
                    backgroundColor: passwordStrength.color,
                  }}
                ></div>
              </div>
              <span className="password-strength-label" style={{ color: passwordStrength.color }}>
                {passwordStrength.label}
              </span>
            </div>
          )}

          <p className="auth-field-hint">
            Must contain: 8+ characters, uppercase, lowercase, number, special character
          </p>
        </div>

        <div className="auth-field-group">
          <label htmlFor="signup-confirm-password" className="auth-field-label">
            Confirm Password
          </label>
          <div className="auth-password-wrapper">
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              placeholder="Re-enter your password"
              className="auth-field-input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? 'Show Less' : 'Show'}
            </button>
          </div>

          {confirmPassword && (
            <p className={`password-match-indicator ${password === confirmPassword ? 'match' : 'no-match'}`}>
              {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
            </p>
          )}
        </div>

        {!!error && <div className="auth-error-box">{error}</div>}

        <div className="auth-actions">
          <button type="submit" disabled={isLoading} className="auth-btn-primary">
            {isLoading ? 'Sending verification code...' : 'Continue'}
          </button>
          <button type="button" onClick={onBack} disabled={isLoading} className="auth-btn-ghost">
            Back
          </button>
        </div>
      </form>

      {showOtpModal && (
        <div className="otp-modal-overlay" onClick={handleCloseOtpModal}>
          <div className="otp-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="otp-modal-close" onClick={handleCloseOtpModal}>x</button>

            <div className="otp-modal-header">
              <div className="otp-icon">OTP</div>
              <h3 className="otp-modal-title">Verify Your Email</h3>
              <p className="otp-modal-subtitle">
                We have sent a 6-digit code to
                <br />
                <strong>{email}</strong>
              </p>
            </div>

            <div className="otp-input-container">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength="1"
                  className="otp-input"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {otpError && <div className="auth-error-box">{otpError}</div>}

            <button
              type="button"
              className="auth-btn-primary"
              onClick={handleVerifyOtp}
              disabled={isVerifyingOtp || otp.join('').length !== 6}
            >
              {isVerifyingOtp ? 'Verifying...' : 'Verify and Create Account'}
            </button>

            <div className="otp-resend-container">
              {resendTimer > 0 ? (
                <p className="otp-resend-timer">Resend code in {resendTimer}s</p>
              ) : (
                <button type="button" className="otp-resend-button" onClick={handleResendOtp}>
                  Resend Code
                </button>
              )}
            </div>

            <p className="otp-help-text">
              Did not receive the code? Check spam or click resend.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}

export default Signup
