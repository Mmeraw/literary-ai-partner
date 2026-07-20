import fs from 'node:fs'
import path from 'node:path'

describe('password recovery confirmation surface', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/reset-password/confirm/page.tsx'),
    'utf8'
  )

  it('requires an explicit POST before consuming a recovery token', () => {
    expect(source).toContain('method="post"')
    expect(source).toContain('action="/api/auth/callback"')
    expect(source).toContain('name="token_hash"')
    expect(source).toContain('name="type" value="recovery"')
  })

  it('does not verify or exchange the token during the email-link GET', () => {
    expect(source).not.toContain('verifyOtp')
    expect(source).not.toContain('exchangeCodeForSession')
  })

  it('fails closed when the recovery link is missing governed inputs', () => {
    expect(source).toContain('const canContinue = Boolean(tokenHash) && isRecovery')
    expect(source).toContain('This reset link is incomplete or invalid')
  })
})
