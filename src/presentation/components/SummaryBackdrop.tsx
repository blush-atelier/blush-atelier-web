import { useState, type ReactNode } from 'react';
import type { Product } from '../../domain/contracts';
import { ProductArt } from './ProductArt';
import { Icon } from './Icon';
export function SummaryBackdrop({
  product,
  quantity,
  children,
  items,
}: {
  product: Product | null | undefined;
  quantity: number;
  children: ReactNode;
  items?: { product: Product | null | undefined; quantity: number }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      className="summary-backdrop"
      aria-label="Resumen de compra en dos capas"
    >
      <div className="summary-back-layer">
        <div className="backdrop-bar">
          <div>
            <p className="eyebrow">TU CARRITO ATELIER</p>
            <p>
              {quantity}{' '}
              {quantity === 1 ? 'unidad elegida' : 'unidades elegidas'}
            </p>
          </div>
          <button
            aria-expanded={expanded}
            aria-controls="backdrop-product"
            onClick={() => setExpanded((value) => !value)}
          >
            {items && items.length > 1
              ? expanded
                ? 'Ocultar productos'
                : 'Ver mis productos'
              : expanded
                ? 'Ocultar producto'
                : 'Ver mi producto'}
            <Icon name={expanded ? 'minus' : 'plus'} />
          </button>
        </div>
        <div
          className={`backdrop-reveal ${expanded ? 'is-expanded' : ''}`}
          id="backdrop-product"
          aria-hidden={!expanded}
        >
          <div>
            {(items ?? [{ product, quantity }]).map(
              ({ product: entry, quantity: count }) =>
                entry && (
                  <div className="backdrop-product" key={entry.id}>
                    <ProductArt product={entry} />
                    <div>
                      <h3>{entry.name}</h3>
                      <p>Cantidad: {count}</p>
                    </div>
                  </div>
                ),
            )}
          </div>
        </div>
      </div>
      <div className="summary-front-layer">
        <span className="backdrop-handle" aria-hidden="true" />
        {children}
      </div>
    </section>
  );
}
