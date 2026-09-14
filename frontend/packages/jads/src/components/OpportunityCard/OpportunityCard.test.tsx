import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { OpportunityCard } from './OpportunityCard';

describe('OpportunityCard', () => {
  it('renders the title', () => {
    render(<OpportunityCard title="Improve AI area" />);
    expect(screen.getByRole('heading', { name: 'Improve AI area' })).toBeInTheDocument();
  });

  it('renders as an article element', () => {
    render(<OpportunityCard title="Opp" />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<OpportunityCard title="Opp" description="Grow the AI capabilities" />);
    expect(screen.getByText('Grow the AI capabilities')).toBeInTheDocument();
  });

  it('truncates long descriptions', () => {
    const long = 'x'.repeat(150);
    render(<OpportunityCard title="Opp" description={long} />);
    expect(screen.getByText(`${'x'.repeat(100)}...`)).toBeInTheDocument();
  });

  it('renders key focus and task counts', () => {
    render(<OpportunityCard title="Opp" keyFocusCount={2} taskCount={5} />);
    expect(screen.getByText('2 key focuses')).toBeInTheDocument();
    expect(screen.getByText('5 tasks')).toBeInTheDocument();
  });

  it('uses singular labels for a count of one', () => {
    render(<OpportunityCard title="Opp" keyFocusCount={1} taskCount={1} />);
    expect(screen.getByText('1 key focus')).toBeInTheDocument();
    expect(screen.getByText('1 task')).toBeInTheDocument();
  });

  it('does not render actions when no handlers are given', () => {
    render(<OpportunityCard title="Opp" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onEdit when the edit button is clicked', async () => {
    const onEdit = vi.fn();
    render(<OpportunityCard title="Opp" onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: /edit opportunity/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when the delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(<OpportunityCard title="Opp" onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /delete opportunity/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
