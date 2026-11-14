import type { CardInput, CardConfiguration } from '../../domain/card';
import { cardBrand } from '../../domain/card';
import { AtelierSelect } from './AtelierSelect';
export const blankCard: CardInput = {
  number: '',
  holder: '',
  expiry: '',
  cvc: '',
  installments: 1,
  privacyAccepted: false,
  personalDataAccepted: false,
};
export function CardFields({
  value,
  onChange,
  errors,
  terms,
  disabled,
  retry,
}: {
  value: CardInput;
  onChange: (value: CardInput) => void;
  errors: Partial<Record<keyof CardInput, string>>;
  terms: CardConfiguration | null;
  disabled: boolean;
  retry: () => void;
}) {
  const brand = cardBrand(value.number);
  return (
    <fieldset className="card-fields" disabled={disabled}>
      <legend>Tu tarjeta</legend>
      <div className="checkout-fields">
        {(
          [
            {
              name: 'number',
              label: 'Número de tarjeta',
              complete: 'cc-number',
              placeholder: 'Número de tarjeta',
              max: 23,
            },
            {
              name: 'holder',
              label: 'Nombre en la tarjeta',
              complete: 'cc-name',
              placeholder: 'Como aparece en tu tarjeta',
              max: 100,
            },
            {
              name: 'expiry',
              label: 'Vencimiento',
              complete: 'cc-exp',
              placeholder: 'MM/AA',
              max: 5,
            },
            {
              name: 'cvc',
              label: 'Código de seguridad',
              complete: 'cc-csc',
              placeholder: 'CVC',
              max: 3,
            },
          ] as const
        ).map((field) => (
          <div
            className={`form-field ${field.name === 'number' || field.name === 'holder' ? 'form-field--wide' : ''}`}
            key={field.name}
          >
            <label className="field-label" htmlFor={`card-${field.name}`}>
              {field.label}
            </label>
            <div
              className={
                field.name === 'number' ? 'card-number-control' : undefined
              }
            >
              <input
                id={`card-${field.name}`}
                name={`card-${field.name}`}
                value={value[field.name]}
                type={field.name === 'cvc' ? 'password' : 'text'}
                inputMode={field.name === 'holder' ? 'text' : 'numeric'}
                autoComplete={field.complete}
                placeholder={field.placeholder}
                maxLength={field.max}
                required
                aria-invalid={Boolean(errors[field.name])}
                aria-describedby={
                  errors[field.name] ? `card-error-${field.name}` : undefined
                }
                onChange={(e) => {
                  let next = e.target.value;
                  if (field.name === 'holder')
                    next = next.replace(/[^\p{L}\p{M} .’'-]/gu, '');
                  if (field.name === 'number')
                    next = next
                      .replace(/\D/g, '')
                      .slice(0, 19)
                      .replace(/(.{4})/g, '$1 ')
                      .trim();
                  if (field.name === 'expiry') {
                    const digits = next.replace(/\D/g, '').slice(0, 4);
                    next =
                      digits.length > 2
                        ? digits.slice(0, 2) + '/' + digits.slice(2)
                        : digits;
                  }
                  onChange({ ...value, [field.name]: next });
                }}
              />
              {field.name === 'number' && (
                <span
                  className="card-number-brand"
                  role="status"
                  aria-label={
                    brand
                      ? `Tarjeta ${brand} detectada`
                      : 'Marca de tarjeta sin identificar'
                  }
                >
                  {brand && (
                    <img
                      key={brand}
                      src={`/images/payments/${brand === 'VISA' ? 'visa' : 'mastercard'}.svg`}
                      alt={brand === 'VISA' ? 'Visa' : 'Mastercard'}
                      width="42"
                      height="26"
                    />
                  )}
                </span>
              )}
            </div>
            {errors[field.name] && (
              <p className="field-error" id={`card-error-${field.name}`}>
                {errors[field.name]}
              </p>
            )}
          </div>
        ))}
        <AtelierSelect
          label="Cuotas"
          name="installments"
          value={String(value.installments)}
          options={[1, 2, 3, 6, 12, 18, 24, 36].map((n) => ({
            value: String(n),
            label: n === 1 ? '1 cuota' : `${n} cuotas`,
          }))}
          disabled={disabled}
          onChange={(v) => onChange({ ...value, installments: Number(v) })}
        />
      </div>
      <p className="card-security-note">
        Tu tarjeta se cifra y tokeniza directamente con Wompi. No guardamos su
        número ni código de seguridad.
      </p>
      {terms ? (
        <div className="card-consents">
          {(
            [
              {
                name: 'privacyAccepted',
                text: 'Acepto la política de privacidad',
                url: terms.privacyUrl,
              },
              {
                name: 'personalDataAccepted',
                text: 'Autorizo el tratamiento de mis datos personales',
                url: terms.personalDataUrl,
              },
            ] as const
          ).map((c) => (
            <div key={c.name}>
              <label>
                <input
                  type="checkbox"
                  name={`card-${c.name}`}
                  aria-invalid={Boolean(errors[c.name])}
                  aria-describedby={
                    errors[c.name] ? `card-error-${c.name}` : undefined
                  }
                  checked={value[c.name]}
                  onChange={(e) =>
                    onChange({ ...value, [c.name]: e.target.checked })
                  }
                />
                <span>
                  {c.text}{' '}
                  <a href={c.url} target="_blank" rel="noreferrer">
                    de Wompi
                  </a>
                  .
                </span>
              </label>
              {errors[c.name] && (
                <p className="field-error" id={`card-error-${c.name}`}>
                  {errors[c.name]}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card-terms-unavailable" role="status">
          <p>Estamos conectando con el servicio de pago.</p>
          <button type="button" className="text-button" onClick={retry}>
            Volver a conectar
          </button>
        </div>
      )}
    </fieldset>
  );
}
