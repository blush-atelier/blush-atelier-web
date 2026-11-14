import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { resumeCheckout } from '../application/operations';
import { useAppDispatch, useAppSelector } from './hooks';
import { Shell } from './components/Shell';
import { CartDrawer } from './components/CartDrawer';
import { PaymentAlerts } from './components/PaymentAlerts';
import { CheckoutDialog } from './components/CheckoutDialog';
import { CataloguePage } from './pages/CataloguePage';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { OrderPage } from './pages/OrderPage';
import './styles.css';
export function App() {
  const [cartPreview, setCartPreview] = useState(false);
  const dispatch = useAppDispatch();
  const warning = useAppSelector((state) => state.persistenceWarning);
  useEffect(() => {
    void dispatch(resumeCheckout());
  }, [dispatch]);
  return (
    <Shell>
      {warning && (
        <p className="persistence-warning" role="status">
          Este navegador no permite guardar tu progreso. Mantén esta pestaña
          abierta para continuar.
        </p>
      )}
      <Routes>
        <Route path="/" element={<CataloguePage />} />
        <Route
          path="/producto/:id"
          element={<ProductPage onAdded={() => setCartPreview(true)} />}
        />
        <Route path="/carrito" element={<CartPage />} />
        <Route path="/pedido" element={<OrderPage />} />
        <Route
          path="*"
          element={
            <section className="section-wrap page-empty">
              <p className="eyebrow">VOLVAMOS A LO ESENCIAL</p>
              <h1 tabIndex={-1}>Este camino no está en la colección.</h1>
              <Link className="button button--dark" to="/">
                Volver al inicio
              </Link>
            </section>
          }
        />
      </Routes>
      <CheckoutDialog />
      <PaymentAlerts />
      {cartPreview && <CartDrawer onClose={() => setCartPreview(false)} />}
    </Shell>
  );
}
