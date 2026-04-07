import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard/Dashboard';
import TaskBoard from './pages/TaskBoard/TaskBoard';
import KeyFocusBoard from './pages/KeyFocusBoard/KeyFocusBoard';
import Reports from './pages/Reports/Reports';
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

function BoardNav() {
  const location = useLocation();
  return (
    <div className="board-nav" role="tablist" aria-label="Board navigation">
      {BOARD_TABS.map((tab) => (
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ParticlesBackground />
        <div className="app">
          <header className="app-header">
            <Link to="/" className="logo" aria-label="J.A.R.V.I.S">
              J.A.R.V.I.S
            </Link>
            <nav aria-label="Main navigation">
              <Link to="/">Dashboard</Link>
              <Link to="/tasks">Tasks</Link>
            </nav>
          </header>

          <main className="app-main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<><BoardNav /><TaskBoard /></>} />
              <Route path="/key-focuses" element={<><BoardNav /><KeyFocusBoard /></>} />
              <Route path="/reports" element={<><BoardNav /><Reports /></>} />
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
