import { useState } from 'react'
import { adminApi } from '../../api/axiosInstance'
import './../Admin/admin.css'
import DashboardLayout from '../../components/layout/DashboardLayout'

function SystemReport({ user, onLogout, onNavigate, currentPath }) {
  const [reportType, setReportType] = useState('revenue')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [format, setFormat] = useState('pdf')
  const [generating, setGenerating] = useState(false)
  const [recentReports] = useState([
    {
      id: 1,
      name: 'Revenue Report - January 2026',
      type: 'revenue',
      generated: '2026-02-01',
      size: '2.4 MB',
      format: 'PDF'
    },
    {
      id: 2,
      name: 'User Analytics - Q4 2025',
      type: 'users',
      generated: '2026-01-15',
      size: '1.8 MB',
      format: 'CSV'
    },
    {
      id: 3,
      name: 'Shipment Report - December 2025',
      type: 'shipments',
      generated: '2026-01-01',
      size: '3.2 MB',
      format: 'Excel'
    }
  ])

  const reportTypes = [
    { value: 'revenue', label: 'Revenue Report', icon: '💰', description: 'Platform revenue and financial metrics' },
    { value: 'users', label: 'User Analytics', icon: '👥', description: 'User activity and engagement data' },
    { value: 'shipments', label: 'Shipment Analytics', icon: '📦', description: 'Delivery performance and logistics' },
    { value: 'blockchain', label: 'Blockchain Audit', icon: '🔗', description: 'Transaction verification history' },
    { value: 'system', label: 'System Performance', icon: '⚡', description: 'API usage and system health' },
    { value: 'custom', label: 'Custom Report', icon: '📊', description: 'Build your own custom report' }
  ]

  const handleGenerateReport = async () => {
    setGenerating(true)
    try {
      const response = await adminApi.generateReport({
        type: reportType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        format: format
      })

      if (response) {
        // Create download link
        const blob = new Blob([response], { type: `application/${format}` })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportType}_report_${dateRange.startDate}_to_${dateRange.endDate}.${format}`
        a.click()
        window.URL.revokeObjectURL(url)
        alert('Report generated successfully!')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadReport = (reportId) => {
    alert(`Downloading report ID: ${reportId}`)
  }

  const handleDeleteReport = (reportId) => {
    if (window.confirm('Are you sure you want to delete this report?')) {
      alert(`Report ${reportId} deleted`)
    }
  }

  const getReportIcon = (type) => {
    const report = reportTypes.find(r => r.value === type)
    return report ? report.icon : '📄'
  }

  const stats = [
    { label: 'Total Reports', value: '247', trend: 'All-time' },
    { label: 'This Month', value: '45', trend: 'Generated' },
    { label: 'Data Size', value: '128 GB', trend: 'Storage used' },
    { label: 'Most Generated', value: 'Revenue', trend: 'Report type' }
  ]

  return (
    <DashboardLayout
      role="Admin"
      themeClass="admin-theme"
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={stats}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>System Reports</h2>
        <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>Generate and export comprehensive platform reports</p>
      </div>

      {/* Report Generator */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Generate New Report</h3>

          {/* Report Type Selection */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
              Select Report Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {reportTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() => setReportType(type.value)}
                  style={{
                    padding: 16,
                    border: reportType === type.value ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: reportType === type.value ? '#eff6ff' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 32, marginRight: 12 }}>{type.icon}</span>
                    <div>
                      <h4 style={{ fontWeight: 600, margin: '0 0 4px 0', fontSize: 14 }}>{type.label}</h4>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{type.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                />
              </div>
            </div>
          </div>

          {/* Export Format */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Export Format
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              {['pdf', 'csv', 'excel'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  style={{
                    padding: '8px 24px',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: format === fmt ? '#3b82f6' : '#f3f4f6',
                    color: format === fmt ? 'white' : '#374151',
                    transition: 'all 0.2s'
                  }}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: generating ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {generating ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span className="spinner"></span>
                Generating Report...
              </span>
            ) : (
              '📥 Generate and Download Report'
            )}
          </button>
        </div>
      </section>

      {/* Quick Report Templates */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Quick Templates</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <button
              style={{
                padding: 16,
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
                e.currentTarget.style.background = '#eff6ff'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.background = 'white'
              }}
            >
              <h4 style={{ fontWeight: 600, margin: '0 0 4px 0' }}>📅 Monthly Summary</h4>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Last 30 days comprehensive report</p>
            </button>
            <button
              style={{
                padding: 16,
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
                e.currentTarget.style.background = '#eff6ff'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.background = 'white'
              }}
            >
              <h4 style={{ fontWeight: 600, margin: '0 0 4px 0' }}>📊 Quarterly Review</h4>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Q4 2025 performance metrics</p>
            </button>
            <button
              style={{
                padding: 16,
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
                e.currentTarget.style.background = '#eff6ff'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.background = 'white'
              }}
            >
              <h4 style={{ fontWeight: 600, margin: '0 0 4px 0' }}>📈 Annual Report</h4>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Year 2025 full analysis</p>
            </button>
          </div>
        </div>
      </section>

      {/* Recent Reports */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Recent Reports</h3>
            <button style={{ fontSize: 14, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>
              View All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentReports.map((report) => (
              <div
                key={report.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'white' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: 32, marginRight: 16 }}>{getReportIcon(report.type)}</span>
                  <div>
                    <h4 style={{ fontWeight: 600, margin: '0 0 4px 0', fontSize: 14 }}>{report.name}</h4>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                      Generated on {new Date(report.generated).toLocaleDateString()} • {report.size} • {report.format}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDownloadReport(report.id)}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500
                    }}
                  >
                    📥 Download
                  </button>
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    style={{
                      padding: '8px 16px',
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report Insights */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          <div style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', borderRadius: 12, padding: 24 }}>
            <h4 style={{ fontWeight: 600, color: '#1e3a8a', margin: '0 0 8px 0' }}>Most Generated</h4>
            <p style={{ fontSize: 28, fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>Revenue Reports</p>
            <p style={{ fontSize: 14, color: '#1e40af', margin: '4px 0 0 0' }}>45 times this month</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', borderRadius: 12, padding: 24 }}>
            <h4 style={{ fontWeight: 600, color: '#14532d', margin: '0 0 8px 0' }}>Total Reports</h4>
            <p style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981', margin: 0 }}>247</p>
            <p style={{ fontSize: 14, color: '#166534', margin: '4px 0 0 0' }}>Generated all-time</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', borderRadius: 12, padding: 24 }}>
            <h4 style={{ fontWeight: 600, color: '#4c1d95', margin: '0 0 8px 0' }}>Data Size</h4>
            <p style={{ fontSize: 28, fontWeight: 'bold', color: '#8b5cf6', margin: 0 }}>128 GB</p>
            <p style={{ fontSize: 14, color: '#6b21a8', margin: '4px 0 0 0' }}>Total storage used</p>
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default SystemReport
