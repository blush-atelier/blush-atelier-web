import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { TransactionStatus } from '../../domain/contracts';
import {
  resumeCheckout,
  refreshPayment,
  startPayment,
  cardEnabled,
  restartCheckout,
} from '../../application/operations';
import { useAppDispatch, useAppSelector } from '../hooks';
import { OrderSummary } from '../components/OrderSummary';
import { ProductArt } from '../components/ProductArt';
import { Icon } from '../components/Icon';
import { OrderLookup } from '../components/OrderLookup';
import { ErrorNotice, Loading } from '../components/Feedback';
const statuses: Record<
  TransactionStatus,
  { label: string; title: string; description: string }
> = {
  PENDING: {
    label: 'RESERVA ACTIVA · PAGO PENDIENTE',
    title: 'Tu selección te espera.',
    description:
      'Guardamos tu próximo esencial por un momento. El pago todavía no está confirmado. Consulta su estado antes de abrir otro intento.',
  },
  EXPIRED: {
    label: 'RESERVA FINALIZADA',
    title: 'Todavía hay color por descubrir.',
    description:
      'La reserva terminó. Consulta la disponibilidad y prepara una nueva selección cuando quieras.',
  },
  APPROVED: {
    label: 'PAGO APROBADO',
    title: 'Gracias por elegir tu color.',
    description:
      'Tu pago está confirmado. Conserva tu referencia para consultar este pedido.',
  },
  DECLINED: {
    label: 'PAGO NO APROBADO',
    title: 'Tu pedido necesita una revisión.',
    description:
      'El estado recibido indica que el pago no fue aprobado. Consulta el estado antes de preparar otra selección.',
  },
  ERROR: {
    label: 'PEDIDO POR REVISAR',
    title: 'Hagamos una pausa.',
    description:
      'Se informó un inconveniente con el pedido. Actualiza su estado antes de volver a intentarlo.',
  },
};
export function OrderPage() {
  const hasOrder = useAppSelector((state) =>
    Boolean(state.checkout.transactionId || state.checkout.attempted),
  );
  return hasOrder ? (
    <>
      <CurrentOrder />
      <OrderLookup />
    </>
  ) : (
    <>
      <OrderLookup />
      <CurrentOrder />
    </>
  );
}
function CurrentOrder() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const checkout = useAppSelector((state) => state.checkout);
  const products = useAppSelector((state) => state.products);
  const [cardMode, setCardMode] = useState(false);
  useEffect(() => {
    setCardMode(dispatch(cardEnabled()));
  }, [dispatch]);
  const [copied, setCopied] = useState('');
  const transaction = checkout.sessionExpired ? null : checkout.transaction;
  const reset = () => {
    dispatch(restartCheckout());
    navigate('/');
  };
  if (!transaction)
    return (
      <section className="section-wrap order-page">
        <div className="order-intro">
          <p className="eyebrow">TU ESPACIO ATELIER</p>
          <h1 tabIndex={-1}>
            {checkout.transactionId || checkout.attempted
              ? 'Recuperemos tu selección.'
              : 'Aquí comienza tu próximo ritual.'}
          </h1>
          <p>
            {checkout.transactionId
              ? 'Consultamos el estado de tu pedido desde este navegador.'
              : checkout.attempted
                ? 'Estamos comprobando la misma solicitud, sin duplicar tu reserva.'
                : 'Cuando prepares un pedido, podrás consultar aquí su referencia y estado.'}
          </p>
        </div>
        <ErrorNotice
          error={cardMode ? null : checkout.error}
          retry={() => void dispatch(resumeCheckout())}
        />
        {checkout.phase !== 'idle' ? (
          <Loading label="Consultando tu selección…" />
        ) : (
          <div className="empty-order">
            {checkout.transactionId ||
            checkout.attempted ||
            checkout.deliveryId ? (
              <button
                className="button button--dark"
                onClick={() => void dispatch(resumeCheckout())}
              >
                Recuperar mi selección <Icon name="refresh" />
              </button>
            ) : (
              <Link className="button button--dark" to="/">
                Descubrir la tienda <Icon name="arrow" />
              </Link>
            )}
            {checkout.sessionExpired && (
              <>
                <p>
                  La sesión anterior ya no permite consultar el pedido. Su
                  reserva puede permanecer hasta que venza.
                </p>
                <button className="text-button" onClick={reset}>
                  Empezar una nueva selección
                </button>
              </>
            )}
          </div>
        )}
      </section>
    );
  const content = statuses[transaction.status];
  const items = transaction.items ?? [
    { productId: transaction.productId, quantity: transaction.quantity },
  ];
  const until = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(new Date(transaction.reservationExpiresAt));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(transaction.reference);
      setCopied('Referencia copiada.');
    } catch {
      setCopied(
        'Puedes seleccionar y copiar la referencia que aparece arriba.',
      );
    }
  };
  return (
    <section className="section-wrap order-page">
      <div className="order-intro">
        <p className="eyebrow">{content.label}</p>
        <h1 tabIndex={-1}>
          {checkout.paymentSubmitted && transaction.status === 'PENDING'
            ? 'Completando pago'
            : content.title}
        </h1>
        <p>{content.description}</p>
      </div>
      <ErrorNotice
        error={cardMode ? null : checkout.error}
        retry={() => void dispatch(resumeCheckout())}
      />
      <div className="order-layout">
        <div className="order-progress">
          <div className="reference-block">
            <span className="eyebrow">REFERENCIA DE TU PEDIDO</span>
            <p className="reference">{transaction.reference}</p>
            <button className="text-button" onClick={() => void copy()}>
              Copiar referencia
            </button>
            <span className="copy-status" role="status">
              {copied}
            </span>
          </div>
          <ol className="order-timeline" aria-label="Estado del pedido">
            <li className="is-complete">
              <span className="timeline-dot">
                <Icon name="check" />
              </span>
              <div>
                <h2>Pedido registrado</h2>
                <p>Tu selección tiene una referencia propia.</p>
              </div>
            </li>
            <li
              className={
                transaction.reservationStatus === 'RELEASED'
                  ? 'is-released'
                  : 'is-complete'
              }
            >
              <span className="timeline-dot">
                {transaction.reservationStatus === 'RELEASED' ? (
                  '—'
                ) : (
                  <Icon name="check" />
                )}
              </span>
              <div>
                <h2>
                  {transaction.reservationStatus === 'RELEASED'
                    ? 'Reserva liberada'
                    : transaction.reservationStatus === 'CONFIRMED'
                      ? 'Stock confirmado'
                      : 'Producto reservado'}
                </h2>
                <p>
                  {transaction.reservationStatus === 'ACTIVE'
                    ? checkout.paymentSubmitted
                      ? 'Mantenemos los productos reservados hasta verificar el resultado del pago.'
                      : `Reserva hasta las ${until}. Hora de Colombia. Actualiza el estado para verificar su vigencia.`
                    : 'Estado actualizado desde tu pedido.'}
                </p>
              </div>
            </li>
            <li
              className={
                transaction.status === 'APPROVED' ? 'is-complete' : 'is-current'
              }
            >
              <span className="timeline-dot">
                {transaction.status === 'APPROVED' ? (
                  <Icon name="check" />
                ) : (
                  '03'
                )}
              </span>
              <div>
                <h2>
                  {transaction.status === 'APPROVED'
                    ? 'Pago aprobado'
                    : transaction.status === 'DECLINED'
                      ? 'Pago no aprobado'
                      : transaction.status === 'EXPIRED'
                        ? 'Reserva finalizada'
                        : checkout.paymentSubmitted &&
                            transaction.status === 'PENDING'
                          ? 'Procesando pago'
                          : 'Pago pendiente'}
                </h2>
                <p>
                  {transaction.status === 'PENDING'
                    ? 'Consulta el estado de tu pago. Confirmamos el resultado directamente con Wompi para evitar intentos duplicados.'
                    : 'Consulta aquí las actualizaciones de tu pedido.'}
                </p>
              </div>
            </li>
            <li>
              <span className="timeline-dot">04</span>
              <div>
                <h2>
                  {transaction.status === 'APPROVED'
                    ? 'Entrega preparada'
                    : 'Entrega por confirmar'}
                </h2>
                <p>
                  {transaction.status === 'APPROVED'
                    ? 'Tu pedido está asignado a la dirección de entrega registrada.'
                    : 'La reserva no implica que el pedido se haya despachado.'}
                </p>
              </div>
            </li>
          </ol>
          <div className="order-buttons">
            {transaction.status === 'PENDING' && (
              <button
                className="button button--dark"
                disabled={checkout.phase !== 'idle'}
                onClick={() => void dispatch(startPayment())}
              >
                {checkout.phase === 'paying'
                  ? 'Comprobando pago…'
                  : checkout.providerPaymentId
                    ? 'Verificar pago'
                    : checkout.paymentSubmitted
                      ? 'Consultar pago'
                      : 'Pagar con tarjeta de crédito'}
              </button>
            )}
            <button
              className="button button--outline"
              disabled={checkout.phase !== 'idle'}
              onClick={() => void dispatch(refreshPayment())}
            >
              <Icon name="refresh" />
              {checkout.phase !== 'idle'
                ? 'Actualizando…'
                : 'Actualizar estado'}
            </button>
            <Link className="text-button" to="/">
              Volver a la tienda <Icon name="arrow" />
            </Link>
          </div>
        </div>
        <aside className="order-summary">
          <p className="eyebrow">TU SELECCIÓN</p>
          {items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return (
              product && (
                <div className="order-product" key={item.productId}>
                  <ProductArt product={product} />
                  <div>
                    <h2>
                      <Link to={`/producto/${product.id}`}>{product.name}</Link>
                    </h2>
                    <p>Cantidad: {item.quantity}</p>
                  </div>
                </div>
              )
            );
          })}
          <OrderSummary quote={transaction} />
          <p className="safe-note">
            Importes del pedido registrado. La tarjeta se tokeniza directamente
            con Wompi. No almacenamos su número ni código de seguridad.
          </p>
        </aside>
      </div>
    </section>
  );
}
