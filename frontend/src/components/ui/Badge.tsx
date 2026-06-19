import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function priorityVariant(priority: string): BadgeVariant {
  if (priority === 'HIGH') return 'danger';
  if (priority === 'MEDIUM') return 'warning';
  return 'default';
}

export function statusVariant(status: string): BadgeVariant {
  if (status === 'converted') return 'success';
  if (status === 'contacted') return 'info';
  if (status === 'new') return 'warning';
  return 'default';
}

export default Badge;
