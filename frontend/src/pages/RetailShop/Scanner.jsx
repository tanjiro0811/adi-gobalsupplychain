import { useState } from 'react'
import { blockchainApi } from '../../api/axiosInstance'
import BlockchainBadge from '../../components/blockchain/BlockchainBadge'

function normalizeScanCode(value = '') {
  return String(value).trim().toUpperCase()
}

function normalizeScannerProducts(products = []) {
  return products.map((item, index) => {
    const sku = String(item.id || item.sku || `SKU-${index + 1}`)
    const normalizedSku = normalizeScanCode(sku)
    const normalizedName = normalizeScanCode(item.name || '')
    const aliases = []

    if (normalizedSku.startsWith('N95') || normalizedName.includes('N95')) {
      aliases.push('N95-KIT')
    }
    if (normalizedSku.startsWith('IV') || normalizedName.includes('IV SET')) {
      aliases.push('IV-SET')
    }

    return {
      sku: normalizedSku,
      code: sku,
      aliases,
      name: item.name || `Product ${index + 1}`,
      manufacturer: item.manufacturer || 'Global Supply Manufacturer',
      batchNumber: item.batchNumber || `BATCH-${String(index + 1).padStart(4, '0')}`,
      expiryDate: item.expiryDate || 'N/A',
      verified: Boolean(item.verified),
      origin: item.origin || 'Supply Network',
      certifications: Array.isArray(item.certifications) && item.certifications.length
        ? item.certifications
        : ['ISO 13485'],
    }
  })
}

function Scanner({ products = [] }) {
  const [scannedCode, setScannedCode] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [isScanning, setIsScanning] = useState(false)

  const productCatalog = normalizeScannerProducts(products)
  const productByCode = Object.fromEntries(
    productCatalog.flatMap((item) => {
      const keys = [item.code, ...(item.aliases || [])].map((key) => normalizeScanCode(key))
      return keys.map((key) => [key, item])
    }),
  )
  const quickScanCodes = Array.from(
    new Set(productCatalog.flatMap((item) => [item.code, ...(item.aliases || [])])),
  ).slice(0, 4)

  const handleScan = (code) => {
    const normalizedCode = normalizeScanCode(code)
    setIsScanning(true)
    setScannedCode(normalizedCode)

    // Simulate scanning delay
    setTimeout(() => {
      const result = productByCode[normalizedCode]
      if (result) {
        setScanResult({ ...result, loadingBlockchain: true, qrImageUrl: '', journey: [] })
        Promise.all([
          blockchainApi.qr(result.sku || normalizedCode),
          blockchainApi.journey(result.sku || normalizedCode),
        ])
          .then(([qrPayload, journeyPayload]) => {
            setScanResult((prev) => ({
              ...(prev || result),
              loadingBlockchain: false,
              qrImageUrl: qrPayload?.qrImageUrl || '',
              journey: Array.isArray(journeyPayload?.journey) ? journeyPayload.journey : [],
            }))
          })
          .catch(() => {
            setScanResult((prev) => ({
              ...(prev || result),
              loadingBlockchain: false,
              qrImageUrl: '',
              journey: [],
            }))
          })
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
              placeholder="Enter code (e.g., N95-KIT, IV-SET)"
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
            />
            <button type="submit" className="btn-scan" disabled={isScanning}>
              {isScanning ? 'Scanning...' : 'Scan Code'}
            </button>
          </form>

          {quickScanCodes.length > 0 && (
            <div className="quick-scan-buttons">
              {quickScanCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  className="btn-quick-scan"
                  onClick={() => handleScan(code)}
                >
                  Scan: {code}
                </button>
              ))}
            </div>
          )}
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

              {scanResult.loadingBlockchain && (
                <p style={{ marginTop: 12, color: '#1d4ed8', fontSize: 13 }}>Loading blockchain journey...</p>
              )}

              {!scanResult.loadingBlockchain && scanResult.qrImageUrl && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>Product Journey QR</p>
                  <img
                    src={scanResult.qrImageUrl}
                    alt={`QR for ${scanResult.name}`}
                    style={{ width: 160, height: 160, border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                </div>
              )}

              {!scanResult.loadingBlockchain && Array.isArray(scanResult.journey) && scanResult.journey.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>Journey Trail</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {scanResult.journey.map((step) => (
                      <div
                        key={`${step.eventStage}-${step.timestamp}`}
                        style={{
                          padding: 10,
                          border: '1px solid #dbeafe',
                          borderRadius: 8,
                          background: '#eff6ff',
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 600, color: '#1e3a8a' }}>
                          {String(step.eventStage || '').replace(/_/g, ' ')}
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#334155' }}>
                          tx: {String(step.txHash || '').slice(0, 18)}...
                        </p>
                      </div>
                    ))}
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
