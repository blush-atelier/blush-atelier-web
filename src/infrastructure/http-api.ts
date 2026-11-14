import type {
  ApiResult,
  ApiError,
  CheckoutApi,
  Product,
  Quote,
  Transaction,
} from '../domain/contracts';
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
    value,
  );
const money = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^(0|[1-9][0-9]{0,18})$/.test(value) &&
  BigInt(value) <= 9223372036854775807n;
export function isProduct(value: unknown): value is Product {
  return (
    record(value) &&
    uuid(value.id) &&
    typeof value.sku === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    (value.imageUrl === null || typeof value.imageUrl === 'string') &&
    money(value.priceMinor) &&
    value.currency === 'COP' &&
    typeof value.availableStock === 'number' &&
    Number.isSafeInteger(value.availableStock) &&
    value.availableStock >= 0
  );
}
function isQuoteItem(value: unknown): boolean {
  return (
    record(value) &&
    uuid(value.productId) &&
    typeof value.quantity === 'number' &&
    Number.isSafeInteger(value.quantity) &&
    value.quantity > 0 &&
    value.quantity <= 2147483647 &&
    money(value.unitPriceMinor) &&
    money(value.productAmountMinor) &&
    BigInt(value.unitPriceMinor) * BigInt(value.quantity) ===
      BigInt(value.productAmountMinor)
  );
}
export function isQuote(value: unknown): value is Quote {
  return (
    record(value) &&
    (value.items === undefined ||
      (Array.isArray(value.items) &&
        value.items.length >= 2 &&
        value.items.length <= 50 &&
        value.items.every(isQuoteItem) &&
        new Set(value.items.map((i) => i.productId)).size ===
          value.items.length &&
        value.items
          .reduce((sum, i) => sum + BigInt(i.productAmountMinor), 0n)
          .toString() === value.productAmountMinor)) &&
    uuid(value.productId) &&
    typeof value.quantity === 'number' &&
    Number.isSafeInteger(value.quantity) &&
    value.quantity > 0 &&
    value.currency === 'COP' &&
    [
      'unitPriceMinor',
      'productAmountMinor',
      'baseFeeMinor',
      'deliveryFeeMinor',
      'totalMinor',
    ].every((key) => money(value[key]))
  );
}
export function isTransaction(value: unknown): value is Transaction {
  return (
    isQuote(value) &&
    record(value) &&
    uuid(value.id) &&
    typeof value.reference === 'string' &&
    value.reference.length <= 80 &&
    ['PENDING', 'EXPIRED', 'APPROVED', 'DECLINED', 'ERROR'].includes(
      String(value.status),
    ) &&
    ['ACTIVE', 'RELEASED', 'CONFIRMED'].includes(
      String(value.reservationStatus),
    ) &&
    typeof value.reservationExpiresAt === 'string' &&
    Number.isFinite(Date.parse(value.reservationExpiresAt))
  );
}
const codes = new Set([
  'PaymentNotConfigured',
  'PaymentSessionExpired',
  'PaymentProviderUnavailable',
  'PaymentNotFound',
  'InvalidProviderResponse',
  'InvalidPaymentObservation',
  'PaymentIdentityMismatch',
  'PaymentAmountMismatch',
  'PaymentCurrencyMismatch',
  'InvalidPaymentState',
  'InvalidPaymentInput',
  'SessionRequired',
  'DeliveryNotFound',
  'ProductNotFound',
  'TransactionNotFound',
  'InsufficientStock',
  'QuoteChanged',
  'IdempotencyConflict',
  'DeliveryAlreadyUsed',
  'CheckoutStorageUnavailable',
  'AmountOutOfRange',
  'InvalidCustomer',
  'InvalidDelivery',
  'InvalidCheckout',
  'InvalidInput',
]);
export function createHttpApi(
  base = '',
  fetcher: typeof fetch = globalThis.fetch,
): CheckoutApi {
  const prefix = base.replace(/\/$/, '');
  async function send<T>(
    path: string,
    decode: (value: unknown) => T | null,
    body?: unknown,
    key?: string,
  ): Promise<ApiResult<T>> {
    const abort = new AbortController();
    const timer = setTimeout(
      () => abort.abort(),
      path.endsWith('/payments') ? 25000 : 15000,
    );
    try {
      const headers: Record<string, string> = {};
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        headers['X-Checkout-Request'] = '1';
      }
      if (key) headers['Idempotency-Key'] = key;
      const response = await fetcher(`${prefix}/api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        credentials: 'include',
        cache: 'no-store',
        signal: abort.signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        return {
          ok: false,
          error: {
            code: response.ok ? 'InvalidResponse' : 'RequestRejected',
            status: response.status,
          },
        };
      }
      if (!response.ok) {
        const code =
          response.status === 401
            ? 'SessionRequired'
            : response.status === 429
              ? 'RateLimited'
              : record(data) &&
                  typeof data.code === 'string' &&
                  codes.has(data.code)
                ? data.code
                : response.status >= 500
                  ? 'CheckoutStorageUnavailable'
                  : 'RequestRejected';
        // Solo conservamos un código conocido; nunca cuerpos o mensajes recibidos del servidor.
        return {
          ok: false,
          error: { code: code as ApiError['code'], status: response.status },
        };
      }
      const decoded = decode(data);
      return decoded !== null
        ? { ok: true, value: decoded }
        : {
            ok: false,
            error: { code: 'InvalidResponse', status: response.status },
          };
    } catch {
      return { ok: false, error: { code: 'NetworkError', status: 0 } };
    } finally {
      clearTimeout(timer);
    }
  }
  const id = (value: unknown): { id: string } | null =>
    record(value) && uuid(value.id) ? { id: value.id } : null;
  const product = (value: Product): Product => ({
    id: value.id,
    sku: value.sku,
    name: value.name,
    description: value.description,
    imageUrl: value.imageUrl,
    priceMinor: value.priceMinor,
    currency: value.currency,
    availableStock: value.availableStock,
  });
  const quote = (value: Quote): Quote => ({
    ...(value.items
      ? {
          items: value.items.map(
            ({ productId, quantity, unitPriceMinor, productAmountMinor }) => ({
              productId,
              quantity,
              unitPriceMinor,
              productAmountMinor,
            }),
          ),
        }
      : {}),
    productId: value.productId,
    quantity: value.quantity,
    currency: value.currency,
    unitPriceMinor: value.unitPriceMinor,
    productAmountMinor: value.productAmountMinor,
    baseFeeMinor: value.baseFeeMinor,
    deliveryFeeMinor: value.deliveryFeeMinor,
    totalMinor: value.totalMinor,
  });
  const transaction = (value: Transaction): Transaction => ({
    ...quote(value),
    id: value.id,
    reference: value.reference,
    status: value.status,
    reservationStatus: value.reservationStatus,
    reservationExpiresAt: value.reservationExpiresAt,
  });
  return {
    cardConfiguration: () =>
      send('/payments/card-configuration', (value) => {
        if (
          !record(value) ||
          ![
            'apiUrl',
            'publicKey',
            'encryptionKey',
            'privacyUrl',
            'personalDataUrl',
            'acceptanceToken',
            'personalDataToken',
          ].every((k) => typeof value[k] === 'string' && value[k].length > 0)
        )
          return null;
        return {
          apiUrl: value.apiUrl,
          publicKey: value.publicKey,
          encryptionKey: value.encryptionKey,
          privacyUrl: value.privacyUrl,
          personalDataUrl: value.personalDataUrl,
          acceptanceToken: value.acceptanceToken,
          personalDataToken: value.personalDataToken,
        } as import('../domain/card').CardConfiguration;
      }),
    chargePayment: (id, input) =>
      send(
        `/transactions/${encodeURIComponent(id)}/payments`,
        (value) =>
          record(value) && value.accepted === true ? { accepted: true } : null,
        {
          token: input.token,
          acceptanceToken: input.acceptanceToken,
          personalDataToken: input.personalDataToken,
          installments: input.installments,
          privacyAccepted: input.privacyAccepted,
          personalDataAccepted: input.personalDataAccepted,
        },
      ),
    verifyPayment: (transactionId, providerPaymentId) =>
      send(
        `/transactions/${encodeURIComponent(transactionId)}/payment-verification`,
        (value) =>
          record(value) && typeof value.verified === 'boolean'
            ? {
                verified: value.verified,
                ...(typeof value.submitted === 'boolean'
                  ? { submitted: value.submitted }
                  : {}),
              }
            : null,
        providerPaymentId ? { providerPaymentId } : {},
      ),
    listProducts: () =>
      send('/products', (value) =>
        Array.isArray(value) && value.every(isProduct)
          ? value.map(product)
          : null,
      ),
    getProduct: (productId) =>
      send(`/products/${encodeURIComponent(productId)}`, (value) =>
        isProduct(value) && value.id === productId ? product(value) : null,
      ),
    registerCustomer: (input) =>
      send('/customers', id, {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
      }),
    registerDelivery: (input) =>
      send('/deliveries', id, {
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        addressLine: input.addressLine,
        city: input.city,
        region: input.region,
        countryCode: input.countryCode,
      }),
    quote: (input) =>
      send(
        '/checkout/quote',
        (value) => (isQuote(value) ? quote(value) : null),
        {
          ...(input.items
            ? {
                items: input.items.map(({ productId, quantity }) => ({
                  productId,
                  quantity,
                })),
              }
            : {}),
          productId: input.productId,
          quantity: input.quantity,
          deliveryId: input.deliveryId,
        },
      ),
    createPending: (input, key) =>
      send(
        '/transactions',
        (value) => (isTransaction(value) ? transaction(value) : null),
        {
          ...(input.items
            ? {
                items: input.items.map(({ productId, quantity }) => ({
                  productId,
                  quantity,
                })),
              }
            : {}),
          productId: input.productId,
          quantity: input.quantity,
          deliveryId: input.deliveryId,
          expectedTotalMinor: input.expectedTotalMinor,
        },
        key,
      ),
    getTransaction: (transactionId) =>
      send(`/transactions/${encodeURIComponent(transactionId)}`, (value) =>
        isTransaction(value) && value.id === transactionId
          ? transaction(value)
          : null,
      ),
  };
}
