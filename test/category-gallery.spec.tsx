import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryDiscovery } from '../src/presentation/components/CategoryDiscovery';
import { product } from './fixtures';
test('galería navega sin cambiar la selección, refleja bordes y respeta movimiento reducido', async () => {
  const user = userEvent.setup(),
    onSelect = jest.fn();
  render(
    <CategoryDiscovery
      products={[{ ...product, sku: 'BASE-MAC-DEMO' }]}
      onSelect={onSelect}
    />,
  );
  const gallery = screen.getByRole('group', {
    name: 'Categorías de productos',
  });
  Object.defineProperties(gallery, {
    clientWidth: { value: 320 },
    scrollWidth: { value: 1240 },
  });
  const scroll = jest.fn();
  gallery.scrollBy = scroll;
  fireEvent.scroll(gallery);
  expect(
    screen.getByRole('button', { name: 'Categoría anterior' }),
  ).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Siguiente categoría' }));
  expect(scroll).toHaveBeenCalledWith({ left: 336, behavior: 'smooth' });
  expect(onSelect).not.toHaveBeenCalled();
  gallery.scrollLeft = 920;
  fireEvent.scroll(gallery);
  expect(
    screen.getByRole('button', { name: 'Siguiente categoría' }),
  ).toBeDisabled();
  const original = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  await user.click(screen.getByRole('button', { name: 'Categoría anterior' }));
  expect(scroll).toHaveBeenLastCalledWith({ left: -336, behavior: 'auto' });
  window.matchMedia = original;
  await user.click(screen.getByRole('button', { name: 'Explorar Bases' }));
  expect(onSelect).toHaveBeenCalledWith('Bases');
  expect(
    screen.getByRole('button', { name: 'Explorar Sombras' }),
  ).toBeDisabled();
});
