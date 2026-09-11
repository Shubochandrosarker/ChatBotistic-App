// Tenancy tags for the white-label (tochat.be) API.
//
// The authoritative tag for an org lives in `tochat_org_config.user_client`
// (migration 020), seeded by:
//   - SSO provisioning (src/lib/sso/provision.ts) — WordPress users
//     inherit the connector's `cbc-{wp_user_id}` tag so widgets created
//     in the member portal stay visible in this dashboard;
//   - migration backfill — `org-{uuid}` for app-native orgs.
//
// The helpers below are the deterministic fallbacks used when no row
// exists yet; org-config.ts resolves the real value at request time.

/** Deterministic app-native tag for an org. */
export function tochatUserClientForOrg(orgId: string): string {
  return `org-${orgId}`
}

/**
 * The WordPress connector's tag for a WP user id (class-store.php:
 * `Store::user_client()`). Used when importing/provisioning orgs from
 * the SaaS member portal so both surfaces address the same rows.
 */
export function tochatUserClientForWpUser(wpUserId: string | number): string {
  return `cbc-${wpUserId}`
}
