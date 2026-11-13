import { selectOption } from './select-helper';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/presentation/App';
import { Pagination } from '../src/presentation/components/Pagination';
import { createAppStore } from '../src/application/store';
import { apiFixture, memoryProgress, product, success } from './fixtures';
const prefix = [
  'BASE',
  'BASE',
  'BASE',
  'CONCEALER',
  'CONCEALER',
  'CONCEALER',
  'EYE',
  'EYE',
  'EYE',
  'ACC',
  'ACC',
  'ACC',
  'LIP',
  'LIP',
  'LIP',
  'LIP',
  'LIP',
  'BLUSH',
  'BLUSH',
  'BLUSH',
  'BLUSH',
  'BLUSH',
];
const items = prefix.map((kind, index) => ({
  ...product,
  id: `b3000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  sku: `${kind}-${['MAC', 'ATENEA', 'TOOFACED', 'BLOOMSHELL'][index % 4]}-${index}`,
  name: `Producto ${String(index + 1).padStart(2, '0')}`,
  priceMinor: (BigInt(index + 1) * 1000000n).toString(),
}));
function Location() {
  return <p data-testid="location">{useLocation().search}</p>;
}
function setup(path = '/') {
  const api = apiFixture();
  api.listProducts.mockResolvedValue(success(items));
  api.getProduct.mockImplementation(async (id) =>
    success(items.find((value) => value.id === id)!),
  );
  const store = createAppStore({
    api,
    progress: memoryProgress(),
    runtime: { newKey: () => 'checkout-page-0001' },
  });
  return {
    user: userEvent.setup(),
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Location />
          <App />
        </MemoryRouter>
      </Provider>,
    ),
  };
}
test('paginación accesible, límites y recorrido sin repetir productos', async () => {
  const { user } = setup();
  await screen.findByRole('heading', { name: 'Producto 01' });
  expect(screen.getAllByRole('article')).toHaveLength(8);
  expect(
    screen.getByRole('button', { name: 'Página anterior' }),
  ).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
  expect(screen.getByRole('heading', { name: 'Producto 09' })).toBeVisible();
  expect(screen.getByTestId('location')).toHaveTextContent('page=2');
  expect(
    screen.getByRole('heading', { name: 'Tus nuevos esenciales.' }),
  ).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Ir a la página 3' }));
  expect(screen.getAllByRole('article')).toHaveLength(6);
  expect(
    screen.getByRole('button', { name: 'Página siguiente' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Ir a la página 3' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(screen.getByText(/Mostrando 17–22 de 22 productos/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Página anterior' }));
  expect(screen.getByRole('heading', { name: 'Producto 09' })).toBeVisible();
});
test('filtros y búsqueda reinician la página y se pueden quitar por separado', async () => {
  const { user } = setup('/?page=3');
  await screen.findByRole('heading', { name: 'Producto 17' });
  await user.click(screen.getByRole('button', { name: 'Bases' }));
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(
    screen.queryByRole('navigation', { name: 'Páginas del catálogo' }),
  ).not.toBeInTheDocument();
  expect(screen.getByTestId('location')).not.toHaveTextContent('page=');
  await selectOption(
    user,
    screen.getByRole('combobox', { name: 'Filtrar por marca' }),
    'MAC',
  );
  expect(screen.getAllByRole('article')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Quitar marca' }));
  expect(screen.getAllByRole('article')).toHaveLength(3);
  await user.type(screen.getByRole('searchbox'), 'inexistente');
  expect(screen.getByText('No encontramos ese producto.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Quitar búsqueda' }));
  expect(screen.getAllByRole('article')).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: 'Quitar categoría' }));
  expect(screen.getAllByRole('article')).toHaveLength(8);
  await selectOption(
    user,
    screen.getByRole('combobox', { name: 'Filtrar por marca' }),
    'MAC',
  );
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(
    screen.getByRole('combobox', { name: 'Filtrar por marca' }),
  ).toHaveTextContent('Todas');
});
test('restaura URL compartida, orden y página al volver desde detalle', async () => {
  const { user } = setup('/?page=2&sort=price-desc');
  await screen.findByRole('heading', { name: 'Producto 14' });
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('Producto 14');
  await user.click(screen.getByRole('link', { name: 'Ver Producto 14' }));
  await screen.findByRole('button', { name: 'Agregar al carrito' });
  const crumbs = screen.getByRole('navigation', { name: 'Ruta de navegación' });
  await user.click(within(crumbs).getByRole('link', { name: 'Colección' }));
  await screen.findByRole('heading', { name: 'Producto 14' });
  expect(screen.getByTestId('location')).toHaveTextContent('page=2');
  expect(
    screen.getByRole('combobox', { name: 'Ordenar productos' }),
  ).toHaveTextContent('Mayor precio');
});
test.each([
  ['999', 3],
  ['-2', 1],
  ['abc', 1],
  ['1.5', 1],
])('corrige page=%s sin dejar una cuadrícula vacía', async (raw, page) => {
  setup(`/?page=${raw}`);
  await screen.findByRole('navigation', { name: 'Páginas del catálogo' });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: `Ir a la página ${page}` }),
    ).toHaveAttribute('aria-current', 'page'),
  );
  expect(screen.getAllByRole('article')).toHaveLength(page === 3 ? 6 : 8);
  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toBe(
      page === 1 ? '' : '?page=3',
    ),
  );
});
test('los accesos por categoría limpian filtros anteriores y muestran el grupo elegido', async () => {
  const { user } = setup('/?brand=MAC&q=Producto&page=2');
  await screen.findByRole('button', { name: 'Explorar Accesorios' });
  await user.click(screen.getByRole('button', { name: 'Explorar Accesorios' }));
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(screen.getByTestId('location')).toHaveTextContent(
    '?category=Accesorios',
  );
  expect(
    screen.getByRole('combobox', { name: 'Filtrar por marca' }),
  ).toHaveTextContent('Todas');
});
test('ventana numérica acotada para catálogos con muchas páginas', async () => {
  const change = jest.fn();
  const user = userEvent.setup();
  render(
    <Pagination
      page={6}
      totalPages={12}
      start={41}
      end={48}
      total={96}
      onChange={change}
    />,
  );
  expect(
    screen.queryByRole('button', { name: 'Ir a la página 1' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ir a la página 8' }));
  expect(change).toHaveBeenCalledWith(8);
});
