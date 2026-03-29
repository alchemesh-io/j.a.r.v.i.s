import type { HTMLAttributes } from 'react';
import { IconButton } from '../IconButton/IconButton';
import './TaskCard.css';

export interface TaskCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  type: 'refinement' | 'implementation' | 'review';
  status: 'created' | 'done';
  jiraTicketId?: string;
  dates?: string[];
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
  dragListeners?: Record<string, Function>;
}

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 6L2 8L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 8H10C12.2091 8 14 9.79086 14 12V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TaskCard({
  title,
  type,
  status,
  jiraTicketId,
  dates,
  onEdit,
  onDelete,
  onToggleStatus,
  dragListeners,
  className = '',
  ...props
}: TaskCardProps) {
  const isDone = status === 'done';
  const displayTitle = jiraTicketId ? `[${jiraTicketId}] - ${title}` : title;

  return (
    <article
      className={`jads-task-card jads-task-card--${type} ${isDone ? 'jads-task-card--done' : ''} ${className}`.trim()}
      {...props}
    >
      {onToggleStatus && (
        <IconButton
          aria-label={isDone ? `Reopen task: ${title}` : `Complete task: ${title}`}
          variant="ghost"
          size="sm"
          onClick={onToggleStatus}
          className={`jads-task-card__status-btn ${isDone ? 'jads-task-card__status-btn--done' : ''}`}
        >
          {isDone ? <UndoIcon /> : <CheckIcon />}
        </IconButton>
      )}
      <div className="jads-task-card__content" {...dragListeners}>
        <h4 className="jads-task-card__title">{displayTitle}</h4>
      </div>
      {dates && dates.length > 0 && (
        <div className="jads-task-card__dates">
          {dates.map((d) => (
            <span key={d} className="jads-task-card__date">{formatShortDate(d)}</span>
          ))}
        </div>
      )}
      <div className="jads-task-card__footer">
        <div className="jads-task-card__actions">
          {onEdit && (
            <IconButton
              aria-label={`Edit task: ${title}`}
              variant="ghost"
              size="sm"
              onClick={onEdit}
            >
              <EditIcon />
            </IconButton>
          )}
          {onDelete && (
            <IconButton
              aria-label={`Delete task: ${title}`}
              variant="ghost"
              size="sm"
              onClick={onDelete}
            >
              <DeleteIcon />
            </IconButton>
          )}
        </div>
        <span className="jads-task-card__type">{type}</span>
      </div>
    </article>
  );
}
