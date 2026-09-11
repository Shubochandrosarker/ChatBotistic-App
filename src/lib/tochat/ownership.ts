// Shared re-fetch-and-verify ownership checks for the white-label
// (tochat.be) integration.
//
// In `shared` mode the whole platform uses one master account, so a
// resource id alone never proves it's the caller's — every check walks
// up to the owning widget and compares its `userClient` tag against
// the org's tag (kept in tochat_org_config, resolved via the scope).
//
// In `isolated` mode the org's own JWT already scopes what upstream
// will even return: if the GET succeeds, the resource is theirs by
// definition, so the tag walk is skipped.

import {
  widgets,
  operators,
  faqGroups,
  bookingConfigs,
  resourceIdFromIri,
  TochatApiError,
  type TochatScope,
  type TochatWidget,
  type TochatOperator,
  type TochatFaqGroup,
  type TochatBookingConfig,
} from './client'

// A resource that genuinely doesn't exist upstream and a resource that
// exists but belongs to another org must be indistinguishable to the
// caller — both are "not found" here. Without this, an upstream 404
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

export async function widgetOwnedByOrg(
  scope: TochatScope,
  widgetId: string,
): Promise<TochatWidget | null> {
  const widget = await getOrNull(() => widgets.get(scope, widgetId) as Promise<TochatWidget>)
  if (!widget) return null
  if (scope.mode === 'isolated') return widget
  if (widget.userClient !== scope.userClient) return null
  return widget
}

export async function operatorOwnedByOrg(
  scope: TochatScope,
  operatorId: string,
): Promise<TochatOperator | null> {
  const operator = await getOrNull(() => operators.get(scope, operatorId) as Promise<TochatOperator>)
  if (!operator) return null
  if (scope.mode === 'isolated') return operator
  const widgetId = resourceIdFromIri(operator.business)
  if (!widgetId) return null
  const widget = await widgetOwnedByOrg(scope, widgetId)
  return widget ? operator : null
}

export async function faqGroupOwnedByOrg(
  scope: TochatScope,
  faqGroupId: string,
): Promise<TochatFaqGroup | null> {
  const group = await getOrNull(() => faqGroups.get(scope, faqGroupId) as Promise<TochatFaqGroup>)
  if (!group) return null
  if (scope.mode === 'isolated') return group
  const operatorId = resourceIdFromIri(group.whatsapp)
  if (!operatorId) return null
  const operator = await operatorOwnedByOrg(scope, operatorId)
  return operator ? group : null
}

export async function bookingConfigOwnedByOrg(
  scope: TochatScope,
  bookingConfigId: string,
): Promise<TochatBookingConfig | null> {
  const config = await getOrNull(() =>
    bookingConfigs.get(scope, bookingConfigId) as Promise<TochatBookingConfig>,
  )
  if (!config) return null
  if (scope.mode === 'isolated') return config
  const operatorId = resourceIdFromIri(config.whatsapp)
  if (!operatorId) return null
  const operator = await operatorOwnedByOrg(scope, operatorId)
  return operator ? config : null
}
