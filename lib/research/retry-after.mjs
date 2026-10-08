// Retry-After supports both delay-seconds and an HTTP date. Never retry automatically.
export function retryAfterSeconds(value, now = Date.now()) {
  if (!value?.trim()) return 60;
  const text = value.trim();
  const seconds = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : (Date.parse(text) - now) / 1000;
  return Number.isFinite(seconds) ? Math.min(86400, Math.max(1, Math.ceil(seconds))) : 60;
}
export function retryWindow(value, now = Date.now()) {
  return {startedAt:now,retryAt:now+retryAfterSeconds(value,now)*1000};
}
