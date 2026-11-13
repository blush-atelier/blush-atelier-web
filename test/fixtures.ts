import type {
  ApiResult,
  CheckoutApi,
  Product,
  Quote,
  Transaction,
  SafeProgress,
  ProgressPort,
  CheckoutForm,
} from '../src/domain/contracts';
export const productId = '11111111-1111-4111-8111-111111111111';
export const otherId = '22222222-2222-4222-8222-222222222222';
export const deliveryId = '33333333-3333-4333-8333-333333333333';
export const transactionId = '44444444-4444-4444-8444-444444444444';
export const product: Product = {
  id: productId,
  sku: 'BLUSH-ROSE-01',
  name: 'Rubor Rose',
  description: 'Rubor suave de acabado natural.',
  imageUrl: null,
  priceMinor: '8990000',
  currency: 'COP',
  availableStock: 20,
};
export const lipstick: Product = {
  ...product,
  id: otherId,
  sku: 'LIP-COCOA-01',
  name: 'Labial Cocoa',
  description: 'Labial cremoso en tono cocoa.',
  priceMinor: '5990000',
  availableStock: 15,
};
export const quote: Quote = {
  productId,
  quantity: 1,
  currency: 'COP',
  unitPriceMinor: '8990000',
  productAmountMinor: '8990000',
  baseFeeMinor: '500000',
  deliveryFeeMinor: '1000000',
  totalMinor: '10490000',
};
export const transaction: Transaction = {
  ...quote,
  id: transactionId,
  reference: `BA-${transactionId}`,
  status: 'PENDING',
  reservationStatus: 'ACTIVE',
  reservationExpiresAt: '2026-11-13T23:59:00.000Z',
};
export const form: CheckoutForm = {
  fullName: 'Ana Prueba',
  email: 'ana@example.com',
  phone: '+573001234567',
  addressLine: 'Calle 10 # 20-30',
  city: 'Bogotá',
  region: 'Bogotá D.C.',
};
export const progress: SafeProgress = {
  version: 1,
  productId,
  quantity: 1,
  deliveryId,
  transactionId: null,
  requestKey: 'checkout-request-0001',
  expectedTotalMinor: quote.totalMinor,
  attempted: false,
};
export const success = <T>(value: T): ApiResult<T> => ({ ok: true, value });
export function apiFixture(): jest.Mocked<CheckoutApi> {
  return {
    listProducts: jest.fn().mockResolvedValue(success([product, lipstick])),
    getProduct: jest.fn().mockResolvedValue(success(product)),
    registerCustomer: jest.fn().mockResolvedValue(success({ id: otherId })),
    registerDelivery: jest.fn().mockResolvedValue(success({ id: deliveryId })),
    quote: jest.fn().mockResolvedValue(success(quote)),
    createPending: jest.fn().mockResolvedValue(success(transaction)),
    getTransaction: jest.fn().mockResolvedValue(success(transaction)),
  };
}
export function memoryProgress(
  initial: SafeProgress | null = null,
): ProgressPort & { current: SafeProgress | null } {
  return {
    current: initial,
    read() {
      return { ok: true, value: this.current };
    },
    save(value) {
      this.current = value;
      return { ok: true, value: undefined };
    },
  };
}
