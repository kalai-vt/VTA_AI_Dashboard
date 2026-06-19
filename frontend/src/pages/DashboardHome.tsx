import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Users, TrendingUp, Activity } from 'lucide-react';
import StatsCard from '../components/ui/StatsCard';
import { analyticsAPI, leadsAPI } from '../lib/api';
import { Badge, priorityVariant, statusVariant } from '../components/ui/Badge';
import type { Lead } from '../types';

export default function DashboardHome() {
  const { data: dashboard } = useQuery({ queryKey: ['analytics-dashboard'], queryFn: analyticsAPI.getDashboard });
  const { data: leadStats } = useQuery({ queryKey: ['lead-stats'], queryFn: leadsAPI.getStats });
  const { data: recentLeads } = useQuery({ queryKey: ['leads', { limit: 5 }], queryFn: () => leadsAPI.getAll({ limit: 5 }) });
  const leads: Lead[] = Array.isArray(recentLeads) ? recentLeads : [];
  const dash: any = dashboard || {};
  const stats: any = leadStats || {};

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Sessions" value={dash.total_sessions ?? '—'} icon={MessageSquare} color="blue" />
        <StatsCard title="Total Messages" value={dash.total_messages ?? '—'} icon={Activity} color="purple" />
        <StatsCard title="Leads Generated" value={stats.total ?? '—'} icon={Users} color="green" />
        <StatsCard title="Conversion Rate" value={dash.avg_conversion_rate ? `${dash.avg_conversion_rate}%` : '—'} icon={TrendingUp} color="yellow" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Leads</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-3">Name</th><th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">Country</th><th className="text-left px-6 py-3">Priority</th>
              <th className="text-left px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No leads yet</td></tr>}
            {leads.map(lead => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-900">{lead.name || '—'}</td>
                <td className="px-6 py-3 text-gray-600">{lead.email || '—'}</td>
                <td className="px-6 py-3 text-gray-600">{lead.country || '—'}</td>
                <td className="px-6 py-3"><Badge variant={priorityVariant(lead.priority)}>{lead.priority}</Badge></td>
                <td className="px-6 py-3"><Badge variant={statusVariant(lead.status)}>{lead.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
