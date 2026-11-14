import { createCardPayments } from './infrastructure/card-tokenization';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createAppStore } from './application/store';
import { createHttpApi } from './infrastructure/http-api';
import { browserProgress, newRequestKey } from './infrastructure/progress';
import { App } from './presentation/App';
const api = createHttpApi(__API_BASE_URL__);
const store = createAppStore({
  card: createCardPayments(api),
  api,
  progress: browserProgress(),
  runtime: { newKey: newRequestKey },
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
