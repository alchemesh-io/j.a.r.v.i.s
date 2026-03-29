import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { IconButton } from './IconButton';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

describe('IconButton', () => {
  it('renders with accessible label', () => {
    render(<IconButton aria-label="Close"><CloseIcon /></IconButton>);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('applies ghost variant by default', () => {
    render(<IconButton aria-label="Close"><CloseIcon /></IconButton>);
    expect(screen.getByRole('button').className).toContain('jads-icon-button--ghost');
  });

  it('applies outline variant', () => {
    render(<IconButton aria-label="Close" variant="outline"><CloseIcon /></IconButton>);
    expect(screen.getByRole('button').className).toContain('jads-icon-button--outline');
  });

  it('applies size classes', () => {
    render(<IconButton aria-label="Close" size="sm"><CloseIcon /></IconButton>);
    expect(screen.getByRole('button').className).toContain('jads-icon-button--sm');
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<IconButton aria-label="Close" onClick={handleClick}><CloseIcon /></IconButton>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does not fire click when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<IconButton aria-label="Close" disabled onClick={handleClick}><CloseIcon /></IconButton>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('has type="button" by default', () => {
    render(<IconButton aria-label="Close"><CloseIcon /></IconButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('is keyboard accessible', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<IconButton aria-label="Close" onClick={handleClick}><CloseIcon /></IconButton>);

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
