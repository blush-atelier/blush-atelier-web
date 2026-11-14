import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cardEnabled, restartCheckout } from '../../application/operations';
import { errorMessage } from '../../domain/presentation';
import { useAppDispatch, useAppSelector } from '../hooks';
export function PaymentAlerts() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch(),
    error = useAppSelector((s) => s.checkout.error),
    [enabled, setEnabled] = useState(false),
    dialog = useRef<HTMLDialogElement>(null),
    button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setEnabled(dispatch(cardEnabled()));
  }, [dispatch]);
  useEffect(() => {
    if (!enabled || !error) return;
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    button.current?.focus();
    return () => {
      dialog.current?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [error?.code, enabled]);
  if (!enabled || !error) return null;
  return (
    <dialog
      ref={dialog}
      className="payment-alert"
      aria-labelledby="payment-alert-title"
    >
      <div className="payment-alert-content" role="alert">
        <p className="eyebrow">TU COMPRA, CON CLARIDAD</p>
        <h2 id="payment-alert-title">Revisemos un detalle</h2>
        <p>{errorMessage(error)}</p>
        <button
          ref={button}
          className="button button--dark"
          onClick={() => {
            if (error.code === 'SessionRequired') {
              dispatch(restartCheckout());
              navigate('/');
            } else dialog.current?.close();
          }}
        >
          {error.code === 'SessionRequired' ? 'Volver a comprar' : 'Entendido'}
        </button>
      </div>
    </dialog>
  );
}
