import { type SelectHTMLAttributes, useId, forwardRef } from 'react';
import './Select.css';

export interface SelectOption {
  /** Value submitted with the form */
  value: string;
  /** Display text shown to the user */
  label: string;
  /** Whether this option is disabled */
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  /** Label text displayed above the select */
  label: string;
  /** Available options */
  options: SelectOption[];
  /** Placeholder text shown when no value is selected */
  placeholder?: string;
  /** Error message displayed below the select */
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    options,
    placeholder,
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
    <div className={`jads-select-wrapper ${error ? 'jads-select-wrapper--error' : ''} ${className}`.trim()}>
      <label htmlFor={id} className="jads-select__label">
        {label}
      </label>
      <div className="jads-select__container">
        <select
          ref={ref}
          id={id}
          className="jads-select"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <span className="jads-select__chevron" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {error && (
        <p id={errorId} className="jads-select__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
