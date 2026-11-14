import { render, screen, act } from '@testing-library/react';
import { selectOption } from './select-helper';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { CheckoutDialog } from '../src/presentation/components/CheckoutDialog';
import { PaymentAlerts } from '../src/presentation/components/PaymentAlerts';
import { createAppStore } from '../src/application/store';
import { actions } from '../src/application/state';
import type { CardPort } from '../src/domain/card';
import {
  apiFixture,
  memoryProgress,
  progress,
  transaction,
  form,
  success,
} from './fixtures';
const config = {
  apiUrl: 'https://api-sandbox.co.uat.wompi.dev/v1',
  publicKey: 'pub_stagtest_fixture',
  encryptionKey: 'public',
  privacyUrl: 'https://example.com/privacy',
  personalDataUrl: 'https://example.com/personal',
  acceptanceToken: 'privacy',
  personalDataToken: 'personal',
};
function setup(existing = true) {
  const api = apiFixture();
  api.chargePayment = jest.fn().mockResolvedValue(success({ accepted: true }));
  api.verifyPayment.mockResolvedValue(
    success({ verified: false, submitted: false }),
  );
  const card: jest.Mocked<CardPort> = {
    configuration: jest.fn().mockResolvedValue(success(config)),
    prepare: jest
      .fn()
      .mockResolvedValue(success({ brand: 'VISA', lastFour: '4242' })),
    authorization: jest.fn().mockReturnValue({
      token: 'tok_stagtest_fixture',
      acceptanceToken: 'privacy',
      personalDataToken: 'personal',
      installments: 1,
      privacyAccepted: true,
      personalDataAccepted: true,
    }),
    clear: jest.fn(),
  };
  const store = createAppStore({
    api,
    card,
    progress: memoryProgress({ ...progress, transactionId: transaction.id }),
    runtime: { newKey: () => 'request-0000001' },
  });
  if (existing) {
    store.dispatch(actions.transactionReady(transaction));
    store.dispatch(actions.cardDetailsRequested());
  } else
    store.dispatch(
      actions.checkoutOpened({ productId: progress.productId, quantity: 1 }),
    );
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/pedido']}>
        <CheckoutDialog />
        <PaymentAlerts />
      </MemoryRouter>
    </Provider>,
  );
  return { api, card, store, user: userEvent.setup() };
}
it('datos primero, resumen y tarjeta después, tercer paso activo durante pago y alerta superior', async () => {
  const f = setup(false);
  expect(screen.queryByLabelText('Número de tarjeta')).not.toBeInTheDocument();
  await f.user.click(screen.getByRole('button', { name: 'Completar pago' }));
  expect(screen.getByLabelText('Nombre y apellido')).toHaveFocus();
  for (const [label, value] of [
    ['Nombre y apellido', form.fullName],
    ['Correo electrónico', form.email],
    ['Teléfono de contacto', form.phone],
    ['Dirección de entrega', form.addressLine],
  ])
    await f.user.type(screen.getByLabelText(label), value);
  await selectOption(
    f.user,
    screen.getByRole('combobox', { name: 'Departamento' }),
    form.region,
  );
  await selectOption(
    f.user,
    screen.getByRole('combobox', { name: 'Ciudad' }),
    form.city,
  );
  await f.user.click(screen.getByRole('button', { name: 'Completar pago' }));
  await screen.findByRole('heading', { name: 'Resumen de tu compra.' });
  expect(f.card.prepare).not.toHaveBeenCalled();
  expect(f.api.createPending).not.toHaveBeenCalled();
  await f.user.click(screen.getByRole('button', { name: 'Registrar pago' }));
  expect(screen.getByLabelText('Número de tarjeta')).toHaveFocus();
  await f.user.type(
    screen.getByLabelText('Número de tarjeta'),
    '4242424242424242',
  );
  expect(screen.getByLabelText('Tarjeta VISA detectada')).toBeVisible();
  await f.user.type(
    screen.getByLabelText('Nombre en la tarjeta'),
    'Persona Prueba',
  );
  await f.user.type(screen.getByLabelText('Vencimiento'), '1239');
  await f.user.type(screen.getByLabelText('Código de seguridad'), '123');
  await f.user.click(screen.getByLabelText(/Acepto la política/));
  await f.user.click(screen.getByLabelText(/Autorizo el tratamiento/));
  let finish!: (v: Awaited<ReturnType<typeof f.api.chargePayment>>) => void;
  f.api.chargePayment.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await f.user.click(screen.getByRole('button', { name: 'Registrar pago' }));
  await screen.findByRole('heading', { name: 'Completando pago', level: 3 });
  expect(screen.getByText('Procesando pago').closest('li')).toHaveAttribute(
    'aria-current',
    'step',
  );
  expect(f.api.createPending.mock.invocationCallOrder[0]).toBeLessThan(
    f.api.chargePayment.mock.invocationCallOrder[0],
  );
  await act(async () =>
    finish({
      ok: false,
      error: { code: 'PaymentProviderUnavailable', status: 503 },
    }),
  );
  await screen.findByRole('heading', { name: 'Revisemos un detalle' });
  expect(
    screen.getByRole('dialog', { name: 'Revisemos un detalle' }),
  ).toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'Entendido' })).toHaveFocus();
  await f.user.click(screen.getByRole('button', { name: 'Entendido' }));
  await f.user.click(screen.getByRole('button', { name: 'Ver mi pedido' }));
  expect(
    screen.queryByRole('dialog', { name: 'Completando pago' }),
  ).not.toBeInTheDocument();
}, 15000);
it('detecta Mastercard y cerrar descarta la tarjeta', async () => {
  const f = setup();
  await screen.findByLabelText('Número de tarjeta');
  await f.user.type(
    screen.getByLabelText('Número de tarjeta'),
    '5555555555554444',
  );
  expect(screen.getByLabelText('Tarjeta MASTERCARD detectada')).toBeVisible();
  await f.user.click(screen.getByRole('button', { name: 'Cerrar checkout' }));
  expect(f.card.clear).toHaveBeenCalled();
});
