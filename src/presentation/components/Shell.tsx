import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppSelector } from '../hooks';
import { Icon } from './Icon';
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-name">
        blush<span className="brand-period">.</span>
      </span>
      <span className="brand-subtitle">ATELIER</span>
    </span>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { pathname, hash } = useLocation();
  const selected = useAppSelector((state) =>
    Boolean(state.checkout.transactionId || state.checkout.attempted),
  );
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
          .matches
          ? 'auto'
          : 'smooth',
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
      document
        .querySelector<HTMLElement>('main h1')
        ?.focus({ preventScroll: true });
    }
  }, [pathname, hash]);
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className="announcement">
        Tu ritual, a tu ritmo.{' '}
        <span>Una selección de color, hecha para ti.</span>
      </div>
      <header className="site-header" id="inicio">
        <nav className="desktop-links" aria-label="Principal">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              (isActive && !hash) || pathname.startsWith('/producto/')
                ? 'is-active'
                : ''
            }
          >
            Colección
          </NavLink>
          <Link
            to="/#ayuda"
            className={hash === '#ayuda' ? 'is-active' : ''}
            aria-current={hash === '#ayuda' ? 'location' : undefined}
          >
            Cómo funciona
          </Link>
        </nav>
        <Link to="/" className="brand-link" aria-label="Blush Atelier, inicio">
          <Brand />
        </Link>
        <NavLink to="/pedido" className="order-link">
          <span>Mi pedido</span>
          <Icon name="bag" />
          {selected && (
            <span
              className="selection-count"
              aria-label="Una selección guardada"
            >
              1
            </span>
          )}
        </NavLink>
      </header>
      <main id="contenido">{children}</main>
      <footer className="site-footer">
        <Brand />
        <p>
          Un poco de color.
          <br />
          Una forma de ser tú.
        </p>
        <nav aria-label="Enlaces de ayuda">
          <Link to="/#ayuda">Cómo reservar</Link>
          <Link to="/pedido">Consultar mi pedido</Link>
          <a href="#inicio">Volver arriba ↑</a>
        </nav>
        <div className="footer-bottom">
          <span>Blush Atelier · Colección esencial</span>
          <span>Demo · COP · Sin afiliación con las marcas</span>
        </div>
      </footer>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            (isActive && !hash) || pathname.startsWith('/producto/')
              ? 'is-active'
              : ''
          }
        >
          <Icon name="home" />
          <span>Colección</span>
        </NavLink>
        <NavLink to="/pedido">
          <Icon name="bag" />
          <span>Mi pedido</span>
        </NavLink>
        <Link
          to="/#ayuda"
          className={hash === '#ayuda' ? 'is-active' : ''}
          aria-current={hash === '#ayuda' ? 'location' : undefined}
        >
          <span className="help-symbol" aria-hidden="true">
            ?
          </span>
          <span>Ayuda</span>
        </Link>
      </nav>
    </>
  );
}
