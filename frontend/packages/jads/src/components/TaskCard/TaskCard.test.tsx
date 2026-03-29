import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from './TaskCard';

describe('TaskCard', () => {
  it('renders the task title', () => {
    render(<TaskCard title="Fix login bug" type="review" status="created" />);
    expect(screen.getByRole('heading', { name: 'Fix login bug' })).toBeInTheDocument();
  });

  it('renders as an article element', () => {
    render(<TaskCard title="Task" type="refinement" status="created" />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('applies refinement type class', () => {
    render(<TaskCard title="Task" type="refinement" status="created" />);
    expect(screen.getByRole('article').className).toContain('jads-task-card--refinement');
  });

  it('applies implementation type class', () => {
    render(<TaskCard title="Task" type="implementation" status="created" />);
    expect(screen.getByRole('article').className).toContain('jads-task-card--implementation');
  });

  it('applies review type class', () => {
    render(<TaskCard title="Task" type="review" status="created" />);
    expect(screen.getByRole('article').className).toContain('jads-task-card--review');
  });

  it('applies done state class', () => {
    render(<TaskCard title="Task" type="refinement" status="done" />);
    expect(screen.getByRole('article').className).toContain('jads-task-card--done');
  });

  it('does not apply done class for created status', () => {
    render(<TaskCard title="Task" type="refinement" status="created" />);
    expect(screen.getByRole('article').className).not.toContain('jads-task-card--done');
  });

  it('renders JIRA ticket ID badge when provided', () => {
    render(<TaskCard title="Task" type="refinement" status="created" jiraTicketId="JAR-42" />);
    expect(screen.getByText('JAR-42')).toBeInTheDocument();
  });

  it('does not render badge when no JIRA ticket ID', () => {
    const { container } = render(<TaskCard title="Task" type="refinement" status="created" />);
    expect(container.querySelector('.jads-task-card__badge')).not.toBeInTheDocument();
  });

  it('renders edit button when onEdit is provided', () => {
    const handleEdit = vi.fn();
    render(<TaskCard title="My Task" type="refinement" status="created" onEdit={handleEdit} />);
    expect(screen.getByRole('button', { name: 'Edit task: My Task' })).toBeInTheDocument();
  });

  it('renders delete button when onDelete is provided', () => {
    const handleDelete = vi.fn();
    render(<TaskCard title="My Task" type="refinement" status="created" onDelete={handleDelete} />);
    expect(screen.getByRole('button', { name: 'Delete task: My Task' })).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();
    render(<TaskCard title="My Task" type="refinement" status="created" onEdit={handleEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit task: My Task' }));
    expect(handleEdit).toHaveBeenCalledOnce();
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();
    render(<TaskCard title="My Task" type="refinement" status="created" onDelete={handleDelete} />);

    await user.click(screen.getByRole('button', { name: 'Delete task: My Task' }));
    expect(handleDelete).toHaveBeenCalledOnce();
  });

  it('does not render action buttons when no callbacks', () => {
    const { container } = render(<TaskCard title="Task" type="refinement" status="created" />);
    expect(container.querySelector('.jads-task-card__actions')).not.toBeInTheDocument();
  });
});
