import { useState, useCallback, useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import { IconButton } from '../IconButton/IconButton';
import './Calendar.css';

export interface CalendarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Currently selected date */
  selectedDate: Date;
  /** Callback when a date is selected */
  onDateSelect: (date: Date) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

function getCalendarDays(year: number, month: number, selectedDate: Date, today: Date): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const days: CalendarDay[] = [];

  // Fill leading days from the previous month
  const prevMonthStart = new Date(year, month, 1 - startOffset);
  for (let i = 0; i < startOffset; i++) {
    const date = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), prevMonthStart.getDate() + i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isSelected: isSameDay(date, selectedDate),
    });
  }

  // Fill current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      isSelected: isSameDay(date, selectedDate),
    });
  }

  // Fill trailing days to complete 6 rows (42 cells)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isSelected: isSameDay(date, selectedDate),
    });
  }

  return days;
}

const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Calendar({
  selectedDate,
  onDateSelect,
  className = '',
  ...props
}: CalendarProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const today = useMemo(() => new Date(), []);

  const days = useMemo(
    () => getCalendarDays(viewYear, viewMonth, selectedDate, today),
    [viewYear, viewMonth, selectedDate, today],
  );

  const handlePrevMonth = useCallback(() => {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const handleDayClick = useCallback(
    (date: Date) => {
      onDateSelect(date);
    },
    [onDateSelect],
  );

  const handleDayKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, date: Date) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDateSelect(date);
      }
    },
    [onDateSelect],
  );

  return (
    <div className={`jads-calendar ${className}`.trim()} {...props}>
      <div className="jads-calendar__header">
        <IconButton
          aria-label="Previous month"
          variant="ghost"
          size="sm"
          onClick={handlePrevMonth}
        >
          <ChevronLeft />
        </IconButton>
        <span className="jads-calendar__month-year" aria-live="polite">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <IconButton
          aria-label="Next month"
          variant="ghost"
          size="sm"
          onClick={handleNextMonth}
        >
          <ChevronRight />
        </IconButton>
      </div>

      <div className="jads-calendar__grid" role="grid" aria-label="Calendar">
        <div className="jads-calendar__weekdays" role="row">
          {DAY_NAMES.map((day) => (
            <div key={day} className="jads-calendar__weekday" role="columnheader" aria-label={day}>
              {day}
            </div>
          ))}
        </div>

        <div className="jads-calendar__days">
          {days.map((day, index) => {
            const cellClasses = [
              'jads-calendar__day',
              !day.isCurrentMonth && 'jads-calendar__day--other-month',
              day.isToday && 'jads-calendar__day--today',
              day.isSelected && 'jads-calendar__day--selected',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={index}
                className={cellClasses}
                type="button"
                role="gridcell"
                aria-selected={day.isSelected}
                aria-label={day.date.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                tabIndex={day.isSelected ? 0 : -1}
                onClick={() => handleDayClick(day.date)}
                onKeyDown={(e) => handleDayKeyDown(e, day.date)}
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
