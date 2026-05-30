/**
 * Tiny module-level cache for the current user's pharmacy_id.
 *
 * Populated by AuthProvider as soon as it resolves the profile, so
 * non-React utilities (trackEvent, fire-and-forget helpers) can read
 * the pharmacy_id synchronously instead of re-querying `profiles`.
 *
 * Cleared on sign-out.
 */

let cachedPharmacyId: string | null = null;
let cachedUserId: string | null = null;

export const setCachedPharmacyId = (userId: string | null, pharmacyId: string | null) => {
  cachedUserId = userId;
  cachedPharmacyId = pharmacyId;
};

export const getCachedPharmacyId = (forUserId?: string): string | null => {
  if (forUserId && cachedUserId !== forUserId) return null;
  return cachedPharmacyId;
};

export const clearAuthCache = () => {
  cachedUserId = null;
  cachedPharmacyId = null;
};
