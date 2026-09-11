// Maps a dashboard org to the `userClient` tag Tochat.be uses to scope
// widgets/agents/leads/etc to one customer. Deterministic — no mapping
// table needed for orgs created directly in this app. If WordPress-era
// customers (tagged `cbc-{wp_user_id}`) are ever imported, add a lookup
// table at that point rather than guessing their legacy tag here.
export function tochatUserClientForOrg(orgId: string): string {
  return `org-${orgId}`
}
