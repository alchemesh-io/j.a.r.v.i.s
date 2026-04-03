import type { HTMLAttributes } from 'react';
import { IconButton } from '../IconButton/IconButton';
import './TaskCard.css';

export interface TaskCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  type: 'refinement' | 'implementation' | 'review';
  status: 'created' | 'done';
  jiraTicketId?: string;
  jiraProjectUrl?: string;
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

const JiraIcon = () => (
  <svg width="14" height="14" viewBox="0 0 128 128" aria-hidden="true">
    <defs>
      <linearGradient id="jira-a" gradientUnits="userSpaceOnUse" x1="22.034" y1="9.773" x2="17.118" y2="14.842" gradientTransform="scale(4)"><stop offset=".176" stopColor="#0052cc"/><stop offset="1" stopColor="#2684ff"/></linearGradient>
      <linearGradient id="jira-b" gradientUnits="userSpaceOnUse" x1="16.641" y1="15.564" x2="10.957" y2="21.094" gradientTransform="scale(4)"><stop offset=".176" stopColor="#0052cc"/><stop offset="1" stopColor="#2684ff"/></linearGradient>
    </defs>
    <path d="M108.023 16H61.805c0 11.52 9.324 20.848 20.847 20.848h8.5v8.226c0 11.52 9.328 20.848 20.848 20.848V19.977A3.98 3.98 0 00108.023 16zm0 0" fill="#2684ff"/>
    <path d="M85.121 39.04H38.902c0 11.519 9.325 20.847 20.844 20.847h8.504v8.226c0 11.52 9.328 20.848 20.848 20.848V43.016a3.983 3.983 0 00-3.977-3.977zm0 0" fill="url(#jira-a)"/>
    <path d="M62.219 62.078H16c0 11.524 9.324 20.848 20.848 20.848h8.5v8.23c0 11.52 9.328 20.844 20.847 20.844V66.059a3.984 3.984 0 00-3.976-3.98zm0 0" fill="url(#jira-b)"/>
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
  jiraProjectUrl,
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
        <h4 className="jads-task-card__title">
          {displayTitle}
          {jiraTicketId && jiraProjectUrl && (
            <a
              href={`${jiraProjectUrl}/browse/${jiraTicketId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="jads-task-card__jira-link"
              aria-label={`Open JIRA ticket ${jiraTicketId}`}
              onClick={(e) => e.stopPropagation()}
            >
              <JiraIcon />
            </a>
          )}
        </h4>
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
