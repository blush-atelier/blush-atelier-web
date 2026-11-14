import type { CardInput, CardConfiguration, CardPreview } from '../domain/card';
import type {
  ApiError,
  ApiResult,
  Transaction,
  CheckoutForm,
  PendingInput,
  CartItem,
} from '../domain/contracts';
import type { CartError, Result } from '../domain/contracts';
import type { CheckoutState } from './state';
import type { AppThunk } from './store';
import { actions } from './state';
const unexpected: ApiError = { code: 'NetworkError', status: 0 };
export const loadProducts =
  (): AppThunk =>
  async (dispatch, getState, { api }) => {
    if (getState().catalogueStatus === 'loading') return false;
    dispatch(actions.catalogueStarted());
    const result = await api.listProducts();
    if (!result.ok) {
      dispatch(actions.catalogueFailed(result.error));
      return false;
    }
    dispatch(actions.catalogueReady(result.value));
    return true;
  };
export const loadProduct =
  (id: string): AppThunk =>
  async (dispatch, getState, { api }) => {
    if (getState().detailId === id && getState().detailStatus === 'loading')
      return false;
    dispatch(actions.detailStarted(id));
    const result = await api.getProduct(id);
    if (!result.ok) {
      dispatch(actions.detailFailed({ id, error: result.error }));
      return false;
    }
    dispatch(actions.detailReady(result.value));
    return true;
  };
export const openCheckout =
  (productId: string, quantity: number): AppThunk<boolean> =>
  (dispatch, getState) => {
    const current = getState().checkout;
    if (
      current.phase !== 'idle' ||
      (current.attempted && !current.transaction) ||
      (current.transactionId &&
        (!current.transaction || current.transaction.status === 'PENDING'))
    )
      return false;
    dispatch(actions.checkoutOpened({ productId, quantity }));
    return true;
  };
export const prepareCheckout =
  (input: CheckoutForm): AppThunk =>
  async (dispatch, getState, { api, runtime }) => {
    const before = getState().checkout;
    if (
      before.phase !== 'idle' ||
      !before.productId ||
      before.transactionId ||
      before.attempted
    )
      return false;
    dispatch(actions.operationStarted('preparing'));
    // Los datos personales viven en este cierre, nunca en payloads de acciones Redux.
    try {
      const customer = await api.registerCustomer({
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
      });
      if (!customer.ok) {
        dispatch(actions.checkoutFailed({ error: customer.error }));
        return false;
      }
      const delivery = await api.registerDelivery({
        recipientName: input.fullName.trim(),
        recipientPhone: input.phone.trim(),
        addressLine: input.addressLine.trim(),
        city: input.city.trim(),
        region: input.region.trim(),
        countryCode: 'CO',
      });
      if (!delivery.ok) {
        dispatch(actions.checkoutFailed({ error: delivery.error }));
        return false;
      }
      const quote = await api.quote({
        ...(before.items.length > 1 ? { items: before.items } : {}),
        productId: before.productId,
        quantity: before.quantity,
        deliveryId: delivery.value.id,
      });
      if (!quote.ok) {
        dispatch(actions.checkoutFailed({ error: quote.error }));
        return false;
      }
      dispatch(
        actions.quoteReady({
          quote: quote.value,
          deliveryId: delivery.value.id,
          key: runtime.newKey(),
        }),
      );
      return true;
    } catch {
      dispatch(actions.checkoutFailed({ error: unexpected }));
      return false;
    }
  };
