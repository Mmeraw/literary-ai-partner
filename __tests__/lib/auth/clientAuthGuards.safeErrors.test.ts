import { describe, expect, test } from '@jest/globals'
import { getSafeAuthErrorMessage } from '@/lib/auth/clientAuthGuards'

describe('clientAuthGuards safe error mapping', () => {
  test('maps unsupported provider errors to a safe actionable message', () => {
    expect(getSafeAuthErrorMessage('Unsupported provider: provider is not enabled')).toBe(
      'That sign-in option is not enabled right now. Please use another sign-in method.'
    )
  })

  test('maps invalid credentials to incorrect email or password', () => {
    expect(getSafeAuthErrorMessage('Invalid login credentials')).toBe('Incorrect email or password.')
  })
})
