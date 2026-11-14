import { selectOption } from './select-helper';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/presentation/App';
import { ProductArt } from '../src/presentation/components/ProductArt';
import { createAppStore } from '../src/application/store';
import type {
  SafeProgress,
  Transaction,
  ApiError,
} from '../src/domain/contracts';
import {
  apiFixture,
  memoryProgress,
  product,
  lipstick,
  productId,
  progress,
  transaction,
  form,
  success,
} from './fixtures';
function setup(
  path = '/',
  saved: SafeProgress | null = null,
  api = apiFixture(),
) {
  const persistence = memoryProgress(saved);
  const store = createAppStore({
    api,
    progress: persistence,
    runtime: { newKey: () => 'checkout-new-request-0002' },
  });
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
  return { api, store, persistence, user: userEvent.setup(), ...view };
}
async function openDetails(user: ReturnType<typeof userEvent.setup>) {
  if (!screen.queryByRole('heading', { name: 'Tu próximo ritual.' }))
    await user.click(
      await screen.findByRole('button', { name: 'Agregar al carrito' }),
    );
  if (screen.queryByRole('dialog', { name: 'Tu selección.' }))
    await user.click(screen.getByRole('link', { name: 'Revisar carrito' }));
  await user.click(
    await screen.findByRole('button', { name: 'Continuar con la entrega' }),
  );
  return screen.getByRole('dialog');
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  for (const [label, value] of [
    ['Nombre y apellido', form.fullName],
    ['Correo electrónico', form.email],
    ['Teléfono de contacto', form.phone],
    ['Dirección de entrega', form.addressLine],
  ])
    await user.type(screen.getByLabelText(label), value);
  await selectOption(
    user,
    screen.getByRole('combobox', { name: 'Departamento' }),
    form.region,
  );
  await selectOption(
    user,
    screen.getByRole('combobox', { name: 'Ciudad' }),
    form.city,
  );
}
const failure = (code: ApiError['code'], status = 400) => ({
  ok: false as const,
  error: { code, status },
});

