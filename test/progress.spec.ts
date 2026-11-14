import {
  browserProgress,
  newRequestKey,
  parseProgress,
  PROGRESS_KEY,
} from '../src/infrastructure/progress';
import { progress, productId, transactionId, otherId } from './fixtures';
beforeEach(() => localStorage.clear());
it('persiste únicamente referencias seguras y descarta formatos ajenos', () => {
  const port = browserProgress();
  expect(port.read()).toEqual({ ok: true, value: null });
  expect(port.save(progress).ok).toBe(true);
  expect(port.read()).toEqual({ ok: true, value: progress });
  expect(JSON.stringify(port.read())).not.toContain('cvv');
  expect(parseProgress({ ...progress, transactionId })).toBeTruthy();
  localStorage.setItem(
    PROGRESS_KEY,
    JSON.stringify({ ...progress, cardNumber: 'PRIVATE_CARD' }),
  );
  expect(port.read()).toEqual({ ok: true, value: null });
  expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  port.save(progress);
  port.save(null);
  expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
});
it.each([
  null,
  [],
  {},
  { ...progress, version: 2 },
  { ...progress, productId: 'bad' },
  { ...progress, quantity: 0 },
  { ...progress, quantity: 2147483648 },
  { ...progress, attempted: 'true' },
  { ...progress, deliveryId: 'bad' },
  { ...progress, transactionId: 'bad' },
  { ...progress, requestKey: 'x' },
  { ...progress, expectedTotalMinor: '1.5' },
  { ...progress, attempted: true, deliveryId: null },
  { ...progress, attempted: true, requestKey: null },
  { ...progress, attempted: true, expectedTotalMinor: null },
])('rechaza progreso inválido %p', (value) =>
  expect(parseProgress(value)).toBeNull(),
);
it('un almacenamiento bloqueado devuelve un error controlado', () => {
  const port = browserProgress(() => {
    throw Error('private');
  });
  expect(port.read()).toEqual({ ok: false, error: 'PersistenceUnavailable' });
  expect(port.save({ ...progress, productId })).toEqual({
    ok: false,
    error: 'PersistenceUnavailable',
  });
  localStorage.setItem(PROGRESS_KEY, 'invalid');
  expect(browserProgress().read().ok).toBe(false);
  expect(
    browserProgress().save({
      ...progress,
      cvv: 'PRIVATE',
    } as unknown as typeof progress).ok,
  ).toBe(false);
});
it('crea claves con aleatoriedad criptográfica y tamaño válido', () => {
  expect(newRequestKey()).toMatch(/^checkout-[a-f0-9]{32}$/);
  expect(newRequestKey()).not.toBe(newRequestKey());
});

it('preserva todas las referencias de un carrito y rechaza líneas contaminadas o repetidas', () => {
  const basket = {
    ...progress,
    items: [
      { productId, quantity: 1 },
      { productId: otherId, quantity: 2 },
    ],
    attempted: true,
  };
  const port = browserProgress();
  expect(port.save(basket).ok).toBe(true);
  expect(port.read()).toEqual({ ok: true, value: basket });
  for (const items of [
    [],
    [null, null],
    [
      { productId, quantity: 1 },
      { productId, quantity: 1 },
    ],
    [
      { productId, quantity: 1 },
      { productId: otherId, quantity: 2, cvv: 'PRIVATE' },
    ],
    [
      { productId: otherId, quantity: 1 },
      { productId, quantity: 1 },
    ],
    [
      { productId, quantity: 1 },
      { productId: otherId, quantity: 0 },
    ],
  ])
    expect(parseProgress({ ...basket, items })).toBeNull();
  expect(parseProgress(progress)).toEqual(progress);
});
