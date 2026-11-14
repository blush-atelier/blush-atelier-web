import { useEffect, useRef, useState } from 'react';
import type { Product } from '../../domain/contracts';
import { categoryOf, type Category } from '../../domain/presentation';
import { ProductArt } from './ProductArt';
import { Icon } from './Icon';
const edits = [
  { category: 'Bases', copy: 'Piel a tu manera' },
  { category: 'Correctores', copy: 'Pequeños retoques' },
  { category: 'Sombras', copy: 'Miradas con color' },
  { category: 'Accesorios', copy: 'Tu kit de ritual' },
] as const;
export function CategoryDiscovery({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect: (category: Category) => void;
}) {
  const gallery = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  function measure() {
    const el = gallery.current;
    if (el)
      setEdges({
        start: el.scrollLeft < 2,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
  }
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [products]);
  function move(direction: number) {
    const el = gallery.current;
    if (el)
      el.scrollBy({
        left: direction * (el.clientWidth + 16),
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
          .matches
          ? 'auto'
          : 'smooth',
      });
  }
  if (!products.length) return null;
  return (
    <section
      className="category-discovery section-wrap"
      aria-labelledby="discover-title"
    >
      <div className="discovery-heading">
        <h2 id="discover-title">Encuentra tu esencial.</h2>
        <div className="discovery-navigation" aria-label="Navegar categorías">
          <button
            className="icon-button"
            aria-label="Categoría anterior"
            disabled={edges.start}
            onClick={() => move(-1)}
          >
            <Icon name="back" />
          </button>
          <button
            className="icon-button"
            aria-label="Siguiente categoría"
            disabled={edges.end}
            onClick={() => move(1)}
          >
            <Icon name="arrow" />
          </button>
        </div>
      </div>
      <div
        className="category-discovery-grid"
        role="group"
        aria-label="Categorías de productos"
        ref={gallery}
        onScroll={measure}
      >
        {edits.map((edit) => {
          const product = products.find((p) => categoryOf(p) === edit.category);
          return (
            <button
              className="category-discovery-card"
              key={edit.category}
              aria-label={`Explorar ${edit.category}`}
              disabled={!product}
              onClick={() => onSelect(edit.category)}
            >
              {product ? (
                <ProductArt product={product} />
              ) : (
                <span className="category-placeholder" aria-hidden="true" />
              )}
              <span className="category-discovery-copy">
                <strong>{edit.category}</strong>
                <small>{edit.copy}</small>
              </span>
              <Icon name="arrow" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
