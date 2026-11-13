export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export type ErrorCode =
  | 'NetworkError'
  | 'InvalidResponse'
  | 'RequestRejected'
  | 'SessionRequired'
  | 'DeliveryNotFound'
  | 'ProductNotFound'
  | 'TransactionNotFound'
  | 'InsufficientStock'
  | 'QuoteChanged'
  | 'IdempotencyConflict'
  | 'DeliveryAlreadyUsed'
  | 'CheckoutStorageUnavailable'
  | 'AmountOutOfRange'
  | 'InvalidCustomer'
  | 'InvalidDelivery'
  | 'InvalidCheckout'
  | 'InvalidInput'
  | 'RateLimited';
export interface ApiError {
  code: ErrorCode;
  status: number;
}
export type ApiResult<T> = Result<T, ApiError>;
export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceMinor: string;
  currency: 'COP';
  availableStock: number;
}
export interface Quote {
  productId: string;
  quantity: number;
  currency: 'COP';
  unitPriceMinor: string;
  productAmountMinor: string;
  baseFeeMinor: string;
  deliveryFeeMinor: string;
  totalMinor: string;
}
export type TransactionStatus =
  'PENDING' | 'EXPIRED' | 'APPROVED' | 'DECLINED' | 'ERROR';
export interface Transaction extends Quote {
  id: string;
  reference: string;
  status: TransactionStatus;
  reservationStatus: 'ACTIVE' | 'RELEASED' | 'CONFIRMED';
  reservationExpiresAt: string;
}
export interface CustomerInput {
  fullName: string;
  email: string;
  phone: string;
}
export interface DeliveryInput {
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  city: string;
  region: string;
  countryCode: 'CO';
}
export interface CheckoutForm extends CustomerInput {
  addressLine: string;
  city: string;
  region: string;
}
export interface QuoteInput {
  productId: string;
  quantity: number;
  deliveryId: string;
}
export interface PendingInput extends QuoteInput {
  expectedTotalMinor: string;
}
export interface CheckoutApi {
  listProducts(): Promise<ApiResult<Product[]>>;
  getProduct(id: string): Promise<ApiResult<Product>>;
  registerCustomer(input: CustomerInput): Promise<ApiResult<{ id: string }>>;
  registerDelivery(input: DeliveryInput): Promise<ApiResult<{ id: string }>>;
  quote(input: QuoteInput): Promise<ApiResult<Quote>>;
  createPending(
    input: PendingInput,
    key: string,
  ): Promise<ApiResult<Transaction>>;
  getTransaction(id: string): Promise<ApiResult<Transaction>>;
}
export interface SafeProgress {
  version: 1;
  productId: string;
  quantity: number;
  deliveryId: string | null;
  transactionId: string | null;
  requestKey: string | null;
  expectedTotalMinor: string | null;
  attempted: boolean;
}
export interface ProgressPort {
  read(): Result<SafeProgress | null, 'PersistenceUnavailable'>;
  save(progress: SafeProgress | null): Result<void, 'PersistenceUnavailable'>;
}
export interface RuntimePort {
  newKey(): string;
}

export type CartError =
  | 'CheckoutLocked'
  | 'DifferentProduct'
  | 'InsufficientStock'
  | 'ProductNotFound'
  | 'InvalidQuantity';
