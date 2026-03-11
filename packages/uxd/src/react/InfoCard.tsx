import { useState, useEffect, type ReactNode, type HTMLAttributes } from 'react';

export interface InfoCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  children: ReactNode;
  storageKey: string;
  icon?: ReactNode;
}

function isDismissed(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(`rc-info-dismissed:${key}`) === '1'; }
  catch { return false; }
}

function setDismissed(key: string) {
  try { localStorage.setItem(`rc-info-dismissed:${key}`, '1'); }
  catch { /* noop */ }
}

export function resetInfoCards() {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('rc-info-dismissed:'));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* noop */ }
}

export function InfoCard({ title, children, storageKey, icon, className, ...props }: InfoCardProps) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(isDismissed(storageKey));
  }, [storageKey]);

  if (hidden) return null;

  const dismiss = () => {
    setDismissed(storageKey);
    setHidden(true);
  };

  const classes = ['rc-info-card', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="note" {...props}>
      {icon && <span className="rc-info-card__icon" aria-hidden="true">{icon}</span>}
      <div className="rc-info-card__content">
        <p className="rc-info-card__title">{title}</p>
        <p className="rc-info-card__body">{children}</p>
      </div>
      <button className="rc-info-card__dismiss" onClick={dismiss} aria-label="Dismiss tip">{'\u2715'}</button>
    </div>
  );
}
