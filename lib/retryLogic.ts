/**
 * Pure retry-decision logic.
 */

export const MAX_RETRIES = 3;
export const BASE_DELAY_MS = 1500;

export function isRetryableStatus(status: number | undefined): boolean {
  if (status === 429) return true;
  if (status !== undefined && status >= 500 && status < 600) return true;
  return false;
}

export function extractStatusCode(err: unknown): number | undefined {
  const status = (err as any)?.status;
  return typeof status === "number" ? status : undefined;
}

export function isRetryableError(err: unknown): boolean {
  const status = extractStatusCode(err);
  if (status !== undefined) return isRetryableStatus(status);
  const name = (err as any)?.name ?? "";
  return name.includes("Connection") || name.includes("Timeout");
}

export function backoffDelayMs(attempt: number): number {
  const base = BASE_DELAY_MS * Math.pow(2, attempt - 1);
  const jitter = base * 0.3 * (Math.random() * 2 - 1);
  return Math.max(200, Math.round(base + jitter));
}
