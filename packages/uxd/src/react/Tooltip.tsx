import { useState, useRef, useCallback, useEffect, type ReactNode, type HTMLAttributes } from 'react';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'content'> {
  content: string;
  placement?: TooltipPlacement;
  variant?: 'default' | 'info';
  children: ReactNode;
}

const GAP = 8;

export function Tooltip({ content, placement = 'top', variant = 'default', children, className, ...props }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [actualPlacement, setActualPlacement] = useState(placement);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 200);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setCoords(null);
  }, []);

  useEffect(() => {
    if (!visible || !wrapperRef.current || !tooltipRef.current) return;

    const anchor = wrapperRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;
    let place = placement;

    // Calculate position for preferred placement
    if (place === 'top') {
      top = anchor.top - tip.height - GAP;
      left = anchor.left + anchor.width / 2 - tip.width / 2;
      // Flip to bottom if clipped at top
      if (top < 4) {
        place = 'bottom';
        top = anchor.bottom + GAP;
      }
    } else if (place === 'bottom') {
      top = anchor.bottom + GAP;
      left = anchor.left + anchor.width / 2 - tip.width / 2;
      if (top + tip.height > window.innerHeight - 4) {
        place = 'top';
        top = anchor.top - tip.height - GAP;
      }
    } else if (place === 'left') {
      top = anchor.top + anchor.height / 2 - tip.height / 2;
      left = anchor.left - tip.width - GAP;
    } else {
      top = anchor.top + anchor.height / 2 - tip.height / 2;
      left = anchor.right + GAP;
    }

    // Clamp to viewport edges
    left = Math.max(4, Math.min(left, window.innerWidth - tip.width - 4));
    top = Math.max(4, Math.min(top, window.innerHeight - tip.height - 4));

    setCoords({ top, left });
    setActualPlacement(place);
  }, [visible, placement]);

  const wrapperClasses = ['rc-tooltip-wrapper', className].filter(Boolean).join(' ');
  const tooltipClasses = [
    'rc-tooltip',
    variant === 'info' && 'rc-tooltip--info',
  ].filter(Boolean).join(' ');

  return (
    <span ref={wrapperRef} className={wrapperClasses} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} {...props}>
      {children}
      {visible && (
        <span
          ref={tooltipRef}
          className={tooltipClasses}
          role="tooltip"
          style={coords ? { top: `${coords.top}px`, left: `${coords.left}px` } : { visibility: 'hidden' }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