export const reserveCheckout =
  (): AppThunk =>
  async (dispatch, getState, { api }) => {
    const current = getState().checkout;
    if (
      current.phase !== 'idle' ||
      current.transactionId ||
      !current.productId ||
      !current.deliveryId ||
      !current.requestKey ||
      !current.expectedTotalMinor
    )
      return false;
    const payload: PendingInput = {
      ...(current.items.length > 1 ? { items: current.items } : {}),
      productId: current.productId,
      quantity: current.quantity,
      deliveryId: current.deliveryId,
      expectedTotalMinor: current.expectedTotalMinor,
    };
    // El suscriptor persiste clave y payload seguro ANTES del POST: un timeout se reintenta con la misma identidad.
    dispatch(actions.reservationStarted());
    try {
      const result = await api.createPending(payload, current.requestKey);
      if (!result.ok) {
        dispatch(
          actions.checkoutFailed({
            error: result.error,
            uncertain:
              result.error.status === 0 ||
              result.error.status >= 500 ||
              result.error.code === 'InvalidResponse',
          }),
        );
        void dispatch(loadProducts());
        return false;
      }
      dispatch(actions.transactionReady(result.value));
      void dispatch(loadProducts());
      return true;
    } catch {
      dispatch(actions.checkoutFailed({ error: unexpected, uncertain: true }));
      return false;
    }
  };
export const refreshQuote =
  (): AppThunk =>
  async (dispatch, getState, { api, runtime }) => {
    const current = getState().checkout;
    if (
      current.phase !== 'idle' ||
      current.attempted ||
      !current.productId ||
      !current.deliveryId
    )
      return false;
    dispatch(actions.operationStarted('resuming'));
    const result = await api.quote({
      ...(current.items.length > 1 ? { items: current.items } : {}),
      productId: current.productId,
      quantity: current.quantity,
      deliveryId: current.deliveryId,
    });
    if (!result.ok) {
      dispatch(actions.checkoutFailed({ error: result.error }));
      return false;
    }
    dispatch(
      actions.quoteReady({
        quote: result.value,
        deliveryId: current.deliveryId,
        key: runtime.newKey(),
      }),
    );
    return true;
  };
export const resumeCheckout =
  (): AppThunk =>
  async (dispatch, getState, { api }) => {
    const current = getState().checkout;
    if (
      current.phase !== 'idle' ||
      current.sessionExpired ||
      current.paymentChecking
    )
      return false;
    if (current.transactionId) {
      dispatch(actions.operationStarted('resuming'));
      const result = await api.getTransaction(current.transactionId);
      if (getState().checkout.transactionId !== current.transactionId)
        return false;
      if (!result.ok) {
        dispatch(actions.checkoutFailed({ error: result.error }));
        return false;
      }
      dispatch(actions.transactionReady(result.value));
      void dispatch(loadProducts());
      return true;
    }
    if (current.attempted) return dispatch(reserveCheckout());
    if (current.deliveryId) return dispatch(refreshQuote());
    return false;
  };

function cartLocked(checkout: CheckoutState): boolean {
  return (
    checkout.phase !== 'idle' ||
    (!checkout.sessionExpired &&
      ((checkout.attempted && !checkout.transaction) ||
        Boolean(
          checkout.transactionId &&
          (!checkout.transaction || checkout.transaction.status === 'PENDING'),
        )))
  );
}

function storeCart(items: CartItem[]) {
  return items.length
    ? actions.cartStored({ ...items[0], items })
    : actions.checkoutReset();
}
export const addToCart =
  (
    productId: string,
    quantity: number,
  ): AppThunk<Result<undefined, CartError>> =>
  (dispatch, getState, { card }) => {
    const state = getState(),
      current = state.checkout;
    if (cartLocked(current)) return { ok: false, error: 'CheckoutLocked' };
    const product =
      state.detail?.id === productId
        ? state.detail
        : state.products.find((p) => p.id === productId);
    if (!product) return { ok: false, error: 'ProductNotFound' };
    if (!Number.isSafeInteger(quantity) || quantity < 1)
      return { ok: false, error: 'InvalidQuantity' };
    const items =
      current.transactionId || current.sessionExpired ? [] : current.items;
    const found = items.find((i) => i.productId === productId);
    const next = (found?.quantity ?? 0) + quantity;
    if (next > product.availableStock || (!found && items.length >= 50))
      return { ok: false, error: 'InsufficientStock' };
    if (current.sessionExpired) card?.clear();
    dispatch(
      storeCart(
        found
          ? items.map((i) =>
              i.productId === productId ? { ...i, quantity: next } : i,
            )
          : [...items, { productId, quantity }],
      ),
    );
    return { ok: true, value: undefined };
  };
