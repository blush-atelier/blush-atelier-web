import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CheckoutForm } from '../../domain/contracts';
import { validateForm } from '../../domain/presentation';
import { actions } from '../../application/state';
import {
  prepareCheckout,
  reserveCheckout,
  refreshQuote,
} from '../../application/operations';
import { useAppDispatch, useAppSelector } from '../hooks';
import { Icon } from './Icon';
import { ProductArt } from './ProductArt';
import { SummaryBackdrop } from './SummaryBackdrop';
import { OrderSummary } from './OrderSummary';
import { ErrorNotice, Loading } from './Feedback';
const blankForm: CheckoutForm = {
  fullName: '',
  email: '',
  phone: '',
  addressLine: '',
  city: '',
  region: '',
};
const fields: {
  name: keyof CheckoutForm;
  label: string;
  placeholder: string;
  autoComplete: string;
  type?: string;
  maxLength: number;
}[] = [
  {
    name: 'fullName',
    label: 'Nombre y apellido',
    placeholder: '¿Cómo te llamas?',
    autoComplete: 'name',
    maxLength: 120,
  },
  {
    name: 'email',
    label: 'Correo electrónico',
    placeholder: 'tu@correo.com',
    autoComplete: 'email',
    type: 'email',
    maxLength: 254,
  },
  {
    name: 'phone',
    label: 'Teléfono de contacto',
    placeholder: '+57 300 123 4567',
    autoComplete: 'tel',
    type: 'tel',
    maxLength: 30,
  },
  {
    name: 'addressLine',
    label: 'Dirección de entrega',
    placeholder: 'Calle, número, apartamento…',
    autoComplete: 'street-address',
    maxLength: 250,
  },
  {
    name: 'city',
    label: 'Ciudad',
    placeholder: 'Tu ciudad',
    autoComplete: 'address-level2',
    maxLength: 100,
  },
  {
    name: 'region',
    label: 'Departamento',
    placeholder: 'Tu departamento',
    autoComplete: 'address-level1',
    maxLength: 100,
  },
];
export function CheckoutDialog() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const checkout = useAppSelector((state) => state.checkout);
  const product = useAppSelector(
    (state) =>
      state.products.find((value) => value.id === state.checkout.productId) ||
      (state.detail?.id === state.checkout.productId ? state.detail : null),
  );
  const products = useAppSelector((state) => state.products);
  const detail = useAppSelector((state) => state.detail);
  const selection = checkout.items.map((i) => ({
    quantity: i.quantity,
    product:
      detail?.id === i.productId
        ? detail
        : products.find((p) => p.id === i.productId),
  }));
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState<CheckoutForm>(blankForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CheckoutForm, string>>
  >({});
  const open = checkout.step === 'details' || checkout.step === 'review';
  const busy = checkout.phase !== 'idle';
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    const previous = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = 'hidden';
    heading.current?.focus();
    return () => {
      dialog.current?.close();
      document.body.style.overflow = previous;
      if (opener.current?.isConnected) opener.current.focus();
      setForm(blankForm);
      setErrors({});
    };
  }, [open]);
  useEffect(() => {
    if (open) {
      heading.current?.focus({ preventScroll: true });
      // El scroll del formulario no debe ocultar el inicio del resumen.
      if (dialog.current) dialog.current.scrollTop = 0;
    }
  }, [checkout.step, open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = validateForm(form);
    setErrors(issues);
    const first = Object.keys(issues)[0];
    if (first) {
      dialog.current
        ?.querySelector<HTMLInputElement>(`[name="${first}"]`)
        ?.focus();
      return;
    }
    await dispatch(prepareCheckout(form));
  }
  async function reserve() {
    if (await dispatch(reserveCheckout())) navigate('/pedido');
  }
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog"
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        event.preventDefault();
        dispatch(actions.checkoutClosed());
      }}
      data-stage={checkout.step}
    >
      <div className="dialog-header">
        <div>
          <h2 ref={heading} id="checkout-title" tabIndex={-1}>
            {checkout.step === 'details'
              ? 'Tus datos y entrega.'
              : 'Resumen de tu compra.'}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Cerrar checkout"
          disabled={busy}
          onClick={() => dispatch(actions.checkoutClosed())}
        >
          <Icon name="close" />
        </button>
      </div>
      <ol className="checkout-steps" aria-label="Pasos de tu compra">
        <li className="is-active">
          <span>
            {checkout.step === 'review' ? <Icon name="check" /> : '01'}
          </span>
          Entrega
        </li>
        <li
          className={checkout.step === 'review' ? 'is-active' : ''}
          aria-current={checkout.step === 'review' ? 'step' : undefined}
        >
          <span>02</span>Resumen
        </li>
      </ol>
      <div className="dialog-body">
        <ErrorNotice error={checkout.error} />
        {checkout.step === 'details' ? (
          <form onSubmit={submit} noValidate>
            <p className="form-intro">
              Tu selección está en el carrito. Ahora cuéntanos a dónde llegará.
              <br />
              <span>Entrega en Colombia.</span>
            </p>
            <details className="checkout-basket">
              <summary>
                <span>
                  Tu selección ·{' '}
                  {selection.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                  unidades
                </span>
                <Icon name="chevron" />
              </summary>
              <div className="checkout-selection-list">
                {selection.map(
                  ({ product, quantity }) =>
                    product && (
                      <div className="checkout-selection" key={product.id}>
                        <ProductArt product={product} />
                        <div>
                          <strong>{product.name}</strong>
                          <p>Cantidad: {quantity}</p>
                        </div>
                      </div>
                    ),
                )}
              </div>
            </details>
            <button
              type="button"
              className="text-button checkout-cart-link"
              disabled={busy}
              onClick={() => {
                dispatch(actions.checkoutClosed());
                navigate('/carrito');
              }}
            >
              Revisar carrito
            </button>
            <fieldset disabled={busy}>
              <legend className="sr-only">Contacto y dirección</legend>
              <div className="checkout-fields">
                {fields.map((field) => (
                  <div
                    className={`form-field ${['fullName', 'addressLine'].includes(field.name) ? 'form-field--wide' : ''}`}
                    key={field.name}
                  >
                    <label
                      className="field-label"
                      htmlFor={`checkout-${field.name}`}
                    >
                      {field.label}
                    </label>
                    <input
                      id={`checkout-${field.name}`}
                      name={field.name}
                      type={field.type || 'text'}
                      autoComplete={field.autoComplete}
                      placeholder={field.placeholder}
                      maxLength={field.maxLength}
                      required
                      value={form[field.name]}
                      aria-invalid={Boolean(errors[field.name])}
                      aria-describedby={
                        errors[field.name] ? `error-${field.name}` : undefined
                      }
                      onChange={(event) => {
                        setForm((value) => ({
                          ...value,
                          [field.name]: event.target.value,
                        }));
                        setErrors((value) => ({
                          ...value,
                          [field.name]: undefined,
                        }));
                      }}
                    />
                    {errors[field.name] && (
                      <p className="field-error" id={`error-${field.name}`}>
                        {errors[field.name]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
            <div className="payment-note">
              <span className="payment-note-label">
                Pago con tarjeta <small>Próximamente</small>
              </span>
              <p>
                Hoy solo prepararás una reserva. No hay cobros y no te pediremos
                información de tu tarjeta.
              </p>
            </div>
            <div className="dialog-actions">
              <p>El resumen mostrará todos los importes antes de reservar.</p>
              <button
                className="button button--dark"
                disabled={busy}
                type="submit"
              >
                {busy ? 'Preparando resumen…' : 'Revisar mi pedido'}
                {!busy && <Icon name="arrow" />}
              </button>
            </div>
          </form>
        ) : checkout.quote ? (
          <SummaryBackdrop
            product={product}
            quantity={checkout.items.reduce((sum, i) => sum + i.quantity, 0)}
            items={selection}
          >
            <div className="review-delivery">
              {form.fullName ? (
                <div className="delivery-preview">
                  <h4>Entregar a</h4>
                  <p>
                    {form.fullName}
                    <br />
                    {form.addressLine}
                    <br />
                    {form.city}, {form.region}
                  </p>
                </div>
              ) : (
                <p className="muted">
                  Tu entrega ya está registrada en esta sesión.
                </p>
              )}
              <button
                className="text-button"
                disabled={busy || checkout.attempted}
                onClick={() => dispatch(actions.checkoutEdited())}
              >
                Editar datos de entrega
              </button>
            </div>
            <div className="review-amounts">
              <p className="eyebrow">RESUMEN DE TU PEDIDO</p>
              <OrderSummary quote={checkout.quote} />
              <div className="payment-note">
                <strong>Una reserva, sin cobros.</strong>
                <p>
                  Se apartará tu selección por 15 minutos. El pago con tarjeta
                  aún no está disponible.
                </p>
              </div>
              {checkout.error?.code === 'QuoteChanged' && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void dispatch(refreshQuote())}
                >
                  Actualizar resumen
                </button>
              )}
              <button
                className="button button--dark"
                disabled={busy || checkout.error?.code === 'QuoteChanged'}
                onClick={() => void reserve()}
              >
                {busy
                  ? 'Confirmando reserva…'
                  : checkout.attempted
                    ? 'Reintentar la misma reserva'
                    : 'Confirmar reserva'}
                {!busy && <Icon name="arrow" />}
              </button>
              <p className="safe-note">
                Tu reserva queda identificada para evitar duplicados si
                necesitas reintentar.
              </p>
            </div>
          </SummaryBackdrop>
        ) : (
          <div className="restore-summary">
            <Loading
              label={
                busy
                  ? 'Recuperando tu resumen…'
                  : 'Tu resumen necesita actualizarse.'
              }
            />
            <button
              className="button button--outline"
              disabled={busy}
              onClick={() => void dispatch(refreshQuote())}
            >
              Recuperar resumen
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
