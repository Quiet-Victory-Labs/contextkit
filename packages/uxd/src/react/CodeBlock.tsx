import type { HTMLAttributes } from 'react';

export interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  code: string;
}

export function CodeBlock({ code, className, ...props }: CodeBlockProps) {
  const classes = ['rc-code', className].filter(Boolean).join(' ');

  return (
    <pre className={classes} {...props}>
      <code>{code}</code>
    </pre>
  );
}