describe('UI conectada mediante los puertos', () => {
  test('catálogo: búsqueda, categorías, orden, imágenes y actualización', async () => {
    const { user, api } = setup();
    await screen.findByRole('heading', { name: 'Rubor Rose' });
    await user.click(screen.getByRole('button', { name: 'Labios' }));
    expect(
      screen.queryByRole('heading', { name: 'Rubor Rose' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rubores' }));
    expect(screen.getByRole('heading', { name: 'Rubor Rose' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await selectOption(
      user,
      screen.getByRole('combobox', { name: 'Ordenar productos' }),
      'price',
    );
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Labial Cocoa');
    await user.type(screen.getByRole('searchbox'), 'inexistente');
    expect(screen.getByText('No encontramos ese producto.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    await user.type(screen.getByRole('searchbox'), 'otro');
    await user.click(
      screen.getByRole('button', { name: 'Ver toda la colección' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Actualizar disponibilidad' }),
    );
    expect(api.listProducts).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('link', { name: 'Cómo funciona' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
  test('filtra por marca, permite volver a todas y usa fotos reales optimizadas', async () => {
    const api = apiFixture();
    const real = {
      ...product,
      sku: 'LIP-MAC-RUBYWOO',
      name: 'MACximal Ruby Woo',
      imageUrl: 'https://example.com/mac.jpg',
    };
    api.listProducts.mockResolvedValue(success([real, lipstick]));
    const { user } = setup('/', null, api);
    await screen.findByRole('heading', { name: real.name });
    await selectOption(
      user,
      screen.getByRole('combobox', { name: 'Filtrar por marca' }),
      'MAC',
    );
    expect(
      screen.queryByRole('heading', { name: lipstick.name }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: real.name })).toHaveAttribute(
      'src',
      '/images/catalog/mac-ruby-woo-480.jpg',
    );
    fireEvent.error(screen.getByRole('img', { name: real.name }));
    expect(screen.getByRole('img', { name: real.name })).toHaveAttribute(
      'src',
      real.imageUrl,
    );
    fireEvent.error(screen.getByRole('img', { name: real.name }));
    expect(
      screen.getByRole('img', { name: `Imagen no disponible: ${real.name}` }),
    ).toBeVisible();
    await selectOption(
      user,
      screen.getByRole('combobox', { name: 'Filtrar por marca' }),
      'Todas',
    );
    expect(screen.getByRole('heading', { name: lipstick.name })).toBeVisible();
  });
  test('carga, error seguro y recuperación del catálogo', async () => {
    const api = apiFixture();
    let resolve!: (value: Awaited<ReturnType<typeof api.listProducts>>) => void;
    api.listProducts.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { user } = setup('/', null, api);
    expect(screen.getByText('Buscando tus próximos esenciales…')).toBeVisible();
    resolve(failure('NetworkError', 0));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Volver a intentar' }));
    await screen.findByRole('heading', { name: 'Rubor Rose' });
  });
  test('detalle, cantidades, validación accesible, resumen y reserva PENDING sin tarjeta', async () => {
    const { user, api, store, persistence } = setup(`/producto/${productId}`);
    await user.click(
      await screen.findByRole('button', { name: 'Aumentar cantidad' }),
    );
    expect(screen.getByLabelText('Cantidad seleccionada')).toHaveTextContent(
      '2',
    );
    await user.click(screen.getByRole('button', { name: 'Reducir cantidad' }));
    const dialog = await openDetails(user);
    expect(dialog).toHaveAttribute('open');
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('button', { name: 'Revisar mi pedido' }));
    expect(screen.getByLabelText('Nombre y apellido')).toHaveFocus();
    expect(api.registerCustomer).not.toHaveBeenCalled();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Revisar mi pedido' }));
    await screen.findByRole('heading', { name: 'Resumen de tu compra.' });
    expect(dialog).toHaveTextContent(/\$\s104\.900/);
    expect(dialog).toHaveTextContent(form.addressLine);
    expect(JSON.stringify(store.getState())).not.toContain(form.email);
    expect(JSON.stringify(persistence.current)).not.toContain(form.fullName);
    await user.click(
      screen.getByRole('button', { name: 'Editar datos de entrega' }),
    );
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(form.email);
    await user.click(screen.getByRole('button', { name: 'Revisar mi pedido' }));
    await screen.findByRole('heading', { name: 'Resumen de tu compra.' });
    await user.click(
      screen.getByRole('button', { name: 'Continuar con el pago' }),
    );
    await screen.findByRole('heading', { name: 'Tu selección te espera.' });
    expect(screen.getByText(transaction.reference)).toBeVisible();
    expect(api.createPending).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(screen.queryByLabelText(/tarjeta/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copiar referencia' }));
    expect(await screen.findByText('Referencia copiada.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await waitFor(() => expect(api.getTransaction).toHaveBeenCalled());
    await user.click(
      screen.getByRole('link', { name: 'Volver a la colección' }),
    );
    await screen.findByRole('heading', { name: 'Rubor Rose' });
    expect(api.listProducts.mock.calls.length).toBeGreaterThan(1);
  }, 10000);
  test('cerrar y Escape descartan datos personales del formulario', async () => {
    const { user } = setup(`/producto/${productId}`);
    await openDetails(user);
    await user.type(
      screen.getByLabelText('Nombre y apellido'),
      'Nombre temporal',
    );
    await user.click(screen.getByRole('button', { name: 'Cerrar checkout' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openDetails(user);
    expect(screen.getByLabelText('Nombre y apellido')).toHaveValue('');
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: true, cancelable: true }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  test('no permite cerrar ni duplicar envío mientras registra la entrega', async () => {
    const api = apiFixture();
    let resolve!: (
      value: Awaited<ReturnType<typeof api.registerCustomer>>,
    ) => void;
    api.registerCustomer.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { user } = setup(`/producto/${productId}`, null, api);
    await openDetails(user);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Revisar mi pedido' }));
    expect(
      screen.getByRole('button', { name: 'Cerrar checkout' }),
    ).toBeDisabled();
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: true, cancelable: true }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Preparando resumen…' }),
    ).toBeDisabled();
    resolve(failure('SessionRequired', 401));
    await screen.findByRole('alert');
  });
  test('sin stock impide preparar y permite refrescar el detalle', async () => {
    const api = apiFixture();
    api.getProduct.mockResolvedValue(
      success({ ...product, availableStock: 0 }),
    );
    const { user } = setup(`/producto/${productId}`, null, api);
    expect(
      await screen.findByRole('button', { name: 'Agregar al carrito' }),
    ).toBeDisabled();
    expect(screen.getByText('Sin existencias por ahora')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Actualizar existencias' }),
    );
    expect(api.getProduct).toHaveBeenCalledTimes(2);
  });
  test('detalle fallido ofrece reintentar y navegación segura', async () => {
    const api = apiFixture();
    api.getProduct.mockResolvedValueOnce(failure('ProductNotFound', 404));
    const { user } = setup(`/producto/${productId}`, null, api);
    await screen.findByRole('heading', {
      name: 'No pudimos encontrar tu esencial.',
    });
    await user.click(screen.getByRole('button', { name: 'Volver a intentar' }));
    await screen.findByRole('heading', { name: 'Rubor Rose' });
  });
  test('resumen recuperado revalida precio antes de reservar y maneja QuoteChanged', async () => {
    const api = apiFixture();
    api.createPending.mockResolvedValueOnce(failure('QuoteChanged', 409));
    const { user } = setup('/', progress, api);
    await screen.findByRole('button', { name: 'Continuar con el pago' });
    expect(
      screen.getByText('Tu entrega ya está registrada en esta sesión.'),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Continuar con el pago' }),
    );
    await screen.findByRole('alert');
    expect(
      screen.getByRole('button', { name: 'Continuar con el pago' }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Actualizar resumen' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Continuar con el pago' }),
      ).toBeEnabled(),
    );
  });
  test('resumen fallido al retomar se puede recuperar', async () => {
    const api = apiFixture();
    api.quote.mockResolvedValueOnce(failure('NetworkError', 0));
    const { user } = setup('/', progress, api);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Recuperar resumen' }));
    await screen.findByRole('button', { name: 'Continuar con el pago' });
  });
  test('una respuesta perdida ofrece reintentar la misma reserva', async () => {
    const api = apiFixture();
    api.createPending.mockResolvedValueOnce(failure('NetworkError', 0));
    const { user } = setup('/', progress, api);
    await user.click(
      await screen.findByRole('button', { name: 'Continuar con el pago' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: 'Reintentar la misma reserva',
      }),
    );
    await screen.findByRole('heading', { name: 'Tu selección te espera.' });
    expect(api.createPending.mock.calls[0]).toEqual(
      api.createPending.mock.calls[1],
    );
  });
  test.each([
    ['PENDING', 'ACTIVE', 'Tu selección te espera.', 'Producto reservado'],
    [
      'EXPIRED',
      'RELEASED',
      'Todavía hay color por descubrir.',
      'Reserva liberada',
    ],
    [
      'APPROVED',
      'CONFIRMED',
      'Gracias por elegir tu color.',
      'Stock confirmado',
    ],
    [
      'DECLINED',
      'RELEASED',
      'Tu pedido necesita una revisión.',
      'Reserva liberada',
    ],
    ['ERROR', 'RELEASED', 'Hagamos una pausa.', 'Reserva liberada'],
  ] as const)(
    'pedido muestra únicamente estado %s obtenido de API',
    async (status, reservationStatus, title, stockLabel) => {
      const api = apiFixture();
      api.getTransaction.mockResolvedValue(
        success({ ...transaction, status, reservationStatus } as Transaction),
      );
      const { user } = setup(
        '/pedido',
        { ...progress, transactionId: transaction.id },
        api,
      );
      expect(await screen.findByRole('heading', { name: title })).toBeVisible();
      expect(screen.getByRole('heading', { name: stockLabel })).toBeVisible();
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      });
      await user.click(
        screen.getByRole('button', { name: 'Copiar referencia' }),
      );
      await screen.findByText(
        'Puedes seleccionar y copiar la referencia que aparece arriba.',
      );
    },
  );
  test('sesión vencida oculta el pedido y permite empezar otra selección', async () => {
    const api = apiFixture();
    api.getTransaction.mockResolvedValue(failure('SessionRequired', 401));
    const { user } = setup(
      '/pedido',
      { ...progress, transactionId: transaction.id },
      api,
    );
    await user.click(
      await screen.findByRole('button', {
        name: 'Empezar una nueva selección',
      }),
    );
    await screen.findByRole('heading', { name: 'Rubor Rose' });
    expect(screen.queryByText(transaction.reference)).not.toBeInTheDocument();
  });
  test('pedido vacío, ruta desconocida y aviso cuando no se puede persistir', async () => {
    const view = setup('/pedido');
    expect(
      screen.getByRole('heading', { name: 'Aquí comienza tu próximo ritual.' }),
    ).toBeVisible();
    await view.user.click(
      screen.getByRole('link', { name: 'Descubrir la colección' }),
    );
    await screen.findByRole('heading', { name: 'Rubor Rose' });
    view.unmount();
    const next = setup('/desconocida');
    expect(
      screen.getByRole('heading', {
        name: 'Este camino no está en la colección.',
      }),
    ).toBeVisible();
    next.unmount();
    const api = apiFixture();
    const store = createAppStore({
      api,
      progress: {
        read: () => ({ ok: false, error: 'PersistenceUnavailable' }),
        save: () => ({ ok: false, error: 'PersistenceUnavailable' }),
      },
      runtime: { newKey: () => 'key-00000001' },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </Provider>,
    );
    await screen.findByText(/Este navegador no permite guardar tu progreso/);
  });
  test('una selección activa lleva al pedido en lugar de abrir un segundo checkout', async () => {
    const { user, store } = setup(`/producto/${productId}`, {
      ...progress,
      transactionId: transaction.id,
    });
    await waitFor(() =>
      expect(store.getState().checkout.transaction?.id).toBe(transaction.id),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Agregar al carrito' }),
    );
    await screen.findByRole('heading', { name: 'Tu selección te espera.' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  test('un fallo de imagen remota pasa al recurso local y luego a alternativa accesible', () => {
    const view = render(
      <ProductArt
        product={{ ...product, imageUrl: 'https://example.com/product.jpg' }}
        priority
      />,
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/images/rose-720.jpg',
    );
    fireEvent.error(screen.getByRole('img'));
    expect(
      screen.getByRole('img', { name: 'Imagen no disponible: Rubor Rose' }),
    ).toBeVisible();
    view.unmount();
    render(
      <ProductArt product={{ ...lipstick, imageUrl: 'javascript:alert(1)' }} />,
    );
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/images/cocoa-720.jpg',
    );
  });
  test('la interfaz refleja que un producto del catálogo agotó sus unidades', async () => {
    const api = apiFixture();
    api.listProducts.mockResolvedValue(
      success([{ ...product, availableStock: 0 }]),
    );
    setup('/', null, api);
    await screen.findByText('Sin unidades disponibles');
  });
});

test('cambiar de paso reinicia el scroll del modal y mantiene el título enfocado', async () => {
  const { user } = setup(`/producto/${productId}`);
  const dialog = await openDetails(user);
  await fill(user);
  dialog.scrollTop = 600;
  await user.click(screen.getByRole('button', { name: 'Revisar mi pedido' }));
  const heading = await screen.findByRole('heading', {
    name: 'Resumen de tu compra.',
  });
  expect(heading).toHaveFocus();
  expect(dialog.scrollTop).toBe(0);
  dialog.scrollTop = 400;
  await user.click(
    screen.getByRole('button', { name: 'Editar datos de entrega' }),
  );
  expect(
    screen.getByRole('heading', { name: 'Tus datos y entrega.' }),
  ).toHaveFocus();
  expect(dialog.scrollTop).toBe(0);
});

test('retomar selección abre el carrito completo en lugar de un único detalle', async () => {
  const saved: SafeProgress = {
    ...progress,
    deliveryId: null,
    requestKey: null,
    expectedTotalMinor: null,
    items: [
      { productId, quantity: 1 },
      { productId: lipstick.id, quantity: 2 },
    ],
  };
  const { user } = setup('/', saved);
  await user.click(screen.getByRole('link', { name: 'Retomar mi selección' }));
  expect(
    await screen.findByRole('heading', { name: 'Tu próximo ritual.' }),
  ).toBeVisible();
  expect(screen.getByRole('article', { name: product.name })).toBeVisible();
  expect(screen.getByRole('article', { name: lipstick.name })).toBeVisible();
});
test('retomar una compra ya creada abre su estado sin crear otra transacción', async () => {
  const { user, api } = setup('/', {
    ...progress,
    transactionId: transaction.id,
    attempted: true,
  });
  await user.click(screen.getByRole('link', { name: 'Retomar mi selección' }));
  expect(
    await screen.findByRole('heading', { name: 'Tu selección te espera.' }),
  ).toBeVisible();
  expect(api.getTransaction).toHaveBeenCalledWith(transaction.id);
  expect(api.createPending).not.toHaveBeenCalled();
});

test('ciudades dependen del departamento y cambiarlo borra la ciudad anterior', async () => {
  const { user, api } = setup(`/producto/${productId}`);
  await openDetails(user);
  const region = screen.getByRole('combobox', { name: 'Departamento' });
  const city = screen.getByRole('combobox', { name: 'Ciudad' });
  expect(city).toBeDisabled();
  await selectOption(user, region, 'Amazonas');
  expect(city).toBeEnabled();
  await user.click(city);
  expect(screen.getByRole('option', { name: 'Leticia' })).toBeVisible();
  expect(
    screen.queryByRole('option', { name: 'Bogotá' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'Leticia' }));
  await selectOption(user, region, 'Bogotá D.C.');
  expect(city).toHaveTextContent('Selecciona tu ciudad o municipio');
  await user.click(city);
  expect(screen.getAllByRole('option')).toHaveLength(1);
  await user.click(screen.getByRole('option', { name: 'Bogotá' }));
  await user.click(screen.getByRole('button', { name: 'Revisar mi pedido' }));
  expect(api.registerDelivery).not.toHaveBeenCalled();
});

test('añadir abre vista lateral sin navegar, acumula y devuelve el foco al cerrar', async () => {
  const { user, store, api } = setup(`/producto/${productId}`);
  const add = await screen.findByRole('button', { name: 'Agregar al carrito' });
  await user.click(add);
  expect(screen.getByRole('dialog', { name: 'Tu selección.' })).toBeVisible();
  expect(screen.getByText('Cantidad: 1')).toBeVisible();
  expect(api.createPending).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Seguir comprando' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(add).toHaveFocus();
  expect(
    screen.getByRole('heading', { name: 'Rubor Rose', level: 1 }),
  ).toBeVisible();
  await user.click(add);
  expect(screen.getByText('Cantidad: 2')).toBeVisible();
  expect(store.getState().checkout.items[0].quantity).toBe(2);
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { bubbles: true, cancelable: true }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
  await user.click(add);
  await user.click(
    screen.getByRole('button', { name: 'Cerrar vista del carrito' }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(add);
  fireEvent.click(screen.getByRole('dialog'), { clientX: -10, clientY: -10 });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(add);
  await user.click(screen.getByRole('link', { name: 'Revisar carrito' }));
  expect(
    await screen.findByRole('heading', { name: 'Tu próximo ritual.' }),
  ).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
