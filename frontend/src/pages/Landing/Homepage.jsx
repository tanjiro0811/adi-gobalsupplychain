import GlassCard from '../../components/ui/GlassCard'
import './homepage.css'

function Homepage({ onGuestEntry, onLoginClick, onSignupClick, isGuestView = false }) {
  return (
    <main className="homepage-scene homepage-theme-command">
      <div className="homepage-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <section className="homepage-content">
        <GlassCard className="homepage-card">
          <div className="homepage-header">
            <div className="logo-container">
             <div className="logo-icon">🌐</div>
<h1 className="homepage-title">
  <span className="title-highlight">Global Supply Chain Platform</span>
</h1>
            </div>
            
            <p className="homepage-subtitle">
              High-density AI, blockchain verification, and logistics control in one
              connected control plane.
            </p>

            <div className="feature-pills">
              <span className="feature-pill">
                <span className="pill-icon">🤖</span>
                AI-Powered
              </span>
              <span className="feature-pill">
                <span className="pill-icon">🔗</span>
                Blockchain Verified
              </span>
              <span className="feature-pill">
                <span className="pill-icon">📊</span>
                Real-time Analytics
              </span>
            </div>
          </div>

          {!isGuestView && (
            <div className="homepage-actions">
              <button type="button" className="primary-btn" onClick={onLoginClick}>
                <span className="btn-icon">🔐</span>
                Login
              </button>
              <button type="button" className="secondary-btn" onClick={onSignupClick}>
                <span className="btn-icon">✨</span>
                Sign Up
              </button>
              <button type="button" className="ghost-btn" onClick={onGuestEntry}>
                <span className="btn-icon">👤</span>
                Explore as Guest
              </button>
            </div>
          )}

          {isGuestView && (
            <div className="guest-mode-banner">
              <div className="banner-icon">ℹ️</div>
              <div className="banner-content">
                <h3>Guest Mode</h3>
                <p>You're exploring with read-only access. Sign in for full features.</p>
              </div>
              <button type="button" className="primary-btn-small" onClick={onLoginClick}>
                Sign In Now
              </button>
            </div>
          )}

          <div className="homepage-footer">
            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-value">10K+</span>
                <span className="stat-label">Active Users</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">99.9%</span>
                <span className="stat-label">Uptime</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">500M+</span>
                <span className="stat-label">Tracked Items</span>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="homepage-features">
          <div className="feature-card">
            <div className="feature-icon">🏭</div>
            <h3>Manufacturer Control</h3>
            <p>AI-driven production forecasting and batch management</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🚚</div>
            <h3>Live Logistics</h3>
            <p>Real-time GPS tracking and route optimization</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏪</div>
            <h3>Retail Integration</h3>
            <p>Smart inventory and blockchain product verification</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Homepage
