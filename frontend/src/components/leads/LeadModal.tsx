import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '../ui/Modal';
import { Badge, priorityVariant, statusVariant } from '../ui/Badge';
import { leadsAPI } from '../../lib/api';
import type { Lead } from '../../types';

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
}

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'lost'];

export default function LeadModal({ lead, onClose }: LeadModalProps) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => leadsAPI.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); },
  });

  if (!lead) return null;

  return (
    <Modal open={!!lead} onClose={onClose} title="Lead Details" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Name', value: lead.name },
            { label: 'Email', value: lead.email },
            { label: 'Phone', value: lead.phone },
            { label: 'Company', value: lead.company_name },
            { label: 'Country', value: lead.country },
            { label: 'Lead Score', value: lead.lead_score },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs text-gray-500">{f.label}</p>
              <p className="font-medium text-gray-900">{f.value || '—'}</p>
            </div>
          ))}
        </div>
        {lead.requirement && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Requirement</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{lead.requirement}</p>
          </div>
        )}
        <div className="flex items-center gap-4">
          <Badge variant={priorityVariant(lead.priority)}>{lead.priority}</Badge>
          <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-2">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => mutation.mutate({ id: lead.id, status: s })}
                disabled={lead.status === s || mutation.isPending}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${lead.status === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400">Created: {new Date(lead.created_at).toLocaleString()}</p>
      </div>
    </Modal>
  );
}
