import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
export async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  control: HTMLElement,
  value: string,
) {
  const labels: Record<string, string> = {
    price: 'Menor precio',
    'price-desc': 'Mayor precio',
    atelier: 'Selección atelier',
    Todas: 'Todas las marcas',
  };
  await user.click(control);
  await user.click(
    await screen.findByRole('option', {
      name: labels[value] ?? value,
    }),
  );
}
