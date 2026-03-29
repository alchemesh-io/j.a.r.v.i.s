import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Calendar } from './Calendar';

describe('Calendar', () => {
  const defaultDate = new Date(2026, 2, 15); // March 15, 2026

  it('renders the calendar grid', () => {
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);
    expect(screen.getByRole('grid', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('displays the correct month and year', () => {
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });

  it('renders day-of-week headers', () => {
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);
    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(7);
    expect(columnHeaders[0]).toHaveTextContent('Sun');
    expect(columnHeaders[6]).toHaveTextContent('Sat');
  });

  it('renders 42 day cells (6 rows of 7)', () => {
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);
    const gridcells = screen.getAllByRole('gridcell');
    expect(gridcells).toHaveLength(42);
  });

  it('marks the selected date with aria-selected', () => {
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);
    const selectedCells = screen.getAllByRole('gridcell').filter(
      (cell) => cell.getAttribute('aria-selected') === 'true',
    );
    expect(selectedCells).toHaveLength(1);
    expect(selectedCells[0]).toHaveTextContent('15');
  });

  it('calls onDateSelect when a day is clicked', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    render(<Calendar selectedDate={defaultDate} onDateSelect={handleSelect} />);

    // Click day 20
    const day20 = screen.getAllByRole('gridcell').find(
      (cell) => cell.textContent === '20' && cell.className.includes('jads-calendar__day--other-month') === false,
    );
    expect(day20).toBeDefined();
    await user.click(day20!);
    expect(handleSelect).toHaveBeenCalledOnce();

    const selectedDate = handleSelect.mock.calls[0][0] as Date;
    expect(selectedDate.getDate()).toBe(20);
    expect(selectedDate.getMonth()).toBe(2); // March
    expect(selectedDate.getFullYear()).toBe(2026);
  });

  it('navigates to previous month', async () => {
    const user = userEvent.setup();
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('February 2026')).toBeInTheDocument();
  });

  it('navigates to next month', async () => {
    const user = userEvent.setup();
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('April 2026')).toBeInTheDocument();
  });

  it('wraps from January to December of previous year', async () => {
    const user = userEvent.setup();
    const janDate = new Date(2026, 0, 15); // January 2026
    render(<Calendar selectedDate={janDate} onDateSelect={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('December 2025')).toBeInTheDocument();
  });

  it('wraps from December to January of next year', async () => {
    const user = userEvent.setup();
    const decDate = new Date(2026, 11, 15); // December 2026
    render(<Calendar selectedDate={decDate} onDateSelect={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('January 2027')).toBeInTheDocument();
  });

  it('has navigation buttons that are keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);

    const prevButton = screen.getByRole('button', { name: 'Previous month' });
    prevButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText('February 2026')).toBeInTheDocument();
  });

  it('uses aria-live on month/year heading for screen readers', () => {
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);
    const heading = screen.getByText('March 2026');
    expect(heading).toHaveAttribute('aria-live', 'polite');
  });

  it('provides accessible labels on day cells', () => {
    render(<Calendar selectedDate={defaultDate} onDateSelect={() => {}} />);
    const selectedCell = screen.getAllByRole('gridcell').find(
      (cell) => cell.getAttribute('aria-selected') === 'true',
    );
    const label = selectedCell?.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label).toContain('March');
    expect(label).toContain('15');
    expect(label).toContain('2026');
  });
});
