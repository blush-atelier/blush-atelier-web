import { errorMessage } from '../../domain/presentation';
import type { ApiError } from '../../domain/contracts';
export function ErrorNotice({
  error,
  retry,
}: {
  error: ApiError | null;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="error-notice" role="alert">
      <p>{errorMessage(error)}</p>
      {retry && (
        <button className="text-button" onClick={retry}>
          Volver a intentar
        </button>
      )}
    </div>
  );
}
export function Loading({
  label = 'Un momento, estamos preparando tu selección…',
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
