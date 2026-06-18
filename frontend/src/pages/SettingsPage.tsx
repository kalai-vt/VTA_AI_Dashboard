import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyAPI, agentAPI } from '../lib/api'
import type { Company, AgentSettings } from '../types'

export default function SettingsPage() {
  const [tab, setTab] = useState<'company' | 'agent'>('company')
  const queryClient = useQueryClient()

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyAPI.getMe().then((r) => r.data as Company),
  })

  const { data: agentSettings } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: () => agentAPI.getSettings().then((r) => r.data as AgentSettings),
  })

  const [companyForm, setCompanyForm] = useState({
    name: '', website_url: '', industry: '', description: '',
    contact_email: '', support_email: '', sales_email: '',
  })

  const [agentForm, setAgentForm] = useState({
    llm_model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 1000, system_prompt: '',
  })

  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || '',
        website_url: company.website_url || '',
        industry: company.industry || '',
        description: company.description || '',
        contact_email: company.contact_email || '',
        support_email: company.support_email || '',
        sales_email: company.sales_email || '',
      })
    }
  }, [company])

  useEffect(() => {
    if (agentSettings) {
      setAgentForm({
        llm_model: agentSettings.llm_model || 'gpt-4o-mini',
        temperature: agentSettings.temperature ?? 0.7,
        max_tokens: agentSettings.max_tokens || 1000,
        system_prompt: agentSettings.system_prompt || '',
      })
    }
  }, [agentSettings])

  const companyMutation = useMutation({
    mutationFn: () => companyAPI.updateMe(companyForm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  })

  const agentMutation = useMutation({
    mutationFn: () => agentAPI.updateSettings(agentForm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-settings'] }),
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('company')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'company' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Company Profile
        </button>
        <button
          onClick={() => setTab('agent')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'agent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          AI Agent Config
        </button>
      </div>

      {tab === 'company' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-5">Company Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyForm.name}
                onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <input
                type="url"
                value={companyForm.website_url}
                onChange={(e) => setCompanyForm((f) => ({ ...f, website_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input
                type="text"
                value={companyForm.industry}
                onChange={(e) => setCompanyForm((f) => ({ ...f, industry: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Technology, Retail..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={companyForm.contact_email}
                onChange={(e) => setCompanyForm((f) => ({ ...f, contact_email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
              <input
                type="email"
                value={companyForm.support_email}
                onChange={(e) => setCompanyForm((f) => ({ ...f, support_email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sales Email</label>
              <input
                type="email"
                value={companyForm.sales_email}
                onChange={(e) => setCompanyForm((f) => ({ ...f, sales_email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={companyForm.description}
                onChange={(e) => setCompanyForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          {companyMutation.isSuccess && (
            <div className="mt-4 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              Company profile saved successfully!
            </div>
          )}
          <button
            onClick={() => companyMutation.mutate()}
            disabled={companyMutation.isPending}
            className="mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {companyMutation.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {tab === 'agent' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-5">AI Agent Configuration</h3>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LLM Model</label>
              <select
                value={agentForm.llm_model}
                onChange={(e) => setAgentForm((f) => ({ ...f, llm_model: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gpt-4o-mini">GPT-4o Mini (Recommended)</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: <span className="text-blue-600 font-semibold">{agentForm.temperature}</span>
                <span className="text-gray-400 font-normal ml-2 text-xs">(0 = focused, 1 = creative)</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={agentForm.temperature}
                onChange={(e) => setAgentForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0 (Precise)</span>
                <span>1 (Creative)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
              <input
                type="number"
                value={agentForm.max_tokens}
                onChange={(e) => setAgentForm((f) => ({ ...f, max_tokens: parseInt(e.target.value) }))}
                min={100}
                max={4000}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
              <textarea
                rows={8}
                value={agentForm.system_prompt}
                onChange={(e) => setAgentForm((f) => ({ ...f, system_prompt: e.target.value }))}
                placeholder="You are a helpful AI sales and support agent for {company_name}. Your goal is to assist visitors, answer questions about our products/services, and qualify leads..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
              />
            </div>
          </div>
          {agentMutation.isSuccess && (
            <div className="mt-4 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              AI agent settings saved successfully!
            </div>
          )}
          <button
            onClick={() => agentMutation.mutate()}
            disabled={agentMutation.isPending}
            className="mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {agentMutation.isPending ? 'Saving...' : 'Save Agent Config'}
          </button>
        </div>
      )}
    </div>
  )
}