export const updateCartQuantity =
  (
    quantity: number,
    productId?: string,
  ): AppThunk<Result<undefined, CartError>> =>
  (dispatch, getState) => {
    const state = getState(),
      current = state.checkout;
    if (cartLocked(current) || current.transactionId)
      return { ok: false, error: 'CheckoutLocked' };
    const id = productId ?? current.productId;
    const item = current.items.find((i) => i.productId === id);
    const product =
      state.detail?.id === id
        ? state.detail
        : state.products.find((p) => p.id === id);
    if (!product || !item) return { ok: false, error: 'ProductNotFound' };
    if (!Number.isSafeInteger(quantity) || quantity < 1)
      return { ok: false, error: 'InvalidQuantity' };
    if (quantity > product.availableStock && quantity >= item.quantity)
      return { ok: false, error: 'InsufficientStock' };
    dispatch(
      storeCart(
        current.items.map((i) => (i.productId === id ? { ...i, quantity } : i)),
      ),
    );
    return { ok: true, value: undefined };
  };
export const removeFromCart =
  (productId?: string): AppThunk<boolean> =>
  (dispatch, getState) => {
    const current = getState().checkout;
    if (cartLocked(current) || current.transactionId) return false;
    dispatch(
      storeCart(
        productId ? current.items.filter((i) => i.productId !== productId) : [],
      ),
    );
    return true;
  };
export const beginCartCheckout =
  (): AppThunk<boolean> => (dispatch, getState) => {
    const state = getState(),
      current = state.checkout;
    if (cartLocked(current) || current.transactionId || !current.items.length)
      return false;
    if (
      current.items.some((i) => {
        const p =
          state.detail?.id === i.productId
            ? state.detail
            : state.products.find((p) => p.id === i.productId);
        return !p || i.quantity > p.availableStock;
      })
    )
      return false;
    dispatch(actions.cartDetailsRequested());
    return true;
  };

export const refreshPayment =
  (providerPaymentId?: string): AppThunk =>
  async (dispatch, getState, { api }) => {
    const current = getState().checkout;
    if (
      current.phase !== 'idle' ||
      !current.transactionId ||
      current.sessionExpired ||
      current.paymentChecking
    )
      return false;
    if (current.paymentInProgress && !current.paymentSubmitted) return false;
    // La consulta de fondo no cambia la fase visual ni desmonta las acciones.
    dispatch(actions.paymentCheckStarted());
    const verified = await api.verifyPayment(
      current.transactionId,
      providerPaymentId ?? current.providerPaymentId ?? undefined,
    );
    if (getState().checkout.transactionId !== current.transactionId)
      return false;
    if (!verified.ok) {
      dispatch(actions.paymentCheckFailed(verified.error));
      return false;
    }
    if (verified.value.submitted) dispatch(actions.paymentSubmissionStarted());
    const result = await api.getTransaction(current.transactionId);
    if (getState().checkout.transactionId !== current.transactionId)
      return false;
    if (!result.ok) {
      dispatch(actions.paymentCheckFailed(result.error));
      return false;
    }
    dispatch(actions.paymentChecked(result.value));
    if (
      current.transaction?.status !== result.value.status ||
      current.transaction?.reservationStatus !==
        result.value.reservationStatus ||
      !getState().products.length
    )
      void dispatch(loadProducts());
    return true;
  };

