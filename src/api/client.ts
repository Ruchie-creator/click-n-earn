export type ApiError = Error & { status?: number; details?: Record<string, string[]> }

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8001/api' : '/api')).replace(/\/$/, '')
const TOKEN_KEY = 'click-and-earn.token'

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

function headers(body?: BodyInit): HeadersInit {
  const token = getToken()
  return {
    Accept: 'application/json',
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_URL + (path.startsWith('/') ? path : '/' + path), {
    ...options,
    headers: { ...headers(options.body ?? undefined), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.message || 'The request could not be completed.') as ApiError
    error.status = response.status
    error.details = payload?.errors
    throw error
  }
  return payload as T
}

export async function apiDownload(path: string): Promise<Blob> {
  const token = getToken()
  const response = await fetch(API_URL + (path.startsWith('/') ? path : '/' + path), {
    headers: {
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const error = new Error(payload?.message || 'The file could not be downloaded.') as ApiError
    error.status = response.status
    error.details = payload?.errors
    throw error
  }
  return response.blob()
}

export function apiUrl(path: string): string {
  return API_URL + (path.startsWith('/') ? path : '/' + path)
}
