import type { HTMLAttributes } from 'react';
import { IconButton } from '../IconButton/IconButton';
import './KeyFocusCard.css';

export type KeyFocusKind = 'delivery' | 'learning' | 'support' | 'operational' | 'side_quest';
export type KeyFocusStatus = 'in_progress' | 'succeed' | 'failed';
export type KeyFocusFrequency = 'weekly' | 'quarterly';

export interface KeyFocusCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  description?: string | null;
  kind: KeyFocusKind;
  status: KeyFocusStatus;
  frequency: KeyFocusFrequency;
  periodLabel?: string;
  taskCount?: number;
  blockerCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onBlockers?: () => void;
}

const KIND_COLORS: Record<KeyFocusKind, string> = {
  delivery: '#3b82f6',
  learning: '#22c55e',
  support: '#a855f7',
  operational: '#f97316',
  side_quest: '#06b6d4',
};

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

const BlockerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 5V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function KeyFocusCard({
  title,
  description,
  kind,
  status,
  frequency,
  periodLabel,
  taskCount = 0,
  blockerCount = 0,
  onEdit,
  onDelete,
  onBlockers,
  className = '',
  ...props
}: KeyFocusCardProps) {
  return (
    <article
      className={`jads-key-focus-card jads-key-focus-card--${status} ${className}`.trim()}
      {...props}
    >
      <div className="jads-key-focus-card__header">
        <span className="jads-key-focus-card__kind-badge" style={{ backgroundColor: KIND_COLORS[kind] }}>
          {kind.replace('_', ' ')}
        </span>
        <span className={`jads-key-focus-card__status jads-key-focus-card__status--${status}`}>
          {status === 'in_progress' && '●'}
          {status === 'succeed' && '✓'}
          {status === 'failed' && '✕'}
        </span>
      </div>
      <h4 className="jads-key-focus-card__title">{title}</h4>
      {description && (
        <p className="jads-key-focus-card__description">
          {description.length > 100 ? description.slice(0, 100) + '...' : description}
        </p>
      )}
      <div className="jads-key-focus-card__meta">
        <span className="jads-key-focus-card__freq-badge">{frequency}</span>
        {periodLabel && <span className="jads-key-focus-card__period">{periodLabel}</span>}
        <span className="jads-key-focus-card__task-count">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
      </div>
      {(onEdit || onDelete || onBlockers) && (
        <div className="jads-key-focus-card__actions">
          {onEdit && (
            <IconButton aria-label={`Edit key focus: ${title}`} variant="ghost" size="sm" onClick={onEdit}>
              <EditIcon />
            </IconButton>
          )}
          {onDelete && (
            <IconButton aria-label={`Delete key focus: ${title}`} variant="ghost" size="sm" onClick={onDelete}>
              <DeleteIcon />
            </IconButton>
          )}
          {onBlockers && (
            <IconButton aria-label={`Blockers: ${title}`} variant="ghost" size="sm" onClick={onBlockers} className="jads-key-focus-card__blockers-btn">
              <BlockerIcon />
              {blockerCount > 0 && <span className="jads-key-focus-card__blocker-badge">{blockerCount}</span>}
            </IconButton>
          )}
        </div>
      )}
    </article>
  );
}
