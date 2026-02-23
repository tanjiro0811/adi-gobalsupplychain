import { useState } from 'react'
import { createGuestWithDetails } from '../../auth/guestAccess'
import './guestform.css'

function GuestForm({ role, onSubmit, onBack }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const submitGuest = async (payload) => {
    setError('')
    setIsLoading(true)
    try {
      await onSubmit?.(payload)
    } catch (submitError) {
      setError(submitError?.message ?? 'Guest access failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const guestData = createGuestWithDetails(formData, role)
    await submitGuest(guestData)
  }

  return (
    <main className="auth-scene auth-guest-theme">
      <form onSubmit={handleSubmit} className="auth-panel guest-form auth-guest-panel">
        <div className="auth-header">
          <div className="guest-icon">G</div>
          <h2 className="auth-panel-title">Guest Access</h2>
          <p className="auth-panel-subtitle">Explore the {role} dashboard with read-only access.</p>
        </div>

        <div className="auth-field-group">
          <label htmlFor="guest-name" className="auth-field-label">
            Full Name
          </label>
          <input
            id="guest-name"
            type="text"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange('name')}
            className="auth-field-input"
          />
        </div>

        <div className="auth-field-group">
          <label htmlFor="guest-email" className="auth-field-label">
            Email Address
          </label>
          <input
            id="guest-email"
            type="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={handleChange('email')}
            className="auth-field-input"
          />
        </div>

        <div className="auth-field-group">
          <label htmlFor="guest-company" className="auth-field-label">
            Company Name
          </label>
          <input
            id="guest-company"
            type="text"
            placeholder="Acme Corporation"
            value={formData.company}
            onChange={handleChange('company')}
            className="auth-field-input"
          />
        </div>

        <div className="auth-field-group">
          <label htmlFor="guest-phone" className="auth-field-label">
            Phone Number
          </label>
          <input
            id="guest-phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={formData.phone}
            onChange={handleChange('phone')}
            className="auth-field-input"
          />
        </div>

        {!!error && <div className="auth-error-box">{error}</div>}

        <div className="auth-actions">
          <button type="submit" disabled={isLoading} className="auth-btn-primary">
            {isLoading ? 'Accessing...' : 'Continue as Guest'}
          </button>
          <button type="button" onClick={onBack} disabled={isLoading} className="auth-btn-ghost">
            Back to Login
          </button>
        </div>

        <div className="info-banner">
          <span>Info:</span>
          <span>Guest mode provides read-only access to explore features.</span>
        </div>
      </form>
    </main>
  )
}

export default GuestForm
