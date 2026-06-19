import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MessageSquare, Users, TrendingUp, Activity } from 'lucide-react';
import StatsCard from '../components/ui/StatsCard';
import { analyticsAPI } from '../lib/api';

export default function AnalyticsPage() {
  const { data: dashboard } = useQuery({ queryKey: ['analytics-dashboard'], queryFn: analyticsAPI.getDashboard });
  const { data: daily } = useQuery({ queryKey: ['analytics-daily'], queryFn: analyticsAPI.getDaily });
  const { data: questions } = useQuery({ queryKey: ['analytics-questions'], queryFn: analyticsAPI.getQuestions });

  const dash: any = dashboard || {};
  const dailyArr: any[] = Array.isArray(daily) ? daily : [];
  const questionsArr: any[] = Array.isArray(questions) ? questions : [];

  const chartData = dailyArr.map(d => ({
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    sessions: d.chat_sessions,
    messages: d.messages,
    leads: d.leads_generated,
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Sessions" value={dash.total_sessions ?? '—'} icon={MessageSquare} color="blue" />
        <StatsCard title="Total Messages" value={dash.total_messages ?? '—'} icon={Activity} color="purple" />
        <StatsCard title="Total Leads" value={dash.total_leads ?? '—'} icon={Users} color="green" />
        <StatsCard title="Avg Conversion" value={dash.avg_conversion_rate ? `${dash.avg_conversion_rate}%` : '—'} icon={TrendingUp} color="yellow" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Sessions & Messages (30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sessions" />
              <Line type="monotone" dataKey="messages" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Messages" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Leads Generated (30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="leads" fill="#10b981" radius={[4, 4, 0, 0]} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {questionsArr.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Questions</h3>
          <div className="space-y-2">
            {questionsArr.slice(0, 10).map((q: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">{q.question}</div>
                <span className="text-xs text-gray-500 w-8 text-right">{q.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
