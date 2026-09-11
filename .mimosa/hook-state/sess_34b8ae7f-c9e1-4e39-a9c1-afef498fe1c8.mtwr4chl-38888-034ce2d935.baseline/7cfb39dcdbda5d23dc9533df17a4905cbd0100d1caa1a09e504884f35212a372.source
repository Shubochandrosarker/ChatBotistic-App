// Shared re-fetch-and-verify ownership checks for the Tochat.be
// integration. Tochat.be is one shared master account across every
// org on this platform, so a resource id alone never proves it's the
// caller's — every check below walks up to the owning widget and
// compares its `userClient` tag against the caller's org. See the
// "keep the re-fetch-and-verify ownership checks" note in
// ChatBotistic-System-Management/docs/CHATBOTISTIC-DASHBOARD-MASTER-PLAN.md.

import {
  widgets,
  operators,
  faqGroups,
  bookingConfigs,
  resourceIdFromIri,
  TochatApiError,
  type TochatWidget,
  type TochatOperator,
  type TochatFaqGroup,
  type TochatBookingConfig,
} from './client'
import { tochatUserClientForOrg } from './org'

// A resource that genuinely doesn't exist on Tochat.be and a resource
// that exists but belongs to another org must be indistinguishable to
// the caller — both are "not found" here. Without this, a Tochat 404
// (real message, real status) vs. our own denial (generic message)
// would let a tenant probe ids to learn which ones exist for *someone
// else*, an id-enumeration side channel. Only a genuine 404 is
// swallowed this way; any other failure (5xx, network) still throws.
async function getOrNull<T>(getter: () => Promise<T>): Promise<T | null> {
  try {
    return await getter()
  } catch (err) {
    if (err instanceof TochatApiError && err.status === 404) return null
    throw err
  }
}

export async function widgetOwnedByOrg(widgetId: string, orgId: string): Promise<TochatWidget | null> {
  const widget = await getOrNull(() => widgets.get(widgetId) as Promise<TochatWidget>)
  if (!widget) return null
  if (widget.userClient !== tochatUserClientForOrg(orgId)) return null
  return widget
}

export async function operatorOwnedByOrg(
  operatorId: string,
  orgId: string,
): Promise<TochatOperator | null> {
  const operator = await getOrNull(() => operators.get(operatorId) as Promise<TochatOperator>)
  if (!operator) return null
  const widgetId = resourceIdFromIri(operator.business)
  if (!widgetId) return null
  const widget = await widgetOwnedByOrg(widgetId, orgId)
  return widget ? operator : null
}

export async function faqGroupOwnedByOrg(
  faqGroupId: string,
  orgId: string,
): Promise<TochatFaqGroup | null> {
  const group = await getOrNull(() => faqGroups.get(faqGroupId) as Promise<TochatFaqGroup>)
  if (!group) return null
  const operatorId = resourceIdFromIri(group.whatsapp)
  if (!operatorId) return null
  const operator = await operatorOwnedByOrg(operatorId, orgId)
  return operator ? group : null
}

export async function bookingConfigOwnedByOrg(
  bookingConfigId: string,
  orgId: string,
): Promise<TochatBookingConfig | null> {
  const config = await getOrNull(() => bookingConfigs.get(bookingConfigId) as Promise<TochatBookingConfig>)
  if (!config) return null
  const operatorId = resourceIdFromIri(config.whatsapp)
  if (!operatorId) return null
  const operator = await operatorOwnedByOrg(operatorId, orgId)
  return operator ? config : null
}
