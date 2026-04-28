import './WorkerModeBadge.css';

export type WorkerMode = 'ephemeral' | 'stateful';

export interface WorkerModeBadgeProps {
  mode: WorkerMode;
  className?: string;
}

const MODE_LABEL: Record<WorkerMode, string> = {
  ephemeral: 'Ephemeral',
  stateful: 'Stateful',
};

const ChipIcon = ({ mode }: { mode: WorkerMode }) =>
  mode === 'stateful' ? (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5c3.59 0 6.5 1.12 6.5 2.5v8c0 1.38-2.91 2.5-6.5 2.5S1.5 13.38 1.5 12V4c0-1.38 2.91-2.5 6.5-2.5zm0 1C5.24 2.5 3 3.34 3 4s2.24 1.5 5 1.5 5-.84 5-1.5-2.24-1.5-5-1.5z" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 1.5A4.5 4.5 0 113.5 8 4.5 4.5 0 018 3.5z" />
    </svg>
  );

export function WorkerModeBadge({ mode, className }: WorkerModeBadgeProps) {
  return (
    <span
      className={`worker-mode-badge worker-mode-badge--${mode}${className ? ` ${className}` : ''}`}
      aria-label={`Worker mode: ${MODE_LABEL[mode]}`}
    >
      <ChipIcon mode={mode} />
      {MODE_LABEL[mode]}
    </span>
  );
}
