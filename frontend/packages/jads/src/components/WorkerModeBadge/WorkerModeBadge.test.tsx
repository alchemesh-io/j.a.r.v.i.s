import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkerModeBadge } from './WorkerModeBadge';

describe('WorkerModeBadge', () => {
  it('renders the Ephemeral label for mode=ephemeral', () => {
    render(<WorkerModeBadge mode="ephemeral" />);
    expect(screen.getByText('Ephemeral')).toBeInTheDocument();
  });

  it('renders the Stateful label for mode=stateful', () => {
    render(<WorkerModeBadge mode="stateful" />);
    expect(screen.getByText('Stateful')).toBeInTheDocument();
  });

  it('exposes an aria-label describing the mode', () => {
    render(<WorkerModeBadge mode="stateful" />);
    expect(screen.getByLabelText('Worker mode: Stateful')).toBeInTheDocument();
  });

  it('applies a mode-specific CSS class', () => {
    const { container } = render(<WorkerModeBadge mode="stateful" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('worker-mode-badge--stateful');
  });
});
