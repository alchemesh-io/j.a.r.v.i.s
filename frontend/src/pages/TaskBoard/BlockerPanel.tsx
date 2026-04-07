import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@jarvis/jads';
import {
  listTaskBlockers,
  createTaskBlocker,
  updateBlocker,
  deleteBlocker,
  type Task,
  type Blocker,
} from '../../api/client';
import './BlockerPanel.css';

interface BlockerPanelProps {
  task: Task;
  onClose: () => void;
}

export function BlockerPanel({ task, onClose }: BlockerPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const { data: blockers = [] } = useQuery({
    queryKey: ['task-blockers', task.id],
    queryFn: () => listTaskBlockers(task.id),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => createTaskBlocker(task.id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-blockers', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTitle('');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (blockerId: number) => updateBlocker(blockerId, { status: 'resolved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-blockers', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBlocker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-blockers', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <div className="blocker-panel">
      <div className="blocker-panel__header">
        <h3>Blockers — {task.title}</h3>
        <button type="button" className="blocker-panel__close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="blocker-panel__list">
        {blockers.length === 0 && <p className="blocker-panel__empty">No blockers</p>}
        {blockers.map((b: Blocker) => (
          <div key={b.id} className={`blocker-panel__item blocker-panel__item--${b.status}`}>
            <span className="blocker-panel__item-title">{b.title}</span>
            <div className="blocker-panel__item-actions">
              {b.status === 'opened' && (
                <button type="button" className="blocker-panel__resolve-btn" onClick={() => resolveMutation.mutate(b.id)}>
                  Resolve
                </button>
              )}
              <button type="button" className="blocker-panel__delete-btn" onClick={() => deleteMutation.mutate(b.id)} aria-label="Delete blocker">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="blocker-panel__form">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New blocker..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) {
              createMutation.mutate(title.trim());
            }
          }}
        />
        <Button
          variant="primary"
          onClick={() => { if (title.trim()) createMutation.mutate(title.trim()); }}
          disabled={!title.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
