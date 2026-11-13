import { createAppStore } from '../src/application/store';
import { actions } from '../src/application/state';
import {
  loadProduct,
  loadProducts,
  openCheckout,
  prepareCheckout,
  reserveCheckout,
  refreshQuote,
  resumeCheckout,
} from '../src/application/operations';
import type { ApiResult, Product } from '../src/domain/contracts';
import {
  apiFixture,
  form,
  memoryProgress,
  product,
  productId,
  otherId,
  progress,
  quote,
  success,
  transaction,
  transactionId,
} from './fixtures';
const error = { code: 'NetworkError' as const, status: 0 };
function fixture(initial: typeof progress | null = null) {
  const api = apiFixture();
  const persistence = memoryProgress(initial);
  const runtime = {
    newKey: jest.fn().mockReturnValue('checkout-request-0001'),
  };
  const store = createAppStore({ api, progress: persistence, runtime });
  return { api, persistence, runtime, store };
}
it('carga catálogo y evita solicitudes simultáneas duplicadas', async () => {
  const f = fixture();
  let resolve!: (value: ApiResult<Product[]>) => void;
  f.api.listProducts.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const first = f.store.dispatch(loadProducts());
  expect(await f.store.dispatch(loadProducts())).toBe(false);
  expect(f.api.listProducts).toHaveBeenCalledTimes(1);
  resolve(success([product]));
  await first;
  expect(f.store.getState().products).toEqual([product]);
  f.api.listProducts.mockResolvedValueOnce({ ok: false, error });
  expect(await f.store.dispatch(loadProducts())).toBe(false);
  expect(f.store.getState().catalogueError).toEqual(error);
});
it('el detalle ignora respuestas de rutas que ya se abandonaron', async () => {
  const f = fixture();
  let resolve!: (value: ApiResult<Product>) => void;
  f.api.getProduct.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const old = f.store.dispatch(loadProduct(productId));
  expect(await f.store.dispatch(loadProduct(productId))).toBe(false);
  f.api.getProduct.mockResolvedValueOnce(success({ ...product, id: otherId }));
  await f.store.dispatch(loadProduct(otherId));
  resolve(success(product));
  await old;
  expect(f.store.getState().detail?.id).toBe(otherId);
  f.store.dispatch(actions.detailFailed({ id: productId, error }));
  expect(f.store.getState().detailStatus).toBe('ready');
  f.api.getProduct.mockResolvedValueOnce({ ok: false, error });
  await f.store.dispatch(loadProduct(productId));
  expect(f.store.getState().detailStatus).toBe('error');
});
it('prepara resumen con datos personales fuera de Redux y de la persistencia', async () => {
  const f = fixture();
  expect(await f.store.dispatch(prepareCheckout(form))).toBe(false);
  expect(f.store.dispatch(openCheckout(productId, 1))).toBe(true);
  expect(await f.store.dispatch(prepareCheckout(form))).toBe(true);
  expect(f.store.getState().checkout).toMatchObject({
    step: 'review',
    quote,
    expectedTotalMinor: quote.totalMinor,
  });
  expect(f.api.registerCustomer).toHaveBeenCalledWith({
    fullName: form.fullName,
    email: form.email,
    phone: form.phone,
  });
  expect(JSON.stringify(f.store.getState())).not.toContain(form.email);
  expect(JSON.stringify(f.persistence.current)).not.toContain(form.addressLine);
  f.store.dispatch(actions.checkoutEdited());
  expect(f.store.getState().checkout.step).toBe('details');
  f.store.dispatch(actions.checkoutClosed());
  expect(f.store.getState().checkout.step).toBe('closed');
});
it('no puede reemplazar o cerrar una solicitud mientras se envía', async () => {
  const f = fixture();
  f.store.dispatch(openCheckout(productId, 1));
  let resolve!: (value: ApiResult<{ id: string }>) => void;
  f.api.registerCustomer.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const first = f.store.dispatch(prepareCheckout(form));
  expect(await f.store.dispatch(prepareCheckout(form))).toBe(false);
  expect(f.store.dispatch(openCheckout(otherId, 1))).toBe(false);
  f.store.dispatch(actions.checkoutClosed());
  f.store.dispatch(actions.checkoutEdited());
  f.store.dispatch(actions.checkoutReset());
  expect(f.store.getState().checkout.phase).toBe('preparing');
  resolve(success({ id: otherId }));
  await first;
  expect(f.api.registerCustomer).toHaveBeenCalledTimes(1);
});
it.each(['customer', 'delivery', 'quote', 'unexpected', 'crypto'])(
  'controla fallos al preparar: %s',
  async (scope) => {
    const f = fixture();
    f.store.dispatch(openCheckout(productId, 1));
    if (scope === 'customer')
      f.api.registerCustomer.mockResolvedValueOnce({ ok: false, error });
    if (scope === 'delivery')
      f.api.registerDelivery.mockResolvedValueOnce({ ok: false, error });
    if (scope === 'quote')
      f.api.quote.mockResolvedValueOnce({ ok: false, error });
    if (scope === 'unexpected')
      f.api.registerCustomer.mockRejectedValueOnce(new Error('PRIVATE'));
    if (scope === 'crypto')
      f.runtime.newKey.mockImplementationOnce(() => {
        throw Error('unsupported');
      });
    expect(await f.store.dispatch(prepareCheckout(form))).toBe(false);
    expect(f.store.getState().checkout.phase).toBe('idle');
    expect(f.store.getState().checkout.error).toBeTruthy();
    expect(f.api.createPending).not.toHaveBeenCalled();
  },
);
it('persiste la identidad de la reserva antes del POST y bloquea doble clic', async () => {
  const f = fixture();
  f.store.dispatch(openCheckout(productId, 1));
  await f.store.dispatch(prepareCheckout(form));
  let resolve!: (value: ApiResult<typeof transaction>) => void;
  f.api.createPending.mockImplementationOnce((_body, key) => {
    expect(f.persistence.current).toMatchObject({
      attempted: true,
      requestKey: key,
      expectedTotalMinor: quote.totalMinor,
    });
    return new Promise((done) => {
      resolve = done;
    });
  });
  const first = f.store.dispatch(reserveCheckout());
  expect(await f.store.dispatch(reserveCheckout())).toBe(false);
  f.store.dispatch(actions.checkoutEdited());
  expect(f.store.getState().checkout.step).toBe('review');
  resolve(success(transaction));
  await first;
  expect(f.api.createPending).toHaveBeenCalledTimes(1);
  expect(f.store.getState().checkout.transactionId).toBe(transactionId);
  expect(f.store.dispatch(openCheckout(otherId, 1))).toBe(false);
  expect(await f.store.dispatch(prepareCheckout(form))).toBe(false);
  expect(await f.store.dispatch(reserveCheckout())).toBe(false);
});
it('recupera una respuesta perdida con la misma clave, importe y entrega tras refrescar', async () => {
  const f = fixture(progress);
  f.api.createPending.mockResolvedValueOnce({ ok: false, error });
  expect(await f.store.dispatch(reserveCheckout())).toBe(false);
  expect(f.persistence.current?.attempted).toBe(true);
  expect(f.store.dispatch(openCheckout(otherId, 1))).toBe(false);
  const next = createAppStore({
    api: f.api,
    progress: f.persistence,
    runtime: f.runtime,
  });
  expect(next.getState().checkout.transaction).toBeNull();
  expect(await next.dispatch(resumeCheckout())).toBe(true);
  expect(f.api.createPending.mock.calls[0]).toEqual(
    f.api.createPending.mock.calls[1],
  );
  expect(f.api.registerCustomer).not.toHaveBeenCalled();
  expect(f.api.quote).not.toHaveBeenCalled();
  expect(next.getState().checkout.transaction?.id).toBe(transactionId);
});
it.each([
  { code: 'InvalidResponse' as const, status: 200 },
  { code: 'CheckoutStorageUnavailable' as const, status: 503 },
  { code: 'InsufficientStock' as const, status: 409 },
])(
  'distingue respuesta incierta de rechazo definitivo: %p',
  async (failure) => {
    const f = fixture(progress);
    f.api.createPending.mockResolvedValueOnce({ ok: false, error: failure });
    expect(await f.store.dispatch(reserveCheckout())).toBe(false);
    expect(f.store.getState().checkout.attempted).toBe(failure.status !== 409);
  },
);
it('actualiza cotización con una nueva clave solo tras rechazo definitivo', async () => {
  const f = fixture(progress);
  f.api.createPending.mockResolvedValueOnce({
    ok: false,
    error: { code: 'QuoteChanged', status: 409 },
  });
  await f.store.dispatch(reserveCheckout());
  f.api.quote.mockResolvedValueOnce(
    success({ ...quote, totalMinor: '10500000' }),
  );
  f.runtime.newKey.mockReturnValueOnce('checkout-request-0002');
  expect(await f.store.dispatch(refreshQuote())).toBe(true);
  expect(f.store.getState().checkout).toMatchObject({
    expectedTotalMinor: '10500000',
    requestKey: 'checkout-request-0002',
    attempted: false,
  });
  expect(f.api.createPending).toHaveBeenCalledTimes(1);
});
it('vuelve a consultar el backend para reanudar, sin confiar en estados guardados', async () => {
  const f = fixture({ ...progress, transactionId });
  expect(f.store.getState().checkout.transaction).toBeNull();
  f.api.getTransaction.mockResolvedValueOnce(
    success({
      ...transaction,
      status: 'EXPIRED',
      reservationStatus: 'RELEASED',
    }),
  );
  expect(await f.store.dispatch(resumeCheckout())).toBe(true);
  expect(f.store.getState().checkout.transaction?.status).toBe('EXPIRED');
  expect(f.store.dispatch(openCheckout(otherId, 1))).toBe(true);
  const g = fixture({ ...progress, transactionId });
  expect(g.store.dispatch(openCheckout(otherId, 1))).toBe(false);
  g.api.getTransaction.mockResolvedValueOnce({
    ok: false,
    error: { code: 'SessionRequired', status: 401 },
  });
  expect(await g.store.dispatch(resumeCheckout())).toBe(false);
  expect(g.store.getState().checkout.transaction).toBeNull();
});
it('reanuda un resumen sin enviar la reserva automáticamente', async () => {
  const f = fixture(progress);
  expect(await f.store.dispatch(resumeCheckout())).toBe(true);
  expect(f.api.quote).toHaveBeenCalled();
  expect(f.api.createPending).not.toHaveBeenCalled();
  f.api.quote.mockResolvedValueOnce({ ok: false, error });
  expect(await f.store.dispatch(refreshQuote())).toBe(false);
  f.store.dispatch(actions.operationStarted('preparing'));
  expect(await f.store.dispatch(resumeCheckout())).toBe(false);
  expect(await f.store.dispatch(refreshQuote())).toBe(false);
  f.store.dispatch(actions.checkoutFailed({ error }));
  f.store.dispatch(actions.checkoutReset());
  expect(await f.store.dispatch(resumeCheckout())).toBe(false);
  expect(await f.store.dispatch(reserveCheckout())).toBe(false);
  expect(await f.store.dispatch(refreshQuote())).toBe(false);
});
it('una excepción al reservar mantiene el intento recuperable', async () => {
  const f = fixture(progress);
  f.api.createPending.mockRejectedValueOnce(new Error('PRIVATE'));
  expect(await f.store.dispatch(reserveCheckout())).toBe(false);
  expect(f.store.getState().checkout).toMatchObject({
    attempted: true,
    error: { code: 'NetworkError' },
  });
  f.store.dispatch(actions.checkoutClosed());
  f.store.dispatch(actions.checkoutEdited());
  expect(f.store.getState().checkout.step).toBe('closed');
});
it('degradación controlada cuando el almacenamiento está bloqueado', () => {
  const api = apiFixture();
  const save = jest
    .fn()
    .mockReturnValue({ ok: false, error: 'PersistenceUnavailable' });
  const store = createAppStore({
    api,
    progress: { read: () => ({ ok: true, value: null }), save },
    runtime: { newKey: () => '' },
  });
  store.dispatch(openCheckout(productId, 1));
  expect(store.getState().persistenceWarning).toBe(true);
  store.dispatch(actions.checkoutReset());
  expect(save).toHaveBeenCalledTimes(2);
  const failed = createAppStore({
    api,
    progress: {
      read: () => ({ ok: false, error: 'PersistenceUnavailable' }),
      save,
    },
    runtime: { newKey: () => '' },
  });
  expect(failed.getState().persistenceWarning).toBe(true);
});
