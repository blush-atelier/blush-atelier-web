import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SummaryBackdrop } from '../src/presentation/components/SummaryBackdrop';
import { App } from '../src/presentation/App';
import { createAppStore } from '../src/application/store';
import { actions } from '../src/application/state';
import {
  addToCart,
  updateCartQuantity,
  removeFromCart,
  beginCartCheckout,
  prepareCheckout,
  reserveCheckout,
  resumeCheckout,
} from '../src/application/operations';
import { cartSubtotalMinor } from '../src/domain/presentation';
import {
  apiFixture,
  memoryProgress,
  product,
  lipstick,
  productId,
  otherId,
  progress,
  transaction,
  success,
  quote,
  form,
  deliveryId,
} from './fixtures';
function fixture() {
  const api = apiFixture();
  const persistence = memoryProgress();
  const store = createAppStore({
    api,
    progress: persistence,
    runtime: { newKey: () => 'checkout-cart-0001' },
  });
  store.dispatch(actions.catalogueReady([product, lipstick]));
  return { api, persistence, store };
}
function setup(path = '/carrito', f = fixture()) {
  return {
    ...f,
    user: userEvent.setup(),
    ...render(
      <Provider store={f.store}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </Provider>,
    ),
  };
}
test('agrega, acumula y cambia cantidades sin registrar cliente, entrega ni reserva', () => {
  const f = fixture();
  expect(f.store.dispatch(addToCart(productId, 1))).toEqual({
    ok: true,
    value: undefined,
  });
  expect(f.store.dispatch(addToCart(productId, 2)).ok).toBe(true);
  expect(f.persistence.current?.quantity).toBe(3);
  expect(f.store.getState().checkout.step).toBe('closed');
  expect(f.store.dispatch(addToCart(otherId, 1)).ok).toBe(true);
  expect(f.store.getState().checkout.items).toEqual([
    { productId, quantity: 3 },
    { productId: otherId, quantity: 1 },
  ]);
  expect(f.store.dispatch(updateCartQuantity(2, otherId)).ok).toBe(true);
  expect(f.store.getState().checkout.items[1].quantity).toBe(2);
  expect(f.api.registerCustomer).not.toHaveBeenCalled();
  expect(f.api.createPending).not.toHaveBeenCalled();
  expect(f.api.quote).not.toHaveBeenCalled();
  expect(f.store.dispatch(beginCartCheckout())).toBe(true);
  expect(f.store.getState().checkout.step).toBe('details');
  expect(f.store.dispatch(removeFromCart())).toBe(true);
  expect(f.persistence.current).toBeNull();
});
test('rechaza cantidades inválidas, stock insuficiente y cambios durante solicitudes inciertas', () => {
  const f = fixture();
  expect(f.store.dispatch(addToCart(productId, 0))).toEqual({
    ok: false,
    error: 'InvalidQuantity',
  });
  expect(f.store.dispatch(addToCart('unknown', 1))).toEqual({
    ok: false,
    error: 'ProductNotFound',
  });
  expect(f.store.dispatch(addToCart(productId, 21))).toEqual({
    ok: false,
    error: 'InsufficientStock',
  });
  expect(f.store.dispatch(updateCartQuantity(1))).toEqual({
    ok: false,
    error: 'ProductNotFound',
  });
  expect(f.store.dispatch(beginCartCheckout())).toBe(false);
  f.store.dispatch(addToCart(productId, 1));
  expect(f.store.dispatch(updateCartQuantity(0))).toEqual({
    ok: false,
    error: 'InvalidQuantity',
  });
  expect(f.store.dispatch(updateCartQuantity(21))).toEqual({
    ok: false,
    error: 'InsufficientStock',
  });
  f.store.dispatch(actions.reservationStarted());
  expect(f.store.dispatch(addToCart(productId, 1))).toEqual({
    ok: false,
    error: 'CheckoutLocked',
  });
  expect(f.store.dispatch(updateCartQuantity(2))).toEqual({
    ok: false,
    error: 'CheckoutLocked',
  });
  expect(f.store.dispatch(removeFromCart())).toBe(false);
  expect(f.store.dispatch(beginCartCheckout())).toBe(false);
});
test('el subtotal orientativo mantiene precisión y editar invalida una cotización vieja', () => {
  expect(
    cartSubtotalMinor({ ...product, priceMinor: '9007199254740993' }, 2),
  ).toBe('18014398509481986');
  const f = fixture();
  f.store.dispatch(addToCart(productId, 1));
  f.store.dispatch(
    actions.quoteReady({
      quote: transaction,
      deliveryId: progress.deliveryId!,
      key: 'checkout-cart-0001',
    }),
  );
  f.store.dispatch(updateCartQuantity(2));
  expect(f.store.getState().checkout).toMatchObject({
    quantity: 2,
    quote: null,
    deliveryId: null,
    requestKey: null,
  });
});
test('carrito vacío, revisión de contenido y entrega posterior, con persistencia segura', async () => {
  const empty = setup();
  expect(
    screen.getByRole('heading', { name: 'Todo empieza con un esencial.' }),
  ).toBeVisible();
  empty.unmount();
  const f = fixture();
  f.store.dispatch(addToCart(productId, 2));
  const { user } = setup('/carrito', f);
  await screen.findByRole('heading', { name: 'Rubor Rose' });
  expect(screen.getByText('$ 179.800')).toBeVisible();
  expect(screen.queryByLabelText('Nombre y apellido')).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Aumentar unidades del carrito' }),
  );
  expect(screen.getByLabelText('Unidades en el carrito')).toHaveTextContent(
    '3',
  );
  await user.click(
    screen.getByRole('button', { name: 'Reducir unidades del carrito' }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' }),
  );
  expect(screen.getByLabelText('Nombre y apellido')).toBeVisible();
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { bubbles: true, cancelable: true }),
  );
  await user.click(screen.getByRole('button', { name: 'Eliminar producto' }));
  expect(
    screen.getByRole('heading', { name: 'Todo empieza con un esencial.' }),
  ).toBeVisible();
});
test('agregar otro producto conserva ambos y permite editar y retirar cada línea', async () => {
  const f = fixture();
  f.store.dispatch(addToCart(productId, 1));
  f.api.getProduct.mockResolvedValue(success(lipstick));
  const { user } = setup(`/producto/${otherId}`, f);
  await user.click(
    await screen.findByRole('button', { name: 'Agregar al carrito' }),
  );
  await user.click(screen.getByRole('link', { name: 'Revisar carrito' }));
  await screen.findByRole('heading', { name: 'Tu próximo ritual.' });
  expect(screen.getByRole('article', { name: product.name })).toBeVisible();
  expect(screen.getByRole('article', { name: lipstick.name })).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(
    screen.getAllByRole('button', { name: 'Aumentar unidades del carrito' })[1],
  );
  expect(f.store.getState().checkout.items).toEqual([
    { productId, quantity: 1 },
    { productId: otherId, quantity: 2 },
  ]);
  await user.click(
    screen.getAllByRole('button', { name: 'Eliminar producto' })[0],
  );
  expect(f.store.getState().checkout.items).toEqual([
    { productId: otherId, quantity: 2 },
  ]);
  expect(f.store.getState().checkout.productId).toBe(otherId);
});
test('si cambió el stock se muestra el aviso y bloquea continuar; permite corregir', async () => {
  const f = fixture();
  f.store.dispatch(addToCart(productId, 3));
  f.api.getProduct.mockResolvedValue(
    success({ ...product, availableStock: 1 }),
  );
  f.api.listProducts.mockResolvedValue(
    success([{ ...product, availableStock: 1 }]),
  );
  const { user } = setup('/carrito', f);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' }),
    ).toBeDisabled(),
  );
  expect(f.store.dispatch(beginCartCheckout())).toBe(false);
  await user.click(
    screen.getByRole('button', { name: 'Reducir unidades del carrito' }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Reducir unidades del carrito' }),
  );
  expect(
    screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' }),
  ).toBeEnabled();
});
test('la solicitud pendiente queda protegida incluso al abrir el carrito directamente', async () => {
  const f = fixture();
  f.store.dispatch(addToCart(productId, 1));
  f.store.dispatch(actions.transactionReady(transaction));
  setup('/carrito', f);
  await screen.findByRole('heading', { name: 'Rubor Rose' });
  expect(
    screen.getByRole('button', { name: 'Eliminar producto' }),
  ).toBeDisabled();
  expect(
    screen.getAllByRole('link', { name: 'Consultar mi pedido' })[0],
  ).toBeVisible();
});

