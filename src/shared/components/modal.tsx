'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({
  open,
  onClose,
  title,
  children,
  fullscreen = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  fullscreen?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = old;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={fullscreen ? 'lightbox-dialog' : 'modal-dialog'}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={fullscreen ? 'lightbox-content' : 'p-6 sm:p-8'}>
        <button autoFocus onClick={onClose} className="modal-close" aria-label="Fechar">
          <X />
        </button>
        <h2 className={fullscreen ? 'sr-only' : 'mb-5 pr-8 text-2xl font-bold text-brand-500'}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
