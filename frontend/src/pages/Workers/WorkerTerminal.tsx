import { useParams, useSearchParams, Link } from 'react-router';
import { getWorkerLogsUrl, type TerminalMode } from '../../api/client';
import { useTerminalSession, STATE_LABELS } from '../../hooks/useTerminalSession';
import './WorkerTerminal.css';

export default function WorkerTerminal() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const mode: TerminalMode = searchParams.get('mode') === 'shell' ? 'shell' : 'terminal';

  const { containerRef, connState } = useTerminalSession({ workerId: id, mode });

  return (
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
  );
}
