import { createContext, useContext, useCallback, useState, useEffect, useRef, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  toast: (variant: ToastVariant, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const ICONS: Record<ToastVariant, string> = {
  success: '\u2713',
  error: '\u2715',
  warning: '\u26A0',
  info: '\u2139',
};

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  error: 0, // persist until dismissed
  warning: 4000,
  info: 4000,
};

function ToastItem({ toast: t, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(t.id), 150);
  }, [t.id, onDismiss]);

  useEffect(() => {
    const dur = t.duration ?? DEFAULT_DURATION[t.variant];
    if (dur > 0) {
      timerRef.current = setTimeout(dismiss, dur);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [t, dismiss]);

  return (
    <div className={`rc-toast rc-toast--${t.variant}${exiting ? ' rc-toast--exiting' : ''}`} role="alert">
      <span className="rc-toast__icon" aria-hidden="true">{ICONS[t.variant]}</span>
      <span className="rc-toast__content">{t.message}</span>
      <button className="rc-toast__dismiss" onClick={dismiss} aria-label="Dismiss notification">{'\u2715'}</button>
    </div>
  );
}

let toastCounter = 0;

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((variant: ToastVariant, message: string, duration?: number) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { id, variant, message, duration }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="rc-toast-container" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
