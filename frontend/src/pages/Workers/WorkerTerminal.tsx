import { useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { WorkerBrain } from '@jarvis/jads';
import { getWorkerLogsUrl, listWorkers, listTasks, type TerminalMode, type Worker, type Task } from '../../api/client';
import { useTerminalSession, STATE_LABELS } from '../../hooks/useTerminalSession';
import './WorkerTerminal.css';

// Pod-state-driven gating, mirrors Workers.tsx: only these states have a live
// pod a terminal can actually attach to.
const POD_LIVE_STATES = new Set(['working', 'waiting_for_human', 'initialized']);
const isActive = (s: string) => POD_LIVE_STATES.has(s);

export default function WorkerTerminal() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode: TerminalMode = searchParams.get('mode') === 'shell' ? 'shell' : 'terminal';

  const { containerRef, connState } = useTerminalSession({ workerId: id, mode });

  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: listWorkers, refetchInterval: 5000 });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => listTasks() });

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const aActive = isActive(a.effective_state) ? 0 : 1;
      const bActive = isActive(b.effective_state) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [workers]);

  return (
    <div className="worker-terminal-page">
      <aside className="worker-terminal-sidebar">
        <div className="worker-terminal-sidebar__header">Workers</div>
        <div className="worker-terminal-sidebar__list">
          {sortedWorkers.map((w: Worker) => {
            const task = tasks.find((t: Task) => t.id === w.task_id);
            const active = isActive(w.effective_state);
            const current = w.id === id;
            return (
              <button
                key={w.id}
                type="button"
                className={`worker-terminal-sidebar__item${current ? ' worker-terminal-sidebar__item--current' : ''}`}
                disabled={!active}
                title={!active ? `Worker is ${w.effective_state} — no live terminal` : undefined}
                onClick={() => navigate(`/workers/${w.id}/terminal`)}
              >
                <span className="worker-terminal-sidebar__brain">
                  <WorkerBrain state={w.effective_state} />
                </span>
                <span className="worker-terminal-sidebar__info">
                  <span className="worker-terminal-sidebar__title">
                    {w.is_main ? 'J.A.R.V.I.S Main Brain' : (task?.source_id ? `[${task.source_id}] ` : '') + (task?.title ?? `Task #${w.task_id}`)}
                  </span>
                  <span className="worker-terminal-sidebar__id">{w.id.slice(0, 8)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="worker-terminal">
        <header className="worker-terminal__bar">
          <Link to="/workers" className="worker-terminal__back">← Workers</Link>
          <span className="worker-terminal__title">
            {mode === 'shell' ? 'Shell' : 'Claude session'} · {id.slice(0, 12)}
          </span>
          <span className={`worker-terminal__status worker-terminal__status--${connState}`} role="status">
            {STATE_LABELS[connState]}
          </span>
          <span className="worker-terminal__actions">
            {mode === 'terminal' && (
              <Link
                to={`/workers/${id}/terminal?mode=shell`}
                target="_blank"
                className="worker-terminal__action"
              >
                Shell ↗
              </Link>
            )}
            <a
              href={getWorkerLogsUrl(id)}
              target="_blank"
              rel="noopener noreferrer"
              className="worker-terminal__action"
            >
              Logs ↗
            </a>
          </span>
        </header>
        <div ref={containerRef} className="worker-terminal__screen" />
      </div>
    </div>
  );
}
