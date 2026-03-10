import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  children?: ReactNode;
}

export function Card({
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  const classes = [
    'rc-card',
    interactive && 'rc-card--interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
