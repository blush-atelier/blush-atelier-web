import type { PaymentSession } from '../src/domain/contracts';
export const paymentSession: PaymentSession = {
  reference: 'BA-44444444-4444-4444-8444-444444444444',
  amountMinor: '10490000',
  currency: 'COP',
  publicKey: 'pub_test_fixture',
  integrity: 'a'.repeat(64),
  expiresAt: '2099-01-01T00:00:00.000Z',
};
