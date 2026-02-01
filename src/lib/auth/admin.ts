export const ADMIN_UIDS = new Set<string>([
  "UAwLKrkl97RdpPIHjV4JRD08GTI2",
  "66YapQFC1jWtQIGl4f3BgvoGVH63",
]);

export function isAdminUid(uid?: string | null) {
  return !!uid && ADMIN_UIDS.has(uid);
}
