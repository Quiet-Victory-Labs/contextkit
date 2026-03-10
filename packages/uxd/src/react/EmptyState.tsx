import type { HTMLAttributes, ReactNode } from 'react';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  message,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const classes = ['rc-empty', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {icon && <div className="rc-empty__icon">{icon}</div>}
      <p className="rc-empty__message">{message}</p>
      {action}
    </div>
  );
}
