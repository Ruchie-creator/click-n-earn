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

export function apiUpload<T>(path: string, body: FormData, onProgress?: (progress: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', apiUrl(path))
    request.setRequestHeader('Accept', 'application/json')
    const token = getToken()
    if (token) request.setRequestHeader('Authorization', 'Bearer ' + token)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
    request.onload = () => {
      let payload: { message?: string; errors?: Record<string, string[]> }
      try {
        payload = JSON.parse(request.responseText || '{}') as typeof payload
      } catch {
        reject(new Error('The server returned an invalid response.'))
        return
      }
      if (request.status < 200 || request.status >= 300) {
        const error = new Error(payload?.message || 'The upload could not be completed.') as ApiError
        error.status = request.status
        error.details = payload?.errors
        reject(error)
        return
      }
      resolve(payload as T)
    }
    request.onerror = () => reject(new TypeError('We could not reach the server.'))
    request.onabort = () => reject(new Error('The upload was cancelled.'))
    request.send(body)
  })
}

export function apiUrl(path: string): string {
  return API_URL + (path.startsWith('/') ? path : '/' + path)
}
