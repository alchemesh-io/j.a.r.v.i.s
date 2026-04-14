import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import Dashboard from './pages/Dashboard/Dashboard';
import TaskBoard from './pages/TaskBoard/TaskBoard';
import KeyFocusBoard from './pages/KeyFocusBoard/KeyFocusBoard';
import Reports from './pages/Reports/Reports';
import Workers from './pages/Workers/Workers';
import Repositories from './pages/Repositories/Repositories';
import ParticlesBackground from './components/ParticlesBackground';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const BOARD_TABS = [
  { path: '/tasks', label: 'Tasks' },
  { path: '/key-focuses', label: 'Key Focuses' },
  { path: '/reports', label: 'Reports' },
];

const WORKER_TABS = [
  { path: '/workers', label: 'Workers' },
  { path: '/repositories', label: 'Repositories' },
];

function InvalidateOnRouteChange() {
  const location = useLocation();
  const qc = useQueryClient();
  const prevPath = useRef(location.pathname);
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      qc.invalidateQueries();
    }
  }, [location.pathname, qc]);
  return null;
}

function TabNav({ tabs }: { tabs: { path: string; label: string }[] }) {
  const location = useLocation();
  return (
    <div className="board-nav" role="tablist" aria-label="Board navigation">
      {tabs.map((tab) => (
        <Link
          key={tab.path}
          to={tab.path}
          role="tab"
          aria-selected={location.pathname === tab.path}
          className={`board-nav__tab${location.pathname === tab.path ? ' board-nav__tab--active' : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function BoardNav() {
  return <TabNav tabs={BOARD_TABS} />;
}

function WorkerNav() {
  return <TabNav tabs={WORKER_TABS} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <InvalidateOnRouteChange />
        <ParticlesBackground />
        <div className="app">
          <header className="app-header">
            <Link to="/" className="logo" aria-label="J.A.R.V.I.S">
              J.A.R.V.I.S
            </Link>
            <nav aria-label="Main navigation">
              <Link to="/">Dashboard</Link>
              <Link to="/tasks">Tasks</Link>
              <Link to="/workers">Workers</Link>
            </nav>
          </header>

          <main className="app-main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<><BoardNav /><TaskBoard /></>} />
              <Route path="/key-focuses" element={<><BoardNav /><KeyFocusBoard /></>} />
              <Route path="/reports" element={<><BoardNav /><Reports /></>} />
              <Route path="/workers" element={<><WorkerNav /><Workers /></>} />
              <Route path="/repositories" element={<><WorkerNav /><Repositories /></>} />
            </Routes>
          </main>

          <footer className="app-footer">
            <p>J.A.R.V.I.S &copy; {new Date().getFullYear()} — Alchemesh IO</p>
          </footer>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
