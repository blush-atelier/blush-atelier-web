import { render, screen } from '@testing-library/react';
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
function setup() {
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
  store.dispatch(actions.transactionReady(transaction));
  store.dispatch(actions.cardDetailsRequested());
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
it('tarjeta validada antes del resumen, campos vacíos después y aviso encima del checkout', async () => {
  const f = setup();
  await screen.findByLabelText('Número de tarjeta');
  await screen.findByLabelText(/Acepto la política/);
  await f.user.click(screen.getByRole('button', { name: 'Revisar mi pedido' }));
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
  await f.user.click(screen.getByRole('button', { name: 'Revisar mi pedido' }));
  await screen.findByText('VISA ···· 4242');
  expect(
    screen.queryByLabelText('Código de seguridad'),
  ).not.toBeInTheDocument();
  expect(JSON.stringify(f.store.getState())).not.toContain('4242');
  jest.mocked(f.api.chargePayment!).mockResolvedValue({
    ok: false,
    error: { code: 'PaymentProviderUnavailable', status: 503 },
  });
  await f.user.click(
    screen.getByRole('button', { name: 'Continuar con el pago' }),
  );
  await screen.findByRole('heading', { name: 'Revisemos un detalle' });
  expect(
    screen.getByRole('dialog', { name: 'Revisemos un detalle' }),
  ).toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'Entendido' })).toHaveFocus();
  await f.user.click(screen.getByRole('button', { name: 'Entendido' }));
  expect(
    screen.getByRole('heading', { name: 'Completando pago', level: 3 }),
  ).toBeVisible();
  await f.user.click(screen.getByRole('button', { name: 'Ver mi pedido' }));
  expect(
    screen.queryByRole('dialog', { name: 'Completando pago' }),
  ).not.toBeInTheDocument();
});
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
