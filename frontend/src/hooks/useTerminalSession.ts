import { useEffect, useRef, useState, type RefObject } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { getWorkerTerminalWsUrl, type TerminalMode } from '../api/client';

export type ConnState = 'connecting' | 'starting' | 'running' | 'stopped' | 'error' | 'disconnected';

export const STATE_LABELS: Record<ConnState, string> = {
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

/** Guard fit() against a zero-size container (e.g. a collapsed dashboard dock). */
function safeFit(fit: FitAddon, container: HTMLDivElement) {
  if (container.clientWidth === 0 || container.clientHeight === 0) return;
  fit.fit();
}

export interface TerminalSessionOptions {
  workerId: string | undefined;
  mode?: TerminalMode;
  enabled?: boolean;
  fontSize?: number;
}

export interface TerminalSession {
  containerRef: RefObject<HTMLDivElement | null>;
  connState: ConnState;
}

export function useTerminalSession({
  workerId,
  mode = 'terminal',
  enabled = true,
  fontSize = 13,
}: TerminalSessionOptions): TerminalSession {
  const containerRef = useRef<HTMLDivElement>(null);
  const [connState, setConnState] = useState<ConnState>('connecting');

  useEffect(() => {
    if (!enabled || !workerId || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      scrollback: 5000,
      fontSize,
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
    safeFit(fit, containerRef.current);

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
      ws = new WebSocket(getWorkerTerminalWsUrl(workerId, mode));
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
    const observer = new ResizeObserver(() => {
      if (containerRef.current) safeFit(fit, containerRef.current);
    });
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
  }, [workerId, mode, enabled, fontSize]);

  return { containerRef, connState };
}
