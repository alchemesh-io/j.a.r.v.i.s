import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from './TaskCard';

describe('TaskCard', () => {
  it('renders the task title', () => {
    render(<TaskCard title="Fix login bug" type="review" status="created" />);
    expect(screen.getByRole('heading', { name: 'Fix login bug' })).toBeInTheDocument();
  });

  it('renders title with JIRA prefix when sourceType=jira and sourceId provided', () => {
    render(<TaskCard title="Fix login" type="review" status="created" sourceType="jira" sourceId="JAR-42" />);
    expect(screen.getByRole('heading', { name: '[JAR-42] - Fix login' })).toBeInTheDocument();
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

  it('renders type badge', () => {
    render(<TaskCard title="Task" type="implementation" status="created" />);
    expect(screen.getByText('implementation')).toBeInTheDocument();
  });

  // --- Dates ---

  it('renders date chips when dates provided', () => {
    render(<TaskCard title="Task" type="review" status="created" dates={['2026-03-29', '2026-03-30']} />);
    expect(screen.getByText('Mar 29')).toBeInTheDocument();
    expect(screen.getByText('Mar 30')).toBeInTheDocument();
  });

  it('does not render dates section when dates empty', () => {
    const { container } = render(<TaskCard title="Task" type="review" status="created" dates={[]} />);
    expect(container.querySelector('.jads-task-card__dates')).not.toBeInTheDocument();
  });

  it('does not render dates section when dates undefined', () => {
    const { container } = render(<TaskCard title="Task" type="review" status="created" />);
    expect(container.querySelector('.jads-task-card__dates')).not.toBeInTheDocument();
  });

  // --- Status toggle ---

  it('renders check button when onToggleStatus provided', () => {
    const handleToggle = vi.fn();
    render(<TaskCard title="My Task" type="review" status="created" onToggleStatus={handleToggle} />);
    expect(screen.getByRole('button', { name: 'Complete task: My Task' })).toBeInTheDocument();
  });

  it('renders undo button for done tasks', () => {
    const handleToggle = vi.fn();
    render(<TaskCard title="My Task" type="review" status="done" onToggleStatus={handleToggle} />);
    expect(screen.getByRole('button', { name: 'Reopen task: My Task' })).toBeInTheDocument();
  });

  it('calls onToggleStatus when status button clicked', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();
    render(<TaskCard title="My Task" type="review" status="created" onToggleStatus={handleToggle} />);
    await user.click(screen.getByRole('button', { name: 'Complete task: My Task' }));
    expect(handleToggle).toHaveBeenCalledOnce();
  });

  it('does not render status button when no onToggleStatus', () => {
    render(<TaskCard title="Task" type="review" status="created" />);
    expect(screen.queryByRole('button', { name: /Complete task|Reopen task/ })).not.toBeInTheDocument();
  });

  // --- Edit / Delete ---

  it('renders edit button when onEdit provided', () => {
    const handleEdit = vi.fn();
    render(<TaskCard title="My Task" type="refinement" status="created" onEdit={handleEdit} />);
    expect(screen.getByRole('button', { name: 'Edit task: My Task' })).toBeInTheDocument();
  });

  it('renders delete button when onDelete provided', () => {
    const handleDelete = vi.fn();
    render(<TaskCard title="My Task" type="refinement" status="created" onDelete={handleDelete} />);
    expect(screen.getByRole('button', { name: 'Delete task: My Task' })).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();
    render(<TaskCard title="My Task" type="refinement" status="created" onEdit={handleEdit} />);
    await user.click(screen.getByRole('button', { name: 'Edit task: My Task' }));
    expect(handleEdit).toHaveBeenCalledOnce();
  });

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();
    render(<TaskCard title="My Task" type="refinement" status="created" onDelete={handleDelete} />);
    await user.click(screen.getByRole('button', { name: 'Delete task: My Task' }));
    expect(handleDelete).toHaveBeenCalledOnce();
  });

  it('does not render action buttons when no callbacks', () => {
    render(<TaskCard title="Task" type="refinement" status="created" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // --- JIRA deep-link ---

  it('renders JIRA link when sourceType=jira, sourceId, and jiraProjectUrl are provided', () => {
    render(
      <TaskCard
        title="Fix login"
        type="review"
        status="created"
        sourceType="jira" sourceId="JAR-42"
        jiraProjectUrl="https://myorg.atlassian.net"
      />,
    );
    const link = screen.getByRole('link', { name: 'Open JIRA ticket JAR-42' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://myorg.atlassian.net/browse/JAR-42');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not render JIRA link when sourceId is missing', () => {
    render(
      <TaskCard
        title="Fix login"
        type="review"
        status="created"
        jiraProjectUrl="https://myorg.atlassian.net"
      />,
    );
    expect(screen.queryByRole('link', { name: /Open JIRA ticket/ })).not.toBeInTheDocument();
  });

  it('does not render JIRA link when jiraProjectUrl is missing (sourceType=jira)', () => {
    render(
      <TaskCard
        title="Fix login"
        type="review"
        status="created"
        sourceType="jira" sourceId="JAR-42"
      />,
    );
    expect(screen.queryByRole('link', { name: /Open JIRA ticket/ })).not.toBeInTheDocument();
  });
});
