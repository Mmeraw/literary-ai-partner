import { NextResponse } from 'next/server'
import { getEnabledOAuthProviderDescriptors } from '@/lib/auth/oauthProviders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchSupabaseAuthSettings(): Promise<unknown | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) return null

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function GET() {
  const hasSupabaseAuthConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const settings = hasSupabaseAuthConfig ? await fetchSupabaseAuthSettings() : null
  const providers = hasSupabaseAuthConfig
    ? getEnabledOAuthProviderDescriptors({ env: process.env, supabaseSettings: settings })
    : []

  const source = settings ? 'supabase_settings' : (providers.length > 0 ? 'env' : 'none')

  return NextResponse.json(
    { providers, hasSupabaseAuthConfig, source },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
