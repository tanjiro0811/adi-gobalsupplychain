function makePartnerLogo(name, bg = '#0e7490', fg = '#ffffff') {
  const initials = getInitials(name)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='48' fill='${bg}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='${fg}' font-family='Arial, sans-serif' font-size='34' font-weight='700'>${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const FALLBACK_PARTNERS = [
  {
    name: 'SwiftMove Logistics',
    phone: '+91 90000 12001',
    rating: 4.7,
    logo: makePartnerLogo('SwiftMove Logistics', '#0e7490'),
  },
  {
    name: 'PrimeRoute Carriers',
    phone: '+91 90000 12002',
    rating: 4.5,
    logo: makePartnerLogo('PrimeRoute Carriers', '#1d4ed8'),
  },
  {
    name: 'CargoLink Express',
    phone: '+91 90000 12003',
    rating: 4.6,
    logo: makePartnerLogo('CargoLink Express', '#0f766e'),
  },
  {
    name: 'TransitEdge Movers',
    phone: '+91 90000 12004',
    rating: 4.4,
    logo: makePartnerLogo('TransitEdge Movers', '#0369a1'),
  },
]

function normalizeText(value, fallback = '--') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  return String(value)
}

function normalizeStatus(status) {
  return normalizeText(status, 'unknown').replace(/_/g, ' ')
}

function seedFromId(id) {
  return String(id)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function getFallbackPartner(id) {
  const index = seedFromId(id) % FALLBACK_PARTNERS.length
  return FALLBACK_PARTNERS[index]
}

function asNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getInitials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'DP'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function projectCoordinates(lat, lng) {
  const x = ((lng + 180) / 360) * 100
  const y = ((90 - lat) / 180) * 100
  return { x, y }
}

export function getShipmentDetails(id, item = {}) {
  const fallbackPartner = getFallbackPartner(id)
  const partnerInfo = item.deliveryPartner ?? item.partner ?? item.partnerDetails ?? {}
  const feedbackInfo = item.feedback ?? item.customerFeedback ?? {}
  const assignmentInfo = item.assignment ?? {}
  const vehicleInfo = item.vehicle ?? item.vehicleDetails ?? {}

  const lat = asNumber(item.lat ?? item.latitude ?? item.location?.lat)
  const lng = asNumber(item.lng ?? item.longitude ?? item.location?.lng)
  const hasGps = lat !== null && lng !== null

  const status = normalizeStatus(item.status)
  const lowerStatus = status.toLowerCase()
  const isDelayed = lowerStatus.includes('delay')
  const isDelivered = lowerStatus.includes('deliver') || lowerStatus.includes('complete')

  const partnerName =
    partnerInfo.name ??
    item.partnerName ??
    item.carrier ??
    item.driverName ??
    fallbackPartner.name

  const partnerPhone =
    partnerInfo.phone ??
    partnerInfo.contact ??
    item.partnerPhone ??
    item.driverPhone ??
    fallbackPartner.phone

  const ratingRaw = partnerInfo.rating ?? item.partnerRating ?? feedbackInfo.rating ?? fallbackPartner.rating
  const partnerRating = Number.isFinite(Number(ratingRaw)) ? Number(ratingRaw).toFixed(1) : '--'

  const partnerLogo =
    partnerInfo.logo ??
    partnerInfo.logoUrl ??
    partnerInfo.image ??
    partnerInfo.avatar ??
    item.partnerLogo ??
    item.partner_logo ??
    item.logo ??
    fallbackPartner.logo

  const feedbackMessage =
    feedbackInfo.comment ??
    feedbackInfo.message ??
    item.deliveryFeedback ??
    (isDelayed
      ? 'Delay reported by partner.'
      : isDelivered
        ? 'Delivered safely to destination.'
        : 'Shipment moving on planned route.')

  const assignmentStatus =
    assignmentInfo.status ??
    item.assignmentStatus ??
    item.assignedTo ??
    (partnerName ? 'Assigned' : 'Pending Assignment')

  const vehicleNumber =
    vehicleInfo.number ??
    item.vehicleNumber ??
    item.truckNumber ??
    item.lorryNumber ??
    `TRK-${String(id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`

  return {
    id: normalizeText(id),
    origin: normalizeText(item.origin ?? item.source ?? item.from, 'N/A'),
    destination: normalizeText(item.destination ?? item.to, 'N/A'),
    status,
    eta: normalizeText(item.eta ?? item.estimatedArrival ?? item.deliveryDate),
    weight: normalizeText(item.weight ?? item.weightKg ?? item.loadWeight, '--'),
    partnerName: normalizeText(partnerName, 'Unassigned Partner'),
    partnerPhone: normalizeText(partnerPhone, '--'),
    partnerLogo: normalizeText(partnerLogo, ''),
    partnerRating,
    assignmentStatus: normalizeText(assignmentStatus, 'Pending Assignment'),
    vehicleNumber,
    feedbackMessage: normalizeText(feedbackMessage, '--'),
    liveTracking: hasGps ? `Live (${lat.toFixed(3)}, ${lng.toFixed(3)})` : 'Signal unavailable',
    hasGps,
    lat,
    lng,
    isDelayed,
    isDelivered,
    lastUpdate: normalizeText(item.timestamp ?? item.updatedAt ?? item.lastUpdate),
  }
}
