import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { getWorkerTerminalWsUrl, getWorkerLogsUrl, type TerminalMode } from '../../api/client';
import './WorkerTerminal.css';

type ConnState = 'connecting' | 'starting' | 'running' | 'stopped' | 'error' | 'disconnected';

const STATE_LABELS: Record<ConnState, string> = {
  connecting: 'Connecting…',
  starting: 'Starting…',
  running: 'Live',
  stopped: 'Stopped',
  error: 'Error',
  disconnected: 'Reconnecting…',
};

// Server-reported terminal states: once one of these arrives, the session is
// over and the client must not reconnect.
const FINAL_STATES: ReadonlySet<string> = new Set(['stopped', 'error']);

const MAX_RECONNECT_DELAY_MS = 10_000;

function openHttpLink(uri: string) {
  if (/^https?:\/\//i.test(uri)) window.open(uri, '_blank', 'noopener,noreferrer');
}

export default function WorkerTerminal() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const mode: TerminalMode = searchParams.get('mode') === 'shell' ? 'shell' : 'terminal';

  const containerRef = useRef<HTMLDivElement>(null);
  const [connState, setConnState] = useState<ConnState>('connecting');

  useEffect(() => {
    if (!id || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      scrollback: 5000,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
      theme: {
        background: '#0a0e1a',
        foreground: '#e2e8f0',
        cursor: '#00d4ff',
        selectionBackground: '#2d3748',
      },
      linkHandler: { activate: (_e, uri) => openHttpLink(uri) },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon((_e, uri) => openHttpLink(uri)));
    term.open(containerRef.current);
    fit.fit();

    const encoder = new TextEncoder();
    let ws: WebSocket | null = null;
    let disposed = false;
    let finalState = false;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const sendResize = () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    const connect = () => {
      if (disposed || finalState) return;
      ws = new WebSocket(getWorkerTerminalWsUrl(id, mode));
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        reconnectDelay = 1000;
        setConnState('running');
        sendResize();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'status') {
              setConnState(msg.status as ConnState);
              if (FINAL_STATES.has(msg.status)) finalState = true;
            }
          } catch {
            // ignore malformed control frames
          }
          return;
        }
        const data = new Uint8Array(event.data as ArrayBuffer);
        if (data.length > 0) term.write(data);
      };

      ws.onclose = () => {
        if (disposed) return;
        if (finalState) return; // server said stopped/error — leave the badge as-is
        setConnState('disconnected');
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      };
    };

    const dataSub = term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(encoder.encode(data));
    });
    const resizeSub = term.onResize(sendResize);
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(containerRef.current);

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      observer.disconnect();
      dataSub.dispose();
      resizeSub.dispose();
      ws?.close();
      term.dispose();
    };
  }, [id, mode]);

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
