import { useEffect, useMemo, useState } from 'react'
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

function formatStageName(value = '') {
  const raw = String(value || '').trim()
  if (!raw) {
    return 'Unknown stage'
  }
  const cleaned = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function formatTimestamp(value) {
  if (!value) {
    return 'Timestamp unavailable'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value)
  }
  return parsed.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatCountdownLabel(milliseconds) {
  if (milliseconds <= 0) {
    return 'Arrived • finalizing confirmation'
  }
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
}

function Scanner({ products = [] }) {
  const [scannedCode, setScannedCode] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [etaTargetTime, setEtaTargetTime] = useState(null)
  const [etaLabel, setEtaLabel] = useState('Awaiting journey data for ETA countdown')

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

  const timelineSteps = useMemo(() => {
    const journey = Array.isArray(scanResult?.journey) ? scanResult.journey : []
    return journey.map((step, index) => {
      const rawEta = step.etaHours ?? step.payload?.etaHours
      const etaNumeric = Number(rawEta)
      return {
        id: `${step.txHash || step.eventStage || index}-${index}`,
        stage: formatStageName(step.eventStage || step.eventStatus || step.payload?.stage),
        timestamp: step.timestamp,
        meta: step.eventStatus || step.payload?.status,
        etaHours: Number.isFinite(etaNumeric) ? etaNumeric : null,
        txHash: step.txHash,
      }
    })
  }, [scanResult?.journey])

  const activeStageLabel =
    timelineSteps.length > 0 ? timelineSteps[timelineSteps.length - 1].stage : 'Waiting for blockchain sync'

  useEffect(() => {
    const candidate = [...timelineSteps].reverse().find((step) => step.etaHours !== null && step.etaHours >= 0)
    if (candidate && typeof candidate.etaHours === 'number') {
      setEtaTargetTime(Date.now() + candidate.etaHours * 3600 * 1000)
    } else {
      setEtaTargetTime(null)
    }
  }, [timelineSteps])

  useEffect(() => {
    if (!etaTargetTime) {
      setEtaLabel('Awaiting journey data for ETA countdown')
      return
    }

    const update = () => {
      const remaining = Math.max(etaTargetTime - Date.now(), 0)
      if (remaining <= 0) {
        setEtaLabel('Arrived • finalizing confirmation')
        return
      }
      setEtaLabel(`${formatCountdownLabel(remaining)} until arrival`)
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [etaTargetTime])

  const handleScan = (code) => {
    const normalizedCode = normalizeScanCode(code)
    setIsScanning(true)
    setScannedCode(normalizedCode)

    // Simulate scanning delay
    setTimeout(() => {
      const result = productByCode[normalizedCode]
      if (result) {
        setScanResult({
          ...result,
          loadingBlockchain: true,
          qrImageUrl: '',
          journey: [],
          aiSummary: '',
          aiHighlight: '',
          aiStage: '',
        })
        Promise.all([
          blockchainApi.qr(result.sku || normalizedCode),
          blockchainApi.journey(result.sku || normalizedCode),
          blockchainApi.journeySummary(result.sku || normalizedCode),
        ])
          .then(([qrPayload, journeyPayload, summaryPayload]) => {
            setScanResult((prev) => ({
              ...(prev || result),
              loadingBlockchain: false,
              qrImageUrl: qrPayload?.qrImageUrl || '',
              journey: Array.isArray(journeyPayload?.journey) ? journeyPayload.journey : [],
              aiSummary: summaryPayload?.summary?.summary || '',
              aiHighlight: summaryPayload?.summary?.highlight || '',
              aiStage: summaryPayload?.summary?.keyStage || '',
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
                <div className="scanner-radar" aria-hidden="true"></div>
                <div className="scan-line"></div>
                <p aria-live="polite">Scanning...</p>
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

              {!scanResult.loadingBlockchain && (
                <div className="journey-visuals">
                  {timelineSteps.length > 0 && (
                    <div className="timeline-panel">
                      <div className="timeline-headline">
                        <p>Product journey timeline ({timelineSteps.length} hops)</p>
                        <span>Live QR trace</span>
                      </div>
                      <div className="timeline-body">
                        {timelineSteps.map((step, index) => (
                          <div className="timeline-step" key={step.id}>
                            <div className="timeline-node">
                              <span className="timeline-circle" />
                              {index < timelineSteps.length - 1 && <span className="timeline-line" aria-hidden="true"></span>}
                            </div>
                            <div className="timeline-content">
                              <p className="timeline-stage">{step.stage}</p>
                              <p className="timeline-meta">
                                {step.meta ? `${step.meta} • ` : ''}
                                {formatTimestamp(step.timestamp)}
                              </p>
                              {step.txHash && (
                                <p className="timeline-hash">Tx {step.txHash.slice(0, 10)}...</p>
                              )}
                              {step.etaHours !== null && (
                                <p className="timeline-eta">ETA window: {step.etaHours.toFixed(1)}h</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="eta-panel">
                    <p className="eta-label">Live ETA Countdown</p>
                    <p className="eta-value">{etaLabel}</p>
                    <p className="eta-stage">Tracking stage: {activeStageLabel}</p>
                    <p className="eta-hint">Powered by blockchain telemetry + AI delay risk</p>
                  </div>
                </div>
              )}
              {scanResult.aiSummary && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px dashed #cbd5f5' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>AI Journey Insight</p>
                  <p style={{ margin: '4px 0 0 0', color: '#0f172a', fontSize: 14 }}>{scanResult.aiSummary}</p>
                  {scanResult.aiHighlight && (
                    <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: 12 }}>Highlight: {scanResult.aiHighlight}</p>
                  )}
                  {scanResult.aiStage && (
                    <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: 12 }}>Stage cue: {scanResult.aiStage}</p>
                  )}
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
