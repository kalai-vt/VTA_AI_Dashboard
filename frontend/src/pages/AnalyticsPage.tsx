import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { analyticsAPI } from '../lib/api'
import StatsCard from '../components/ui/StatsCard'
import { MessageSquare, Users, TrendingUp, Activity } from 'lucide-react'
import type { AnalyticsDashboard, DailyAnalytics } from '../types'
import { format, parseISO } from 'date-fns'

export default function AnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')

  const { data: dashboard } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsAPI.dashboard().then((r) => r.data as AnalyticsDashboard),
  })

  const { data: daily } = useQuery({
    queryKey: ['analytics-daily', range],
    queryFn: () => analyticsAPI.daily().then((r) => r.data as DailyAnalytics[]),
  })

  const { data: questions } = useQuery({
    queryKey: ['analytics-questions'],
    queryFn: () => analyticsAPI.questions().then((r) => r.data as { question: string; count: number }[]),
  })

  const stats = dashboard || { total_sessions: 0, total_messages: 0, total_leads: 0, conversion_rate: 0, active_today: 0 }
  const chartData = (daily || []).map((d) => ({
    ...d,
    date: format(parseISO(d.date), 'MMM d'),
  }))

  const rangeDays = range === '7d' ? 7 : range === '90d' ? 90 : 30
  const filteredData = chartData.slice(-rangeDays)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Sessions" value={stats.total_sessions.toLocaleString()} icon={<Activity size={20} />} color="blue" />
        <StatsCard title="Total Messages" value={stats.total_messages.toLocaleString()} icon={<MessageSquare size={20} />} color="purple" />
        <StatsCard title="Total Leads" value={stats.total_leads.toLocaleString()} icon={<Users size={20} />} color="green" />
        <StatsCard title="Conversion Rate" value={`${stats.conversion_rate.toFixed(1)}%`} icon={<TrendingUp size={20} />} color="orange" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sessions & Leads Over Time</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sessions" />
            <Line type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={2} dot={false} name="Leads" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Messages Per Day</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={filteredData.slice(-14)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="messages" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Messages" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {questions && questions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Asked Questions</h3>
          <div className="space-y-3">
            {questions.slice(0, 10).map((q, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-400 w-5 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm text-gray-700">{q.question}</p>
                    <span className="text-xs font-medium text-gray-500 ml-2">{q.count}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${(q.count / (questions[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
