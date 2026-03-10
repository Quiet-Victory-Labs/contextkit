import type { HTMLAttributes, ReactNode } from 'react';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

export function StatCard({
  label,
  value,
  icon,
  className,
  ...props
}: StatCardProps) {
  const classes = ['rc-stat-card', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      <div className="rc-stat-card__header">
        <span className="rc-stat-card__label">{label}</span>
        {icon && <span className="rc-stat-card__icon">{icon}</span>}
      </div>
      <div className="rc-stat-card__value">{value}</div>
    </div>
  );
}
