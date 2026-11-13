import type {
  ApiError,
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
    if (current.phase !== 'idle') return false;
    if (current.transactionId) {
      dispatch(actions.operationStarted('resuming'));
      const result = await api.getTransaction(current.transactionId);
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
    (checkout.attempted && !checkout.transaction) ||
    Boolean(
      checkout.transactionId &&
      (!checkout.transaction || checkout.transaction.status === 'PENDING'),
    )
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
  (dispatch, getState) => {
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
    const items = current.transactionId ? [] : current.items;
    const found = items.find((i) => i.productId === productId);
    const next = (found?.quantity ?? 0) + quantity;
    if (next > product.availableStock || (!found && items.length >= 50))
      return { ok: false, error: 'InsufficientStock' };
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
