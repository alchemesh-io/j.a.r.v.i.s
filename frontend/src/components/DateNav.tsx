import './DateNav.css';

interface DateNavProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  scope?: 'daily' | 'weekly' | 'quarterly' | 'all';
}

function stepDate(date: Date, direction: 1 | -1, scope: string): Date {
  const d = new Date(date);
  if (scope === 'quarterly') {
    d.setMonth(d.getMonth() + direction * 3);
  } else if (scope === 'weekly') {
    d.setDate(d.getDate() + direction * 7);
  } else {
    d.setDate(d.getDate() + direction);
  }
  return d;
}

export function DateNavPrev({ selectedDate, onDateChange, scope = 'daily' }: DateNavProps) {
  return (
    <button type="button" className="date-nav__btn" onClick={() => onDateChange(stepDate(selectedDate, -1, scope))} title="Previous">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}

export function DateNavNext({ selectedDate, onDateChange, scope = 'daily' }: DateNavProps) {
  return (
    <button type="button" className="date-nav__btn" onClick={() => onDateChange(stepDate(selectedDate, 1, scope))} title="Next">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}

export function DateNavToday({ selectedDate, onDateChange }: DateNavProps) {
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  return (
    <button
      type="button"
      className={`date-nav__today${isToday ? ' date-nav__today--active' : ''}`}
      onClick={() => onDateChange(new Date())}
    >
      Today
    </button>
  );
}
