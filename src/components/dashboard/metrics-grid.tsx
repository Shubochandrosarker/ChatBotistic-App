"use client"

import { MessageSquare, UserPlus, DollarSign, Send } from 'lucide-react'
import type { MetricsBundle } from '@/lib/dashboard/types'
import { MetricCard } from './metric-card'

/**
 * Client wrapper for the four headline metric cards. The dashboard page
 * is a Server Component that fetches the bundle and hands it down here,
 * where the count-up animation and the (non-serialisable) lucide icons
 * live on the client side of the boundary.
 */
export function MetricsGrid({ metrics }: { metrics: MetricsBundle }) {
  return (
    <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Active Conversations"
        value={metrics.activeConversations.current}
        icon={MessageSquare}
        accent="violet"
        delta={{
          sign: metrics.activeConversations.previous,
          label: deltaLabel(
            metrics.activeConversations.previous,
            'new today vs yesterday',
          ),
        }}
      />
      <MetricCard
        title="New Contacts Today"
        value={metrics.newContactsToday.current}
        icon={UserPlus}
        accent="blue"
        delta={{
          sign: metrics.newContactsToday.current - metrics.newContactsToday.previous,
          label: deltaLabel(
            metrics.newContactsToday.current - metrics.newContactsToday.previous,
            'vs yesterday',
          ),
        }}
      />
      <MetricCard
        title="Open Deals Value"
        value={metrics.openDealsValue}
        format={formatCurrency}
        icon={DollarSign}
        accent="emerald"
        subtitle={`${metrics.openDealsCount} open deal${metrics.openDealsCount === 1 ? '' : 's'}`}
      />
      <MetricCard
        title="Messages Sent Today"
        value={metrics.messagesSentToday.current}
        icon={Send}
        accent="amber"
        delta={{
          sign: metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
          label: deltaLabel(
            metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
            'vs yesterday',
          ),
        }}
      />
    </div>
  )
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)
}

function deltaLabel(delta: number, suffix: string): string {
  if (delta === 0) return `No change ${suffix}`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}
