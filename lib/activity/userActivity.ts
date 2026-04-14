export type UserActivityEntry = {
  id: string;
  timestamp: string;
  event: string;
  detail?: string;
  route?: string;
  href?: string;
  linkLabel?: string;
};

type AppendActivityInput = Omit<UserActivityEntry, 'id' | 'timestamp'> & {
  timestamp?: string;
};

type RemoteActivityPayload = {
  event: string;
  detail?: string;
  route?: string;
  href?: string;
  linkLabel?: string;
  timestamp?: string;
};

const STORAGE_KEY = 'rg_user_activity_v1';
const MAX_ITEMS = 500;
const MAX_REMOTE_BATCH = 300;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeParse(value: string | null): UserActivityEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as UserActivityEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === 'string' && typeof item.event === 'string');
  } catch {
    return [];
  }
}

function write(entries: UserActivityEntry[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

function toRemotePayload(entry: UserActivityEntry): RemoteActivityPayload {
  return {
    event: entry.event,
    ...(entry.detail ? { detail: entry.detail } : {}),
    ...(entry.route ? { route: entry.route } : {}),
    ...(entry.href ? { href: entry.href } : {}),
    ...(entry.linkLabel ? { linkLabel: entry.linkLabel } : {}),
    timestamp: entry.timestamp,
  };
}

async function postActivityToServer(payload: RemoteActivityPayload): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(payload),
    });
  } catch {
    // Never throw from client logging.
  }
}

export function readUserActivity(limit = 200): UserActivityEntry[] {
  if (!canUseStorage()) return [];
  const items = safeParse(window.localStorage.getItem(STORAGE_KEY));
  return items.slice(0, Math.max(0, limit));
}

export function appendUserActivity(input: AppendActivityInput): void {
  if (!canUseStorage()) return;

  const items = safeParse(window.localStorage.getItem(STORAGE_KEY));
  const nowIso = input.timestamp ?? new Date().toISOString();

  const next: UserActivityEntry = {
    id: crypto.randomUUID(),
    timestamp: nowIso,
    event: input.event,
    ...(input.detail ? { detail: input.detail } : {}),
    ...(input.route ? { route: input.route } : {}),
    ...(input.href ? { href: input.href } : {}),
    ...(input.linkLabel ? { linkLabel: input.linkLabel } : {}),
  };

  const previous = items[0];
  const isNearDuplicate =
    !!previous &&
    previous.event === next.event &&
    previous.route === next.route &&
    previous.href === next.href &&
    Math.abs(new Date(next.timestamp).getTime() - new Date(previous.timestamp).getTime()) < 1500;

  if (isNearDuplicate) {
    return;
  }

  const trimmed = [next, ...items].slice(0, MAX_ITEMS);
  write(trimmed);

  void postActivityToServer(toRemotePayload(next));
}

export function clearUserActivity(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export async function fetchUserActivityRemote(limit = 200): Promise<UserActivityEntry[]> {
  if (typeof window === 'undefined') return [];

  try {
    const resolvedLimit = Math.max(1, Math.min(limit, MAX_REMOTE_BATCH));
    const response = await fetch(`/api/activity?limit=${resolvedLimit}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      items?: UserActivityEntry[];
    };

    if (!payload?.ok || !Array.isArray(payload.items)) {
      return [];
    }

    return payload.items;
  } catch {
    return [];
  }
}

export async function clearUserActivityRemote(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const response = await fetch('/api/activity', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
    });

    return response.ok;
  } catch {
    return false;
  }
}
