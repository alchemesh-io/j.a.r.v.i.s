import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { KeyFocusCard } from './KeyFocusCard';

describe('KeyFocusCard', () => {
  it('renders the title', () => {
    render(<KeyFocusCard title="Ship the graph view" kind="delivery" status="in_progress" frequency="weekly" />);
    expect(screen.getByRole('heading', { name: 'Ship the graph view' })).toBeInTheDocument();
  });

  it('renders as an article element', () => {
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="weekly" />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('applies status class', () => {
    render(<KeyFocusCard title="KF" kind="delivery" status="succeed" frequency="weekly" />);
    expect(screen.getByRole('article').className).toContain('jads-key-focus-card--succeed');
  });

  it('renders the kind badge', () => {
    render(<KeyFocusCard title="KF" kind="side_quest" status="in_progress" frequency="weekly" />);
    expect(screen.getByText('side quest')).toBeInTheDocument();
  });

  it('renders the frequency badge', () => {
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="quarterly" />);
    expect(screen.getByText('quarterly')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<KeyFocusCard title="KF" description="Some details" kind="delivery" status="in_progress" frequency="weekly" />);
    expect(screen.getByText('Some details')).toBeInTheDocument();
  });

  it('truncates long descriptions', () => {
    const long = 'x'.repeat(150);
    render(<KeyFocusCard title="KF" description={long} kind="delivery" status="in_progress" frequency="weekly" />);
    expect(screen.getByText(`${'x'.repeat(100)}...`)).toBeInTheDocument();
  });

  it('renders the period label when provided', () => {
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="weekly" periodLabel="Mar 30 - Apr 5" />);
    expect(screen.getByText('Mar 30 - Apr 5')).toBeInTheDocument();
  });

  it('renders task count', () => {
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="weekly" taskCount={3} />);
    expect(screen.getByText('3 tasks')).toBeInTheDocument();
  });

  it('uses singular task label for one task', () => {
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="weekly" taskCount={1} />);
    expect(screen.getByText('1 task')).toBeInTheDocument();
  });

  it('does not render actions when no handlers are given', () => {
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="weekly" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onEdit when the edit button is clicked', async () => {
    const onEdit = vi.fn();
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="weekly" onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: /edit key focus/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when the delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="weekly" onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /delete key focus/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders the blocker badge when blockerCount > 0', () => {
    render(<KeyFocusCard title="KF" kind="delivery" status="in_progress" frequency="weekly" blockerCount={2} onBlockers={() => {}} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
