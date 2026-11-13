import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  loadProducts,
  loadProduct,
  updateCartQuantity,
  removeFromCart,
  beginCartCheckout,
} from '../../application/operations';
import {
  brandOf,
  formatMoney,
  cartSubtotalMinor,
} from '../../domain/presentation';
import { useAppDispatch, useAppSelector } from '../hooks';
import { ProductArt } from '../components/ProductArt';
import { Icon } from '../components/Icon';
import { ErrorNotice, Loading } from '../components/Feedback';
export function CartPage() {
  const dispatch = useAppDispatch();
  const checkout = useAppSelector((state) => state.checkout);
  const product = useAppSelector((state) =>
    state.detail?.id === state.checkout.productId
      ? state.detail
      : state.products.find((value) => value.id === state.checkout.productId),
  );
  const status = useAppSelector((state) => state.detailStatus);
  const error = useAppSelector((state) => state.detailError);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (checkout.productId) {
      void dispatch(loadProducts());
      void dispatch(loadProduct(checkout.productId));
    }
  }, [dispatch, checkout.productId]);
  const locked = Boolean(
    checkout.transactionId || checkout.attempted || checkout.phase !== 'idle',
  );
  function change(quantity: number) {
    const result = dispatch(updateCartQuantity(quantity));
    setNotice(
      result.ok
        ? ''
        : 'Actualiza la disponibilidad antes de cambiar la cantidad.',
    );
  }
  if (!checkout.productId)
    return (
      <section className="section-wrap cart-empty">
        <span className="cart-empty-icon">
          <Icon name="bag" />
        </span>
        <p className="eyebrow">TU BOLSA ATELIER</p>
        <h1 tabIndex={-1}>Todo empieza con un esencial.</h1>
        <p>Encuentra ese pequeño toque que hará tuyo el día.</p>
        <Link className="button button--dark" to="/">
          Explorar la colección
          <Icon name="arrow" />
        </Link>
      </section>
    );
  return (
    <section className="section-wrap cart-page">
      <div className="cart-heading">
        <p className="eyebrow">01 / TU CARRITO</p>
        <h1 tabIndex={-1}>Tu próximo ritual.</h1>
        <p>Revisa tu elección antes de contarnos a dónde llegará.</p>
      </div>
      <ErrorNotice
        error={error}
        retry={() => void dispatch(loadProduct(checkout.productId!))}
      />
      {!product ? (
        <Loading
          label={
            status === 'error'
              ? 'No pudimos cargar tu producto.'
              : 'Recuperando tu carrito…'
          }
        />
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            <article className="cart-item">
              <Link
                to={`/producto/${product.id}`}
                aria-label={`Ver ${product.name}`}
              >
                <ProductArt product={product} priority />
              </Link>
              <div className="cart-item-copy">
                <p className="eyebrow">{brandOf(product)}</p>
                <h2>{product.name}</h2>
                <p>{product.description}</p>
                <strong>
                  {formatMoney(product.priceMinor)} <small>COP / unidad</small>
                </strong>
                <div className="cart-item-controls">
                  <div
                    className="quantity-control"
                    role="group"
                    aria-label="Cantidad en el carrito"
                  >
                    <button
                      aria-label="Reducir unidades del carrito"
                      disabled={locked || checkout.quantity <= 1}
                      onClick={() => change(checkout.quantity - 1)}
                    >
                      <Icon name="minus" />
                    </button>
                    <output aria-label="Unidades en el carrito">
                      {checkout.quantity}
                    </output>
                    <button
                      aria-label="Aumentar unidades del carrito"
                      disabled={
                        locked || checkout.quantity >= product.availableStock
                      }
                      onClick={() => change(checkout.quantity + 1)}
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                  <button
                    className="text-button"
                    disabled={locked}
                    onClick={() => dispatch(removeFromCart())}
                  >
                    Eliminar producto
                  </button>
                </div>
                <p className="stock-line">
                  {checkout.quantity > product.availableStock && !locked
                    ? 'La cantidad elegida supera la disponibilidad actual. Reduce las unidades para continuar.'
                    : `${product.availableStock} unidades disponibles`}
                </p>
              </div>
            </article>
            <p className="cart-hint">
              Una referencia por compra, tantas unidades como tu ritual
              necesite.
            </p>
            <Link className="text-button" to="/">
              <Icon name="back" />
              Seguir explorando
            </Link>
          </div>
          <aside className="cart-totals">
            <p className="eyebrow">TU SELECCIÓN, CON CALMA</p>
            <h2>Resumen del carrito</h2>
            <dl>
              <div>
                <dt>
                  Productos <span>× {checkout.quantity}</span>
                </dt>
                <dd>
                  {formatMoney(cartSubtotalMinor(product, checkout.quantity))}
                </dd>
              </div>
            </dl>
            <p>
              El envío y la tarifa base se mostrarán en el resumen antes de
              confirmar.
            </p>
            {notice && <p role="alert">{notice}</p>}
            {locked ? (
              <>
                <p className="cart-locked">
                  Tu compra ya tiene una solicitud en curso. Consulta su estado
                  para continuar sin duplicarla.
                </p>
                <Link className="button button--dark" to="/pedido">
                  Consultar mi pedido
                  <Icon name="arrow" />
                </Link>
              </>
            ) : (
              <button
                className="button button--dark"
                disabled={
                  checkout.quantity > product.availableStock ||
                  !product.availableStock
                }
                onClick={() => dispatch(beginCartCheckout())}
              >
                Continuar con la entrega
                <Icon name="arrow" />
              </button>
            )}
            <p className="safe-note">
              Agregar al carrito no aparta stock ni realiza cobros.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
