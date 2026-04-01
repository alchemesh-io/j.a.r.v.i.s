import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Button contents */
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`jads-button jads-button--${variant} ${loading ? 'jads-button--loading' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="jads-button__spinner" aria-hidden="true" />
      )}
      <span className={loading ? 'jads-button__content--hidden' : ''}>
        {children}
      </span>
    </button>
  );
}
