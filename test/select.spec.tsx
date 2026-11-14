import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AtelierSelect } from '../src/presentation/components/AtelierSelect';
const options = [
  { value: 'all', label: 'Todas las marcas' },
  { value: 'mac', label: 'MAC' },
  { value: 'atenea', label: 'Atenea' },
  { value: 'later', label: 'No disponible', disabled: true },
];
function Fixture() {
  const [value, setValue] = useState('all');
  return (
    <AtelierSelect
      label="Marca"
      value={value}
      options={options}
      onChange={setValue}
    />
  );
}
test('selección con ratón, check visible y retorno de foco al trigger', async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  const trigger = screen.getByRole('combobox', { name: 'Marca' });
  await user.click(trigger);
  expect(
    screen.getByRole('option', { name: 'Todas las marcas' }),
  ).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('option', { name: 'MAC' }));
  expect(trigger).toHaveTextContent('MAC');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
test('teclado, búsqueda por letras, Escape y opciones deshabilitadas', async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  const trigger = screen.getByRole('combobox');
  trigger.focus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'No disponible' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await user.keyboard('m{Enter}');
  expect(trigger).toHaveTextContent('MAC');
  await user.keyboard('{ArrowDown}{Escape}');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
test('estado deshabilitado y error asociado al campo', () => {
  const change = jest.fn();
  render(
    <AtelierSelect
      label="Marca"
      value="all"
      options={options}
      onChange={change}
      disabled
      error="Selecciona una marca disponible."
    />,
  );
  const trigger = screen.getByRole('combobox');
  expect(trigger).toBeDisabled();
  expect(trigger).toHaveAttribute('aria-invalid', 'true');
  expect(trigger).toHaveAccessibleDescription(
    'Selecciona una marca disponible.',
  );
  expect(change).not.toHaveBeenCalled();
});

test('bloquea el fondo solo mientras el menú está abierto y lo restaura al seleccionar', async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>Acción de fondo</button>
      <Fixture />
    </>,
  );
  const background = screen.getByRole('button', { name: 'Acción de fondo' }),
    trigger = screen.getByRole('combobox');
  await user.click(trigger);
  expect(background.closest('[inert]')).not.toBeNull();
  await user.click(screen.getByRole('option', { name: 'MAC' }));
  await waitFor(() => expect(background.closest('[inert]')).toBeNull());
  await user.click(background);
  expect(background).toHaveFocus();
});
