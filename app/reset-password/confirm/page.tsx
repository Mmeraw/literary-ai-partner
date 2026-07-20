import Link from 'next/link'

type ConfirmRecoveryPageProps = {
  searchParams: Promise<{
    token_hash?: string | string[]
    type?: string | string[]
  }>
}

function singleValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export default async function ConfirmRecoveryPage({ searchParams }: ConfirmRecoveryPageProps) {
  const params = await searchParams
  const tokenHash = singleValue(params.token_hash).trim()
  const isRecovery = singleValue(params.type) === 'recovery'
  const canContinue = Boolean(tokenHash) && isRecovery

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-rg-ink flex flex-col items-center justify-center px-6 py-16">
      <Link href="/" className="flex items-center gap-3 mb-10 group">
        <span className="inline-flex h-8 w-8 items-center justify-center border border-rg-gold/60 text-rg-gold font-rg-serif text-sm group-hover:border-rg-gold transition-colors">
          R
        </span>
        <span className="font-rg-serif text-rg-cream text-sm tracking-wide">RevisionGrade&#8482;</span>
      </Link>

      <p className="font-rg-mono text-xs tracking-[0.25em] uppercase text-rg-cream2 mb-8">
        <span className="text-rg-red mr-2">●</span>
        Password Recovery
      </p>

      <div className="border border-rg-cream2/20 bg-rg-ink2 w-full max-w-sm px-8 py-10">
        <h1 className="font-rg-serif text-rg-cream text-2xl mb-3 text-center">
          Continue password reset
        </h1>

        {canContinue ? (
          <>
            <p className="font-rg-serif text-rg-cream2 text-sm text-center mb-6 leading-relaxed">
              Confirm that you want to open the secure form for choosing a new password.
            </p>
            <form method="post" action="/api/auth/callback">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value="recovery" />
              <button
                type="submit"
                className="w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200"
              >
                Continue securely
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 border border-rg-red/60 bg-rg-red/10 px-4 py-3 font-rg-mono text-xs text-rg-cream2 leading-relaxed">
              This reset link is incomplete or invalid. Request a new link to continue.
            </div>
            <Link
              href="/forgot-password"
              className="block w-full border border-rg-cream2/50 text-rg-cream text-center font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200"
            >
              Request a new link
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
