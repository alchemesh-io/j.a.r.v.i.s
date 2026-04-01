import { type InputHTMLAttributes, useId, forwardRef } from 'react';
import './Input.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text displayed above the input */
  label: string;
  /** Input type (defaults to text) */
  type?: 'text' | 'email' | 'password' | 'url' | 'search' | 'tel' | 'number';
  /** Error message displayed below the input */
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    type = 'text',
    error,
    id: externalId,
    className = '',
    'aria-describedby': ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const errorId = `${id}-error`;

  const describedBy = [
    error ? errorId : null,
    ariaDescribedBy,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`jads-input-wrapper ${error ? 'jads-input-wrapper--error' : ''} ${className}`.trim()}>
      <label htmlFor={id} className="jads-input__label">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        className="jads-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && (
        <p id={errorId} className="jads-input__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
