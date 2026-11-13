import {
  brandOf,
  paginateProducts,
  categoryOf,
  errorMessage,
  filterProducts,
  formatMoney,
  validateForm,
} from '../src/domain/presentation';
import type { ErrorCode } from '../src/domain/contracts';
import { product, lipstick, form } from './fixtures';
it('formatea centavos con precisión y sin Number para cantidades grandes', () => {
  expect(formatMoney('8990000')).toBe('$ 89.900');
  expect(formatMoney('2')).toBe('$ 0,02');
  expect(formatMoney('0')).toBe('$ 0');
  expect(formatMoney('9007199254740993')).toBe('$ 90.071.992.547.409,93');
  expect(formatMoney('-1')).toBe('—');
  expect(formatMoney('1.2')).toBe('—');
});
it('filtra texto, categoría y precio sin mutar el catálogo', () => {
  const products = [product, lipstick];
  expect(filterProducts(products, 'RÓSE', 'Todos', 'atelier')).toEqual([
    product,
  ]);
  expect(filterProducts(products, '', 'Labios', 'atelier')).toEqual([lipstick]);
  expect(filterProducts(products, '', 'Rubores', 'atelier')).toEqual([product]);
  expect(filterProducts(products, '', 'Todos', 'price')).toEqual([
    lipstick,
    product,
  ]);
  expect(products[0]).toBe(product);
  expect(
    filterProducts(
      [product, { ...product, id: 'other' }],
      '',
      'Todos',
      'price',
    ),
  ).toHaveLength(2);
  expect(categoryOf({ ...product, sku: 'OTHER' })).toBe('Todos');
});
it('valida el formulario y normalización de formatos admitidos', () => {
  expect(validateForm(form)).toEqual({});
  expect(validateForm({ ...form, phone: '+57 (300) 123-4567' })).toEqual({});
  for (const change of [
    { fullName: '1' },
    { fullName: 'A'.repeat(121) },
    { email: 'wrong' },
    { email: 'a'.repeat(255) + '@example.com' },
    { phone: 'x' },
    { addressLine: 'x' },
    { city: 'x' },
    { region: 'x' },
    { city: 'x'.repeat(101) },
    { region: 'Bogotá\n' },
  ])
    expect(
      Object.keys(validateForm({ ...form, ...change })).length,
    ).toBeGreaterThan(0);
});
it('mensajes locales no reflejan errores de servidor ni datos privados', () => {
  expect(errorMessage(null)).toBe('');
  const codes: ErrorCode[] = [
    'NetworkError',
    'InvalidResponse',
    'RequestRejected',
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
    'RateLimited',
  ];
  for (const code of codes)
    expect(errorMessage({ code, status: 400 }).length).toBeGreaterThan(10);
});

it('identifica marcas y combina marca, texto y categoría sin inventar metadatos', () => {
  const items = [
    { ...lipstick, sku: 'LIP-MAC-RUBYWOO', name: 'MACximal Ruby Woo' },
    { ...lipstick, sku: 'LIP-TOOFACED-STARS', name: 'Lip Injection' },
    { ...product, sku: 'BLUSH-BLOOMSHELL-LOVE' },
    { ...product, sku: 'BLUSH-ATENEA-PINKCHAI' },
  ];
  expect(items.map(brandOf)).toEqual([
    'MAC',
    'Too Faced',
    'Bloomshell',
    'Atenea',
  ]);
  expect(brandOf(product)).toBe('Atelier');
  expect(filterProducts(items, 'MAC', 'Labios', 'atelier', 'MAC')).toEqual([
    items[0],
  ]);
  expect(filterProducts(items, '', 'Rubores', 'atelier', 'Atenea')).toEqual([
    items[3],
  ]);
  expect(filterProducts(items, '', 'Labios', 'atelier', 'Bloomshell')).toEqual(
    [],
  );
});

it('clasifica las cuatro categorías nuevas y no confunde accesorios con bases', () => {
  for (const [sku, category] of [
    ['BASE-MAC-NC15', 'Bases'],
    ['CONCEALER-ATENEA-LIGHT', 'Correctores'],
    ['EYE-ATENEA-ROSE', 'Sombras'],
    ['ACC-ATENEA-BASE', 'Accesorios'],
    ['constructor', 'Todos'],
  ])
    expect(categoryOf({ ...product, sku })).toBe(category);
});
it('pagina ocho productos, acota extremos y no modifica el catálogo original', () => {
  const products = Array.from({ length: 22 }, (_, index) => ({
    ...product,
    id: String(index),
  }));
  expect(paginateProducts(products, 1)).toMatchObject({
    page: 1,
    totalPages: 3,
    total: 22,
    start: 1,
    end: 8,
    items: products.slice(0, 8),
  });
  expect(paginateProducts(products, 2).items).toEqual(products.slice(8, 16));
  expect(paginateProducts(products, 999)).toMatchObject({
    page: 3,
    start: 17,
    end: 22,
    items: products.slice(16),
  });
  for (const invalid of [0, -1, NaN, Infinity, 1.5])
    expect(paginateProducts(products, invalid).page).toBe(1);
  expect(paginateProducts([], 5)).toEqual({
    items: [],
    page: 1,
    totalPages: 1,
    total: 0,
    start: 0,
    end: 0,
  });
  expect(products).toHaveLength(22);
});
it('ordena por mayor precio sin perder precisión en centavos', () => {
  const high = { ...product, id: 'high', priceMinor: '9007199254740993' };
  const low = { ...product, id: 'low', priceMinor: '9007199254740992' };
  expect(filterProducts([low, high], '', 'Todos', 'price-desc')).toEqual([
    high,
    low,
  ]);
});
