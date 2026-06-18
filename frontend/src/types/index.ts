export interface User {
  id: string
  email: string
  full_name: string
  role: string
  company_id: string
  is_active: boolean
}

export interface Company {
  id: string
  name: string
  website_url: string
  logo_url?: string
  contact_email?: string
  support_email?: string
  sales_email?: string
  industry?: string
  description?: string
  widget_key: string
  is_active: boolean
}

export interface AgentSettings {
  id: string
  company_id: string
  agent_name: string
  welcome_message: string
  suggested_questions: string[]
  primary_color: string
  llm_model: string
  temperature: number
  max_tokens: number
  system_prompt: string
}

export interface Document {
  id: string
  company_id: string
  filename: string
  file_type: string
  file_size: number
  status: 'pending' | 'processing' | 'done' | 'failed'
  chunk_count: number
  created_at: string
}

export interface WebsitePage {
  id: string
  url: string
  title: string
  content: string
  status: string
  crawled_at: string
}

export interface ChatSession {
  id: string
  session_token: string
  visitor_name?: string
  visitor_email?: string
  visitor_ip?: string
  started_at: string
  last_activity: string
  message_count: number
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  intent?: string
  lead_score?: number
  created_at: string
}

export interface Lead {
  id: string
  company_id: string
  session_id?: string
  name: string
  email?: string
  phone?: string
  company_name?: string
  country?: string
  requirement?: string
  quantity?: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  lead_score: number
  status: string
  source?: string
  created_at: string
}

export interface LeadStats {
  total: number
  high_priority: number
  medium_priority: number
  new_count: number
  by_country: { country: string; count: number }[]
}

export interface AnalyticsDashboard {
  total_sessions: number
  total_messages: number
  total_leads: number
  conversion_rate: number
  active_today: number
}

export interface DailyAnalytics {
  date: string
  sessions: number
  messages: number
  leads: number
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}
