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
  if (!products.length) return null;
  return (
    <section
      className="category-discovery section-wrap"
      aria-labelledby="discover-title"
    >
      <div className="discovery-heading">
        <div>
          <p className="eyebrow">ELIGE TU MOMENTO</p>
          <h2 id="discover-title">Un ritual, muchas formas.</h2>
        </div>
        <span className="atelier-flower" aria-hidden="true">
          ✳
        </span>
      </div>
      <div className="category-discovery-grid">
        {edits.map((edit) => {
          const product = products.find(
            (value) => categoryOf(value) === edit.category,
          );
          return (
            <button
              key={edit.category}
              className="category-discovery-card"
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
                <small>{edit.copy}</small>
                <strong>{edit.category}</strong>
              </span>
              <Icon name="arrow" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
