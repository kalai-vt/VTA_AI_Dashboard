import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Bot } from 'lucide-react';
import { companyAPI, agentAPI } from '../lib/api';

const TABS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'agent', label: 'AI Agent Config', icon: Bot },
];

const MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

export default function SettingsPage() {
  const [tab, setTab] = useState('company');
  const qc = useQueryClient();

  const { data: company } = useQuery({ queryKey: ['company'], queryFn: companyAPI.getMe });
  const { data: agentSettings } = useQuery({ queryKey: ['agent-settings'], queryFn: agentAPI.getSettings });

  const [companyForm, setCompanyForm] = useState<any>({});
  const [agentForm, setAgentForm] = useState<any>({});

  useEffect(() => { if (company) setCompanyForm({ name: company.name, website_url: company.website_url, industry: company.industry }); }, [company]);
  useEffect(() => { if (agentSettings) setAgentForm({ ...agentSettings }); }, [agentSettings]);

  const updateCompany = useMutation({
    mutationFn: companyAPI.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company'] }),
  });

  const updateAgent = useMutation({
    mutationFn: agentAPI.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-settings'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Company Profile</h3>

          {[
            { label: 'Company Name', key: 'name', type: 'text' },
            { label: 'Website URL', key: 'website_url', type: 'url' },
            { label: 'Industry', key: 'industry', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={companyForm[f.key] || ''}
                onChange={e => setCompanyForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          <button
            onClick={() => updateCompany.mutate(companyForm)}
            disabled={updateCompany.isPending}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updateCompany.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {tab === 'agent' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl space-y-4">
          <h3 className="text-base font-semibold text-gray-900">AI Agent Configuration</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LLM Model</label>
            <select
              value={agentForm.llm_model || 'gpt-4o-mini'}
              onChange={e => setAgentForm((p: any) => ({ ...p, llm_model: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature ({agentForm.temperature ?? 0.7})
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={agentForm.temperature ?? 0.7}
              onChange={e => setAgentForm((p: any) => ({ ...p, temperature: parseFloat(e.target.value) }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
            <input
              type="number" min={100} max={4000} step={100}
              value={agentForm.max_tokens || 1000}
              onChange={e => setAgentForm((p: any) => ({ ...p, max_tokens: parseInt(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea
              rows={5}
              value={agentForm.system_prompt || ''}
              onChange={e => setAgentForm((p: any) => ({ ...p, system_prompt: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <button
            onClick={() => updateAgent.mutate(agentForm)}
            disabled={updateAgent.isPending}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updateAgent.isPending ? 'Saving...' : 'Save Agent Config'}
          </button>
        </div>
      )}
    </div>
  );
}
