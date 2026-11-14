import { useState, type FormEvent } from 'react';
import type { ApiError, Transaction } from '../../domain/contracts';
import { lookupOrder } from '../../application/operations';
import { useAppDispatch } from '../hooks';
import { ErrorNotice } from './Feedback';
const labels = {
  PENDING: 'Pago pendiente de confirmación',
  APPROVED: 'Pago aprobado',
  DECLINED: 'Pago no aprobado',
  ERROR: 'Pago con error',
  EXPIRED: 'Reserva finalizada',
};
export function OrderLookup() {
  const dispatch = useAppDispatch(),
    [reference, setReference] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Transaction | null>(null),
    [error, setError] = useState<ApiError | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const response = await dispatch(lookupOrder(reference));
      if (response.ok) setResult(response.value);
      else setError(response.error);
    } catch {
      setError({ code: 'NetworkError', status: 0 });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="section-wrap order-lookup"
      aria-labelledby="order-lookup-title"
    >
      <div>
        <p className="eyebrow">TU PEDIDO, A MANO</p>
        <h2 id="order-lookup-title">Consulta tu pedido</h2>
        <p>
          Escribe tu referencia desde el mismo navegador donde hiciste la
          compra.
        </p>
      </div>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="order-reference">
          Número de referencia
        </label>
        <div className="order-lookup-controls">
          <input
            id="order-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="BA-…"
            maxLength={39}
            required
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy}
          />
          <button className="button button--dark" disabled={busy} type="submit">
            {busy ? 'Consultando…' : 'Consultar pedido'}
          </button>
        </div>
        <ErrorNotice error={error} />
        {result && (
          <div
            className="order-lookup-result"
            data-state={result.status}
            role="status"
          >
            <strong>{labels[result.status]}</strong>
            <p>{result.reference}</p>
            <p>
              {result.reservationStatus === 'CONFIRMED'
                ? 'Productos asignados a tu entrega.'
                : result.reservationStatus === 'RELEASED'
                  ? 'Reserva liberada; stock físico conservado.'
                  : 'Productos reservados mientras se confirma el pago.'}
            </p>
          </div>
        )}
      </form>
    </section>
  );
}
