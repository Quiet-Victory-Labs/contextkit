import type { HTMLAttributes, ReactNode } from 'react';

export interface ErrorCardProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
  action?: ReactNode;
}

export function ErrorCard({
  message,
  action,
  className,
  ...props
}: ErrorCardProps) {
  const classes = ['rc-error-card', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      <p className="rc-error-card__message">{message}</p>
      {action}
    </div>
  );
}
