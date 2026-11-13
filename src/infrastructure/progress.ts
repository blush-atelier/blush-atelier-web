import type { ProgressPort, SafeProgress } from '../domain/contracts';
export const PROGRESS_KEY = 'blush.checkout.v1';
const uuid = (value: unknown) =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
    value,
  );
export function parseProgress(value: unknown): SafeProgress | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const data = value as Record<string, unknown>;
  const keys = [
    'version',
    'items',
    'productId',
    'quantity',
    'deliveryId',
    'transactionId',
    'requestKey',
    'expectedTotalMinor',
    'attempted',
  ];
  if (
    Object.keys(data).some((key) => !keys.includes(key)) ||
    data.version !== 1 ||
    !uuid(data.productId) ||
    typeof data.quantity !== 'number' ||
    !Number.isSafeInteger(data.quantity) ||
    data.quantity < 1 ||
    data.quantity > 2147483647 ||
    typeof data.attempted !== 'boolean'
  )
    return null;
  if (
    data.items !== undefined &&
    (!Array.isArray(data.items) ||
      data.items.length < 2 ||
      data.items.length > 50 ||
      new Set(data.items.map((i) => i?.productId)).size !== data.items.length ||
      !data.items.every(
        (i) =>
          typeof i === 'object' &&
          i !== null &&
          Object.keys(i).length === 2 &&
          uuid(i.productId) &&
          Number.isSafeInteger(i.quantity) &&
          i.quantity > 0 &&
          i.quantity <= 2147483647,
      ) ||
      data.items[0].productId !== data.productId ||
      data.items[0].quantity !== data.quantity)
  )
    return null;
  if (data.deliveryId !== null && !uuid(data.deliveryId)) return null;
  if (data.transactionId !== null && !uuid(data.transactionId)) return null;
  if (
    data.requestKey !== null &&
    (typeof data.requestKey !== 'string' ||
      !/^[A-Za-z0-9_-]{8,128}$/.test(data.requestKey))
  )
    return null;
  if (
    data.expectedTotalMinor !== null &&
    (typeof data.expectedTotalMinor !== 'string' ||
      !/^(0|[1-9][0-9]{0,18})$/.test(data.expectedTotalMinor))
  )
    return null;
  if (
    data.attempted &&
    (!data.requestKey || !data.deliveryId || !data.expectedTotalMinor)
  )
    return null;
  return {
    version: 1,
    ...(Array.isArray(data.items)
      ? {
          items: data.items.map((i) => ({
            productId: i.productId as string,
            quantity: i.quantity as number,
          })),
        }
      : {}),
    productId: data.productId as string,
    quantity: data.quantity,
    deliveryId: data.deliveryId as string | null,
    transactionId: data.transactionId as string | null,
    requestKey: data.requestKey as string | null,
    expectedTotalMinor: data.expectedTotalMinor as string | null,
    attempted: data.attempted,
  };
}
export function browserProgress(
  storage: () => Storage = () => window.localStorage,
): ProgressPort {
  return {
    read() {
      try {
        const raw = storage().getItem(PROGRESS_KEY);
        if (!raw) return { ok: true, value: null };
        const progress = parseProgress(JSON.parse(raw));
        if (!progress) storage().removeItem(PROGRESS_KEY);
        return { ok: true, value: progress };
      } catch {
        return { ok: false, error: 'PersistenceUnavailable' };
      }
    },
    save(progress) {
      try {
        const safe = progress ? parseProgress(progress) : null;
        if (progress && !safe)
          return { ok: false, error: 'PersistenceUnavailable' };
        if (safe) storage().setItem(PROGRESS_KEY, JSON.stringify(safe));
        else storage().removeItem(PROGRESS_KEY);
        return { ok: true, value: undefined };
      } catch {
        return { ok: false, error: 'PersistenceUnavailable' };
      }
    },
  };
}
export function newRequestKey(): string {
  // Safari sin randomUUID también dispone de getRandomValues; no usamos Math.random.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `checkout-${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}
