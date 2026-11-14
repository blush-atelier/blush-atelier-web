import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  ApiError,
  Product,
  Quote,
  SafeProgress,
  Transaction,
} from '../domain/contracts';
export interface CheckoutState {
  paymentInProgress: boolean;
  paymentSubmitted: boolean;
  providerPaymentId: string | null;
  productId: string | null;
  items: { productId: string; quantity: number }[];
  quantity: number;
  deliveryId: string | null;
  transactionId: string | null;
  requestKey: string | null;
  expectedTotalMinor: string | null;
  attempted: boolean;
  step: 'closed' | 'details' | 'review' | 'result';
  phase: 'idle' | 'preparing' | 'reserving' | 'resuming' | 'paying';
  quote: Quote | null;
  transaction: Transaction | null;
  error: ApiError | null;
}
export interface AppState {
  products: Product[];
  catalogueStatus: 'idle' | 'loading' | 'ready' | 'error';
  catalogueError: ApiError | null;
  detail: Product | null;
  detailId: string | null;
  detailStatus: 'idle' | 'loading' | 'ready' | 'error';
  detailError: ApiError | null;
  checkout: CheckoutState;
  persistenceWarning: boolean;
}
export function emptyCheckout(): CheckoutState {
  return {
    paymentInProgress: false,
    paymentSubmitted: false,
    providerPaymentId: null,
    productId: null,
    items: [],
    quantity: 1,
    deliveryId: null,
    transactionId: null,
    requestKey: null,
    expectedTotalMinor: null,
    attempted: false,
    step: 'closed',
    phase: 'idle',
    quote: null,
    transaction: null,
    error: null,
  };
}
export function initialState(progress: SafeProgress | null = null): AppState {
  const checkout = emptyCheckout();
  if (progress)
    Object.assign(checkout, progress, {
      items: progress.items ?? [
        { productId: progress.productId, quantity: progress.quantity },
      ],
      step: progress.transactionId
        ? 'result'
        : progress.deliveryId
          ? 'review'
          : 'closed',
    });
  return {
    products: [],
    catalogueStatus: 'idle',
    catalogueError: null,
    detail: null,
    detailId: null,
    detailStatus: 'idle',
    detailError: null,
    checkout,
    persistenceWarning: false,
  };
}
const slice = createSlice({
  name: 'atelier',
  initialState: initialState(),
  reducers: {
    catalogueStarted(state) {
      state.catalogueStatus = 'loading';
      state.catalogueError = null;
    },
    catalogueReady(state, action: PayloadAction<Product[]>) {
      state.products = action.payload;
      state.catalogueStatus = 'ready';
    },
    catalogueFailed(state, action: PayloadAction<ApiError>) {
      state.catalogueStatus = 'error';
      state.catalogueError = action.payload;
    },
    detailStarted(state, action: PayloadAction<string>) {
      state.detailId = action.payload;
      state.detailStatus = 'loading';
      state.detail = null;
      state.detailError = null;
    },
    detailReady(state, action: PayloadAction<Product>) {
      if (state.detailId === action.payload.id) {
        state.detail = action.payload;
        state.detailStatus = 'ready';
      }
    },
    detailFailed(
      state,
      action: PayloadAction<{ id: string; error: ApiError }>,
    ) {
      if (state.detailId === action.payload.id) {
        state.detailError = action.payload.error;
        state.detailStatus = 'error';
      }
    },
    checkoutOpened(
      state,
      action: PayloadAction<{ productId: string; quantity: number }>,
    ) {
      state.checkout = {
        ...emptyCheckout(),
        ...action.payload,
        items: [action.payload],
        step: 'details',
      };
    },
    cartStored(
      state,
      action: PayloadAction<{
        productId: string;
        quantity: number;
        items?: { productId: string; quantity: number }[];
      }>,
    ) {
      state.checkout = {
        ...emptyCheckout(),
        ...action.payload,
        items: action.payload.items ?? [
          {
            productId: action.payload.productId,
            quantity: action.payload.quantity,
          },
        ],
      };
    },
    cartDetailsRequested(state) {
      if (
        state.checkout.phase === 'idle' &&
        !state.checkout.attempted &&
        !state.checkout.transactionId
      )
        state.checkout.step =
          state.checkout.quote && state.checkout.deliveryId
            ? 'review'
            : 'details';
    },
    checkoutClosed(state) {
      if (state.checkout.phase === 'idle') state.checkout.step = 'closed';
    },
    operationStarted(state, action: PayloadAction<CheckoutState['phase']>) {
      state.checkout.phase = action.payload;
      state.checkout.error = null;
    },
    quoteReady(
      state,
      action: PayloadAction<{ quote: Quote; deliveryId: string; key: string }>,
    ) {
      Object.assign(state.checkout, {
        quote: action.payload.quote,
        deliveryId: action.payload.deliveryId,
        requestKey: action.payload.key,
        expectedTotalMinor: action.payload.quote.totalMinor,
        attempted: false,
        step: 'review',
        phase: 'idle',
        error: null,
      });
    },
    reservationStarted(state) {
      state.checkout.phase = 'reserving';
      state.checkout.attempted = true;
      state.checkout.error = null;
    },
    cardDetailsRequested(state) {
      state.checkout.step = 'details';
      state.checkout.phase = 'idle';
      state.checkout.error = null;
      state.checkout.paymentInProgress = false;
    },
    cardReviewRequested(state) {
      state.checkout.step = 'review';
      state.checkout.quote = state.checkout.transaction;
    },
    paymentUiStarted(state) {
      state.checkout.paymentInProgress = true;
    },
    paymentUiClosed(state) {
      state.checkout.paymentInProgress = false;
    },
    paymentSubmissionStarted(state) {
      state.checkout.paymentSubmitted = true;
    },
    paymentIdentified(state, action: PayloadAction<string>) {
      if (state.checkout.transactionId)
        state.checkout.providerPaymentId = action.payload;
    },
    transactionReady(state, action: PayloadAction<Transaction>) {
      if (action.payload.status !== 'PENDING')
        state.checkout.paymentInProgress = false;
      Object.assign(state.checkout, {
        transaction: action.payload,
        transactionId: action.payload.id,
        step: 'result',
        phase: 'idle',
        error: null,
      });
    },
    checkoutFailed(
      state,
      action: PayloadAction<{ error: ApiError; uncertain?: boolean }>,
    ) {
      state.checkout.phase = 'idle';
      state.checkout.error = action.payload.error;
      if (action.payload.uncertain === false) state.checkout.attempted = false;
    },
    checkoutEdited(state) {
      if (state.checkout.phase === 'idle' && !state.checkout.attempted) {
        state.checkout.step = 'details';
        state.checkout.quote = null;
        state.checkout.deliveryId = null;
        state.checkout.error = null;
      }
    },
    checkoutReset(state) {
      if (state.checkout.phase === 'idle') state.checkout = emptyCheckout();
    },
    progressUnavailable(state) {
      state.persistenceWarning = true;
    },
  },
});
export const actions = slice.actions;
export const reducer = slice.reducer;
export function safeProgress(state: AppState): SafeProgress | null {
  const value = state.checkout;
  if (!value.productId) return null;
  return {
    version: 1,
    ...(value.providerPaymentId
      ? { providerPaymentId: value.providerPaymentId }
      : {}),
    ...(value.items.length > 1
      ? {
          items: value.items.map(({ productId, quantity }) => ({
            productId,
            quantity,
          })),
        }
      : {}),
    productId: value.productId,
    quantity: value.quantity,
    deliveryId: value.deliveryId,
    transactionId: value.transactionId,
    requestKey: value.requestKey,
    expectedTotalMinor: value.expectedTotalMinor,
    attempted: value.attempted,
  };
}
