import { webcrypto } from 'node:crypto';
import {
  validateCard,
  cardBrand,
  type CardInput,
  type CardConfiguration,
  type CardPort,
} from '../src/domain/card';
import {
  createCardPayments,
  encryptCard,
} from '../src/infrastructure/card-tokenization';
import { createHttpApi } from '../src/infrastructure/http-api';
import { createAppStore } from '../src/application/store';
import { actions } from '../src/application/state';
import {
  prepareCardCheckout,
  checkoutAndPay,
  startPayment,
  loadCardConfiguration,
  clearCard,
  cardEnabled,
} from '../src/application/operations';
import {
  apiFixture,
  form,
  progress,
  memoryProgress,
  transaction,
  success,
} from './fixtures';
const input: CardInput = {
  number: '4242 4242 4242 4242',
  holder: 'Persona Prueba',
  expiry: '12/39',
  cvc: '123',
  installments: 1,
  privacyAccepted: true,
  personalDataAccepted: true,
};
const config: CardConfiguration = {
  apiUrl: 'https://api-sandbox.co.uat.wompi.dev/v1',
  publicKey: 'pub_stagtest_fixture',
  encryptionKey: '',
  privacyUrl: 'https://example.com/privacy',
  personalDataUrl: 'https://example.com/personal',
  acceptanceToken: 'privacy',
  personalDataToken: 'personal',
};
const authorization = {
  token: 'tok_stagtest_fixture',
  acceptanceToken: 'privacy',
  personalDataToken: 'personal',
  installments: 1,
  privacyAccepted: true as const,
  personalDataAccepted: true as const,
};
const crypto = webcrypto as unknown as Crypto;
let pair: CryptoKeyPair;
beforeAll(async () => {
  pair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
  config.encryptionKey =
    '-----BEGIN PUBLIC KEY-----\n' +
    Buffer.from(await crypto.subtle.exportKey('spki', pair.publicKey)).toString(
      'base64',
    ) +
    '\n-----END PUBLIC KEY-----';
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: () => new AbortController().signal,
  });
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: crypto,
  });
});
it('detecta Visa y rangos Mastercard; Luhn, vencimiento, CVC y consentimientos', () => {
  expect(validateCard(input, new Date('2026-01-01'))).toEqual({});
  expect(cardBrand('222100')).toBe('MASTERCARD');
  expect(cardBrand('272000')).toBe('MASTERCARD');
  expect(cardBrand('272100')).toBeNull();
  expect(cardBrand('5100')).toBe('MASTERCARD');
  for (const changes of [
    { number: '4242424242424241' },
    { number: '5555555555554444000' },
    { number: 'x' },
    { expiry: '00/30' },
    { expiry: '12/25' },
    { expiry: '01/26' },
    { cvc: '12' },
    { holder: 'A' },
    { installments: 0 },
    { privacyAccepted: false },
    { personalDataAccepted: false },
  ])
    expect(
      Object.keys(
        validateCard(
          { ...input, ...changes },
          new Date('2026-02-15T12:00:00Z'),
        ),
      ).length,
    ).toBeGreaterThan(0);
  expect(
    validateCard(
      { ...input, number: '5555 5555 5555 4444', expiry: '02/26' },
      new Date('2026-02-15T12:00:00Z'),
    ),
  ).toEqual({});
});
it('JWE interoperable: RSA-OAEP-256 + A256GCM, sin PAN en texto plano', async () => {
  const encrypted = await encryptCard(input, config.encryptionKey, crypto),
    parts = encrypted.split('.');
  expect(parts).toHaveLength(5);
  expect(encrypted).not.toContain(input.number.replace(/\s/g, ''));
  const decode = (s: string) => Buffer.from(s, 'base64url');
  const raw = await crypto.subtle.decrypt(
    'RSA-OAEP',
    pair.privateKey,
    decode(parts[1]),
  );
  const cek = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [
    'decrypt',
  ]);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decode(parts[2]),
      additionalData: new TextEncoder().encode(parts[0]),
      tagLength: 128,
    },
    cek,
    Buffer.concat([decode(parts[3]), decode(parts[4])]),
  );
  expect(JSON.parse(new TextDecoder().decode(plaintext))).toEqual({
    number: '4242424242424242',
    cvc: '123',
    exp_month: '12',
    exp_year: '39',
    card_holder: input.holder,
  });
});
it('tokeniza directamente, conserva solo autorización efímera y no sigue redirecciones', async () => {
  const api = apiFixture();
  api.cardConfiguration = jest.fn().mockResolvedValue(success(config));
  const request = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { id: authorization.token } }),
  });
  const card = createCardPayments(api, request);
  expect((await card.configuration()).ok).toBe(true);
  expect(await card.prepare(input)).toEqual(
    success({ brand: 'VISA', lastFour: '4242' }),
  );
  expect(card.authorization()).toEqual(authorization);
  expect(request.mock.calls[0][0]).toBe(config.apiUrl + '/tokens/cards');
  expect(request.mock.calls[0][1]).toMatchObject({
    credentials: 'omit',
    redirect: 'error',
  });
  expect(Object.keys(JSON.parse(request.mock.calls[0][1].body))).toEqual([
    'payload',
  ]);
  card.clear();
  expect(card.authorization()).toBeNull();
  request.mockResolvedValue({ ok: false });
  expect((await card.prepare(input)).ok).toBe(false);
  expect(card.authorization()).toBeNull();
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { id: 'tok_prod_invalid' } }),
  });
  expect((await card.prepare(input)).ok).toBe(false);
  request.mockRejectedValue(new Error('private'));
  expect((await card.prepare(input)).ok).toBe(false);
  expect((await card.prepare({ ...input, cvc: 'x' })).ok).toBe(false);
});
it('configuración ausente, caída y host productivo se rechazan antes de enviar tarjeta', async () => {
  const api = apiFixture(),
    request = jest.fn(),
    card = createCardPayments(api, request);
  expect((await card.configuration()).ok).toBe(false);
  expect((await card.prepare(input)).ok).toBe(false);
  api.cardConfiguration = jest.fn().mockRejectedValue(new Error('private'));
  expect((await card.configuration()).ok).toBe(false);
  api.cardConfiguration = jest
    .fn()
    .mockResolvedValue(
      success({ ...config, apiUrl: 'https://production.wompi.co/v1' }),
    );
  await card.configuration();
  expect((await card.prepare(input)).ok).toBe(false);
  expect(request).not.toHaveBeenCalled();
});
function fixture(saved = progress) {
  const api = apiFixture();
  api.chargePayment = jest.fn().mockResolvedValue(success({ accepted: true }));
  api.verifyPayment.mockResolvedValue(
    success({ verified: true, submitted: true }),
  );
  const card: jest.Mocked<CardPort> = {
    configuration: jest.fn().mockResolvedValue(success(config)),
    prepare: jest
      .fn()
      .mockResolvedValue(success({ brand: 'VISA', lastFour: '4242' })),
    authorization: jest.fn().mockReturnValue(authorization),
    clear: jest.fn(),
  };
  const persistence = memoryProgress(saved),
    store = createAppStore({
      api,
      card,
      progress: persistence,
      runtime: { newKey: () => 'request-123456789' },
    });
  return { api, card, store, persistence };
}
it('tarjeta antes del resumen, PENDING antes del cargo, sin datos sensibles en Redux/persistencia', async () => {
  const f = fixture();
  f.api.verifyPayment.mockResolvedValue(
    success({ verified: false, submitted: false }),
  );
  expect(f.store.dispatch(cardEnabled())).toBe(true);
  expect((await f.store.dispatch(loadCardConfiguration())).ok).toBe(true);
  f.store.dispatch(actions.checkoutEdited());
  expect(await f.store.dispatch(prepareCardCheckout(form, input))).toEqual({
    brand: 'VISA',
    lastFour: '4242',
  });
  f.api.getTransaction.mockResolvedValue(
    success({
      ...transaction,
      status: 'APPROVED',
      reservationStatus: 'CONFIRMED',
    }),
  );
  expect(await f.store.dispatch(checkoutAndPay())).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.api.createPending.mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(f.api.chargePayment!).mock.invocationCallOrder[0],
  );
  expect(f.card.clear).toHaveBeenCalled();
  expect(f.store.getState().checkout.transaction?.status).toBe('APPROVED');
  for (const raw of [input.number, '"cvc"', authorization.token, form.email]) {
    expect(JSON.stringify(f.store.getState())).not.toContain(raw);
    expect(JSON.stringify(f.persistence.current)).not.toContain(raw);
  }
});
it('recarga de pago enviado solo consulta; nunca reenvía otro cargo', async () => {
  const f = fixture({ ...progress, transactionId: transaction.id });
  f.store.dispatch(actions.transactionReady(transaction));
  await f.store.dispatch(startPayment());
  expect(f.api.chargePayment).not.toHaveBeenCalled();
  expect(f.store.getState().checkout.paymentSubmitted).toBe(true);
  expect(f.api.verifyPayment).toHaveBeenCalled();
});
it('token perdido vuelve al formulario; timeout conserva completando y error controlado', async () => {
  const f = fixture({ ...progress, transactionId: transaction.id });
  f.store.dispatch(actions.transactionReady(transaction));
  f.api.verifyPayment.mockResolvedValue(
    success({ verified: false, submitted: false }),
  );
  f.card.authorization.mockReturnValue(null);
  expect(await f.store.dispatch(startPayment())).toBe(false);
  expect(f.store.getState().checkout.step).toBe('details');
  expect(await f.store.dispatch(checkoutAndPay())).toBe(false);
  f.card.authorization.mockReturnValue(authorization);
  jest.mocked(f.api.chargePayment!).mockResolvedValue({
    ok: false,
    error: { code: 'NetworkError', status: 0 },
  });
  await f.store.dispatch(checkoutAndPay());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.store.getState().checkout.paymentInProgress).toBe(true);
  expect(f.store.getState().checkout.error?.code).toBe('NetworkError');
  f.store.dispatch(clearCard());
});
it('fallo de tokenización o preparación no reserva ni cobra', async () => {
  const f = fixture();
  f.card.prepare.mockResolvedValueOnce({
    ok: false,
    error: { code: 'InvalidPaymentInput', status: 400 },
  });
  expect(await f.store.dispatch(prepareCardCheckout(form, input))).toBeNull();
  expect(f.api.createPending).not.toHaveBeenCalled();
  f.api.registerCustomer.mockResolvedValueOnce({
    ok: false,
    error: { code: 'NetworkError', status: 0 },
  });
  expect(await f.store.dispatch(prepareCardCheckout(form, input))).toBeNull();
  expect(f.card.clear).toHaveBeenCalled();
});
it('HTTP proyecta solo configuración pública, acepta submitted y envía exclusivamente token', async () => {
  const request = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...config, secret: 'DO_NOT_KEEP' }),
    }),
    api = createHttpApi('', request);
  expect(await api.cardConfiguration!()).toEqual(success(config));
  request.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ accepted: true }),
  });
  expect((await api.chargePayment!(transaction.id, authorization)).ok).toBe(
    true,
  );
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual(authorization);
  request.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ verified: false, submitted: true }),
  });
  expect(await api.verifyPayment(transaction.id)).toEqual(
    success({ verified: false, submitted: true }),
  );
  request.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  expect((await api.cardConfiguration!()).ok).toBe(false);
  expect((await api.chargePayment!(transaction.id, authorization)).ok).toBe(
    false,
  );
});

it('doble clic y pago en curso no generan otro envío desde el frontend', async () => {
  const f = fixture({ ...progress, transactionId: transaction.id });
  f.store.dispatch(actions.transactionReady(transaction));
  f.api.verifyPayment.mockResolvedValue(
    success({ verified: false, submitted: false }),
  );
  const first = f.store.dispatch(startPayment());
  expect(await f.store.dispatch(startPayment())).toBe(false);
  await first;
  expect(f.api.chargePayment).toHaveBeenCalledTimes(1);
  f.store.dispatch(actions.paymentUiStarted());
  expect(await f.store.dispatch(checkoutAndPay())).toBe(false);
});
