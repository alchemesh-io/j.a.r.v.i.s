import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Select } from './Select';

const defaultOptions = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
];

describe('Select', () => {
  it('renders with a label', () => {
    render(<Select label="Framework" options={defaultOptions} />);
    expect(screen.getByLabelText('Framework')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Select label="Framework" options={defaultOptions} />);
    expect(screen.getByRole('option', { name: 'React' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Vue' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Angular' })).toBeInTheDocument();
  });

  it('renders placeholder option', () => {
    render(<Select label="Framework" options={defaultOptions} placeholder="Select one..." />);
    const placeholderOption = screen.getByRole('option', { name: 'Select one...' });
    expect(placeholderOption).toBeDisabled();
  });

  it('handles selection change', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Select label="Framework" options={defaultOptions} onChange={handleChange} />);

    await user.selectOptions(screen.getByLabelText('Framework'), 'vue');
    expect(handleChange).toHaveBeenCalled();
  });

  it('shows error message', () => {
    render(<Select label="Framework" options={defaultOptions} error="Selection required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Selection required');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Select label="Framework" options={defaultOptions} error="Required" />);
    expect(screen.getByLabelText('Framework')).toHaveAttribute('aria-invalid', 'true');
  });

  it('associates error with aria-describedby', () => {
    render(<Select label="Framework" options={defaultOptions} error="Required" />);
    const select = screen.getByLabelText('Framework');
    const describedBy = select.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const errorEl = document.getElementById(describedBy!);
    expect(errorEl).toHaveTextContent('Required');
  });

  it('supports disabled state', () => {
    render(<Select label="Framework" options={defaultOptions} disabled />);
    expect(screen.getByLabelText('Framework')).toBeDisabled();
  });

  it('supports disabled options', () => {
    const options = [
      { value: 'a', label: 'Available' },
      { value: 'b', label: 'Unavailable', disabled: true },
    ];
    render(<Select label="Choice" options={options} />);
    expect(screen.getByRole('option', { name: 'Unavailable' })).toBeDisabled();
  });

  it('has accessible combobox role', () => {
    render(<Select label="Framework" options={defaultOptions} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
