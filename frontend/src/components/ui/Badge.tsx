import clsx from 'clsx'

interface BadgeProps {
  label: string
  variant?: 'high' | 'medium' | 'low' | 'pending' | 'processing' | 'done' | 'failed' | 'new' | 'default'
}

const variantMap: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  processing: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  done: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  default: 'bg-gray-100 text-gray-600 border-gray-200',
}

export default function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', variantMap[variant] || variantMap.default)}>
      {label}
    </span>
  )
}
