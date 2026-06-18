import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'
import { leadsAPI } from '../../lib/api'
import type { Lead } from '../../types'
import { format } from 'date-fns'

interface LeadModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
}

const statusOptions = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']

export default function LeadModal({ lead, isOpen, onClose }: LeadModalProps) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(lead?.status || 'new')

  const mutation = useMutation({
    mutationFn: (newStatus: string) => leadsAPI.update(lead!.id, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClose()
    },
  })

  if (!lead) return null

  const priorityVariant = lead.priority === 'HIGH' ? 'high' : lead.priority === 'MEDIUM' ? 'medium' : 'low'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lead Details" size="lg">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{lead.name}</h3>
            {lead.company_name && <p className="text-gray-500">{lead.company_name}</p>}
          </div>
          <Badge label={lead.priority} variant={priorityVariant} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {lead.email && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Email</p>
              <p className="text-sm text-gray-900 mt-1">{lead.email}</p>
            </div>
          )}
          {lead.phone && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Phone</p>
              <p className="text-sm text-gray-900 mt-1">{lead.phone}</p>
            </div>
          )}
          {lead.country && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Country</p>
              <p className="text-sm text-gray-900 mt-1">{lead.country}</p>
            </div>
          )}
          {lead.source && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Source</p>
              <p className="text-sm text-gray-900 mt-1">{lead.source}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Lead Score</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${lead.lead_score}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900">{lead.lead_score}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Created</p>
            <p className="text-sm text-gray-900 mt-1">
              {format(new Date(lead.created_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        {lead.requirement && (
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Requirement</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{lead.requirement}</p>
          </div>
        )}

        {lead.quantity && (
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Quantity</p>
            <p className="text-sm text-gray-900 mt-1">{lead.quantity}</p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
          <div className="flex gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <button
              onClick={() => mutation.mutate(status)}
              disabled={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
