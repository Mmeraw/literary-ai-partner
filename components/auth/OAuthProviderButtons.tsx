'use client'

import { useEffect, useState } from 'react'
import type { OAuthProviderDescriptor, OAuthProviderId } from '@/lib/auth/oauthProviders'

type OAuthProviderButtonsProps = {
  loading: boolean;
  hasSupabaseAuthConfig: boolean;
  onProviderClick: (provider: OAuthProviderId) => void;
};

function ProviderIcon({ provider }: { provider: OAuthProviderId }) {
  switch (provider) {
    case 'google':
      return (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )
    case 'azure':
      return (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
          <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
        </svg>
      )
    case 'apple':
      return (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
      )
    case 'facebook':
      return (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    case 'twitter':
      return (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
  }
}

export default function OAuthProviderButtons({ loading, hasSupabaseAuthConfig, onProviderClick }: OAuthProviderButtonsProps) {
  const [providers, setProviders] = useState<OAuthProviderDescriptor[]>([])
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadProviders() {
      if (!hasSupabaseAuthConfig) {
        if (isMounted) {
          setProviders([])
          setIsLoadingProviders(false)
        }
        return
      }

      try {
        const response = await fetch('/api/auth/providers', { cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (!isMounted) return

        setProviders(Array.isArray(data?.providers) ? data.providers : [])
      } catch {
        if (!isMounted) return
        setProviders([])
      } finally {
        if (isMounted) setIsLoadingProviders(false)
      }
    }

    setIsLoadingProviders(true)
    void loadProviders()

    return () => {
      isMounted = false
    }
  }, [hasSupabaseAuthConfig])

  if (isLoadingProviders) {
    return (
      <div className="border border-rg-cream2/20 bg-rg-ink px-4 py-3 font-rg-mono text-xs tracking-[0.12em] uppercase text-rg-cream2/70">
        Checking available sign-in options…
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <div className="border border-rg-cream2/20 bg-rg-ink px-4 py-3 font-rg-mono text-xs leading-relaxed text-rg-cream2/80">
        Social sign-in is currently unavailable. Use email and password, or enable at least one OAuth provider in the auth environment.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => onProviderClick(provider.id)}
          disabled={loading || !hasSupabaseAuthConfig}
          className="w-full flex items-center justify-center gap-3 border border-rg-cream2/30 text-rg-cream2 font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-cream2/60 hover:text-rg-cream transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ProviderIcon provider={provider.id} />
          {provider.buttonLabel}
        </button>
      ))}
    </div>
  )
}
