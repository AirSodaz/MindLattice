import type { ReactNode } from 'react';

import { classNames } from './classNames';

export type FieldProps = {
  children: ReactNode;
  className?: string;
  error?: ReactNode;
  help?: ReactNode;
  label: ReactNode;
};

export function Field({ children, className, error, help, label }: FieldProps) {
  return (
    <label className={classNames('ml-field', Boolean(error) && 'ml-field-invalid', className)}>
      <span className="ml-field-label">{label}</span>
      {children}
      {help ? <span className="ml-field-help">{help}</span> : null}
      {error ? <span className="ml-field-error">{error}</span> : null}
    </label>
  );
}
