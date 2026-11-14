import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { loadProduct, addToCart } from '../../application/operations';
import { formatMoney, categoryOf, brandOf } from '../../domain/presentation';
import { useAppDispatch, useAppSelector } from '../hooks';
import { ProductArt } from '../components/ProductArt';
import { Icon } from '../components/Icon';
import type { ApiError } from '../../domain/contracts';
import { ErrorNotice, Loading } from '../components/Feedback';
export function ProductPage({ onAdded }: { onAdded: () => void }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = (location.state as { catalogueSearch?: unknown } | null)
    ?.catalogueSearch;
  const collectionUrl =
    typeof saved === 'string' && saved.length <= 1000
      ? `/?${new URLSearchParams(saved).toString()}`
      : '/';
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.detail);
  const detailId = useAppSelector((state) => state.detailId);
  const detailStatus = useAppSelector((state) => state.detailStatus);
  const detailError = useAppSelector((state) => state.detailError);
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState<ApiError | null>(null);
  useEffect(() => {
    setQuantity(1);
    void dispatch(loadProduct(id));
  }, [dispatch, id]);
  const product = detailId === id ? detail : null;
  if (detailStatus === 'error' && detailId === id)
    return (
      <section className="section-wrap page-empty">
        <h1 tabIndex={-1}>No pudimos encontrar tu esencial.</h1>
        <ErrorNotice
          error={detailError}
          retry={() => void dispatch(loadProduct(id))}
        />
        <Link className="button button--outline" to={collectionUrl}>
          Volver a la tienda
        </Link>
      </section>
    );
  if (!product)
    return (
      <div className="section-wrap">
        <Loading label="Preparando los detalles de tu selección…" />
      </div>
    );
  const begin = () => {
    const result = dispatch(addToCart(product.id, quantity));
    if (result.ok) {
      setCartError(null);
      onAdded();
      return;
    }
    if (result.error === 'CheckoutLocked') {
      navigate('/pedido');
      return;
    }
    setCartError({
      code:
        result.error === 'InsufficientStock'
          ? 'InsufficientStock'
          : 'InvalidInput',
      status: 409,
    });
  };
  return (
    <section className="section-wrap product-page">
      <ErrorNotice error={cartError} />
      <nav className="breadcrumbs" aria-label="Ruta de navegación">
        <Link to={collectionUrl}>
          <Icon name="back" />
          Tienda
        </Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="product-detail-grid">
        <div className="detail-art">
          <ProductArt product={product} priority />
          <p className="art-caption">
            {brandOf(product) === 'Atelier'
              ? 'BLUSH ATELIER · Imagen ilustrativa'
              : 'Fotografía del producto'}
          </p>
        </div>
        <div className="detail-copy">
          <p className="eyebrow">
            {brandOf(product)} / {categoryOf(product)}
          </p>
          <h1 tabIndex={-1}>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <p className="detail-price">
            {formatMoney(product.priceMinor)} <span>COP</span>
          </p>
          <div className="tone-row">
            <span>
              Selección {brandOf(product)} · {categoryOf(product)}
            </span>
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
              : 'Sin existencias por ahora'}
          </p>
          <div className="quantity-line">
            <label id="quantity-label">Cantidad</label>
            <div
              className="quantity-control"
              role="group"
              aria-labelledby="quantity-label"
            >
              <button
                aria-label="Reducir cantidad"
                disabled={quantity <= 1}
                onClick={() => setQuantity((value) => value - 1)}
              >
                <Icon name="minus" />
              </button>
              <output aria-label="Cantidad seleccionada">{quantity}</output>
              <button
                aria-label="Aumentar cantidad"
                disabled={quantity >= product.availableStock}
                onClick={() => setQuantity((value) => value + 1)}
              >
                <Icon name="plus" />
              </button>
            </div>
          </div>
          <div className="purchase-actions">
            <button
              className="button button--dark"
              disabled={
                !product.availableStock || quantity > product.availableStock
              }
              onClick={() => begin()}
            >
              Agregar al carrito <Icon name="arrow" />
            </button>
            <p>Revisa tu carrito antes de completar la entrega</p>
          </div>
          <div className="detail-notes">
            <details open>
              <summary>Tu esencial, en detalle</summary>
              <p>
                {product.description} Consulta el resumen antes de confirmar tu
                reserva.
              </p>
            </details>
            <details>
              <summary>Entrega y disponibilidad</summary>
              <p>
                Registra una dirección en Colombia. El resumen mostrará el
                producto, la tarifa base y el envío antes de reservar.
              </p>
            </details>
            <details>
              <summary>Sobre el pago con tarjeta</summary>
              <p>
                Tu tarjeta se cifra y tokeniza directamente con Wompi. No
                guardamos el número de tarjeta ni el código de seguridad.
              </p>
            </details>
          </div>
          <button
            className="text-button"
            onClick={() => void dispatch(loadProduct(id))}
          >
            <Icon name="refresh" />
            Actualizar existencias
          </button>
        </div>
      </div>
    </section>
  );
}
