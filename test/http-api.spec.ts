import {
  createHttpApi,
  isProduct,
  isQuote,
  isTransaction,
} from '../src/infrastructure/http-api';
import {
  product,
  productId,
  quote,
  transaction,
  transactionId,
  form,
  deliveryId,
} from './fixtures';
function response(value: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  } as Response;
}
it('incluye cookies, cabecera anti-CSRF, clave y precio esperado en los endpoints correctos', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ id: deliveryId }));
  const api = createHttpApi('https://api.example/', fetcher);
  await api.registerCustomer({
    fullName: form.fullName,
    email: form.email,
    phone: form.phone,
  });
  expect(fetcher.mock.calls[0][0]).toBe('https://api.example/api/customers');
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Checkout-Request': '1' },
  });
  await api.registerDelivery({
    recipientName: form.fullName,
    recipientPhone: form.phone,
    addressLine: form.addressLine,
    city: form.city,
    region: form.region,
    countryCode: 'CO',
  });
  fetcher.mockResolvedValue(response(quote));
  await expect(
    api.quote({ productId, quantity: 1, deliveryId }),
  ).resolves.toEqual({ ok: true, value: quote });
  fetcher.mockResolvedValue(response(transaction));
  await api.createPending(
    {
      productId,
      quantity: 1,
      deliveryId,
      expectedTotalMinor: quote.totalMinor,
    },
    'checkout-request-0001',
  );
  expect(fetcher.mock.calls[3][1].headers['Idempotency-Key']).toBe(
    'checkout-request-0001',
  );
  expect(JSON.parse(fetcher.mock.calls[3][1].body)).not.toHaveProperty('cvv');
  await expect(api.getTransaction(transactionId)).resolves.toEqual({
    ok: true,
    value: transaction,
  });
  expect(fetcher.mock.calls[4][1].method).toBe('GET');
});
it('valida respuestas y descarta cualquier propiedad privada inesperada', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValue(response([{ ...product, private: 'DO_NOT_KEEP' }]));
  const api = createHttpApi('', fetcher);
  const listed = await api.listProducts();
  expect(listed).toEqual({ ok: true, value: [product] });
  fetcher.mockResolvedValue(response(product));
  expect(await api.getProduct(productId)).toEqual({ ok: true, value: product });
  fetcher.mockResolvedValue(
    response({ ...transaction, customerEmail: 'PRIVATE_EMAIL' }),
  );
  expect(await api.getTransaction(transactionId)).toEqual({
    ok: true,
    value: transaction,
  });
  fetcher.mockResolvedValue(
    response({ id: deliveryId, sessionToken: 'PRIVATE_TOKEN' }),
  );
  expect(await api.registerCustomer(form)).toEqual({
    ok: true,
    value: { id: deliveryId },
  });
  fetcher.mockResolvedValue(response({ wrong: 'PRIVATE_BODY' }));
  expect(await api.getProduct(productId)).toEqual({
    ok: false,
    error: { code: 'InvalidResponse', status: 200 },
  });
  fetcher.mockResolvedValue(response({ ...product, id: deliveryId }));
  expect((await api.getProduct(productId)).ok).toBe(false);
  fetcher.mockResolvedValue(response({ ...transaction, id: deliveryId }));
  expect((await api.getTransaction(transactionId)).ok).toBe(false);
});
it('sanea errores de servidor y maneja red, formatos inválidos y timeout', async () => {
  const fetcher = jest.fn();
  const api = createHttpApi('', fetcher);
  for (const [status, body, code] of [
    [401, {}, 'SessionRequired'],
    [429, {}, 'RateLimited'],
    [
      409,
      { code: 'InsufficientStock', message: 'PRIVATE_CARD' },
      'InsufficientStock',
    ],
    [503, { message: 'PRIVATE_KEY' }, 'CheckoutStorageUnavailable'],
    [400, { code: 'MALICIOUS', message: 'PRIVATE_CARD' }, 'RequestRejected'],
  ] as const) {
    fetcher.mockResolvedValue(response(body, status));
    const result = await api.listProducts();
    expect(result).toEqual({ ok: false, error: { code, status } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  }
  fetcher.mockRejectedValueOnce(new Error('PRIVATE'));
  expect(await api.listProducts()).toEqual({
    ok: false,
    error: { code: 'NetworkError', status: 0 },
  });
  fetcher.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => {
      throw Error('PRIVATE');
    },
  });
  expect(await api.listProducts()).toEqual({
    ok: false,
    error: { code: 'InvalidResponse', status: 200 },
  });
  fetcher.mockResolvedValueOnce({
    ok: false,
    status: 502,
    json: async () => {
      throw Error('PRIVATE');
    },
  });
  expect(await api.listProducts()).toEqual({
    ok: false,
    error: { code: 'RequestRejected', status: 502 },
  });
  jest.useFakeTimers();
  fetcher.mockImplementationOnce(
    (_url, options: RequestInit) =>
      new Promise((_resolve, reject) =>
        options.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        ),
      ),
  );
  const pending = api.listProducts();
  await jest.advanceTimersByTimeAsync(15000);
  expect((await pending).ok).toBe(false);
  jest.useRealTimers();
});
it('rechaza contratos incompletos o importes inválidos antes de mostrarlos', () => {
  expect(isProduct(null)).toBe(false);
  expect(isProduct({ ...product, priceMinor: '9223372036854775808' })).toBe(
    false,
  );
  expect(isProduct({ ...product, availableStock: -1 })).toBe(false);
  expect(isQuote({ ...quote, quantity: 0 })).toBe(false);
  expect(isQuote({ ...quote, currency: 'USD' })).toBe(false);
  expect(isTransaction({ ...transaction, status: 'FAKE_PAID' })).toBe(false);
  expect(isTransaction({ ...transaction, reservationExpiresAt: 'wrong' })).toBe(
    false,
  );
});
