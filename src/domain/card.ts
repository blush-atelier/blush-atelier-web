import type { ApiResult } from './contracts';
export interface CardInput {
  number: string;
  holder: string;
  expiry: string;
  cvc: string;
  installments: number;
  privacyAccepted: boolean;
  personalDataAccepted: boolean;
}
export interface CardAuthorization {
  token: string;
  acceptanceToken: string;
  personalDataToken: string;
  installments: number;
  privacyAccepted: true;
  personalDataAccepted: true;
}
export interface CardConfiguration {
  apiUrl: string;
  publicKey: string;
  encryptionKey: string;
  privacyUrl: string;
  personalDataUrl: string;
  acceptanceToken: string;
  personalDataToken: string;
}
export interface CardPreview {
  brand: 'VISA' | 'MASTERCARD';
  lastFour: string;
}
export interface CardPort {
  configuration(): Promise<ApiResult<CardConfiguration>>;
  prepare(input: CardInput): Promise<ApiResult<CardPreview>>;
  authorization(): CardAuthorization | null;
  clear(): void;
}
export function cardBrand(value: string): CardPreview['brand'] | null {
  const n = value.replace(/\s/g, '');
  if (/^4/.test(n)) return 'VISA';
  const prefix = Number(n.slice(0, 4));
  return /^(5[1-5])/.test(n) ||
    (n.length >= 4 && prefix >= 2221 && prefix <= 2720)
    ? 'MASTERCARD'
    : null;
}
export function validateCard(
  input: CardInput,
  now = new Date(),
): Partial<Record<keyof CardInput, string>> {
  const errors: Partial<Record<keyof CardInput, string>> = {},
    n = input.number.replace(/\s/g, ''),
    brand = cardBrand(n);
  let sum = 0;
  for (let i = n.length - 1, odd = false; i >= 0; i--, odd = !odd) {
    let digit = Number(n[i]);
    if (odd) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if (
    !/^\d{13,19}$/.test(n) ||
    !brand ||
    sum % 10 !== 0 ||
    (brand === 'MASTERCARD' && n.length !== 16) ||
    (brand === 'VISA' && ![13, 16, 19].includes(n.length))
  )
    errors.number = 'Revisa el número de tu tarjeta Visa o Mastercard.';
  if (input.holder.trim().length < 2 || input.holder.trim().length > 100)
    errors.holder = 'Escribe el nombre que aparece en la tarjeta.';
  const match = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(input.expiry);
  if (
    !match ||
    2000 + Number(match[2]) < now.getFullYear() ||
    (2000 + Number(match[2]) === now.getFullYear() &&
      Number(match[1]) < now.getMonth() + 1)
  )
    errors.expiry = 'Revisa la fecha de vencimiento (MM/AA).';
  if (!/^\d{3}$/.test(input.cvc))
    errors.cvc = 'Escribe los 3 dígitos de seguridad.';
  if (
    !Number.isInteger(input.installments) ||
    input.installments < 1 ||
    input.installments > 36
  )
    errors.installments = 'Elige entre 1 y 36 cuotas.';
  if (!input.privacyAccepted)
    errors.privacyAccepted = 'Acepta la política para continuar.';
  if (!input.personalDataAccepted)
    errors.personalDataAccepted =
      'Autoriza el tratamiento de datos para continuar.';
  return errors;
}
