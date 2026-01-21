/**
 * Time formatting utilities for UI display
 * Track B: "Trust Screens" — relative time gives users context
 */

/**
 * Format a timestamp as relative time ("2 minutes ago", "just now", etc.)
 * Provides reassuring context about when jobs were created/updated.
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  const then = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 10) {
    return "just now";
  } else if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  } else if (diffMinutes === 1) {
    return "1 minute ago";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else if (diffHours === 1) {
    return "1 hour ago";
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    // For older items, show absolute date
    return then.toLocaleDateString();
  }
}

/**
 * Format duration for "still running" context
 * Example: "Running for 2 minutes"
 */
export function formatDuration(timestamp: string | Date): string {
  const now = new Date();
  const then = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 1) {
    return "less than a minute";
  } else if (diffMinutes === 1) {
    return "1 minute";
  } else {
    return `${diffMinutes} minutes`;
  }
}
