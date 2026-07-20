import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/auth/callback/route'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

function recoveryRequest(fields: Record<string, string>): Request {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }

  return new Request('https://www.revisiongrade.com/api/auth/callback', {
    method: 'POST',
    body: form,
  })
}

describe('password recovery callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('verifies a recovery token only after the confirmation POST', async () => {
    const verifyOtp = jest.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } } as never)

    const response = await POST(
      recoveryRequest({ token_hash: ' recovery-token-hash ', type: 'recovery' })
    )

    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: 'recovery-token-hash',
      type: 'recovery',
    })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://www.revisiongrade.com/reset-password')
  })

  it.each([
    [{ type: 'recovery' }, 'missing token'],
    [{ token_hash: 'hash' }, 'missing type'],
    [{ token_hash: 'hash', type: 'email' }, 'non-recovery type'],
  ])('fails closed for %s (%s)', async (fields) => {
    const verifyOtp = jest.fn()
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } } as never)

    const response = await POST(recoveryRequest(fields))

    expect(verifyOtp).not.toHaveBeenCalled()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(
      'https://www.revisiongrade.com/forgot-password?error=recovery_link_invalid'
    )
  })

  it('fails closed when the recovery token is expired, consumed, or invalid', async () => {
    const verifyOtp = jest.fn().mockResolvedValue({ error: new Error('invalid token') })
    mockCreateClient.mockResolvedValue({ auth: { verifyOtp } } as never)

    const response = await POST(
      recoveryRequest({ token_hash: 'expired-token-hash', type: 'recovery' })
    )

    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(
      'https://www.revisiongrade.com/forgot-password?error=recovery_link_invalid'
    )
  })
})
