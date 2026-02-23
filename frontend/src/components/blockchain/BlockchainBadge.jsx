import { useState } from 'react'

function truncateHash(hash = '') {
  if (!hash || hash.length < 16) {
    return hash
  }
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`
}

function BlockchainBadge({ label = 'Blockchain Verified', hash }) {
  const [copied, setCopied] = useState(false)

  const copyHash = async () => {
    if (!hash) {
      return
    }
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 900)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span className="pill active" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span>{label}</span>
      {hash && (
        <>
          <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{truncateHash(hash)}</code>
          <button type="button" className="hash-copy" onClick={copyHash} title="Click to copy hash">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </>
      )}
    </span>
  )
}

export default BlockchainBadge
