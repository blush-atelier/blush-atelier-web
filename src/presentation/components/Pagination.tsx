import { Icon } from './Icon';
interface Props {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  onChange: (page: number) => void;
}
export function Pagination({
  page,
  totalPages,
  start,
  end,
  total,
  onChange,
}: Props) {
  if (totalPages <= 1) return null;
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => first + index,
  );
  return (
    <nav className="pagination" aria-label="Páginas del catálogo">
      <p className="pagination-summary" role="status">
        Mostrando {start}–{end} de {total} productos{' '}
        <span>
          · Página {page} de {totalPages}
        </span>
      </p>
      <div className="pagination-controls">
        <button
          className="pagination-button"
          aria-label="Página anterior"
          aria-controls="product-grid"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <Icon name="back" />
        </button>
        <div className="pagination-numbers">
          {pages.map((value) => (
            <button
              key={value}
              className="pagination-button"
              aria-label={`Ir a la página ${value}`}
              aria-current={value === page ? 'page' : undefined}
              aria-controls="product-grid"
              onClick={() => onChange(value)}
            >
              {String(value).padStart(2, '0')}
            </button>
          ))}
        </div>
        <button
          className="pagination-button"
          aria-label="Página siguiente"
          aria-controls="product-grid"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
        >
          <Icon name="arrow" />
        </button>
      </div>
    </nav>
  );
}
