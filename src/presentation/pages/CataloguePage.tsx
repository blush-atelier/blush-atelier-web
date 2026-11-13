import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadProducts } from '../../application/operations';
import {
  filterProducts,
  formatMoney,
  brandOf,
  brands,
  categories,
  paginateProducts,
  type Category,
} from '../../domain/presentation';
import { Pagination } from '../components/Pagination';
import { CategoryDiscovery } from '../components/CategoryDiscovery';
import { useReveal } from '../useReveal';
import { useAppDispatch, useAppSelector } from '../hooks';
import { ProductArt, imageSmall, imageLarge } from '../components/ProductArt';
import { Icon } from '../components/Icon';
import { ErrorNotice, Loading } from '../components/Feedback';
export function CataloguePage() {
  const dispatch = useAppDispatch();
  const products = useAppSelector((state) => state.products);
  const catalogueStatus = useAppSelector((state) => state.catalogueStatus);
  const catalogueError = useAppSelector((state) => state.catalogueError);
  const checkout = useAppSelector((state) => state.checkout);
  const [params, setParams] = useSearchParams();
  const search = (params.get('q') ?? '').slice(0, 120);
  const category =
    categories.find((value) => value === params.get('category')) ?? 'Todos';
  const brand =
    [...brands, 'Atelier'].find((value) => value === params.get('brand')) ??
    'Todas';
  const sort = ['price', 'price-desc'].includes(params.get('sort') ?? '')
    ? params.get('sort')!
    : 'atelier';
  const collectionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    void dispatch(loadProducts());
  }, [dispatch]);
  const visible = filterProducts(products, search, category, sort, brand);
  const pagination = paginateProducts(visible, Number(params.get('page') ?? 1));
  const reveal = useReveal(
    pagination.items.map((product) => product.id).join(','),
  );
  useEffect(() => {
    if (
      catalogueStatus !== 'ready' ||
      !params.has('page') ||
      params.get('page') === String(pagination.page)
    )
      return;
    const next = new URLSearchParams(params);
    if (pagination.page === 1) next.delete('page');
    else next.set('page', String(pagination.page));
    setParams(next, { replace: true, preventScrollReset: true });
  }, [catalogueStatus, params, pagination.page, setParams]);
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (!value || ['Todos', 'Todas', 'atelier'].includes(value))
      next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: key === 'q', preventScrollReset: true });
  }
  function clearFilters() {
    const next = new URLSearchParams();
    if (sort !== 'atelier') next.set('sort', sort);
    setParams(next, { preventScrollReset: true });
  }
  function scrollCollection() {
    collectionHeading.current?.focus({ preventScroll: true });
    reveal.current?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  }
  function changePage(page: number) {
    const next = new URLSearchParams(params);
    if (page === 1) next.delete('page');
    else next.set('page', String(page));
    setParams(next, { preventScrollReset: true });
    scrollCollection();
  }
  function discover(category: Category) {
    setParams({ category }, { preventScrollReset: true });
    scrollCollection();
  }
  const productLinkState = { catalogueSearch: params.toString() };
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">EL ARTE DE LO COTIDIANO</p>
          <h1 tabIndex={-1}>
            El color de
            <br />
            <em>ser tú.</em>
          </h1>
          <p className="hero-description">
            Esenciales que se sienten como tú.
            <br />
            Descubre tu próximo toque de color.
          </p>
          <a className="button button--dark" href="#coleccion">
            Explorar la colección <Icon name="arrow" />
          </a>
          <p className="hero-footnote">
            Rosa suave. Cocoa cálido. Tu propia expresión.
          </p>
        </div>
        <div className="hero-art">
          <img
            src={imageLarge}
            srcSet={`${imageSmall} 720w, ${imageLarge} 1440w`}
            sizes="(min-width: 900px) 60vw, 100vw"
            width="1440"
            height="960"
            fetchPriority="high"
            alt="Rubor rosa y labial en estuches marfil sobre un pedestal cálido"
          />
          <span className="image-caption">LA COLECCIÓN ESENCIAL / 01</span>
        </div>
      </section>
      <div className="brand-strip" aria-label="Marcas de la colección">
        <p>ENCUENTRA TUS FAVORITOS</p>
        {brands.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
      <CategoryDiscovery products={products} onSelect={discover} />
      {checkout.productId && (
        <div className="resume-banner">
          <span>Tu selección sigue aquí.</span>
          <Link
            to={
              checkout.transactionId || checkout.attempted
                ? '/pedido'
                : `/producto/${checkout.productId}`
            }
          >
            Retomar mi selección <Icon name="arrow" />
          </Link>
        </div>
      )}
      <section ref={reveal} className="collection section-wrap" id="coleccion">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / SELECCIÓN ATELIER</p>
            <h2 ref={collectionHeading} tabIndex={-1}>
              Tus nuevos esenciales.
            </h2>
          </div>
          <p>
            Pequeños gestos.
            <br />
            Mucho de ti.
          </p>
        </div>
        <div className="catalogue-tools">
          <label className="search-field">
            <Icon name="search" />
            <span className="sr-only">Buscar productos</span>
            <input
              value={search}
              onChange={(event) => setFilter('q', event.target.value)}
              type="search"
              maxLength={120}
              placeholder="Encuentra tu próximo esencial"
            />
            {search && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setFilter('q', '')}
              >
                <Icon name="close" />
              </button>
            )}
          </label>
          <div className="catalogue-selects">
            <label className="sort-field brand-filter">
              <span>Marca</span>
              <select
                aria-label="Filtrar por marca"
                value={brand}
                onChange={(event) => setFilter('brand', event.target.value)}
              >
                <option value="Todas">Todas las marcas</option>
                {brands.map((value) => (
                  <option key={value}>{value}</option>
                ))}
                <option>Atelier</option>
              </select>
            </label>
            <label className="sort-field">
              <span>Ordenar</span>
              <select
                aria-label="Ordenar productos"
                value={sort}
                onChange={(event) => setFilter('sort', event.target.value)}
              >
                <option value="atelier">Selección atelier</option>
                <option value="price">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
              </select>
            </label>
          </div>
        </div>
        <div className="catalogue-filters">
          <div className="category-tabs" aria-label="Filtrar por categoría">
            {categories.map((value) => (
              <button
                key={value}
                aria-pressed={category === value}
                onClick={() => setFilter('category', value)}
              >
                {value}
              </button>
            ))}
          </div>
          <span className="result-count" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'esencial' : 'esenciales'}
          </span>
        </div>
        {(search || category !== 'Todos' || brand !== 'Todas') && (
          <div className="active-filters" aria-label="Filtros activos">
            {search && (
              <button
                onClick={() => setFilter('q', '')}
                aria-label="Quitar búsqueda"
              >
                “{search}”<Icon name="close" />
              </button>
            )}
            {category !== 'Todos' && (
              <button
                onClick={() => setFilter('category', 'Todos')}
                aria-label="Quitar categoría"
              >
                {category}
                <Icon name="close" />
              </button>
            )}
            {brand !== 'Todas' && (
              <button
                onClick={() => setFilter('brand', 'Todas')}
                aria-label="Quitar marca"
              >
                {brand}
                <Icon name="close" />
              </button>
            )}
            <button className="clear-filters" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        )}
        <ErrorNotice
          error={catalogueError}
          retry={() => void dispatch(loadProducts())}
        />
        {catalogueStatus === 'loading' && products.length === 0 ? (
          <Loading label="Buscando tus próximos esenciales…" />
        ) : (
          <div className="product-grid" id="product-grid">
            {pagination.items.map((product, index) => (
              <article className="product-card" data-reveal key={product.id}>
                <Link
                  className="product-image-link"
                  to={`/producto/${product.id}`}
                  state={productLinkState}
                  aria-label={`Ver ${product.name}`}
                >
                  <ProductArt product={product} />
                  <span className="product-index">
                    {String(pagination.start + index).padStart(2, '0')}
                  </span>
                </Link>
                <div className="product-card-meta">
                  <p className="product-category">{brandOf(product)}</p>
                  <h3>
                    <Link
                      to={`/producto/${product.id}`}
                      state={productLinkState}
                    >
                      {product.name}
                    </Link>
                  </h3>
                  <p className="product-description">{product.description}</p>
                  <div className="product-card-bottom">
                    <strong>{formatMoney(product.priceMinor)}</strong>
                    <Link
                      className="round-link"
                      to={`/producto/${product.id}`}
                      state={productLinkState}
                      aria-label={`Detalles de ${product.name}`}
                    >
                      <span>Ver producto</span>
                      <Icon name="arrow" />
                    </Link>
                  </div>
                  <p className="stock-line">
                    <span
                      className={
                        product.availableStock
                          ? 'stock-dot'
                          : 'stock-dot stock-dot--empty'
                      }
                    />
                    {product.availableStock
                      ? `${product.availableStock} unidades disponibles`
                      : 'Sin unidades disponibles'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
        {catalogueStatus === 'ready' && visible.length === 0 && (
          <div className="empty-state">
            <h3>No encontramos ese producto.</h3>
            <p>Prueba otra búsqueda o vuelve a ver la colección.</p>
            <button className="text-button" onClick={clearFilters}>
              Ver toda la colección
            </button>
          </div>
        )}
        <Pagination {...pagination} onChange={changePage} />
        <button
          className="text-button stock-refresh"
          onClick={() => void dispatch(loadProducts())}
          disabled={catalogueStatus === 'loading'}
        >
          <Icon name="refresh" />
          Actualizar disponibilidad
        </button>
      </section>
      <section
        className="ritual-strip section-wrap"
        aria-label="Cómo preparar tu pedido"
      >
        <div>
          <span>01</span>
          <p>
            Encuentra
            <br />
            <strong>tu esencial.</strong>
          </p>
        </div>
        <div>
          <span>02</span>
          <p>
            Prepara
            <br />
            <strong>tu entrega.</strong>
          </p>
        </div>
        <div>
          <span>03</span>
          <p>
            Revisa y<br />
            <strong>reserva con calma.</strong>
          </p>
        </div>
      </section>
      <section className="faq section-wrap" id="ayuda">
        <div>
          <p className="eyebrow">ESTAMOS PARA ACOMPAÑARTE</p>
          <h2>
            Una selección,
            <br />
            <em>sin prisas.</em>
          </h2>
        </div>
        <div className="faq-items">
          <details>
            <summary>¿Se hará algún cobro?</summary>
            <p>
              No. En esta versión puedes preparar tu entrega y reservar un
              producto. El pago con tarjeta todavía no está habilitado.
            </p>
          </details>
          <details>
            <summary>¿Cuánto dura mi reserva?</summary>
            <p>
              La reserva está prevista por 15 minutos. En Mi pedido puedes
              consultar su estado actualizado.
            </p>
          </details>
          <details>
            <summary>¿Puedo retomar después de refrescar?</summary>
            <p>
              Sí, desde este navegador y mientras tu sesión siga vigente.
              Conservamos solo referencias y progreso seguro.{' '}
              <Link to="/pedido">Consultar mi pedido</Link>.
            </p>
          </details>
        </div>
      </section>
    </>
  );
}
