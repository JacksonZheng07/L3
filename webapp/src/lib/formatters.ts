/**
 * Pure display utilities — format values for the UI.
 * No side effects, no state access, no React imports.
 */

/** Human-readable relative time from an ISO timestamp */
export function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Format a satoshi amount with locale commas and unit */
export function formatSats(amount: number): string {
  return `${amount.toLocaleString()} sats`;
}

/** Format a trust score as an integer string */
export function formatScore(score: number): string {
  return score.toFixed(0);
}

/** Truncate a display name to maxLen characters with ellipsis */
export function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 2) + '..';
}
