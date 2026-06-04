import { describe, expect, test } from '@jest/globals'
import {
  extractEnabledOAuthProvidersFromSupabaseSettings,
  getEnabledOAuthProviderDescriptors,
  getEnabledOAuthProviderDescriptorsFromEnv,
  getEnabledOAuthProvidersFromEnv,
  parseEnabledOAuthProviders,
  resolveEnabledOAuthProviders,
} from '@/lib/auth/oauthProviders'

describe('oauthProviders', () => {
  test('parses provider list in canonical order', () => {
    expect(parseEnabledOAuthProviders('facebook, google, apple')).toEqual(['google', 'apple', 'facebook'])
  })

  test('normalizes provider aliases and removes duplicates', () => {
    expect(parseEnabledOAuthProviders('microsoft,azure,x,twitter,google,google')).toEqual(['google', 'azure', 'twitter'])
  })

  test('ignores unknown providers', () => {
    expect(parseEnabledOAuthProviders('github,linkedin')).toEqual([])
  })

  test('reads enabled providers from server env contract', () => {
    expect(
      getEnabledOAuthProvidersFromEnv({
        AUTH_ENABLED_OAUTH_PROVIDERS: 'google microsoft apple',
      } as NodeJS.ProcessEnv)
    ).toEqual(['google', 'azure', 'apple'])
  })

  test('builds descriptors for enabled providers only', () => {
    expect(
      getEnabledOAuthProviderDescriptorsFromEnv({
        AUTH_ENABLED_OAUTH_PROVIDERS: 'google twitter',
      } as NodeJS.ProcessEnv)
    ).toEqual([
      { id: 'google', label: 'Google', buttonLabel: 'Continue with Google' },
      { id: 'twitter', label: 'X', buttonLabel: 'Continue with X' },
    ])
  })

  test('extracts enabled providers from Supabase settings object', () => {
    const settings = {
      external: {
        google: true,
        azure_enabled: true,
        appleEnabled: false,
        facebook: { enabled: true },
        twitter: 'enabled',
      },
    }

    expect(extractEnabledOAuthProvidersFromSupabaseSettings(settings)).toEqual([
      'google',
      'azure',
      'facebook',
      'twitter',
    ])
  })

  test('resolveEnabledOAuthProviders intersects Supabase settings with env allowlist', () => {
    const providers = resolveEnabledOAuthProviders({
      env: {
        AUTH_ENABLED_OAUTH_PROVIDERS: 'google,azure',
      } as NodeJS.ProcessEnv,
      supabaseSettings: {
        external: {
          google: true,
          azure: false,
          facebook: true,
        },
      },
    })

    expect(providers).toEqual(['google'])
  })

  test('resolveEnabledOAuthProviders falls back to env when settings unavailable', () => {
    const providers = resolveEnabledOAuthProviders({
      env: {
        AUTH_ENABLED_OAUTH_PROVIDERS: 'google,facebook',
      } as NodeJS.ProcessEnv,
    })

    expect(providers).toEqual(['google', 'facebook'])
  })

  test('builds descriptors from combined resolver', () => {
    const descriptors = getEnabledOAuthProviderDescriptors({
      env: {
        AUTH_ENABLED_OAUTH_PROVIDERS: 'google,twitter',
      } as NodeJS.ProcessEnv,
      supabaseSettings: {
        external: {
          google: true,
          twitter: true,
          azure: true,
        },
      },
    })

    expect(descriptors).toEqual([
      { id: 'google', label: 'Google', buttonLabel: 'Continue with Google' },
      { id: 'twitter', label: 'X', buttonLabel: 'Continue with X' },
    ])
  })
})
