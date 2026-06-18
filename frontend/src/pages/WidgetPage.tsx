import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { agentAPI, companyAPI } from '../lib/api';

export default function WidgetPage() {
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: agentAPI.getSettings,
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: companyAPI.getMe,
  });

  const updateMutation = useMutation({
    mutationFn: agentAPI.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-settings'] }),
  });

  const [form, setForm] = useState<any>({});
  const merged = { ...settings, ...form };

  const embedCode = company?.widget_key
    ? `<script>
  window.AgentConfig = {
    widgetKey: "${company.widget_key}",
    primaryColor: "${merged.primary_color || '#2563eb'}",
    apiUrl: "${window.location.origin.replace(':3000', ':8000')}"
  };
</script>
<script src="${window.location.origin.replace(':3000', ':8000')}/widget/widget.js"></script>`
    : '';

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (Object.keys(form).length > 0) updateMutation.mutate(form);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Widget Settings</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
            <input
              type="text"
              defaultValue={settings?.agent_name}
              onChange={e => setForm((f: any) => ({ ...f, agent_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
            <textarea
              rows={3}
              defaultValue={settings?.welcome_message}
              onChange={e => setForm((f: any) => ({ ...f, welcome_message: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                defaultValue={settings?.primary_color || '#2563eb'}
                onChange={e => setForm((f: any) => ({ ...f, primary_color: e.target.value }))}
                className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-sm text-gray-500">{merged.primary_color || settings?.primary_color}</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Embed Code</h3>
            <button
              onClick={copyEmbed}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">
            {embedCode || 'Loading...'}
          </pre>
          <p className="text-xs text-gray-500 mt-3">
            Paste this code before the closing <code>&lt;/body&gt;</code> tag of your website.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Widget Preview</h3>
        <div className="relative bg-gray-100 rounded-xl overflow-hidden" style={{ height: 500 }}>
          <div className="absolute bottom-4 right-4">
            <div
              className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl cursor-pointer"
              style={{ backgroundColor: merged.primary_color || settings?.primary_color || '#2563eb' }}
            >
              💬
            </div>
          </div>
          <div className="absolute bottom-20 right-4 bg-white rounded-2xl shadow-xl w-72 overflow-hidden border border-gray-200">
            <div
              className="px-4 py-3 text-white"
              style={{ backgroundColor: merged.primary_color || settings?.primary_color || '#2563eb' }}
            >
              <p className="font-semibold text-sm">{merged.agent_name || settings?.agent_name || 'AI Assistant'}</p>
              <p className="text-xs opacity-80">Online</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-gray-100 rounded-2xl rounded-tl-none px-3 py-2 text-sm text-gray-800 max-w-[85%]">
                {merged.welcome_message || settings?.welcome_message || 'Hello! How can I help you today?'}
              </div>
            </div>
            <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
              <input
                disabled
                placeholder="Type a message..."
                className="flex-1 text-xs bg-gray-50 rounded-full px-3 py-2 border border-gray-200 outline-none"
              />
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: merged.primary_color || settings?.primary_color || '#2563eb' }}
              >
                ➤
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
