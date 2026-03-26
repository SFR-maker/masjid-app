'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export function useAdminFetch() {
  const { getToken } = useAuth()

  const adminFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getToken()
      return fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
    },
    [getToken]
  )

  return adminFetch
}
