import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant =
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'success'
  | 'error'
  | 'warning'
  | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children?: ReactNode;
}

export function Badge({ variant, className, children, ...props }: BadgeProps) {
  const classes = ['rc-badge', `rc-badge--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
