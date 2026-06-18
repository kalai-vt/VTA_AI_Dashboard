import { useQuery } from '@tanstack/react-query'
import { analyticsAPI, leadsAPI } from '../lib/api'
import StatsCard from '../components/ui/StatsCard'
import Badge from '../components/ui/Badge'
import { useAuthStore } from '../store/authStore'
import { MessageSquare, Users, BarChart3, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AnalyticsDashboard, Lead } from '../types'
import { format } from 'date-fns'

export default function DashboardHome() {
  const user = useAuthStore((s) => s.user)
  const { data: analyticsData } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsAPI.dashboard().then((r) => r.data as AnalyticsDashboard),
  })
  const { data: leadsData } = useQuery({
    queryKey: ['leads', { limit: 5 }],
    queryFn: () => leadsAPI.list({ limit: 5 }).then((r) => r.data as Lead[]),
  })

  const analytics = analyticsData || { total_sessions: 0, total_messages: 0, total_leads: 0, conversion_rate: 0, active_today: 0 }
  const leads = leadsData || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.full_name?.split(' ')[0] || 'there'} 👋
        </h2>
        <p className="text-gray-500 mt-1">Here's what's happening with your AI agent today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total Sessions"
          value={analytics.total_sessions.toLocaleString()}
          icon={<MessageSquare size={20} />}
          color="blue"
          trend={{ value: 12, positive: true }}
        />
        <StatsCard
          title="Total Leads"
          value={analytics.total_leads.toLocaleString()}
          icon={<Users size={20} />}
          color="green"
          trend={{ value: 8, positive: true }}
        />
        <StatsCard
          title="Messages Today"
          value={analytics.active_today.toLocaleString()}
          icon={<BarChart3 size={20} />}
          color="purple"
          trend={{ value: 3, positive: true }}
        />
        <StatsCard
          title="Conversion Rate"
          value={`${analytics.conversion_rate.toFixed(1)}%`}
          icon={<TrendingUp size={20} />}
          color="orange"
          trend={{ value: 2, positive: false }}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Leads</h3>
          <Link to="/dashboard/leads" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View all →
          </Link>
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-30" />
            <p>No leads yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Name</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Company</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Priority</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Score</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{lead.name}</td>
                    <td className="py-3 text-gray-500">{lead.company_name || '-'}</td>
                    <td className="py-3">
                      <Badge
                        label={lead.priority}
                        variant={lead.priority === 'HIGH' ? 'high' : lead.priority === 'MEDIUM' ? 'medium' : 'low'}
                      />
                    </td>
                    <td className="py-3 text-gray-900">{lead.lead_score}/100</td>
                    <td className="py-3 text-gray-500">{format(new Date(lead.created_at), 'MMM d')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/dashboard/knowledge"
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="bg-blue-100 rounded-xl p-3">
            <BarChart3 className="text-blue-600" size={22} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Start Crawling</p>
            <p className="text-sm text-gray-500">Index your website</p>
          </div>
        </Link>
        <Link
          to="/dashboard/knowledge"
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="bg-green-100 rounded-xl p-3">
            <Users className="text-green-600" size={22} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Upload Document</p>
            <p className="text-sm text-gray-500">Add to knowledge base</p>
          </div>
        </Link>
        <Link
          to="/dashboard/widget"
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="bg-purple-100 rounded-xl p-3">
            <MessageSquare className="text-purple-600" size={22} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">View Widget</p>
            <p className="text-sm text-gray-500">Customize & embed</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
