import { type ReactNode, type HTMLAttributes } from 'react';
import { Tooltip } from './Tooltip.js';

export interface ConceptTermProps extends HTMLAttributes<HTMLSpanElement> {
  term: string;
  definition: string;
  children?: ReactNode;
}

export function ConceptTerm({ term, definition, children, className, ...props }: ConceptTermProps) {
  const classes = ['rc-concept-term', className].filter(Boolean).join(' ');

  return (
    <Tooltip content={definition} variant="info" placement="top">
      <span className={classes} {...props}>
        {children ?? term}
        <svg className="rc-concept-term__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </span>
    </Tooltip>
  );
}
