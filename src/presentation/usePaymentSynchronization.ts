import { useEffect } from 'react';
import { refreshPayment } from '../application/operations';
import { useAppDispatch, useAppSelector } from './hooks';
export function usePaymentSynchronization() {
  const dispatch = useAppDispatch(),
    id = useAppSelector((s) => s.checkout.transactionId),
    status = useAppSelector((s) => s.checkout.transaction?.status),
    expired = useAppSelector((s) => s.checkout.sessionExpired);
  useEffect(() => {
    if (!id || expired || (status && status !== 'PENDING')) return;
    const check = () => {
      if (document.visibilityState === 'visible')
        void dispatch(refreshPayment());
    };
    check();
    const timer = setInterval(check, 2500);
    window.addEventListener('online', check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', check);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [dispatch, id, status, expired]);
}
