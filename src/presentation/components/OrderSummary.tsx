import type { Quote } from '../../domain/contracts';
import { formatMoney } from '../../domain/presentation';
export function OrderSummary({ quote }: { quote: Quote }) {
  return (
    <dl className="amount-summary">
      <div>
        <dt>
          Producto <span>× {quote.quantity}</span>
        </dt>
        <dd>{formatMoney(quote.productAmountMinor)}</dd>
      </div>
      <div>
        <dt>Tarifa base</dt>
        <dd>{formatMoney(quote.baseFeeMinor)}</dd>
      </div>
      <div>
        <dt>Envío</dt>
        <dd>{formatMoney(quote.deliveryFeeMinor)}</dd>
      </div>
      <div className="amount-total">
        <dt>
          Total <small>COP</small>
        </dt>
        <dd>{formatMoney(quote.totalMinor)}</dd>
      </div>
    </dl>
  );
}
