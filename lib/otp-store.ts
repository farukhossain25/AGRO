const globalForOtp = globalThis as unknown as {
  __baOtpStore?: Map<string, { code: string; expiresAt: number }>;
};

const store =
  globalForOtp.__baOtpStore ??
  (globalForOtp.__baOtpStore = new Map<string, { code: string; expiresAt: number }>());

export function setOtp(phone: string, code: string, ttlMs = 5 * 60_000) {
  store.set(phone, { code, expiresAt: Date.now() + ttlMs });
}

export function verifyOtp(phone: string, code: string): boolean {
  const entry = store.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return false;
  }
  if (entry.code !== code) return false;
  store.delete(phone);
  return true;
}
