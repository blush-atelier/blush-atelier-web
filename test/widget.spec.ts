import {
  createWompiWidget,
  type WidgetConstructor,
} from '../src/infrastructure/wompi-widget';
import { paymentSession } from './payment-fixtures';
let modal: HTMLDivElement;
let complete: (value: unknown) => void;
let config: ConstructorParameters<WidgetConstructor>[0];
function install() {
  window.WidgetCheckout = class {
    constructor(value: ConstructorParameters<WidgetConstructor>[0]) {
      config = value;
      modal = document.createElement('div');
      modal.className = 'waybox-modal';
      modal.hidden = true;
      document.body.appendChild(modal);
    }
    open(callback: (value: unknown) => void) {
      complete = callback;
      modal.hidden = false;
    }
  };
}
afterEach(() => {
  delete window.WidgetCheckout;
  document
    .querySelectorAll(
      '.waybox-modal,script[src="https://checkout.wompi.co/widget.js"]',
    )
    .forEach((e) => e.remove());
  jest.useRealTimers();
});
async function opened() {
  await Promise.resolve();
  await Promise.resolve();
}
it('abre solo Sandbox y devuelve únicamente ID, nunca status ni datos del callback', async () => {
  install();
  const widget = createWompiWidget();
  const pending = widget.open(paymentSession);
  await opened();
  expect(config).toMatchObject({
    currency: 'COP',
    amountInCents: 10490000,
    publicKey: 'pub_test_fixture',
    signature: { integrity: 'a'.repeat(64) },
    bootstrapTransport: 'postmessage',
  });
  expect(await widget.open(paymentSession)).toEqual({
    ok: false,
    error: 'PaymentWidgetBusy',
  });
  complete({
    transaction: {
      id: 'provider-1',
      status: 'APPROVED',
      cardNumber: 'DO_NOT_KEEP',
    },
  });
  modal.hidden = true;
  expect(await pending).toEqual({
    ok: true,
    value: { providerPaymentId: 'provider-1' },
  });
});
it('cancelar/cerrar sin callback no inventa pago ni deja bloqueado el siguiente intento', async () => {
  install();
  const widget = createWompiWidget();
  const pending = widget.open(paymentSession);
  await opened();
  modal.hidden = true;
  expect(await pending).toEqual({
    ok: true,
    value: { providerPaymentId: null },
  });
  const next = widget.open(paymentSession);
  await opened();
  modal.remove();
  expect((await next).ok).toBe(true);
});
it('descarta IDs inválidos y soporta callback sin modal del SDK', async () => {
  window.WidgetCheckout = class {
    open(cb: (v: unknown) => void) {
      cb({ transaction: { id: '../bad', status: 'APPROVED' } });
    }
  };
  expect(await createWompiWidget().open(paymentSession)).toEqual({
    ok: true,
    value: { providerPaymentId: null },
  });
});
it.each([
  { publicKey: 'pub_prod_no' },
  { amountMinor: '9007199254740993' },
  { amountMinor: '1.2' },
  { expiresAt: 'bad' },
  { expiresAt: '2000-01-01T00:00:00Z' },
])('rechaza sesión insegura/inválida %p', async (changes) => {
  expect(
    await createWompiWidget().open({ ...paymentSession, ...changes }),
  ).toEqual({ ok: false, error: 'PaymentWidgetUnavailable' });
});
it('fallo de carga permite reintentar sin script duplicado', async () => {
  const widget = createWompiWidget();
  const first = widget.open(paymentSession);
  document.querySelector('script')?.dispatchEvent(new Event('error'));
  expect(await first).toEqual({ ok: false, error: 'PaymentWidgetUnavailable' });
  const next = widget.open(paymentSession);
  install();
  document.querySelector('script')?.dispatchEvent(new Event('load'));
  await opened();
  modal.hidden = true;
  expect((await next).ok).toBe(true);
});
it('timeout de script devuelve error controlado', async () => {
  jest.useFakeTimers();
  const pending = createWompiWidget().open(paymentSession);
  await jest.advanceTimersByTimeAsync(12000);
  expect(await pending).toEqual({
    ok: false,
    error: 'PaymentWidgetUnavailable',
  });
});
it('constructor del proveedor que falla no revela su error', async () => {
  window.WidgetCheckout = class {
    constructor() {
      throw new Error('private context');
    }
    open() {}
  };
  expect(await createWompiWidget().open(paymentSession)).toEqual({
    ok: false,
    error: 'PaymentWidgetUnavailable',
  });
});

it('no rechaza localmente una llave stagtest de la prueba', async () => {
  install();
  const pending = createWompiWidget().open({
    ...paymentSession,
    publicKey: 'pub_stagtest_fixture',
  });
  await opened();
  modal.hidden = true;
  expect((await pending).ok).toBe(true);
});
