import { useState, type ReactNode } from 'react';
import type { Product } from '../../domain/contracts';
import { ProductArt } from './ProductArt';
import { Icon } from './Icon';
export function SummaryBackdrop({
  product,
  quantity,
  children,
}: {
  product: Product | null | undefined;
  quantity: number;
  children: ReactNode;
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
            {expanded ? 'Ocultar producto' : 'Ver mi producto'}
            <Icon name={expanded ? 'minus' : 'plus'} />
          </button>
        </div>
        <div
          className={`backdrop-reveal ${expanded ? 'is-expanded' : ''}`}
          id="backdrop-product"
          aria-hidden={!expanded}
        >
          <div>
            {product && (
              <div className="backdrop-product">
                <ProductArt product={product} />
                <div>
                  <h3>{product.name}</h3>
                  <p>Cantidad: {quantity}</p>
                </div>
              </div>
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
