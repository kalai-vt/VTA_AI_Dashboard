import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/leads': 'Leads',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/knowledge': 'Knowledge Base',
  '/dashboard/widget': 'Widget',
  '/dashboard/settings': 'Settings',
}

export default function Header() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const title = pageTitles[location.pathname] || 'Dashboard'

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{user?.full_name || 'User'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
