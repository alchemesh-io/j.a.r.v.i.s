import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@jarvis/jads';
import { getMainWorker, restartWorker } from '../../api/client';
import { useTerminalSession, STATE_LABELS } from '../../hooks/useTerminalSession';
import './MainBrainTerminal.css';

const RECOVERABLE_STATES = new Set(['error', 'stopped']);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

interface MainBrainTerminalProps {
  open: boolean;
  onClose: () => void;
}

export default function MainBrainTerminal({ open, onClose }: MainBrainTerminalProps) {
  const queryClient = useQueryClient();

  // Kept mounted regardless of `open` (see CSS) so the WebSocket connection
  // and xterm scrollback survive close/reopen — a reattach replays the full
  // pod log (up to 10MB, see backend/app/services/terminal.py), which would
  // be wasteful to repeat every time the panel is toggled.
  const { data: mainWorker, isError } = useQuery({
    queryKey: ['worker', 'main'],
    queryFn: getMainWorker,
    retry: 3,
    refetchInterval: 15000,
  });

  const { containerRef, connState } = useTerminalSession({
    workerId: mainWorker?.id,
    enabled: !!mainWorker,
    fontSize: 13,
  });

  const restartMutation = useMutation({
    mutationFn: () => restartWorker(mainWorker!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker', 'main'] }),
  });

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const canRestart = mainWorker && RECOVERABLE_STATES.has(mainWorker.effective_state);

  return (
    <div
      className={`main-brain-terminal-overlay${open ? ' main-brain-terminal-overlay--open' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="main-brain-terminal" role="dialog" aria-label="Main brain terminal">
        <header className="main-brain-terminal__bar">
          <span className="main-brain-terminal__label">MAIN BRAIN</span>
          {mainWorker && (
            <span
              className={`main-brain-terminal__status main-brain-terminal__status--${connState}`}
              role="status"
            >
              {STATE_LABELS[connState]}
            </span>
          )}
          <span className="main-brain-terminal__actions">
            {canRestart && (
              <Button
                variant="ghost"
                className="main-brain-terminal__restart"
                onClick={() => restartMutation.mutate()}
                disabled={restartMutation.isPending}
              >
                Restart
              </Button>
            )}
            <button
              type="button"
              className="main-brain-terminal__toggle"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </span>
        </header>
        {isError && !mainWorker ? (
          <div className="main-brain-terminal__empty">Main brain not provisioned</div>
        ) : (
          <div ref={containerRef} className="main-brain-terminal__screen" />
        )}
      </div>
    </div>
  );
}
