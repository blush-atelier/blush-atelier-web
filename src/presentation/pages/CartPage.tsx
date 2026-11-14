import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  loadProducts,
  loadProduct,
  updateCartQuantity,
  removeFromCart,
  beginCartCheckout,
  restartCheckout,
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
  const products = useAppSelector((state) => state.products);
  const detail = useAppSelector((state) => state.detail);
  const entries = checkout.items.map((item) => ({
    item,
    product:
      detail?.id === item.productId
        ? detail
        : products.find((p) => p.id === item.productId),
  }));
  const ready = entries.every((e) => e.product);
  const subtotal = entries
    .reduce(
      (sum, e) =>
        sum +
        BigInt(e.product ? cartSubtotalMinor(e.product, e.item.quantity) : '0'),
      0n,
    )
    .toString();
  const unavailable = entries.some(
    (e) => !e.product || e.item.quantity > e.product.availableStock,
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
  function change(quantity: number, productId: string) {
    const result = dispatch(updateCartQuantity(quantity, productId));
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
          Explorar la tienda
          <Icon name="arrow" />
        </Link>
      </section>
    );
  return (
    <section className="section-wrap cart-page">
      <div className="cart-heading">
        <h1 tabIndex={-1}>Tu próximo ritual.</h1>
        <p>Revisa tu elección antes de contarnos a dónde llegará.</p>
      </div>
      <ErrorNotice
        error={error}
        retry={() => void dispatch(loadProduct(checkout.productId!))}
      />
      {!ready ? (
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
            {entries.map(
              ({ item, product }, index) =>
                product && (
                  <article
                    className="cart-item"
                    key={item.productId}
                    aria-label={product.name}
                  >
                    <Link
                      to={`/producto/${product.id}`}
                      aria-label={`Ver ${product.name}`}
                    >
                      <ProductArt product={product} priority={index === 0} />
                    </Link>
                    <div className="cart-item-copy">
                      <p className="eyebrow">{brandOf(product)}</p>
                      <h2>{product.name}</h2>
                      <p>{product.description}</p>
                      <strong>
                        {formatMoney(product.priceMinor)}{' '}
                        <small>COP / unidad</small>
                      </strong>
                      <div className="cart-item-controls">
                        <div
                          className="quantity-control"
                          role="group"
                          aria-label="Cantidad en el carrito"
                        >
                          <button
                            aria-label="Reducir unidades del carrito"
                            disabled={locked || item.quantity <= 1}
                            onClick={() =>
                              change(item.quantity - 1, item.productId)
                            }
                          >
                            <Icon name="minus" />
                          </button>
                          <output
                            key={item.quantity}
                            aria-label="Unidades en el carrito"
                          >
                            {item.quantity}
                          </output>
                          <button
                            aria-label="Aumentar unidades del carrito"
                            disabled={
                              locked || item.quantity >= product.availableStock
                            }
                            onClick={() =>
                              change(item.quantity + 1, item.productId)
                            }
                          >
                            <Icon name="plus" />
                          </button>
                        </div>
                        <button
                          className="text-button"
                          disabled={locked}
                          onClick={() =>
                            dispatch(removeFromCart(item.productId))
                          }
                        >
                          Eliminar producto
                        </button>
                      </div>
                      <p className="stock-line">
                        {item.quantity > product.availableStock && !locked
                          ? 'La cantidad elegida supera la disponibilidad actual. Reduce las unidades para continuar.'
                          : `${product.availableStock} unidades disponibles`}
                      </p>
                    </div>
                  </article>
                ),
            )}
            <p className="cart-hint">
              Combina tus favoritos. Puedes ajustar cada producto antes de
              continuar.
            </p>
            <Link className="text-button" to="/">
              <Icon name="back" />
              Seguir explorando
            </Link>
          </div>
          <aside className="cart-totals">
            <h2>Resumen del carrito</h2>
            <dl>
              <div>
                <dt>
                  Productos{' '}
                  <span>
                    × {checkout.items.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                </dt>
                <dd>{formatMoney(subtotal)}</dd>
              </div>
            </dl>
            <p>
              El envío y la tarifa base se mostrarán en el resumen antes de
              confirmar.
            </p>
            {notice && <p role="alert">{notice}</p>}
            {checkout.sessionExpired ? (
              <button
                className="button button--dark"
                onClick={() => dispatch(restartCheckout())}
              >
                Empezar una nueva selección
              </button>
            ) : locked ? (
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
                disabled={unavailable}
                onClick={() => dispatch(beginCartCheckout())}
              >
                Pagar con tarjeta de crédito
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
