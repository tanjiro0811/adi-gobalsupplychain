import { useState } from 'react'
import BlockchainBadge from '../../components/blockchain/BlockchainBadge'

function Scanner() {
  const [scannedCode, setScannedCode] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [isScanning, setIsScanning] = useState(false)

  const mockDatabase = {
    'N95-001': {
      name: 'N95 Mask Box (50pcs)',
      manufacturer: 'MedSafe Corp',
      batchNumber: 'BATCH-2024-001',
      expiryDate: '2026-12-31',
      verified: true,
      origin: 'Mumbai, India',
      certifications: ['FDA', 'CE', 'ISO 13485'],
    },
    'IV-002': {
      name: 'IV Set Standard',
      manufacturer: 'HealthTech Ltd',
      batchNumber: 'BATCH-2024-045',
      expiryDate: '2025-08-15',
      verified: true,
      origin: 'Bangalore, India',
      certifications: ['ISO 13485', 'WHO-GMP'],
    },
    'CARE-003': {
      name: 'Home Care Kit',
      manufacturer: 'CareFirst Inc',
      batchNumber: 'BATCH-2024-089',
      expiryDate: '2027-03-20',
      verified: false,
      origin: 'Delhi, India',
      certifications: ['ISO 9001'],
    },
  }

  const handleScan = (code) => {
    setIsScanning(true)
    setScannedCode(code)

    // Simulate scanning delay
    setTimeout(() => {
      const result = mockDatabase[code]
      if (result) {
        setScanResult(result)
      } else {
        setScanResult({
          error: true,
          message: 'Product not found in database',
        })
      }
      setIsScanning(false)
    }, 1000)
  }

  const handleManualEntry = (e) => {
    e.preventDefault()
    if (scannedCode.trim()) {
      handleScan(scannedCode.trim())
    }
  }

  return (
    <div className="scanner-container">
      <div className="scanner-grid">
        {/* Scanner Interface */}
        <div className="card scanner-interface">
          <h4 className="card-title">Product Scanner</h4>
          <div className="scanner-viewfinder">
            {isScanning ? (
              <div className="scanning-animation">
                <div className="scan-line"></div>
                <p>Scanning...</p>
              </div>
            ) : (
              <div className="scanner-placeholder">
                <div className="scanner-icon">📷</div>
                <p>Point camera at product barcode</p>
                <p className="scanner-hint">or enter code manually below</p>
              </div>
            )}
          </div>

          <form onSubmit={handleManualEntry} className="manual-entry">
            <input
              type="text"
              className="search-input"
              placeholder="Enter product code (e.g., N95-001)"
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
            />
            <button type="submit" className="btn-scan" disabled={isScanning}>
              {isScanning ? 'Scanning...' : 'Scan Code'}
            </button>
          </form>

          <div className="quick-scan-buttons">
            <button
              className="btn-quick-scan"
              onClick={() => handleScan('N95-001')}
            >
              Demo: N95-001
            </button>
            <button
              className="btn-quick-scan"
              onClick={() => handleScan('IV-002')}
            >
              Demo: IV-002
            </button>
            <button
              className="btn-quick-scan"
              onClick={() => handleScan('CARE-003')}
            >
              Demo: CARE-003
            </button>
          </div>
        </div>

        {/* Scan Results */}
        <div className="card scan-results">
          <h4 className="card-title">Scan Results</h4>
          {!scanResult ? (
            <div className="no-results">
              <p>No scan results yet</p>
              <p className="no-results-hint">Scan a product to see details</p>
            </div>
          ) : scanResult.error ? (
            <div className="error-result">
              <div className="error-icon">⚠️</div>
              <h5>Product Not Found</h5>
              <p>{scanResult.message}</p>
            </div>
          ) : (
            <div className="product-details">
              <div className="detail-header">
                <h5>{scanResult.name}</h5>
                {scanResult.verified ? (
                  <BlockchainBadge label="Verified" />
                ) : (
                  <span className="badge-pending">Pending</span>
                )}
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Manufacturer:</span>
                  <span className="detail-value">{scanResult.manufacturer}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Batch Number:</span>
                  <span className="detail-value">{scanResult.batchNumber}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Expiry Date:</span>
                  <span className="detail-value">{scanResult.expiryDate}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Origin:</span>
                  <span className="detail-value">{scanResult.origin}</span>
                </div>
              </div>

              <div className="certifications">
                <span className="detail-label">Certifications:</span>
                <div className="cert-badges">
                  {scanResult.certifications.map((cert) => (
                    <span key={cert} className="cert-badge">
                      {cert}
                    </span>
                  ))}
                </div>
              </div>

              {scanResult.verified && (
                <div className="blockchain-info">
                  <div className="blockchain-icon">🔗</div>
                  <div>
                    <h6>Blockchain Verified</h6>
                    <p className="blockchain-text">
                      This product's authenticity has been verified on the blockchain
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Scanner