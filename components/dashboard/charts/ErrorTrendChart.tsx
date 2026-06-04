'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ErrorTrendPeriod } from '@/lib/dashboard/dashboardAnalyticsTypes'
import { CRITERION_SHORT_LABELS } from '@/lib/dashboard/dashboardAnalyticsTypes'

type Props = {
  data: ErrorTrendPeriod[]
}

const CATEGORY_COLORS: Record<string, string> = {
  concept: '#38bdf8',
  narrativeDrive: '#ef4444',
  character: '#22c55e',
  voice: '#8b5cf6',
  sceneConstruction: '#f59e0b',
  dialogue: '#06b6d4',
  theme: '#ec4899',
  worldbuilding: '#14b8a6',
  pacing: '#f97316',
  proseControl: '#6366f1',
  tone: '#a3e635',
  narrativeClosure: '#fb923c',
  marketability: '#e879f9',
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const nonZero = payload.filter((e) => e.value > 0)
  if (!nonZero.length) return null
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-bold text-neutral-900">{label}</p>
      <div className="mt-2 space-y-1">
        {nonZero
          .sort((a, b) => b.value - a.value)
          .map((entry) => (
            <p key={entry.name} style={{ color: entry.color }}>
              {entry.name}: <strong>{entry.value}</strong>
            </p>
          ))}
      </div>
    </div>
  )
}

export default function ErrorTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-600">
        Complete more evaluations to see error trends.
      </div>
    )
  }

  // Collect all criterion keys that appear in the data
  const allKeys = new Set<string>()
  for (const period of data) {
    for (const key of Object.keys(period.counts)) {
      if (key !== 'other') allKeys.add(key)
    }
  }

  // Build chart data — flatten counts into top-level keys
  const chartData = data.map((period) => ({
    name: `${period.label}\n${period.manuscriptTitle}`,
    label: period.label,
    manuscriptTitle: period.manuscriptTitle,
    ...period.counts,
  }))

  const sortedKeys = [...allKeys].sort((a, b) => {
    const aTotal = data.reduce((sum, p) => sum + (p.counts[a] ?? 0), 0)
    const bTotal = data.reduce((sum, p) => sum + (p.counts[b] ?? 0), 0)
    return bTotal - aTotal
  })

  // Show at most 8 categories to avoid clutter
  const displayKeys = sortedKeys.slice(0, 8)

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#737373' }}
            axisLine={{ stroke: '#d4d4d4' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#737373' }}
            axisLine={{ stroke: '#d4d4d4' }}
            label={{ value: 'Issue count', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#737373' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="square"
          />
          {displayKeys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              name={CRITERION_SHORT_LABELS[key] ?? key}
              fill={CATEGORY_COLORS[key] ?? '#94a3b8'}
              radius={[2, 2, 0, 0]}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
