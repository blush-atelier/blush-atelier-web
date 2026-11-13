import type { ApiError, CheckoutForm, PendingInput } from '../domain/contracts';
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
