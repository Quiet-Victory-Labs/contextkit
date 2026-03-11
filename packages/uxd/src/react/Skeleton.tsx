import type { HTMLAttributes } from 'react';

export type SkeletonVariant = 'text' | 'card' | 'circle' | 'stat' | 'table';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ variant = 'text', width, height, className, style: styleProp, ...props }: SkeletonProps) {
  const style: React.CSSProperties = { ...styleProp };
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  const classes = [
    'rc-skeleton',
    `rc-skeleton--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}
