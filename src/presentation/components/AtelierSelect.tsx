import { useId, useEffect, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Icon } from './Icon';
export interface SelectOption {
  value: string;
  label: string;
  shortLabel?: string;
  disabled?: boolean;
}
export function AtelierSelect({
  label,
  accessibleLabel = label,
  value,
  options,
  onChange,
  disabled = false,
  error,
}: {
  label: string;
  accessibleLabel?: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<HTMLDivElement | null>(null);
  // El fondo no recibe foco; al cerrar se restaura solo lo que este menú cambió.
  useEffect(() => {
    if (!open || !menu?.isConnected) return;
    const changed: Element[] = [];
    for (let child: Element = menu; child.parentElement;) {
      const parent: HTMLElement = child.parentElement;
      for (const sibling of parent.children)
        if (sibling !== child && !sibling.hasAttribute('inert')) {
          sibling.setAttribute('inert', '');
          changed.push(sibling);
        }
      if (parent === menu.ownerDocument.body) break;
      child = parent;
    }
    return () => changed.forEach((element) => element.removeAttribute('inert'));
  }, [open, menu]);
  // El portal evita recortes del catálogo; el margen inferior reserva espacio para la navegación móvil.
  return (
    <div className="atelier-select-field">
      <label id={id} className="field-label">
        {label}
      </label>
      <Select.Root
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
      >
        <Select.Trigger
          className="atelier-select-trigger"
          aria-label={accessibleLabel}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <Select.Value>
            {options.find((option) => option.value === value)?.shortLabel}
          </Select.Value>
          <Select.Icon>
            <Icon name="chevron" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            ref={setMenu}
            className="atelier-select-menu"
            position="popper"
            sideOffset={6}
            collisionPadding={{ top: 12, right: 12, bottom: 88, left: 12 }}
            aria-labelledby={id}
          >
            <Select.ScrollUpButton className="atelier-select-scroll">
              <Icon name="chevron" className="rotate-up" />
            </Select.ScrollUpButton>
            <Select.Viewport
              className="atelier-select-options"
              role="group"
              aria-label="Opciones"
              tabIndex={0}
            >
              {options.map((option) => (
                <Select.Item
                  className="atelier-select-option"
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="atelier-select-check">
                    <Icon name="check" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="atelier-select-scroll">
              <Icon name="chevron" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
