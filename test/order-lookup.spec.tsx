import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { OrderLookup } from '../src/presentation/components/OrderLookup';
import { createAppStore } from '../src/application/store';
import {
  apiFixture,
  memoryProgress,
  progress,
  transaction,
  success,
} from './fixtures';
function setup() {
  const api = apiFixture();
  api.getTransaction.mockResolvedValue(
    success({
      ...transaction,
      status: 'APPROVED',
      reservationStatus: 'CONFIRMED',
    }),
  );
  const store = createAppStore({
    api,
    progress: memoryProgress(progress),
    runtime: { newKey: () => '' },
  });
  render(
    <Provider store={store}>
      <OrderLookup />
    </Provider>,
  );
  return { api, store, user: userEvent.setup() };
}
it('consulta referencia y muestra estado sin tocar el carrito', async () => {
  const f = setup(),
    before = JSON.stringify(f.store.getState());
  await f.user.type(
    screen.getByLabelText('Número de referencia'),
    transaction.reference,
  );
  await f.user.click(screen.getByRole('button', { name: 'Consultar pedido' }));
  expect(await screen.findByText('Pago aprobado')).toBeVisible();
  expect(JSON.stringify(f.store.getState())).toBe(before);
});
it('referencia inválida y sesión no autorizada muestran error seguro', async () => {
  const f = setup();
  await f.user.type(
    screen.getByLabelText('Número de referencia'),
    'BA-invalida',
  );
  await f.user.click(screen.getByRole('button', { name: 'Consultar pedido' }));
  await screen.findByRole('alert');
  expect(f.api.getTransaction).not.toHaveBeenCalled();
  await f.user.clear(screen.getByLabelText('Número de referencia'));
  await f.user.type(
    screen.getByLabelText('Número de referencia'),
    transaction.reference,
  );
  f.api.getTransaction.mockResolvedValue({
    ok: false,
    error: { code: 'SessionRequired', status: 401 },
  });
  await f.user.click(screen.getByRole('button', { name: 'Consultar pedido' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Pago aprobado')).not.toBeInTheDocument();
});