test('el backdrop revela y oculta la capa del producto sin cambiar los importes', async () => {
  const user = userEvent.setup();
  render(
    <SummaryBackdrop product={product} quantity={2}>
      <p>Resumen confirmado por API</p>
    </SummaryBackdrop>,
  );
  const toggle = screen.getByRole('button', { name: 'Ver mi producto' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  expect(
    screen.getByRole('button', { name: 'Ocultar producto' }),
  ).toHaveAttribute('aria-expanded', 'true');
  expect(
    screen.getByRole('heading', { name: product.name }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ocultar producto' }));
  expect(
    screen.getByRole('button', { name: 'Ver mi producto' }),
  ).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Resumen confirmado por API')).toBeVisible();
});

test('el carrito se rehidrata solo con referencias y volver desde entrega no reserva', async () => {
  const f = fixture();
  f.store.dispatch(addToCart(productId, 2));
  const restored = createAppStore({
    api: f.api,
    progress: f.persistence,
    runtime: { newKey: () => 'checkout-cart-0002' },
  });
  const { user } = setup('/carrito', { ...f, store: restored });
  await screen.findByRole('heading', { name: product.name });
  expect(screen.getByLabelText('Unidades en el carrito')).toHaveTextContent(
    '2',
  );
  expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' }),
  );
  await user.click(screen.getByRole('button', { name: 'Revisar carrito' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(restored.getState().checkout.quantity).toBe(2);
  expect(f.api.createPending).not.toHaveBeenCalled();
});

test('cotiza todos los productos, muestra el desglose y reintenta la misma reserva tras refrescar', async () => {
  const f = fixture();
  f.store.dispatch(addToCart(productId, 1));
  f.store.dispatch(addToCart(otherId, 2));
  const items = [
    {
      productId,
      quantity: 1,
      unitPriceMinor: '8990000',
      productAmountMinor: '8990000',
    },
    {
      productId: otherId,
      quantity: 2,
      unitPriceMinor: '5990000',
      productAmountMinor: '11980000',
    },
  ];
  const basket = {
    ...quote,
    items,
    productAmountMinor: '20970000',
    totalMinor: '22470000',
  };
  f.api.quote.mockResolvedValue(success(basket));
  expect(await f.store.dispatch(prepareCheckout(form))).toBe(true);
  expect(f.api.quote).toHaveBeenCalledWith({
    productId,
    quantity: 1,
    deliveryId,
    items: items.map(({ productId, quantity }) => ({ productId, quantity })),
  });
  const { user, unmount } = setup('/carrito', f);
  await user.click(screen.getByRole('button', { name: 'Ver mis productos' }));
  expect(
    screen.getByRole('heading', { name: product.name, level: 3 }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: lipstick.name, level: 3 }),
  ).toBeInTheDocument();
  expect(screen.getByText('$ 224.700')).toBeVisible();
  f.api.createPending.mockResolvedValueOnce({
    ok: false,
    error: { code: 'NetworkError', status: 0 },
  });
  await act(async () => {
    await f.store.dispatch(reserveCheckout());
  });
  const original = f.api.createPending.mock.calls[0];
  expect(f.store.dispatch(removeFromCart(otherId))).toBe(false);
  expect(f.store.dispatch(addToCart(otherId, 1))).toEqual({
    ok: false,
    error: 'CheckoutLocked',
  });
  unmount();
  const restored = createAppStore({
    api: f.api,
    progress: f.persistence,
    runtime: { newKey: () => 'must-not-be-used' },
  });
  f.api.createPending.mockResolvedValue(success({ ...transaction, ...basket }));
  expect(await restored.dispatch(resumeCheckout())).toBe(true);
  expect(f.api.createPending.mock.calls[1]).toEqual(original);
  expect(JSON.stringify(f.persistence.current)).not.toContain(form.email);
  expect(restored.getState().checkout.transaction?.items).toHaveLength(2);
});
