export type AuthFlow = 'login' | 'signup' | 'oauth';

type AuthAttemptState = {
  timestamps: number[];
};

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 8;

function getStorageKey(flow: AuthFlow): string {
  return `rg_auth_attempts_${flow}`;
}

function readState(flow: AuthFlow): AuthAttemptState {
  if (typeof window === 'undefined') {
    return { timestamps: [] };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(flow));
    if (!raw) return { timestamps: [] };

    const parsed = JSON.parse(raw) as AuthAttemptState;
    if (!Array.isArray(parsed?.timestamps)) return { timestamps: [] };
    return { timestamps: parsed.timestamps.filter((ts) => Number.isFinite(ts)) };
  } catch {
    return { timestamps: [] };
  }
}

function writeState(flow: AuthFlow, state: AuthAttemptState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(flow), JSON.stringify(state));
  } catch {
    // Ignore storage failures (private mode / quota) and continue.
  }
}

function pruneWindow(state: AuthAttemptState, now = Date.now()): AuthAttemptState {
  return {
    timestamps: state.timestamps.filter((ts) => now - ts <= WINDOW_MS),
  };
}

export function getAuthBackoffMs(flow: AuthFlow): number {
  const now = Date.now();
  const state = pruneWindow(readState(flow), now);
  writeState(flow, state);

  if (state.timestamps.length < MAX_ATTEMPTS_PER_WINDOW) {
    return 0;
  }

  const oldest = state.timestamps[0];
  return Math.max(0, WINDOW_MS - (now - oldest));
}

export function recordAuthFailure(flow: AuthFlow): void {
  const now = Date.now();
  const pruned = pruneWindow(readState(flow), now);
  const next = {
    timestamps: [...pruned.timestamps, now],
  };
  writeState(flow, next);
}

export function clearAuthFailures(flow: AuthFlow): void {
  writeState(flow, { timestamps: [] });
}

export function getSafeAuthErrorMessage(raw: string | null | undefined): string {
  const message = (raw || '').toLowerCase();

  if (!message) {
    return 'Authentication failed. Please try again.';
  }

  if (message.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (message.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }

  if (message.includes('user already registered')) {
    return 'An account already exists for this email. Please sign in.';
  }

  if (message.includes('password should be at least')) {
    return 'Password does not meet minimum requirements.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }

  return 'Authentication failed. Please try again.';
}
