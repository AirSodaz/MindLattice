import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { classNames } from './classNames';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'draft';
export type ButtonSize = 'default' | 'small' | 'icon';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className,
  disabled,
  icon,
  loading = false,
  size = 'default',
  type = 'button',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames(
        'ml-button',
        `ml-button-${variant}`,
        size === 'small' && 'ml-button-small',
        size === 'icon' && 'ml-button-icon',
        loading && 'ml-button-loading',
        className,
      )}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <span className="ml-button-spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
