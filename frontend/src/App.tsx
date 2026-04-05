import { BrowserRouter, Routes, Route, Link } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard/Dashboard';
import TaskBoard from './pages/TaskBoard/TaskBoard';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/jarvis">
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
              <Route path="/tasks" element={<TaskBoard />} />
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
