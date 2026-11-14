import { CardFields, blankCard } from './CardFields';
import {
  validateCard,
  type CardInput,
  type CardConfiguration,
  type CardPreview,
} from '../../domain/card';
import {
  cardEnabled,
  loadCardConfiguration,
  prepareCardCheckout,
  clearCard,
  refreshPayment,
} from '../../application/operations';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CheckoutForm } from '../../domain/contracts';
import { validateForm } from '../../domain/presentation';
import { actions } from '../../application/state';
import {
  prepareCheckout,
  checkoutAndPay,
  refreshQuote,
} from '../../application/operations';
import { useAppDispatch, useAppSelector } from '../hooks';
import { Icon } from './Icon';
import { AtelierSelect } from './AtelierSelect';
import locations from '../data/colombia-locations.json';
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
];
export function CheckoutDialog() {
  const departments = locations as Record<string, string[]>;
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
  const [cardMode, setCardMode] = useState(false);
  const [card, setCard] = useState<CardInput>(blankCard);
  const [cardErrors, setCardErrors] = useState<
    Partial<Record<keyof CardInput, string>>
  >({});
  const [terms, setTerms] = useState<CardConfiguration | null>(null);
  const [preview, setPreview] = useState<CardPreview | null>(null);
  const connect = async () => {
    const result = await dispatch(loadCardConfiguration());
    if (result.ok) setTerms(result.value);
    else dispatch(actions.checkoutFailed({ error: result.error }));
  };
  useEffect(() => {
    setCardMode(dispatch(cardEnabled()));
  }, [dispatch]);
  const [form, setForm] = useState<CheckoutForm>(blankForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CheckoutForm, string>>
  >({});
  const open =
    checkout.step === 'details' ||
    checkout.step === 'review' ||
    checkout.paymentInProgress;
  const busy = checkout.phase !== 'idle';
  useEffect(() => {
    if (!open) return;
    if (dispatch(cardEnabled())) void connect();
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
      setCard(blankCard);
      setPreview(null);
      dispatch(clearCard());
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
    if (cardMode) {
      const cardIssues = validateCard(card);
      setCardErrors(cardIssues);
      const firstCard = Object.keys(cardIssues)[0];
      if (firstCard) {
        dialog.current
          ?.querySelector<HTMLInputElement>(`[name="card-${firstCard}"]`)
          ?.focus();
        return;
      }
    }
    const issues = checkout.transactionId ? {} : validateForm(form);
    setErrors(issues);
    const first = Object.keys(issues)[0];
    if (first) {
      dialog.current
        ?.querySelector<HTMLInputElement>(`[name="${first}"]`)
        ?.focus();
      return;
    }
    if (cardMode) {
      const issues = validateCard(card);
      setCardErrors(issues);
      const first = Object.keys(issues)[0];
      if (first || !terms) {
        dialog.current
          ?.querySelector<HTMLInputElement>(`[name="card-${first}"]`)
          ?.focus();
        return;
      }
      const result = await dispatch(prepareCardCheckout(form, card));
      if (result) {
        setPreview(result);
        setCard(blankCard);
        setCardErrors({});
      }
    } else await dispatch(prepareCheckout(form));
  }
  async function reserve() {
    if (await dispatch(checkoutAndPay())) navigate('/pedido');
  }
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog"
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          dispatch(actions.paymentUiClosed());
          dispatch(actions.checkoutClosed());
        }
      }}
      data-stage={checkout.step}
    >
      <div className="dialog-header">
        <div>
          <h2 ref={heading} id="checkout-title" tabIndex={-1}>
            {checkout.paymentInProgress
              ? 'Completando pago'
              : checkout.step === 'details'
                ? 'Tus datos y entrega.'
                : 'Resumen de tu compra.'}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Cerrar checkout"
          disabled={busy}
          onClick={() => {
            dispatch(actions.paymentUiClosed());
            dispatch(actions.checkoutClosed());
          }}
        >
          <Icon name="close" />
        </button>
      </div>
      <ol className="checkout-steps" aria-label="Pasos de tu compra">
        <li className="is-active">
          <span>
            {checkout.step === 'review' ? <Icon name="check" /> : '01'}
          </span>
          {cardMode ? 'Tarjeta y entrega' : 'Entrega'}
        </li>
        <li
          className={checkout.step === 'review' ? 'is-active' : ''}
          aria-current={checkout.step === 'review' ? 'step' : undefined}
        >
          <span>02</span>Resumen
        </li>
      </ol>
      <div className="dialog-body">
        {!cardMode && <ErrorNotice error={checkout.error} />}
        {checkout.paymentInProgress ? (
          <div className="payment-completing" role="status">
            <span className="spinner" aria-hidden="true" />
            <p className="eyebrow">CONFIRMACIÓN DE PAGO</p>
            <h3>Completando pago</h3>
            <p>
              Estamos confirmando el resultado con Wompi. No necesitas volver a
              pagar.
            </p>
            {checkout.phase === 'idle' && (
              <div className="payment-completing-actions">
                <button
                  className="button button--dark"
                  onClick={() => void dispatch(refreshPayment())}
                >
                  Consultar estado
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    dispatch(actions.paymentUiClosed());
                    dispatch(actions.checkoutClosed());
                    navigate('/pedido');
                  }}
                >
                  Ver mi pedido
                </button>
              </div>
            )}
          </div>
        ) : checkout.step === 'details' ? (
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
            {cardMode && (
              <CardFields
                value={card}
                onChange={(value) => {
                  setCard(value);
                  setCardErrors({});
                }}
                errors={cardErrors}
                terms={terms}
                disabled={busy}
                retry={() => void connect()}
              />
            )}
            {!checkout.transactionId && (
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
                  <AtelierSelect
                    label="Departamento"
                    name="region"
                    placeholder="Selecciona un departamento"
                    value={form.region}
                    options={Object.keys(departments).map((value) => ({
                      value,
                      label: value,
                    }))}
                    disabled={busy}
                    error={errors.region}
                    onChange={(region) => {
                      setForm((value) => ({ ...value, region, city: '' }));
                      setErrors((value) => ({
                        ...value,
                        region: undefined,
                        city: undefined,
                      }));
                    }}
                  />
                  <AtelierSelect
                    label="Ciudad / municipio"
                    accessibleLabel="Ciudad"
                    name="city"
                    placeholder={
                      form.region
                        ? 'Selecciona tu ciudad o municipio'
                        : 'Primero elige un departamento'
                    }
                    value={form.city}
                    options={(departments[form.region] ?? []).map((value) => ({
                      value,
                      label: value,
                    }))}
                    disabled={busy || !form.region}
                    error={errors.city}
                    onChange={(city) => {
                      setForm((value) => ({ ...value, city }));
                      setErrors((value) => ({ ...value, city: undefined }));
                    }}
                  />
                </div>
              </fieldset>
            )}
            <div className="dialog-actions">
              <p>Revisa todos los importes antes de pagar.</p>
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
                onClick={() => {
                  dispatch(clearCard());
                  setPreview(null);
                  setCard(blankCard);
                  dispatch(actions.checkoutEdited());
                }}
              >
                Editar datos de entrega
              </button>
            </div>
            <div className="review-amounts">
              <p className="eyebrow">RESUMEN DE TU PEDIDO</p>
              <OrderSummary quote={checkout.quote} />
              <div className="payment-note">
                <strong>
                  {preview
                    ? `${preview.brand} ···· ${preview.lastFour}`
                    : 'Pago con tarjeta'}
                </strong>
                <p>
                  El total incluye todos los cargos. Tu pago se confirmará de
                  forma segura con Wompi.
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
                onClick={() => {
                  if (cardMode && !preview) {
                    dispatch(actions.cardDetailsRequested());
                    return;
                  }
                  void reserve();
                }}
              >
                {busy
                  ? 'Preparando compra…'
                  : checkout.attempted
                    ? 'Reintentar la misma reserva'
                    : 'Continuar con el pago'}
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
