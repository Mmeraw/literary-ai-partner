export type OAuthProviderId = 'google' | 'azure' | 'apple' | 'facebook' | 'twitter'

export type OAuthProviderDescriptor = {
  id: OAuthProviderId
  label: string
  buttonLabel: string
}

type OAuthProviderCatalogEntry = OAuthProviderDescriptor & {
  aliases: string[]
}

const OAUTH_PROVIDER_CATALOG: Record<OAuthProviderId, OAuthProviderCatalogEntry> = {
  google: {
    id: 'google',
    label: 'Google',
    buttonLabel: 'Continue with Google',
    aliases: ['google'],
  },
  azure: {
    id: 'azure',
    label: 'Microsoft',
    buttonLabel: 'Continue with Microsoft',
    aliases: ['azure', 'microsoft'],
  },
  apple: {
    id: 'apple',
    label: 'Apple',
    buttonLabel: 'Continue with Apple',
    aliases: ['apple'],
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    buttonLabel: 'Continue with Facebook',
    aliases: ['facebook'],
  },
  twitter: {
    id: 'twitter',
    label: 'X',
    buttonLabel: 'Continue with X',
    aliases: ['twitter', 'x'],
  },
}

export const OAUTH_PROVIDER_ORDER: OAuthProviderId[] = ['google', 'azure', 'apple', 'facebook', 'twitter']

export const OAUTH_PROVIDER_LABELS: Record<OAuthProviderId, string> = {
  google: OAUTH_PROVIDER_CATALOG.google.buttonLabel,
  azure: OAUTH_PROVIDER_CATALOG.azure.buttonLabel,
  apple: OAUTH_PROVIDER_CATALOG.apple.buttonLabel,
  facebook: OAUTH_PROVIDER_CATALOG.facebook.buttonLabel,
  twitter: OAUTH_PROVIDER_CATALOG.twitter.buttonLabel,
}

const OAUTH_PROVIDER_ID_SET = new Set<OAuthProviderId>(OAUTH_PROVIDER_ORDER)

const OAUTH_PROVIDER_ALIAS_MAP = Object.values(OAUTH_PROVIDER_CATALOG).reduce<Record<string, OAuthProviderId>>(
  (acc, provider) => {
    for (const alias of provider.aliases) {
      acc[alias] = provider.id
    }
    return acc
  },
  {},
)

function normalizeOAuthProviderId(value: string): OAuthProviderId | null {
  return OAUTH_PROVIDER_ALIAS_MAP[value.trim().toLowerCase()] ?? null
}

export function isOAuthProviderId(value: string): value is OAuthProviderId {
  return OAUTH_PROVIDER_ID_SET.has(value as OAuthProviderId)
}

export function parseEnabledOAuthProviders(raw: string | null | undefined): OAuthProviderId[] {
  if (!raw) return []

  const tokens = raw
    .split(/[\s,;|]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const enabled = new Set<OAuthProviderId>()
  for (const token of tokens) {
    const normalized = normalizeOAuthProviderId(token)
    if (normalized) enabled.add(normalized)
  }

  return OAUTH_PROVIDER_ORDER.filter((providerId) => enabled.has(providerId))
}

function intersectProviders(left: OAuthProviderId[], right: OAuthProviderId[]): OAuthProviderId[] {
  const rightSet = new Set<OAuthProviderId>(right)
  return OAUTH_PROVIDER_ORDER.filter((providerId) => left.includes(providerId) && rightSet.has(providerId))
}

// Backwards-compat alias for older callers.
export function parseOAuthProviderList(raw: string | null | undefined): OAuthProviderId[] {
  return parseEnabledOAuthProviders(raw)
}

export function getEnabledOAuthProvidersFromEnv(env: NodeJS.ProcessEnv = process.env): OAuthProviderId[] {
  const raw = env.AUTH_ENABLED_OAUTH_PROVIDERS ?? env.NEXT_PUBLIC_AUTH_ENABLED_OAUTH_PROVIDERS ?? ''
  return parseEnabledOAuthProviders(raw)
}

function isEnabledFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'enabled'
  }
  if (typeof value === 'number') return value === 1
  if (value && typeof value === 'object' && 'enabled' in (value as Record<string, unknown>)) {
    return isEnabledFlag((value as Record<string, unknown>).enabled)
  }
  return false
}

export function extractEnabledOAuthProvidersFromSupabaseSettings(settings: unknown): OAuthProviderId[] {
  if (!settings || typeof settings !== 'object') return []

  const root = settings as Record<string, unknown>
  const externalRaw = root.external
  if (!externalRaw || typeof externalRaw !== 'object') return []

  const external = externalRaw as Record<string, unknown>
  const enabled = new Set<OAuthProviderId>()

  for (const providerId of OAUTH_PROVIDER_ORDER) {
    const aliases = OAUTH_PROVIDER_CATALOG[providerId].aliases
    for (const alias of aliases) {
      const rawKeys = [
        alias,
        `${alias}_enabled`,
        `${alias}Enabled`,
      ]

      for (const rawKey of rawKeys) {
        if (!(rawKey in external)) continue
        if (isEnabledFlag(external[rawKey])) {
          enabled.add(providerId)
          break
        }
      }

      if (enabled.has(providerId)) break
    }
  }

  return OAUTH_PROVIDER_ORDER.filter((providerId) => enabled.has(providerId))
}

export function resolveEnabledOAuthProviders(
  params: {
    env?: NodeJS.ProcessEnv
    supabaseSettings?: unknown
  } = {},
): OAuthProviderId[] {
  const env = params.env ?? process.env
  const fromSupabaseSettings = extractEnabledOAuthProvidersFromSupabaseSettings(params.supabaseSettings)
  const fromEnv = getEnabledOAuthProvidersFromEnv(env)

  if (fromSupabaseSettings.length > 0 && fromEnv.length > 0) {
    return intersectProviders(fromSupabaseSettings, fromEnv)
  }

  if (fromSupabaseSettings.length > 0) {
    return fromSupabaseSettings
  }

  return fromEnv
}

export function getOAuthProviderDescriptor(providerId: OAuthProviderId): OAuthProviderDescriptor {
  const { aliases: _aliases, ...descriptor } = OAUTH_PROVIDER_CATALOG[providerId]
  return descriptor
}

export function getEnabledOAuthProviderDescriptorsFromEnv(env: NodeJS.ProcessEnv = process.env): OAuthProviderDescriptor[] {
  return getEnabledOAuthProvidersFromEnv(env).map(getOAuthProviderDescriptor)
}

export function getEnabledOAuthProviderDescriptors(
  params: {
    env?: NodeJS.ProcessEnv
    supabaseSettings?: unknown
  } = {},
): OAuthProviderDescriptor[] {
  return resolveEnabledOAuthProviders(params).map(getOAuthProviderDescriptor)
}
