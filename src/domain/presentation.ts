import type { ApiError, CheckoutForm, Product } from './contracts';
export function formatMoney(minor: string): string {
  if (!/^[0-9]{1,19}$/.test(minor)) return '—';
  const value = BigInt(minor);
  const fraction = value % 100n;
  return `$ ${new Intl.NumberFormat('es-CO').format(value / 100n)}${fraction ? ',' + fraction.toString().padStart(2, '0') : ''}`;
}
export const categories = [
  'Todos',
  'Rubores',
  'Labios',
  'Bases',
  'Correctores',
  'Sombras',
  'Accesorios',
] as const;
export type Category = (typeof categories)[number];
const categoryPrefixes = new Map<string, Category>([
  ['BLUSH', 'Rubores'],
  ['LIP', 'Labios'],
  ['BASE', 'Bases'],
  ['CONCEALER', 'Correctores'],
  ['EYE', 'Sombras'],
  ['ACC', 'Accesorios'],
]);
export function categoryOf(product: Product): Category {
  return categoryPrefixes.get(product.sku.split('-')[0]) ?? 'Todos';
}
export const PAGE_SIZE = 8;
export function paginateProducts(products: Product[], requestedPage: number) {
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    totalPages,
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1,
  );
  const offset = (page - 1) * PAGE_SIZE;
  return {
    items: products.slice(offset, offset + PAGE_SIZE),
    page,
    totalPages,
    total,
    start: total ? offset + 1 : 0,
    end: Math.min(offset + PAGE_SIZE, total),
  };
}
export const brands = ['MAC', 'Too Faced', 'Bloomshell', 'Atenea'] as const;
export function brandOf(product: Product): string {
  const sku = product.sku.toUpperCase();
  return sku.includes('-MAC-')
    ? 'MAC'
    : sku.includes('-TOOFACED-')
      ? 'Too Faced'
      : sku.includes('-BLOOMSHELL-')
        ? 'Bloomshell'
        : sku.includes('-ATENEA-')
          ? 'Atenea'
          : 'Atelier';
}
export function filterProducts(
  products: Product[],
  search: string,
  category: Category,
  sort: string,
  brand = 'Todas',
): Product[] {
  const normalize = (text: string) =>
    text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const term = normalize(search.trim());
  const filtered = products.filter(
    (product) =>
      (brand === 'Todas' || brandOf(product) === brand) &&
      (category === 'Todos' || categoryOf(product) === category) &&
      normalize(
        `${brandOf(product)} ${product.name} ${product.description} ${product.sku}`,
      ).includes(term),
  );
  if (sort !== 'price' && sort !== 'price-desc') return filtered;
  return filtered.sort((a, b) => {
    const order =
      BigInt(a.priceMinor) < BigInt(b.priceMinor)
        ? -1
        : BigInt(a.priceMinor) > BigInt(b.priceMinor)
          ? 1
          : 0;
    return sort === 'price-desc' ? -order : order;
  });
}
export function validateForm(
  form: CheckoutForm,
): Partial<Record<keyof CheckoutForm, string>> {
  const errors: Partial<Record<keyof CheckoutForm, string>> = {};
  const name = form.fullName.trim();
  if (
    name.length < 2 ||
    name.length > 120 ||
    !/^[\p{L}\p{M} .'-]+$/u.test(name)
  )
    errors.fullName = 'Escribe tu nombre y apellido.';
  if (
    form.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  )
    errors.email = 'Escribe un correo válido.';
  if (!/^\+?[0-9]{7,15}$/.test(form.phone.trim().replace(/[ ()-]/g, '')))
    errors.phone = 'Escribe un teléfono válido con indicativo.';
  for (const [key, min, max, label] of [
    ['addressLine', 5, 250, 'la dirección'],
    ['city', 2, 100, 'la ciudad'],
    ['region', 2, 100, 'el departamento'],
  ] as const) {
    if (
      form[key].trim().length < min ||
      form[key].trim().length > max ||
      /\p{Cc}/u.test(form[key])
    )
      errors[key] = `Revisa ${label} de entrega.`;
  }
  return errors;
}
export function errorMessage(error: ApiError | null): string {
  if (!error) return '';
  switch (error.code) {
    case 'PaymentNotConfigured':
      return 'El pago Sandbox aún no está configurado en la API. Tu pedido permanece pendiente.';
    case 'PaymentSessionExpired':
      return 'La sesión de pago venció. Actualiza el estado; si ya pagaste, espera la confirmación.';
    case 'PaymentProviderUnavailable':
      return 'Wompi no respondió. No abras otra compra: actualiza el estado para verificar el intento.';
    case 'InvalidPaymentState':
      return 'Este pedido no permite iniciar otro pago. Actualiza su estado.';
    case 'PaymentIdentityMismatch':
    case 'PaymentAmountMismatch':
    case 'PaymentCurrencyMismatch':
      return 'Los datos del pago no coinciden con el pedido. No se confirmó la compra; consulta su estado.';
    case 'PaymentNotFound':
      return 'El proveedor todavía no encuentra ese pago. Espera y vuelve a consultar.';
    case 'InvalidProviderResponse':
    case 'InvalidPaymentObservation':
    case 'InvalidPaymentInput':
      return 'No pudimos verificar el pago. Actualiza el estado sin crear otra compra.';
    case 'NetworkError':
      return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
    case 'SessionRequired':
      return 'Tu sesión venció. Inicia una nueva selección para continuar.';
    case 'InsufficientStock':
      return 'No quedan suficientes unidades. Actualiza la disponibilidad o elige otra cantidad.';
    case 'QuoteChanged':
      return 'El total cambió. Actualiza el resumen y confírmalo de nuevo.';
    case 'IdempotencyConflict':
      return 'Esta solicitud ya existe con otros datos. Revisa tu pedido antes de continuar.';
    case 'DeliveryAlreadyUsed':
      return 'Esta entrega ya está asociada a una reserva. Consulta tu pedido.';
    case 'RateLimited':
      return 'Hemos recibido varias solicitudes. Espera un momento y vuelve a intentarlo.';
    case 'ProductNotFound':
      return 'Este producto ya no está disponible.';
    case 'DeliveryNotFound':
    case 'TransactionNotFound':
      return 'No encontramos esta selección en tu sesión.';
    case 'CheckoutStorageUnavailable':
      return 'El servicio no está disponible por un momento. Puedes reintentar con seguridad.';
    case 'InvalidCustomer':
    case 'InvalidDelivery':
    case 'InvalidCheckout':
    case 'InvalidInput':
      return 'Revisa los datos del formulario antes de continuar.';
    default:
      return 'No pudimos completar la solicitud. Inténtalo de nuevo.';
  }
}

// Es un subtotal orientativo del catálogo; la cotización del servidor confirma importes y tarifas.
export function cartSubtotalMinor(product: Product, quantity: number): string {
  return (BigInt(product.priceMinor) * BigInt(quantity)).toString();
}
