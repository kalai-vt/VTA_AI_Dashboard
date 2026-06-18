import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { leadsAPI } from '../lib/api'
import Badge from '../components/ui/Badge'
import LeadModal from '../components/leads/LeadModal'
import type { Lead } from '../types'
import { format } from 'date-fns'
import { Download, Search } from 'lucide-react'

const ITEMS_PER_PAGE = 20

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [page, setPage] = useState(1)
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { priority, status, country, page }],
    queryFn: () =>
      leadsAPI
        .list({ priority: priority || undefined, status: status || undefined, country: country || undefined, skip: (page - 1) * ITEMS_PER_PAGE, limit: ITEMS_PER_PAGE })
        .then((r) => r.data as Lead[]),
  })

  const leads = data || []

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Country', 'Priority', 'Score', 'Status', 'Created']
    const rows = leads.map((l) => [
      l.name, l.email || '', l.phone || '', l.company_name || '',
      l.country || '', l.priority, l.lead_score, l.status,
      format(new Date(l.created_at), 'yyyy-MM-dd')
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
          <span className="bg-blue-100 text-blue-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by country..."
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
          {(priority || status || country) && (
            <button
              onClick={() => { setPriority(''); setStatus(''); setCountry('') }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No leads found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Name</th>
                  <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Company</th>
                  <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Contact</th>
                  <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Country</th>
                  <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Priority</th>
                  <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Score</th>
                  <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Status</th>
                  <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                    <td className="px-4 py-3 text-gray-500">{lead.company_name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{lead.email || '-'}</div>
                      <div className="text-gray-400 text-xs">{lead.phone || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{lead.country || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={lead.priority}
                        variant={lead.priority === 'HIGH' ? 'high' : lead.priority === 'MEDIUM' ? 'medium' : 'low'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${lead.lead_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{lead.lead_score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize text-gray-600">{lead.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {format(new Date(lead.created_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {leads.length === ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <LeadModal
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  )
}
