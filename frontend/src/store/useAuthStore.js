import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gsc_auth_state'

const defaultState = {
  user: null,
  role: null,
  isGuest: false,
  token: null,
}

function readPersistedState() {
  if (typeof window === 'undefined') {
    return defaultState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultState
    }

    const parsed = JSON.parse(raw)
    return {
      ...defaultState,
      ...parsed,
    }
  } catch {
    return defaultState
  }
}

let authState = readPersistedState()
const listeners = new Set()

function persistState() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(authState))
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function setAuthState(next) {
  authState = typeof next === 'function' ? next(authState) : next
  persistState()
  emitChange()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAuthState() {
  return authState
}

export const selectAuthState = (state) => state

export function useAuthStore(selector = selectAuthState) {
  return useSyncExternalStore(
    subscribe,
    () => selector(authState),
    () => selector(defaultState),
  )
}

export function setUserSession({ user, role }) {
  setAuthState({
    user: user || null,
    role: role || null,
    isGuest: false,
    token: user?.token || null,
  })
}

export function enterGuest(role = 'Guest', name = 'Guest User') {
  setAuthState({
    user: {
      name: name || 'Guest User',
      email: 'guest@example.com',
      isGuest: true,
    },
    role: role || 'Guest',
    isGuest: true,
    token: null,
  })
}

export function logout() {
  setAuthState(defaultState)
}
