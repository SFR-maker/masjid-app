import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-expo'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

// Singleton token getter — injected by <ClerkTokenSync /> at app root
let _getToken: (() => Promise<string | null>) | null = null

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!_getToken) return {}
  try {
    const token = await _getToken()
    if (token) return { Authorization: `Bearer ${token}` }
  } catch (e) {
    console.warn('[auth] failed to get token:', e)
  }
  return {}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const authHeader = await getAuthHeader()
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' })) as any
    throw new Error(error.error ?? `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T = any>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T = any>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = any>(path: string) => request<T>('DELETE', path),
}

/** Mount this once inside ClerkProvider to wire up the token getter */
export function useApiTokenSync() {
  const { getToken } = useAuth()
  useEffect(() => {
    setTokenGetter(() => getToken())
  }, [getToken])
}
