// src/auth/guestAccess.js

export function createGuestForm() {
  return {
    user: {
      name: 'Guest User',
      email: 'guest@example.com',
      company: 'Guest Company',
      phone: 'N/A',
    },
    role: 'Guest',
    isGuest: true,
  }
}

export function createGuestWithName(name, role) {
  const guestData = createGuestForm()
  if (name && name.trim()) {
    guestData.user.name = name.trim()
  }
  if (role) {
    guestData.role = role
  }
  return guestData
}

export function createGuestWithDetails(details, role) {
  const guestData = createGuestForm()
  
  // Update name if provided
  if (details.name && details.name.trim()) {
    guestData.user.name = details.name.trim()
  }
  
  // Update email if provided
  if (details.email && details.email.trim()) {
    guestData.user.email = details.email.trim()
  }
  
  // Update company if provided
  if (details.company && details.company.trim()) {
    guestData.user.company = details.company.trim()
  }
  
  // Update phone if provided
  if (details.phone && details.phone.trim()) {
    guestData.user.phone = details.phone.trim()
  }
  
  // Update role if provided
  if (role) {
    guestData.role = role
  }
  
  return guestData
}

export function isGuestUser(user) {
  return user?.isGuest === true || user?.email === 'guest@example.com'
}

export function getGuestDisplayName(user) {
  if (!user) return 'Guest'
  return user.name || 'Guest User'
}

export function sanitizeGuestData(data) {
  return {
    user: {
      name: data.user?.name || 'Guest User',
      email: data.user?.email || 'guest@example.com',
      company: data.user?.company || 'Guest Company',
      phone: data.user?.phone || 'N/A',
    },
    role: data.role || 'Guest',
    isGuest: true,
  }
}