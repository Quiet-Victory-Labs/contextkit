import { useState, useEffect, useRef, useCallback, useId, type ReactNode } from 'react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  requireTyping?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  requireTyping,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const canConfirm = requireTyping ? typed === requireTyping : true;

  useEffect(() => {
    if (!open) { setTyped(''); return; }
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab') {
        const modal = overlayRef.current?.querySelector('.rc-modal');
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    if (!requireTyping) cancelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onCancel, requireTyping]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel();
  }, [onCancel]);

  if (!open) return null;

  const btnVariant = variant === 'danger' ? 'rc-btn rc-btn--danger' : 'rc-btn rc-btn--primary';

  return (
    <div className="rc-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="rc-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 className="rc-modal__title" id={titleId}>{title}</h2>
        <div className="rc-modal__description">{description}</div>
        {requireTyping && (
          <div>
            <p className="rc-modal__typing-label">
              Type <strong>{requireTyping}</strong> to confirm:
            </p>
            <input
              className="rc-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              spellCheck={false}
            />
          </div>
        )}
        <div className="rc-modal__actions">
          <button className="rc-btn rc-btn--secondary" onClick={onCancel} ref={cancelRef}>
            {cancelLabel}
          </button>
          <button className={btnVariant} onClick={onConfirm} disabled={!canConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
