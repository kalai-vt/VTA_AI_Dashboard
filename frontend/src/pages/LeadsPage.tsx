import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { leadsAPI } from '../lib/api';
import { Badge, priorityVariant, statusVariant } from '../components/ui/Badge';
import LeadModal from '../components/leads/LeadModal';
import type { Lead } from '../types';

export default function LeadsPage() {
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', priority, status, country, page],
    queryFn: () => leadsAPI.getAll({ priority: priority || undefined, status: status || undefined, country: country || undefined, skip: page * PAGE_SIZE, limit: PAGE_SIZE }),
  });

  const { data: stats } = useQuery({
    queryKey: ['lead-stats'],
    queryFn: leadsAPI.getStats,
  });

  const exportCSV = () => {
    const rows = [['Name','Email','Phone','Company','Country','Priority','Status','Score']];
    (leads as Lead[]).forEach(l => rows.push([l.name, l.email, l.phone||'', l.company_name||'', l.country||'', l.priority, l.status, String(l.lead_score)]));
    const csv = rows.map(r => r.map(v => `"${v??''}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'leads.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: (stats as any)?.total ?? 0, color: 'text-gray-900' },
          { label: 'High Priority', value: (stats as any)?.high_priority ?? 0, color: 'text-red-600' },
          { label: 'Medium Priority', value: (stats as any)?.medium_priority ?? 0, color: 'text-yellow-600' },
          { label: 'New', value: (stats as any)?.new_count ?? 0, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <select value={priority} onChange={e => setPriority(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Priority</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <input type="text" value={country} onChange={e => setCountry(e.target.value)}
            placeholder="Filter by country"
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={exportCSV}
            className="ml-auto flex items-center gap-2 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">Company</th>
              <th className="text-left px-6 py-3">Country</th>
              <th className="text-left px-6 py-3">Priority</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>}
            {!isLoading && (leads as Lead[]).length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No leads found</td></tr>}
            {(leads as Lead[]).map(lead => (
              <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(lead)}>
                <td className="px-6 py-3 font-medium text-gray-900">{lead.name||'—'}</td>
                <td className="px-6 py-3 text-gray-600">{lead.email||'—'}</td>
                <td className="px-6 py-3 text-gray-600">{lead.company_name||'—'}</td>
                <td className="px-6 py-3 text-gray-600">{lead.country||'—'}</td>
                <td className="px-6 py-3"><Badge variant={priorityVariant(lead.priority)}>{lead.priority}</Badge></td>
                <td className="px-6 py-3"><Badge variant={statusVariant(lead.status)}>{lead.status}</Badge></td>
                <td className="px-6 py-3 text-gray-600">{lead.lead_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p-1)} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <button disabled={(leads as Lead[]).length < PAGE_SIZE} onClick={() => setPage(p => p+1)} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>
      <LeadModal lead={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
