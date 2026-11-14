import { createAppStore } from '../src/application/store';
import { actions, safeProgress } from '../src/application/state';
import {
  startPayment,
  refreshPayment,
  checkoutAndPay,
} from '../src/application/operations';
import { parseProgress } from '../src/infrastructure/progress';
import { createHttpApi } from '../src/infrastructure/http-api';
import {
  apiFixture,
  memoryProgress,
  progress,
  transaction,
  success,
} from './fixtures';
import { paymentSession } from './payment-fixtures';
function setup() {
  const api = apiFixture();
  api.preparePayment.mockResolvedValue(success(paymentSession));
  const payment = {
    open: jest.fn().mockResolvedValue({
      ok: true,
      value: { providerPaymentId: 'provider-1' },
    }),
  };
  const persistence = memoryProgress({
    ...progress,
    transactionId: transaction.id,
  });
  const store = createAppStore({
    api,
    payment,
    progress: persistence,
    runtime: { newKey: () => 'key-00000001' },
  });
  store.dispatch(actions.transactionReady(transaction));
  return { api, payment, persistence, store };
}
it('PENDING previo, firma fuera de Redux y éxito solo desde backend', async () => {
  const f = setup();
  f.api.getTransaction.mockResolvedValue(
    success({
      ...transaction,
      status: 'APPROVED',
      reservationStatus: 'CONFIRMED',
    }),
  );
  expect(await f.store.dispatch(startPayment())).toBe(true);
  expect(f.api.verifyPayment).toHaveBeenCalledWith(
    transaction.id,
    'provider-1',
  );
  expect(f.store.getState().checkout.transaction?.status).toBe('APPROVED');
  expect(f.persistence.current?.providerPaymentId).toBe('provider-1');
  expect(JSON.stringify(f.store.getState())).not.toContain(
    paymentSession.integrity,
  );
  expect(JSON.stringify(f.persistence.current)).not.toContain(
    paymentSession.publicKey,
  );
});
it('doble clic no abre otro widget ni prepara dos sesiones', async () => {
  const f = setup();
  const first = f.store.dispatch(startPayment());
  expect(await f.store.dispatch(startPayment())).toBe(false);
  await first;
  expect(f.api.preparePayment).toHaveBeenCalledTimes(1);
  expect(f.payment.open).toHaveBeenCalledTimes(1);
});
it('callback no puede aprobar si backend mantiene PENDING', async () => {
  const f = setup();
  await f.store.dispatch(startPayment());
  expect(f.store.getState().checkout.transaction?.status).toBe('PENDING');
});
it('resultado perdido conserva ID seguro para reconciliar tras recarga sin otro pago', async () => {
  const f = setup();
  f.api.verifyPayment.mockResolvedValueOnce({
    ok: false,
    error: { code: 'NetworkError', status: 0 },
  });
  expect(await f.store.dispatch(startPayment())).toBe(false);
  expect(f.persistence.current?.providerPaymentId).toBe('provider-1');
  const restored = parseProgress(f.persistence.current);
  expect(restored?.providerPaymentId).toBe('provider-1');
  expect(
    parseProgress({
      ...f.persistence.current,
      providerPaymentId: '4111111111111111',
    }),
  ).toBeNull();
  expect(
    parseProgress({ ...f.persistence.current, providerPaymentId: '../unsafe' }),
  ).toBeNull();
  const next = createAppStore({
    api: f.api,
    payment: f.payment,
    progress: memoryProgress(restored),
    runtime: { newKey: () => '' },
  });
  await next.dispatch(refreshPayment());
  expect(f.api.verifyPayment).toHaveBeenLastCalledWith(
    transaction.id,
    'provider-1',
  );
  expect(f.payment.open).toHaveBeenCalledTimes(1);
});
it.each(['PaymentNotConfigured', 'PaymentSessionExpired'] as const)(
  'preparación fallida %s no abre proveedor',
  async (code) => {
    const f = setup();
    f.api.preparePayment.mockResolvedValueOnce({
      ok: false,
      error: { code, status: 503 },
    });
    expect(await f.store.dispatch(startPayment())).toBe(false);
    expect(f.payment.open).not.toHaveBeenCalled();
  },
);
it('importe/ref distintos y widget no disponible no se confirman', async () => {
  const f = setup();
  f.api.preparePayment.mockResolvedValueOnce(
    success({ ...paymentSession, amountMinor: '1' }),
  );
  expect(await f.store.dispatch(startPayment())).toBe(false);
  expect(f.payment.open).not.toHaveBeenCalled();
  f.payment.open.mockResolvedValueOnce({
    ok: false,
    error: 'PaymentWidgetUnavailable',
  });
  expect(await f.store.dispatch(startPayment())).toBe(false);
  expect(f.api.verifyPayment).not.toHaveBeenCalled();
});
it('cierre sin ID consulta estado y conserva el mismo pedido', async () => {
  const f = setup();
  f.payment.open.mockResolvedValueOnce({
    ok: true,
    value: { providerPaymentId: null },
  });
  await f.store.dispatch(startPayment());
  expect(f.api.verifyPayment).toHaveBeenCalledWith(transaction.id, undefined);
  expect(f.store.getState().checkout.transactionId).toBe(transaction.id);
});
it('sin transacción o con estado final no prepara pago', async () => {
  const f = setup();
  f.store.dispatch(actions.checkoutReset());
  expect(await f.store.dispatch(startPayment())).toBe(false);
  expect(await f.store.dispatch(refreshPayment())).toBe(false);
  f.store.dispatch(
    actions.transactionReady({
      ...transaction,
      status: 'APPROVED',
      reservationStatus: 'CONFIRMED',
    }),
  );
  expect(await f.store.dispatch(startPayment())).toBe(false);
  expect(f.api.preparePayment).not.toHaveBeenCalled();
});
it('ID ya conocido solo reconcilia, y no abre una segunda sesión', async () => {
  const f = setup();
  f.store.dispatch(actions.paymentIdentified('provider-1'));
  await f.store.dispatch(startPayment());
  expect(f.payment.open).not.toHaveBeenCalled();
  expect(f.api.verifyPayment).toHaveBeenCalledWith(
    transaction.id,
    'provider-1',
  );
});
it('un fallo al reservar no llama al módulo de pago', async () => {
  const f = setup();
  f.store.dispatch(actions.checkoutReset());
  expect(await f.store.dispatch(checkoutAndPay())).toBe(false);
  expect(f.api.preparePayment).not.toHaveBeenCalled();
});
it('HTTP proyecta sesión segura y solo envía ID al verificar', async () => {
  const fetcher = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ...paymentSession, privateKey: 'DO_NOT_KEEP' }),
  });
  const api = createHttpApi('', fetcher);
  expect(await api.preparePayment(transaction.id)).toEqual(
    success(paymentSession),
  );
  fetcher.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ verified: true, private: 'DO_NOT_KEEP' }),
  });
  expect(await api.verifyPayment(transaction.id, 'provider-1')).toEqual(
    success({ verified: true }),
  );
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    providerPaymentId: 'provider-1',
  });
  fetcher.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ...paymentSession, publicKey: 'pub_prod_invalid' }),
  });
  expect((await api.preparePayment(transaction.id)).ok).toBe(false);
  fetcher.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ verified: 'APPROVED' }),
  });
  expect((await api.verifyPayment(transaction.id)).ok).toBe(false);
});
it('persistencia nunca incluye sesión firmada ni datos del formulario', () => {
  const f = setup();
  expect(safeProgress(f.store.getState())).toMatchObject({
    transactionId: transaction.id,
  });
  expect(Object.keys(safeProgress(f.store.getState())!)).not.toContain(
    'payment',
  );
});
