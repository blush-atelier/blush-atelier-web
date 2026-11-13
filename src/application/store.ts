import {
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import type {
  CheckoutApi,
  ProgressPort,
  RuntimePort,
} from '../domain/contracts';
import {
  actions,
  initialState,
  reducer,
  safeProgress,
  type AppState,
} from './state';
export interface Dependencies {
  api: CheckoutApi;
  progress: ProgressPort;
  runtime: RuntimePort;
}
export function createAppStore(dependencies: Dependencies) {
  const restored = dependencies.progress.read();
  const start = initialState(restored.ok ? restored.value : null);
  if (!restored.ok) start.persistenceWarning = true;
  const store = configureStore({
    reducer,
    preloadedState: start,
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: dependencies } }),
    devTools: false,
  });
  let previous = JSON.stringify(safeProgress(start));
  let warned = !restored.ok;
  store.subscribe(() => {
    const progress = safeProgress(store.getState());
    const serialized = JSON.stringify(progress);
    if (serialized === previous) return;
    previous = serialized;
    const saved = dependencies.progress.save(progress);
    if (!saved.ok && !warned) {
      warned = true;
      store.dispatch(actions.progressUnavailable());
    }
  });
  return store;
}
export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<T = Promise<boolean>> = ThunkAction<
  T,
  AppState,
  Dependencies,
  UnknownAction
>;
