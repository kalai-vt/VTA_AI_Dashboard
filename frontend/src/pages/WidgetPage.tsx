import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentAPI, companyAPI } from '../lib/api'
import type { AgentSettings, Company } from '../types'
import { Check, Copy, Plus, X, Send, Bot } from 'lucide-react'

export default function WidgetPage() {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMsg, setPreviewMsg] = useState('')
  const [previewMessages, setPreviewMessages] = useState([
    { role: 'assistant', content: 'Hello! How can I help you today?' }
  ])
  const [newQuestion, setNewQuestion] = useState('')

  const { data: settings } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: () => agentAPI.getSettings().then((r) => r.data as AgentSettings),
  })

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyAPI.getMe().then((r) => r.data as Company),
  })

  const [form, setForm] = useState({
    primary_color: '#3b82f6',
    agent_name: 'AI Assistant',
    welcome_message: 'Hello! How can I help you today?',
    suggested_questions: [] as string[],
  })

  useEffect(() => {
    if (settings) {
      setForm({
        primary_color: settings.primary_color || '#3b82f6',
        agent_name: settings.agent_name || 'AI Assistant',
        welcome_message: settings.welcome_message || 'Hello! How can I help you today?',
        suggested_questions: settings.suggested_questions || [],
      })
    }
  }, [settings])

  const mutation = useMutation({
    mutationFn: () => agentAPI.updateSettings(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-settings'] }),
  })

  const embedCode = `<script>
  window.AgentConfig = {
    widgetKey: '${company?.widget_key || 'YOUR_WIDGET_KEY'}',
    primaryColor: '${form.primary_color}',
    apiUrl: 'https://your-api.com'
  };
</script>
<script src="https://your-cdn.com/widget.js" async></script>`

  const copyCode = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setForm((f) => ({ ...f, suggested_questions: [...f.suggested_questions, newQuestion.trim()] }))
      setNewQuestion('')
    }
  }

  const removeQuestion = (i: number) => {
    setForm((f) => ({ ...f, suggested_questions: f.suggested_questions.filter((_, idx) => idx !== i) }))
  }

  const sendPreviewMsg = () => {
    if (!previewMsg.trim()) return
    setPreviewMessages((m) => [...m, { role: 'user', content: previewMsg }])
    setPreviewMsg('')
    setTimeout(() => {
      setPreviewMessages((m) => [...m, { role: 'assistant', content: 'This is a preview response. Connect your backend to get real AI responses.' }])
    }, 800)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Widget Configuration</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.primary_color}
                  onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
              <input
                type="text"
                value={form.agent_name}
                onChange={(e) => setForm((f) => ({ ...f, agent_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
              <textarea
                rows={3}
                value={form.welcome_message}
                onChange={(e) => setForm((f) => ({ ...f, welcome_message: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Suggested Questions</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.suggested_questions.map((q, i) => (
                  <span key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full">
                    {q}
                    <button onClick={() => removeQuestion(i)} className="hover:text-blue-900 ml-1">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                  placeholder="Add a question..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addQuestion}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              {mutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Widget Preview</h3>
            <div className="relative bg-gray-100 rounded-xl h-96 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <p className="text-gray-400 text-sm">Your website content</p>
              </div>

              {!previewOpen ? (
                <button
                  onClick={() => setPreviewOpen(true)}
                  style={{ backgroundColor: form.primary_color }}
                  className="absolute bottom-4 right-4 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  <Bot size={24} />
                </button>
              ) : (
                <div className="absolute bottom-4 right-4 w-72 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '340px' }}>
                  <div style={{ backgroundColor: form.primary_color }} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="text-white" size={18} />
                      <span className="text-white font-medium text-sm">{form.agent_name}</span>
                    </div>
                    <button onClick={() => setPreviewOpen(false)} className="text-white/70 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                    {previewMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                            m.role === 'user' ? 'text-white' : 'bg-white text-gray-700 shadow-sm'
                          }`}
                          style={m.role === 'user' ? { backgroundColor: form.primary_color } : {}}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 bg-white border-t border-gray-100 flex gap-2">
                    <input
                      type="text"
                      value={previewMsg}
                      onChange={(e) => setPreviewMsg(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendPreviewMsg()}
                      placeholder="Type a message..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button
                      onClick={sendPreviewMsg}
                      style={{ backgroundColor: form.primary_color }}
                      className="text-white px-3 py-1.5 rounded-lg"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Embed Code</h3>
          <button
            onClick={copyCode}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {copied ? <><Check size={16} className="text-green-500" /> Copied!</> : <><Copy size={16} /> Copy Code</>}
          </button>
        </div>
        <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 text-sm overflow-x-auto">
          <code>{embedCode}</code>
        </pre>
        <p className="text-xs text-gray-400 mt-3">
          Add this code snippet to your website's HTML, just before the closing &lt;/body&gt; tag.
        </p>
      </div>
    </div>
  )
}
