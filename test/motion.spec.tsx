import { render, screen } from '@testing-library/react';
import { useReveal } from '../src/presentation/useReveal';
const originalObserver = globalThis.IntersectionObserver;
const originalMedia = window.matchMedia;
afterEach(() => {
  globalThis.IntersectionObserver = originalObserver;
  window.matchMedia = originalMedia;
});
function Fixture({ revision = 'first' }: { revision?: string }) {
  const ref = useReveal(revision);
  return (
    <section ref={ref}>
      <p data-reveal>Un producto visible</p>
    </section>
  );
}
test('sin IntersectionObserver no oculta productos', () => {
  globalThis.IntersectionObserver =
    undefined as unknown as typeof IntersectionObserver;
  render(<Fixture />);
  expect(screen.getByText('Un producto visible')).not.toHaveClass(
    'will-reveal',
  );
});
test('respeta movimiento reducido y no prepara animaciones', () => {
  const observer = jest.fn();
  globalThis.IntersectionObserver = observer;
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  render(<Fixture />);
  expect(observer).not.toHaveBeenCalled();
  expect(screen.getByText('Un producto visible')).not.toHaveClass(
    'will-reveal',
  );
});
test('revela al entrar en pantalla y libera el observer al cambiar filtro o desmontar', () => {
  let notify!: IntersectionObserverCallback;
  const observer = {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  };
  globalThis.IntersectionObserver = jest
    .fn()
    .mockImplementation((callback: IntersectionObserverCallback) => {
      notify = callback;
      return observer;
    });
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  const view = render(<Fixture />);
  const element = screen.getByText('Un producto visible');
  expect(observer.observe).toHaveBeenCalledWith(element);
  expect(element).toHaveClass('will-reveal');
  notify(
    [
      {
        target: element,
        isIntersecting: false,
        intersectionRatio: 0,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRect: element.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
      },
    ],
    observer as unknown as IntersectionObserver,
  );
  expect(element).not.toHaveClass('is-revealed');
  notify(
    [
      {
        target: element,
        isIntersecting: true,
        intersectionRatio: 1,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRect: element.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
      },
    ],
    observer as unknown as IntersectionObserver,
  );
  expect(element).toHaveClass('is-revealed');
  expect(observer.unobserve).toHaveBeenCalledWith(element);
  view.rerender(<Fixture revision="new-filter" />);
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(observer.disconnect).toHaveBeenCalledTimes(2);
});
