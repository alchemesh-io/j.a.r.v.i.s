import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './IconButton.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: 'ghost' | 'outline';
  /** Size of the button */
  size?: 'sm' | 'md';
  /** Accessible label (required since the button only contains an icon) */
  'aria-label': string;
  /** Icon element to render */
  children: ReactNode;
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  children,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`jads-icon-button jads-icon-button--${variant} jads-icon-button--${size} ${className}`.trim()}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
