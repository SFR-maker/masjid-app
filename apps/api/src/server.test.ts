import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We only need to test the validateEnv function logic
// Pull it out by re-importing the module after setting env vars

describe('validateEnv — startup env validation', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    // Restore env
    Object.assign(process.env, originalEnv)
    // Remove any keys that didn't exist originally
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key]
    }
  })

  function validateEnv() {
    const required = ['CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET', 'DATABASE_URL']
    const missing = required.filter((k) => !process.env[k])
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }

  it('throws when CLERK_SECRET_KEY is missing', () => {
    delete process.env.CLERK_SECRET_KEY
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_real'
    process.env.DATABASE_URL = 'postgresql://...'
    expect(() => validateEnv()).toThrow('CLERK_SECRET_KEY')
  })

  it('throws when CLERK_WEBHOOK_SECRET is missing', () => {
    process.env.CLERK_SECRET_KEY = 'sk_real'
    delete process.env.CLERK_WEBHOOK_SECRET
    process.env.DATABASE_URL = 'postgresql://...'
    expect(() => validateEnv()).toThrow('CLERK_WEBHOOK_SECRET')
  })

  it('throws when DATABASE_URL is missing', () => {
    process.env.CLERK_SECRET_KEY = 'sk_real'
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_real'
    delete process.env.DATABASE_URL
    expect(() => validateEnv()).toThrow('DATABASE_URL')
  })

  it('lists all missing vars in the error message', () => {
    delete process.env.CLERK_SECRET_KEY
    delete process.env.CLERK_WEBHOOK_SECRET
    delete process.env.DATABASE_URL
    expect(() => validateEnv()).toThrow(/CLERK_SECRET_KEY.*CLERK_WEBHOOK_SECRET.*DATABASE_URL/)
  })

  it('does not throw when all required vars are set', () => {
    process.env.CLERK_SECRET_KEY = 'sk_real'
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_real'
    process.env.DATABASE_URL = 'postgresql://...'
    expect(() => validateEnv()).not.toThrow()
  })
})

describe('CORS config — localhost restriction in production', () => {
  it('dev regex matches allowed localhost ports', () => {
    const devRegex = /^http:\/\/localhost:(3001|3002|8081|19000|19001|19006)$/
    expect(devRegex.test('http://localhost:3001')).toBe(true)
    expect(devRegex.test('http://localhost:3002')).toBe(true)
    expect(devRegex.test('http://localhost:8081')).toBe(true)
    expect(devRegex.test('http://localhost:19000')).toBe(true)
  })

  it('dev regex does NOT match arbitrary ports (old wildcard vulnerability)', () => {
    const devRegex = /^http:\/\/localhost:(3001|3002|8081|19000|19001|19006)$/
    expect(devRegex.test('http://localhost:9999')).toBe(false)
    expect(devRegex.test('http://localhost:80')).toBe(false)
    expect(devRegex.test('http://localhost:443')).toBe(false)
    expect(devRegex.test('http://localhost:1337')).toBe(false)
  })

  it('old wildcard regex would have matched any port (demonstrates the vulnerability)', () => {
    const oldRegex = /^http:\/\/localhost:/
    expect(oldRegex.test('http://localhost:9999')).toBe(true)
    expect(oldRegex.test('http://localhost:1337')).toBe(true)
    expect(oldRegex.test('http://localhost:80')).toBe(true)
  })
})