export const startPayment =
  (): AppThunk =>
  async (dispatch, getState, { api, card }) => {
    const current = getState().checkout;
    if (
      current.phase !== 'idle' ||
      !current.transactionId ||
      current.transaction?.status !== 'PENDING'
    )
      return false;
    if (card) {
      dispatch(actions.operationStarted('paying'));
      const verified = await api.verifyPayment(current.transactionId);
      if (!verified.ok) {
        dispatch(actions.checkoutFailed({ error: verified.error }));
        return false;
      }
      if (verified.value.submitted || current.providerPaymentId) {
        dispatch(actions.paymentSubmissionStarted());
        dispatch(actions.operationStarted('idle'));
        return dispatch(refreshPayment());
      }
      const authorization = card.authorization();
      if (!authorization || !api.chargePayment) {
        dispatch(actions.cardDetailsRequested());
        return false;
      }
      dispatch(actions.operationStarted('paying'));
      dispatch(actions.paymentSubmissionStarted());
      try {
        const charged = await api.chargePayment(
          current.transactionId,
          authorization,
        );
        card.clear();
        if (!charged.ok) {
          dispatch(actions.checkoutFailed({ error: charged.error }));
          return false;
        }
        dispatch(actions.operationStarted('idle'));
        return dispatch(refreshPayment());
      } catch {
        card.clear();
        dispatch(actions.checkoutFailed({ error: unexpected }));
        return false;
      }
    }
    dispatch(
      actions.checkoutFailed({
        error: { code: 'PaymentNotConfigured', status: 503 },
      }),
    );
    return false;
  };

export const checkoutAndPay =
  (): AppThunk =>
  async (dispatch, getState, { card }) => {
    if (
      getState().checkout.phase !== 'idle' ||
      getState().checkout.paymentInProgress
    )
      return false;
    if (card && !card.authorization()) {
      dispatch(actions.cardDetailsRequested());
      return false;
    }
    if (card) dispatch(actions.paymentUiStarted());
    if (
      !getState().checkout.transactionId &&
      !(await dispatch(reserveCheckout()))
    ) {
      dispatch(actions.paymentUiClosed());
      return false;
    }
    void dispatch(startPayment());
    return true;
  };

export const cardEnabled =
  (): AppThunk<boolean> =>
  (_d, _s, { card }) =>
    Boolean(card);
export const loadCardConfiguration =
  (): AppThunk<Promise<ApiResult<CardConfiguration>>> =>
  (_d, _s, { card }) =>
    card
      ? card.configuration()
      : Promise.resolve({
          ok: false,
          error: { code: 'PaymentNotConfigured', status: 503 },
        });
export const clearCard =
  (): AppThunk<void> =>
  (_d, _s, { card }) =>
    card?.clear();
export const prepareCardCheckout =
  (input: CardInput): AppThunk<Promise<CardPreview | null>> =>
  async (dispatch, getState, { card }) => {
    const current = getState().checkout;
    if (
      !card ||
      current.phase !== 'idle' ||
      current.paymentInProgress ||
      !current.quote
    )
      return null;
    dispatch(actions.operationStarted('preparing'));
    const prepared = await card.prepare(input);
    if (!prepared.ok) {
      dispatch(actions.checkoutFailed({ error: prepared.error }));
      return null;
    }
    dispatch(actions.operationStarted('idle'));
    return prepared.value;
  };
export const payWithCard =
  (input: CardInput): AppThunk =>
  async (dispatch) => {
    if (!(await dispatch(prepareCardCheckout(input)))) return false;
    return dispatch(checkoutAndPay());
  };
export const lookupOrder =
  (reference: string): AppThunk<Promise<ApiResult<Transaction>>> =>
  async (_dispatch, _getState, { api }) => {
    const match =
      /^BA-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.exec(
        reference.trim(),
      );
    if (!match)
      return { ok: false, error: { code: 'InvalidInput', status: 400 } };
    // La referencia no concede acceso: la API comprueba también la cookie del comprador.
    const id = match[1].toLowerCase(),
      result = await api.getTransaction(id);
    if (!result.ok || result.value.status !== 'PENDING') return result;
    const verified = await api.verifyPayment(id);
    if (!verified.ok) return verified;
    return api.getTransaction(id);
  };

export const restartCheckout =
  (): AppThunk<boolean> =>
  (dispatch, getState, { card }) => {
    if (getState().checkout.phase !== 'idle') return false;
    card?.clear();
    dispatch(actions.checkoutReset());
    return true;
  };
