import type { HTMLAttributes } from 'react';
import { IconButton } from '../IconButton/IconButton';
import './OpportunityCard.css';

export interface OpportunityCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  description?: string | null;
  keyFocusCount?: number;
  taskCount?: number;
  onEdit?: () => void;
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

const OpportunityIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5L9.8 5.6L14 6.1L10.9 9.1L11.7 13.5L8 11.4L4.3 13.5L5.1 9.1L2 6.1L6.2 5.6L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

export function OpportunityCard({
  title,
  description,
  keyFocusCount = 0,
  taskCount = 0,
  onEdit,
  onDelete,
  className = '',
  ...props
}: OpportunityCardProps) {
  return (
    <article className={`jads-opportunity-card ${className}`.trim()} {...props}>
      <div className="jads-opportunity-card__header">
        <span className="jads-opportunity-card__icon"><OpportunityIcon /></span>
        <h4 className="jads-opportunity-card__title">{title}</h4>
      </div>
      {description && (
        <p className="jads-opportunity-card__description">
          {description.length > 100 ? description.slice(0, 100) + '...' : description}
        </p>
      )}
      <div className="jads-opportunity-card__meta">
        <span className="jads-opportunity-card__key-focus-count">
          {keyFocusCount} key focus{keyFocusCount !== 1 ? 'es' : ''}
        </span>
        <span className="jads-opportunity-card__task-count">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
      </div>
      {(onEdit || onDelete) && (
        <div className="jads-opportunity-card__actions">
          {onEdit && (
            <IconButton aria-label={`Edit opportunity: ${title}`} variant="ghost" size="sm" onClick={onEdit}>
              <EditIcon />
            </IconButton>
          )}
          {onDelete && (
            <IconButton aria-label={`Delete opportunity: ${title}`} variant="ghost" size="sm" onClick={onDelete}>
              <DeleteIcon />
            </IconButton>
          )}
        </div>
      )}
    </article>
  );
}
