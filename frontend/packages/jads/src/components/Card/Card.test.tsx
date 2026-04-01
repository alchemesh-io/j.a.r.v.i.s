import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children content', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Card title="My Card">Content</Card>);
    expect(screen.getByRole('heading', { level: 3, name: 'My Card' })).toBeInTheDocument();
  });

  it('does not render header when no title', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.querySelector('.jads-card__header')).not.toBeInTheDocument();
  });

  it('applies the card class', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass('jads-card');
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="custom">Content</Card>);
    expect(container.firstChild).toHaveClass('jads-card');
    expect(container.firstChild).toHaveClass('custom');
  });

  it('passes through HTML attributes', () => {
    render(<Card data-testid="my-card">Content</Card>);
    expect(screen.getByTestId('my-card')).toBeInTheDocument();
  });
});
