import type { CheckoutApi, ApiResult } from '../domain/contracts';
import {
  validateCard,
  cardBrand,
  type CardInput,
  type CardPort,
  type CardConfiguration,
  type CardAuthorization,
} from '../domain/card';
const failure = (): ApiResult<never> => ({
  ok: false,
  error: { code: 'PaymentProviderUnavailable', status: 502 },
});
const bytes = (value: string) => new TextEncoder().encode(value);
const base64url = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
export async function encryptCard(
  input: CardInput,
  pem: string,
  crypto: Crypto = globalThis.crypto,
): Promise<string> {
  const raw = Uint8Array.from(
    atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'spki',
    raw,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  const cek = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  );
  const wrapped = new Uint8Array(
    await crypto.subtle.encrypt(
      'RSA-OAEP',
      key,
      await crypto.subtle.exportKey('raw', cek),
    ),
  );
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    header = base64url(
      bytes(JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })),
    );
  const [month, year] = input.expiry.split('/').map((v) => v.trim());
  const payload = bytes(
    JSON.stringify({
      number: input.number.replace(/\s/g, ''),
      cvc: input.cvc,
      exp_month: month,
      exp_year: year,
      card_holder: input.holder.trim(),
    }),
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: bytes(header), tagLength: 128 },
      cek,
      payload,
    ),
  );
  return [
    header,
    base64url(wrapped),
    base64url(iv),
    base64url(encrypted.slice(0, -16)),
    base64url(encrypted.slice(-16)),
  ].join('.');
}
export function createCardPayments(
  api: CheckoutApi,
  request: typeof fetch = globalThis.fetch,
): CardPort {
  let configuration: CardConfiguration | null = null,
    authorization: CardAuthorization | null = null;
  return {
    clear() {
      authorization = null;
    },
    authorization() {
      return authorization;
    },
    async configuration() {
      try {
        const result = await api.cardConfiguration?.();
        if (!result) return failure();
        if (result.ok) configuration = result.value;
        return result;
      } catch {
        return failure();
      }
    },
    async prepare(input) {
      authorization = null;
      if (Object.keys(validateCard(input)).length)
        return {
          ok: false,
          error: { code: 'InvalidPaymentInput', status: 400 },
        };
      if (!configuration) return failure();
      try {
        const url = new URL(configuration.apiUrl);
        if (
          url.protocol !== 'https:' ||
          !['sandbox.wompi.co', 'api-sandbox.co.uat.wompi.dev'].includes(
            url.hostname,
          ) ||
          url.pathname !== '/v1' ||
          url.username ||
          url.password ||
          url.port
        )
          return failure();
        // La API de Blush solo recibe el token. PAN y CVC van cifrados al proveedor.
        const payload = await encryptCard(input, configuration.encryptionKey);
        const response = await request(`${url.href}/tokens/cards`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${configuration.publicKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ payload }),
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          return response.status === 422 || response.status === 400
            ? { ok: false, error: { code: 'InvalidPaymentInput', status: 400 } }
            : failure();
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== 'object' ||
          !('data' in body) ||
          !body.data ||
          typeof body.data !== 'object' ||
          !('id' in body.data) ||
          typeof body.data.id !== 'string' ||
          !/^tok_(?:test_|stagtest)[A-Za-z0-9_-]+$/.test(body.data.id)
        )
          return failure();
        authorization = {
          token: body.data.id,
          acceptanceToken: configuration.acceptanceToken,
          personalDataToken: configuration.personalDataToken,
          installments: input.installments,
          privacyAccepted: true,
          personalDataAccepted: true,
        };
        return {
          ok: true,
          value: {
            brand: cardBrand(input.number)!,
            lastFour: input.number.replace(/\s/g, '').slice(-4),
          },
        };
      } catch {
        return failure();
      }
    },
  };
}
