import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@jarvis/jads';
import {
  listRepositories,
  createRepository,
  deleteRepository,
  type Repository,
} from '../../api/client';
import './Repositories.css';

function extractRepoName(gitUrl: string): string {
  const match = gitUrl.match(/\/([^/]+?)(\.git)?$/);
  return match ? match[1] : gitUrl;
}

function extractOwner(gitUrl: string): string {
  const match = gitUrl.match(/[/:]([^/:]+)\/[^/]+?(?:\.git)?$/);
  return match ? match[1] : '';
}

function detectPlatform(gitUrl: string): 'github' | 'gitlab' | 'unknown' {
  if (gitUrl.includes('github.com') || gitUrl.includes('github')) return 'github';
  if (gitUrl.includes('gitlab.com') || gitUrl.includes('gitlab')) return 'gitlab';
  return 'unknown';
}

const GITLAB_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/3/35/GitLab_icon.svg';

const GitHubIcon = () => (
  <svg width="28" height="28" viewBox="0 0 98 96" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0112.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
  </svg>
);

const GenericRepoIcon = () => (
  <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor" opacity="0.6">
    <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9z"/>
  </svg>
);

const RepoIcon = ({ gitUrl }: { gitUrl: string }) => {
  const platform = detectPlatform(gitUrl);
  if (platform === 'github') return <GitHubIcon />;
  if (platform === 'gitlab') return <img src={GITLAB_LOGO} alt="GitLab" width="28" height="28" className="repo-card__logo" />;
  return <GenericRepoIcon />;
};

export default function Repositories() {
  const queryClient = useQueryClient();

  const { data: repos = [] } = useQuery({ queryKey: ['repositories'], queryFn: listRepositories });

  const [showForm, setShowForm] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');
  const [error, setError] = useState('');

  const addRepoMutation = useMutation({
    mutationFn: createRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      closeForm();
    },
    onError: (err: Error) => setError(err.message.includes('409') ? 'Repository already exists' : err.message),
  });

  const deleteRepoMutation = useMutation({
    mutationFn: deleteRepository,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repositories'] }),
    onError: (err: Error) => setError(err.message.includes('409') ? 'Repository in use by active worker' : err.message),
  });

  const closeForm = useCallback(() => {
    setShowForm(false);
    setRepoUrl('');
    setRepoBranch('main');
    setError('');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!repoUrl.trim()) return;
    addRepoMutation.mutate({ git_url: repoUrl.trim(), branch: repoBranch || 'main' });
  }, [repoUrl, repoBranch, addRepoMutation]);

  return (
    <div className="repositories">
      <div className="repositories__header">
        <h2 className="repositories__title">Repositories</h2>
        <Button onClick={() => setShowForm(true)}>+ Add Repository</Button>
      </div>

      {error && !showForm && <div className="repositories__error">{error}</div>}

      {repos.length === 0 ? (
        <div className="repositories__empty">No repositories yet. Add one to get started.</div>
      ) : (
        <div className="repositories__grid">
          {repos.map((repo: Repository) => {
            const name = extractRepoName(repo.git_url);
            const owner = extractOwner(repo.git_url);
            const hasActive = (repo.active_worker_count ?? 0) > 0;

            return (
              <article key={repo.id} className={`repo-card${hasActive ? ' repo-card--active' : ''}`}>
                <div className="repo-card__icon">
                  <RepoIcon gitUrl={repo.git_url} />
                </div>

                <div className="repo-card__body">
                  <div className="repo-card__name">{name}</div>
                  {owner && <div className="repo-card__owner">{owner}</div>}
                  <div className="repo-card__branch-row">
                    <span className="repo-card__branch">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6a2.5 2.5 0 01-2.5 2.5H7.5V12h.378a2.25 2.25 0 110 1.5H6.5v-5H4.75a1 1 0 01-1-1V5.372a2.25 2.25 0 111.5 0V7.5h5A1 1 0 0011.25 6.5V5.372A2.25 2.25 0 019.5 3.25zM4 2.5a.75.75 0 100 1.5.75.75 0 000-1.5z" fill="currentColor"/>
                      </svg>
                      {repo.branch}
                    </span>
                    <a className="repo-card__action" href={repo.git_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Open in browser">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M9 2H14V7M14 2L6 10M6 4H3V13H12V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                    <button className="repo-card__action repo-card__action--danger" onClick={() => { if (hasActive) { setError('Repository in use by active worker'); return; } if (confirm(`Delete ${owner}/${name} @${repo.branch}?`)) deleteRepoMutation.mutate(repo.id); }} title="Delete repository">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>

                <div className="repo-card__stats">
                  <div className="repo-card__stat">
                    <span className="repo-card__stat-value">{repo.worker_count ?? 0}</span>
                    <span className="repo-card__stat-label">workers</span>
                  </div>
                  <div className="repo-card__stat">
                    <span className={`repo-card__stat-value${hasActive ? ' repo-card__stat-value--active' : ''}`}>{repo.active_worker_count ?? 0}</span>
                    <span className="repo-card__stat-label">active</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create form overlay */}
      {showForm && (
        <div className="repositories__form-overlay" onClick={closeForm}>
          <div className="repositories__form" onClick={(e) => e.stopPropagation()}>
            <h3>Add Repository</h3>
            <div className="repositories__form-field">
              <label>Git URL</label>
              <input
                type="text"
                placeholder="https://github.com/org/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                autoFocus
              />
            </div>
            <div className="repositories__form-field">
              <label>Branch</label>
              <input
                type="text"
                placeholder="main"
                value={repoBranch}
                onChange={(e) => setRepoBranch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            {error && <div className="repositories__error">{error}</div>}
            <div className="repositories__form-actions">
              <Button onClick={handleSubmit} disabled={!repoUrl.trim()}>Add</Button>
              <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
