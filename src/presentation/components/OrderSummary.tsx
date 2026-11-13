import type { Quote } from '../../domain/contracts';
import { useAppSelector } from '../hooks';
import { formatMoney } from '../../domain/presentation';
export function OrderSummary({ quote }: { quote: Quote }) {
  const products = useAppSelector((state) => state.products);
  return (
    <dl className="amount-summary">
      {(
        quote.items ?? [
          {
            productId: quote.productId,
            quantity: quote.quantity,
            productAmountMinor: quote.productAmountMinor,
          },
        ]
      ).map((item) => (
        <div key={item.productId}>
          <dt>
            {quote.items
              ? (products.find((p) => p.id === item.productId)?.name ??
                'Producto')
              : 'Producto'}{' '}
            <span>× {item.quantity}</span>
          </dt>
          <dd>{formatMoney(item.productAmountMinor)}</dd>
        </div>
      ))}
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
