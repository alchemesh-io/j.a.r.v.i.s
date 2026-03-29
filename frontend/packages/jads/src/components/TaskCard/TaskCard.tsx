import type { HTMLAttributes } from 'react';
import { IconButton } from '../IconButton/IconButton';
import './TaskCard.css';

export interface TaskCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Task title */
  title: string;
  /** Task type determines the left border color */
  type: 'refinement' | 'implementation' | 'review';
  /** Task status - done tasks appear dimmed */
  status: 'created' | 'done';
  /** Optional JIRA ticket ID displayed as a badge */
  jiraTicketId?: string;
  /** Callback when the edit action is triggered */
  onEdit?: () => void;
  /** Callback when the delete action is triggered */
  onDelete?: () => void;
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

export function TaskCard({
  title,
  type,
  status,
  jiraTicketId,
  onEdit,
  onDelete,
  className = '',
  ...props
}: TaskCardProps) {
  const isDone = status === 'done';

  return (
    <article
      className={`jads-task-card jads-task-card--${type} ${isDone ? 'jads-task-card--done' : ''} ${className}`.trim()}
      {...props}
    >
      <div className="jads-task-card__content">
        <div className="jads-task-card__header">
          <h4 className="jads-task-card__title">{title}</h4>
          {jiraTicketId && (
            <span className="jads-task-card__badge">
              {jiraTicketId}
            </span>
          )}
        </div>
      </div>
      {(onEdit || onDelete) && (
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
      )}
    </article>
  );
}
