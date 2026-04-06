import './EmptyState.css';

interface EmptyStateProps {
  scope: 'daily' | 'weekly' | 'all';
  date: string;
}

const MESSAGES: Record<EmptyStateProps['scope'], { title: string; sub: string }> = {
  daily:  { title: 'No tasks scheduled',     sub: 'Nothing assigned for this day.' },
  weekly: { title: 'Clear week ahead',        sub: 'No tasks found for this week.' },
  all:    { title: 'Task board is empty',     sub: 'Start by creating your first task.' },
};

export function EmptyState({ scope }: EmptyStateProps) {
  const { title, sub } = MESSAGES[scope];

  return (
    <div className="empty-state">
      <div className="empty-state__visual" aria-hidden="true">
        {/* Outer scanning ring */}
        <svg className="empty-state__ring" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="88" stroke="rgba(0,212,255,0.12)" strokeWidth="1"/>
          <circle cx="100" cy="100" r="64" stroke="rgba(0,212,255,0.08)" strokeWidth="1" strokeDasharray="4 8"/>
          <circle cx="100" cy="100" r="40" stroke="rgba(0,212,255,0.15)" strokeWidth="1.5"/>
          {/* Scan sweep arc */}
          <path
            className="empty-state__scan"
            d="M100 100 L100 12"
            stroke="rgba(0,212,255,0.5)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Cross-hairs */}
          <line x1="60"  y1="100" x2="80"  y2="100" stroke="rgba(0,212,255,0.25)" strokeWidth="1"/>
          <line x1="120" y1="100" x2="140" y2="100" stroke="rgba(0,212,255,0.25)" strokeWidth="1"/>
          <line x1="100" y1="60"  x2="100" y2="80"  stroke="rgba(0,212,255,0.25)" strokeWidth="1"/>
          <line x1="100" y1="120" x2="100" y2="140" stroke="rgba(0,212,255,0.25)" strokeWidth="1"/>
          {/* Center dot */}
          <circle cx="100" cy="100" r="3" fill="rgba(0,212,255,0.4)"/>
          {/* Corner brackets */}
          <path d="M18 40 L18 18 L40 18"  stroke="rgba(0,212,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <path d="M160 18 L182 18 L182 40" stroke="rgba(0,212,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <path d="M18 160 L18 182 L40 182" stroke="rgba(0,212,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <path d="M182 160 L182 182 L160 182" stroke="rgba(0,212,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>

        {/* Scope icon */}
        <div className="empty-state__icon">
          {scope === 'daily' && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 2V5M16 2V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="7" y="13" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.6"/>
            </svg>
          )}
          {scope === 'weekly' && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 2V5M16 2V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="7"  y="13" width="2" height="2" rx="0.3" fill="currentColor" opacity="0.4"/>
              <rect x="11" y="13" width="2" height="2" rx="0.3" fill="currentColor" opacity="0.4"/>
              <rect x="15" y="13" width="2" height="2" rx="0.3" fill="currentColor" opacity="0.4"/>
            </svg>
          )}
          {scope === 'all' && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
        </div>
      </div>

      <div className="empty-state__text">
        <h3 className="empty-state__title">{title}</h3>
        <p className="empty-state__sub">{sub}</p>
      </div>
    </div>
  );
}
