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
  resourceIdFromIri,
  type TochatWidget,
  type TochatOperator,
  type TochatFaqGroup,
} from './client'
import { tochatUserClientForOrg } from './org'

export async function widgetOwnedByOrg(widgetId: string, orgId: string): Promise<TochatWidget | null> {
  const widget = (await widgets.get(widgetId)) as TochatWidget
  if (widget.userClient !== tochatUserClientForOrg(orgId)) return null
  return widget
}

export async function operatorOwnedByOrg(
  operatorId: string,
  orgId: string,
): Promise<TochatOperator | null> {
  const operator = (await operators.get(operatorId)) as TochatOperator
  const widgetId = resourceIdFromIri(operator.business)
  if (!widgetId) return null
  const widget = await widgetOwnedByOrg(widgetId, orgId)
  return widget ? operator : null
}

export async function faqGroupOwnedByOrg(
  faqGroupId: string,
  orgId: string,
): Promise<TochatFaqGroup | null> {
  const group = (await faqGroups.get(faqGroupId)) as TochatFaqGroup
  const operatorId = resourceIdFromIri(group.whatsapp)
  if (!operatorId) return null
  const operator = await operatorOwnedByOrg(operatorId, orgId)
  return operator ? group : null
}
