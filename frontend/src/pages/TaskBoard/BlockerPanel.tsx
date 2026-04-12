import { useState, useEffect } from 'react';
import { IconButton, Button } from '@jarvis/jads';
import type { Blocker } from '../../api/client';
import './BlockerPanel.css';

interface BlockerPanelProps {
  title: string;
  blockers: Blocker[];
  onClose: () => void;
  onCreate: (title: string) => void;
  onResolve: (blockerId: number) => void;
  onDelete: (blockerId: number) => void;
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ResolveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function BlockerPanel({ title, blockers, onClose, onCreate, onResolve, onDelete }: BlockerPanelProps) {
  const [newTitle, setNewTitle] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleCreate() {
    if (!newTitle.trim()) return;
    onCreate(newTitle.trim());
    setNewTitle('');
  }

  function handleDelete(blockerId: number) {
    onDelete(blockerId);
    setDeletingId(null);
  }

  const opened = blockers.filter((b) => b.status === 'opened');
  const resolved = blockers.filter((b) => b.status === 'resolved');

  return (
    <div className="blocker-panel-overlay" onClick={onClose}>
      <aside className="blocker-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Blockers — ${title}`}>
        <header className="blocker-panel__header">
          <h3 className="blocker-panel__title">Blockers — {title}</h3>
          <IconButton aria-label="Close blockers panel" variant="ghost" size="sm" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </header>

        <div className="blocker-panel__create">
          <input
            className="blocker-panel__input"
            placeholder="New blocker title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <Button onClick={handleCreate} disabled={!newTitle.trim()}>
            Add
          </Button>
        </div>

        <div className="blocker-panel__list">
          {blockers.length === 0 && (
            <p className="blocker-panel__empty">No blockers yet.</p>
          )}

          {opened.map((blocker) => (
            <div key={blocker.id} className="blocker-panel__item blocker-panel__item--opened">
              {deletingId === blocker.id ? (
                <div className="blocker-panel__confirm">
                  <p>Delete this blocker?</p>
                  <div className="blocker-panel__confirm-actions">
                    <Button onClick={() => handleDelete(blocker.id)}>Delete</Button>
                    <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="blocker-panel__item-indicator" />
                  <span className="blocker-panel__item-title">{blocker.title}</span>
                  <div className="blocker-panel__item-actions">
                    <IconButton aria-label="Resolve blocker" variant="ghost" size="sm" onClick={() => onResolve(blocker.id)}>
                      <ResolveIcon />
                    </IconButton>
                    <IconButton aria-label="Delete blocker" variant="ghost" size="sm" onClick={() => setDeletingId(blocker.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </div>
                </>
              )}
            </div>
          ))}

          {resolved.length > 0 && opened.length > 0 && (
            <div className="blocker-panel__separator">Resolved</div>
          )}

          {resolved.map((blocker) => (
            <div key={blocker.id} className="blocker-panel__item blocker-panel__item--resolved">
              {deletingId === blocker.id ? (
                <div className="blocker-panel__confirm">
                  <p>Delete this blocker?</p>
                  <div className="blocker-panel__confirm-actions">
                    <Button onClick={() => handleDelete(blocker.id)}>Delete</Button>
                    <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="blocker-panel__item-indicator blocker-panel__item-indicator--resolved" />
                  <span className="blocker-panel__item-title">{blocker.title}</span>
                  <div className="blocker-panel__item-actions">
                    <IconButton aria-label="Delete blocker" variant="ghost" size="sm" onClick={() => setDeletingId(blocker.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
