import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
export function ReplaceCartDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement;
    const previous = document.body.style.overflow;
    const dialog = ref.current;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    title.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="replace-dialog"
      aria-labelledby="replace-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <button
        className="icon-button"
        aria-label="Cerrar confirmación"
        onClick={onCancel}
      >
        <Icon name="close" />
      </button>
      <p className="eyebrow">UNA NUEVA ELECCIÓN</p>
      <h2 ref={title} id="replace-title" tabIndex={-1}>
        ¿Cambiamos tu esencial?
      </h2>
      <p>
        Esta compra admite un producto y varias unidades. Puedes reemplazar tu
        selección actual o conservarla.
      </p>
      <div>
        <button className="button button--outline" onClick={onCancel}>
          Conservar mi carrito
        </button>
        <button className="button button--dark" onClick={onConfirm}>
          Reemplazar producto
        </button>
      </div>
    </dialog>
  );
}
