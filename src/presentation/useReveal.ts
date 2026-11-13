import { useEffect, useRef } from 'react';
export function useReveal(revision: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // Sin soporte o con movimiento reducido, el contenido permanece visible.
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    ref.current?.querySelectorAll('[data-reveal]').forEach((element) => {
      element.classList.add('will-reveal');
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, [revision]);
  return ref;
}
