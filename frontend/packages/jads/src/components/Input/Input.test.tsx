import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('renders with a label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders as a text input by default', () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('type', 'text');
  });

  it('accepts user input', async () => {
    const user = userEvent.setup();
    render(<Input label="Name" />);

    const input = screen.getByLabelText('Name');
    await user.type(input, 'John');
    expect(input).toHaveValue('John');
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Invalid email address" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email address');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('associates error message via aria-describedby', () => {
    render(<Input label="Email" error="Required" />);
    const input = screen.getByLabelText('Email');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const errorEl = document.getElementById(describedBy!);
    expect(errorEl).toHaveTextContent('Required');
  });

  it('renders placeholder text', () => {
    render(<Input label="Search" placeholder="Type to search..." />);
    expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument();
  });

  it('supports disabled state', () => {
    render(<Input label="Name" disabled />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });

  it('uses provided id for label association', () => {
    render(<Input label="Custom" id="custom-input" />);
    const input = screen.getByLabelText('Custom');
    expect(input).toHaveAttribute('id', 'custom-input');
  });
});
