import type {
  PaymentSession,
  PaymentWidgetPort,
  Result,
} from '../domain/contracts';
type Completion = { providerPaymentId: string | null };
type WidgetResult = Result<
  Completion,
  'PaymentWidgetUnavailable' | 'PaymentWidgetBusy'
>;
export interface WidgetConstructor {
  new (config: {
    currency: 'COP';
    amountInCents: number;
    reference: string;
    publicKey: string;
    signature: { integrity: string };
    expirationTime: string;
    bootstrapTransport: 'postmessage';
  }): { open(callback: (value: unknown) => void): void };
}
declare global {
  interface Window {
    WidgetCheckout?: WidgetConstructor;
  }
}
const scriptUrl = 'https://checkout.wompi.co/widget.js';
export function createWompiWidget(): PaymentWidgetPort {
  let loading: Promise<boolean> | null = null;
  let active = false;
  function load(): Promise<boolean> {
    if (window.WidgetCheckout) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (!ok) {
          script.remove();
          loading = null;
        }
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 12000);
      script.onload = () => finish(Boolean(window.WidgetCheckout));
      script.onerror = () => finish(false);
      document.head.appendChild(script);
    });
    return loading;
  }
  return {
    async open(session: PaymentSession): Promise<WidgetResult> {
      if (active) return { ok: false, error: 'PaymentWidgetBusy' };
      active = true;
      const lifecycle: { observer: MutationObserver | null } = {
        observer: null,
      };
      try {
        if (
          !/^pub_test_/.test(session.publicKey) ||
          !/^[1-9][0-9]{0,18}$/.test(session.amountMinor) ||
          BigInt(session.amountMinor) > BigInt(Number.MAX_SAFE_INTEGER) ||
          !Number.isFinite(Date.parse(session.expiresAt)) ||
          Date.parse(session.expiresAt) <= Date.now() ||
          !(await load()) ||
          !window.WidgetCheckout
        )
          return { ok: false, error: 'PaymentWidgetUnavailable' };
        const widget = new window.WidgetCheckout({
          currency: 'COP',
          amountInCents: Number(session.amountMinor),
          reference: session.reference,
          publicKey: session.publicKey,
          signature: { integrity: session.integrity },
          expirationTime: session.expiresAt,
          bootstrapTransport: 'postmessage',
        });
        const modal = Array.from(
          document.querySelectorAll<HTMLElement>('.waybox-modal'),
        ).at(-1);
        return await new Promise<WidgetResult>((resolve) => {
          let providerPaymentId: string | null = null;
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            lifecycle.observer?.disconnect();
            resolve({ ok: true, value: { providerPaymentId } });
          };
          widget.open((value) => {
            // El callback es solo una pista para el servidor; se descartan status y resto del objeto.
            if (
              typeof value === 'object' &&
              value !== null &&
              'transaction' in value &&
              typeof value.transaction === 'object' &&
              value.transaction !== null &&
              'id' in value.transaction &&
              typeof value.transaction.id === 'string' &&
              /^[A-Za-z0-9_-]{1,128}$/.test(value.transaction.id)
            )
              providerPaymentId = value.transaction.id;
            if (!modal) finish();
          });
          // El SDK no llama al callback al cancelar. Solo observamos cierre, nunca datos del iframe.
          if (modal) {
            lifecycle.observer = new MutationObserver(() => {
              if (modal.hidden || !modal.isConnected) finish();
            });
            lifecycle.observer.observe(document.body, {
              subtree: true,
              childList: true,
              attributes: true,
              attributeFilter: ['hidden'],
            });
          }
        });
      } catch {
        return { ok: false, error: 'PaymentWidgetUnavailable' };
      } finally {
        lifecycle.observer?.disconnect();
        active = false;
      }
    },
  };
}
