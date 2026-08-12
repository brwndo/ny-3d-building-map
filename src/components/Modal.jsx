import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  labelledBy,
  panelClassName = '',
  children,
  headerActions,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const fallbackTitleId = useId();
  const titleId = labelledBy ?? fallbackTitleId;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    dialogRef.current?.focus();
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="app-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`app-modal-panel ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="app-modal-header">
          <div className="app-modal-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="app-modal-sub">{subtitle}</p> : null}
          </div>
          <div className="app-modal-header-actions">
            {headerActions}
            <button type="button" className="close-button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
