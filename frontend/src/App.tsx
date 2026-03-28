import './App.css'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="logo" aria-label="J.A.R.V.I.S">J.A.R.V.I.S</span>
        <nav aria-label="Main navigation">
          <a href="/">Dashboard</a>
          <a href="/agents">Agents</a>
          <a href="/settings">Settings</a>
        </nav>
      </header>

      <main className="app-main">
        <section className="hero" aria-labelledby="hero-heading">
          <h1 id="hero-heading">J.A.R.V.I.S</h1>
          <p>Just A Rather Very Intelligent System — your multi-agent personal assistant platform.</p>
        </section>

        <div className="status-card" role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>System online — all services nominal</span>
        </div>
      </main>

      <footer className="app-footer">
        <p>J.A.R.V.I.S &copy; {new Date().getFullYear()} — Alchemesh IO</p>
      </footer>
    </div>
  )
}
