import { MemoryRouter } from 'react-router-dom';
import { PaymentAlerts } from '../src/presentation/components/PaymentAlerts';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createAppStore } from '../src/application/store';
import { actions } from '../src/application/state';
import {
  addToCart,
  prepareCheckout,
  refreshPayment,
  resumeCheckout,
  restartCheckout,
} from '../src/application/operations';
import { usePaymentSynchronization } from '../src/presentation/usePaymentSynchronization';
import {
  apiFixture,
  memoryProgress,
  progress,
  transaction,
  product,
  success,
  form,
} from './fixtures';
function Probe() {
  usePaymentSynchronization();
  return <p>Seguimiento global</p>;
}
function fixture() {
  const api = apiFixture(),
    store = createAppStore({
      api,
      progress: memoryProgress({ ...progress, transactionId: transaction.id }),
      runtime: { newKey: () => 'renewed-request-123' },
    });
  store.dispatch(actions.catalogueReady([product]));
  store.dispatch(actions.transactionReady(transaction));
  return { api, store };
}
afterEach(() => {
  jest.useRealTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
});
it('confirma automáticamente fuera de OrderPage y detiene el polling al finalizar', async () => {
  jest.useFakeTimers();
  const f = fixture();
  f.api.getTransaction
    .mockResolvedValueOnce(success(transaction))
    .mockResolvedValueOnce(
      success({
        ...transaction,
        status: 'APPROVED',
        reservationStatus: 'CONFIRMED',
      }),
    );
  const view = render(
    <Provider store={f.store}>
      <Probe />
    </Provider>,
  );
  await act(async () => {});
  expect(f.store.getState().checkout.transaction?.status).toBe('PENDING');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2500);
  });
  expect(f.store.getState().checkout.transaction?.status).toBe('APPROVED');
  const count = f.api.verifyPayment.mock.calls.length;
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10000);
  });
  expect(f.api.verifyPayment).toHaveBeenCalledTimes(count);
  view.unmount();
});
it('401 detiene consultas; agregar producto descarta referencias vencidas y registra una sesión nueva al continuar', async () => {
  jest.useFakeTimers();
  const f = fixture();
  f.api.verifyPayment.mockResolvedValueOnce({
    ok: false,
    error: { code: 'SessionRequired', status: 401 },
  });
  const view = render(
    <Provider store={f.store}>
      <Probe />
    </Provider>,
  );
  await act(async () => {});
  expect(f.store.getState().checkout.sessionExpired).toBe(true);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10000);
  });
  expect(f.api.verifyPayment).toHaveBeenCalledTimes(1);
  await act(async () => {
    expect(f.store.dispatch(addToCart(product.id, 1)).ok).toBe(true);
  });
  expect(f.store.getState().checkout).toMatchObject({
    transactionId: null,
    attempted: false,
    sessionExpired: false,
    error: null,
  });
  await act(async () => {
    expect(await f.store.dispatch(prepareCheckout(form))).toBe(true);
  });
  expect(f.api.registerCustomer).toHaveBeenCalledTimes(1);
  expect(f.store.getState().checkout.step).toBe('review');
  view.unmount();
});
it('pausa al ocultar pestaña, reconsulta al volver o recuperar conexión y no cobra', async () => {
  jest.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  });
  const f = fixture();
  render(
    <Provider store={f.store}>
      <Probe />
    </Provider>,
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2500);
  });
  expect(f.api.verifyPayment).not.toHaveBeenCalled();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(f.api.verifyPayment).toHaveBeenCalledTimes(1);
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
  expect(f.api.verifyPayment).toHaveBeenCalledTimes(2);
  expect(f.api.chargePayment).not.toHaveBeenCalled();
});
it('la consulta automática no roba la fase de creación/envío del cargo', async () => {
  const f = fixture();
  f.store.dispatch(actions.paymentUiStarted());
  expect(await f.store.dispatch(refreshPayment())).toBe(false);
  expect(f.api.verifyPayment).not.toHaveBeenCalled();
  f.store.dispatch(actions.operationStarted('preparing'));
  expect(f.store.dispatch(restartCheckout())).toBe(false);
});
it('una respuesta antigua no vuelve a insertar un pedido tras reiniciar el checkout', async () => {
  const f = fixture();
  let finish!: (v: Awaited<ReturnType<typeof f.api.verifyPayment>>) => void;
  f.api.verifyPayment.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const request = f.store.dispatch(refreshPayment());
  f.store.dispatch(
    actions.checkoutFailed({ error: { code: 'SessionRequired', status: 401 } }),
  );
  expect(f.store.dispatch(restartCheckout())).toBe(true);
  finish(success({ verified: true, submitted: true }));
  expect(await request).toBe(false);
  expect(f.store.getState().checkout.transactionId).toBeNull();
  expect(f.api.getTransaction).not.toHaveBeenCalled();
  const g = fixture();
  let get!: (v: Awaited<ReturnType<typeof g.api.getTransaction>>) => void;
  g.api.getTransaction.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        get = resolve;
      }),
  );
  const resume = g.store.dispatch(resumeCheckout());
  g.store.dispatch(
    actions.checkoutFailed({ error: { code: 'SessionRequired', status: 401 } }),
  );
  g.store.dispatch(restartCheckout());
  get(success(transaction));
  expect(await resume).toBe(false);
  expect(g.store.getState().checkout.transactionId).toBeNull();
});

it('la alerta de sesión permite volver a comprar y limpia referencias y token antiguos', async () => {
  const api = apiFixture();
  api.verifyPayment.mockResolvedValueOnce({
    ok: false,
    error: { code: 'SessionRequired', status: 401 },
  });
  const card = {
    configuration: jest.fn(),
    prepare: jest.fn(),
    authorization: jest.fn(),
    clear: jest.fn(),
  };
  const store = createAppStore({
    api,
    card,
    progress: memoryProgress({ ...progress, transactionId: transaction.id }),
    runtime: { newKey: () => 'request-renewed' },
  });
  store.dispatch(actions.transactionReady(transaction));
  store.dispatch(actions.catalogueReady([product]));
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Probe />
        <PaymentAlerts />
      </MemoryRouter>
    </Provider>,
  );
  const button = await screen.findByRole('button', {
    name: 'Volver a comprar',
  });
  fireEvent.click(button);
  expect(store.getState().checkout).toMatchObject({
    transactionId: null,
    sessionExpired: false,
    error: null,
  });
  expect(card.clear).toHaveBeenCalled();
  expect(store.dispatch(addToCart(product.id, 1)).ok).toBe(true);
});
