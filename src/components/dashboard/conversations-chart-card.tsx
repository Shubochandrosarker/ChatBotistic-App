"use client"

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadConversationsSeries } from '@/lib/dashboard/queries'
import type { ConversationsSeriesPoint } from '@/lib/dashboard/types'
import { ConversationsChart } from './conversations-chart'

type RangeDays = 7 | 30 | 90

/**
 * Client shell around the conversations chart. The dashboard server
 * component streams the default 30-day series; this owns the range
 * tabs and lazily fetches the 7- and 90-day buckets on first view,
 * caching each so re-selecting a range never re-fetches.
 */
export function ConversationsChartCard({
  initial,
}: {
  initial: ConversationsSeriesPoint[]
}) {
  const [range, setRange] = useState<RangeDays>(30)
  const [series, setSeries] = useState<
    Record<RangeDays, ConversationsSeriesPoint[] | null>
  >({ 7: null, 30: initial, 90: null })
  const [loading, setLoading] = useState(false)

  const onRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r)
      if (series[r] !== null) return
      setLoading(true)
      loadConversationsSeries(createClient(), r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setLoading(false))
    },
    [series],
  )

  return (
    <ConversationsChart
      series={series}
      loading={loading}
      range={range}
      onRangeChange={onRangeChange}
    />
  )
}
