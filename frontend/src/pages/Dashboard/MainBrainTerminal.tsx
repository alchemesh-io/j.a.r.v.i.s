import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@jarvis/jads';
import { getMainWorker, restartWorker } from '../../api/client';
import { useTerminalSession, STATE_LABELS } from '../../hooks/useTerminalSession';
import './MainBrainTerminal.css';

const RECOVERABLE_STATES = new Set(['error', 'stopped']);

export default function MainBrainTerminal() {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: mainWorker, isError } = useQuery({
    queryKey: ['worker', 'main'],
    queryFn: getMainWorker,
    retry: 3,
    refetchInterval: 15000,
  });

  const { containerRef, connState } = useTerminalSession({
    workerId: mainWorker?.id,
    enabled: !!mainWorker,
    fontSize: 12,
  });

  const restartMutation = useMutation({
    mutationFn: () => restartWorker(mainWorker!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker', 'main'] }),
  });

  const canRestart = mainWorker && RECOVERABLE_STATES.has(mainWorker.effective_state);

  return (
    <div className={`main-brain-terminal${expanded ? ' main-brain-terminal--expanded' : ''}`}>
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
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '⤡' : '⤢'}
          </button>
        </span>
      </header>
      {isError && !mainWorker ? (
        <div className="main-brain-terminal__empty">Main brain not provisioned</div>
      ) : (
        <div ref={containerRef} className="main-brain-terminal__screen" />
      )}
    </div>
  );
}
