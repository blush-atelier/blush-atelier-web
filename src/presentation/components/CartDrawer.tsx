import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney, cartSubtotalMinor } from '../../domain/presentation';
import { useAppSelector } from '../hooks';
import { Icon } from './Icon';
import { ProductArt } from './ProductArt';

export function CartDrawer({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  const checkout = useAppSelector((state) => state.checkout);
  const products = useAppSelector((state) => state.products);
  const detail = useAppSelector((state) => state.detail);
  const entries = checkout.items.map((item) => ({
    ...item,
    product:
      detail?.id === item.productId
        ? detail
        : products.find((p) => p.id === item.productId),
  }));
  const ready = entries.every((entry) => entry.product);
  const subtotal = entries
    .reduce(
      (sum, entry) =>
        sum +
        BigInt(
          entry.product
            ? cartSubtotalMinor(entry.product, entry.quantity)
            : '0',
        ),
      0n,
    )
    .toString();
  useEffect(() => {
    const previous = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="cart-drawer"
      aria-labelledby="cart-drawer-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="cart-drawer-header">
        <div>
          <p className="eyebrow" role="status">
            Añadido a tu carrito
          </p>
          <h2 id="cart-drawer-title">Tu selección.</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar vista del carrito"
          autoFocus
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="cart-drawer-items">
        {entries.map(({ productId, product, quantity }) => (
          <article
            className="cart-drawer-item"
            key={productId}
            aria-label={product?.name ?? 'Producto seleccionado'}
          >
            {product ? (
              <>
                <ProductArt product={product} />
                <div>
                  <h3>{product.name}</h3>
                  <p>Cantidad: {quantity}</p>
                  <strong>
                    {formatMoney(cartSubtotalMinor(product, quantity))}
                  </strong>
                </div>
              </>
            ) : (
              <p>
                Producto seleccionado · {quantity} unidades. Consulta el carrito
                para cargar sus detalles.
              </p>
            )}
          </article>
        ))}
      </div>
      <div className="cart-drawer-footer">
        {ready && (
          <p className="cart-drawer-subtotal">
            <span>Subtotal</span>
            <strong>{formatMoney(subtotal)}</strong>
          </p>
        )}
        <p className="muted">
          Envío y tarifa base en el resumen. Aún no reservamos stock.
        </p>
        <Link className="button button--dark" to="/carrito" onClick={onClose}>
          Revisar carrito
          <Icon name="arrow" />
        </Link>
        <button className="text-button" onClick={onClose}>
          Seguir comprando
        </button>
      </div>
    </dialog>
  );
}
