'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ScoreTrendPoint } from '@/lib/dashboard/getDashboardAnalytics'

type Props = {
  data: ScoreTrendPoint[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; payload?: ScoreTrendPoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-bold text-neutral-900">{point?.manuscriptTitle ?? label}</p>
      <p className="text-xs text-neutral-500">{point ? formatDate(point.date) : ''}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: <strong>{entry.value?.toFixed(1) ?? '—'}</strong>
          </p>
        ))}
      </div>
    </div>
  )
}

export default function ScoreTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-600">
        Complete more evaluations to see score trends.
      </div>
    )
  }

  const chartData = data.map((p) => ({
    ...p,
    dateLabel: formatDate(p.date),
  }))

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: '#737373' }}
            axisLine={{ stroke: '#d4d4d4' }}
          />
          <YAxis
            domain={[5, 10]}
            ticks={[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]}
            tick={{ fontSize: 11, fill: '#737373' }}
            axisLine={{ stroke: '#d4d4d4' }}
            label={{ value: 'Score /10', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#737373' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
          />
          <ReferenceLine
            y={8}
            stroke="#b45309"
            strokeDasharray="8 4"
            strokeWidth={2}
            label={{
              value: 'Market-ready threshold',
              position: 'insideTopLeft',
              style: { fontSize: 11, fontWeight: 700, fill: '#b45309' },
            }}
          />
          <Line
            type="monotone"
            dataKey="overall"
            name="Overall"
            stroke="#38bdf8"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#38bdf8' }}
            activeDot={{ r: 6 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="readiness"
            name="Market Readiness"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#ef4444' }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
