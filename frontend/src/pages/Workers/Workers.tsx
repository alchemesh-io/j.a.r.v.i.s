import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, IconButton } from '@jarvis/jads';
import { WorkerBrain } from '@jarvis/jads/src/components/TaskCard/WorkerBrain';
import {
  listWorkers,
  listRepositories,
  listTasks,
  createWorker,
  updateWorker,
  deleteWorker,
  getWorkerVscodeUri,
  type Worker,
  type Repository,
  type Task,
  type WorkerState,
} from '../../api/client';
import './Workers.css';

function extractRepoName(gitUrl: string): string {
  const match = gitUrl.match(/\/([^/]+?)(\.git)?$/);
  return match ? match[1] : gitUrl;
}

function extractOwner(gitUrl: string): string {
  const match = gitUrl.match(/[/:]([^/:]+)\/[^/]+?(?:\.git)?$/);
  return match ? match[1] : '';
}

function isGitHub(gitUrl: string): boolean {
  return gitUrl.includes('github');
}

const GitHubMiniIcon = () => (
  <svg width="16" height="16" viewBox="0 0 98 96" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0112.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
  </svg>
);

const GitBranchIcon = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6a2.5 2.5 0 01-2.5 2.5H7.5V12h.378a2.25 2.25 0 110 1.5H6.5v-5H4.75a1 1 0 01-1-1V5.372a2.25 2.25 0 111.5 0V7.5h5A1 1 0 0011.25 6.5V5.372A2.25 2.25 0 019.5 3.25zM4 2.5a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
  </svg>
);

const STATE_LABELS: Record<WorkerState, string> = {
  initialized: 'Initialized',
  working: 'Working',
  waiting_for_human: 'Waiting',
  done: 'Done',
  archived: 'Archived',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Workers() {
  const queryClient = useQueryClient();

  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: listWorkers, refetchInterval: 5000 });
  const { data: repos = [] } = useQuery({ queryKey: ['repositories'], queryFn: listRepositories });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => listTasks() });

  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | ''>('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>([]);
  const [createError, setCreateError] = useState('');

  const createWorkerMutation = useMutation({
    mutationFn: createWorker,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workers'] }); queryClient.invalidateQueries({ queryKey: ['tasks'] }); resetCreateForm(); },
    onError: (err: Error) => setCreateError(err.message),
  });

  const archiveWorkerMutation = useMutation({
    mutationFn: (workerId: string) => updateWorker(workerId, { state: 'archived' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workers'] }); queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
  });

  const deleteWorkerMutation = useMutation({
    mutationFn: deleteWorker,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workers'] }); queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
  });

  const resetCreateForm = useCallback(() => { setShowCreate(false); setSelectedTaskId(''); setSelectedRepoIds([]); setCreateError(''); }, []);

  const toggleRepoId = useCallback((id: number) => {
    setSelectedRepoIds((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);
  }, []);

  const availableTasks = tasks.filter((t: Task) => !t.worker);
  const isActive = (s: string) => s !== 'archived' && s !== 'done';

  return (
    <div className="workers">
      <div className="workers__header">
        <h2 className="workers__title">Workers</h2>
        <Button onClick={() => setShowCreate(true)}>+ New Worker</Button>
      </div>

      {workers.length === 0 ? (
        <div className="workers__empty">No workers running. Create one to get started.</div>
      ) : (
        <div className="workers__grid">
          {workers.map((worker: Worker) => {
            const task = tasks.find((t: Task) => t.id === worker.task_id);
            return (
              <article key={worker.id} className="worker-card">
                {/* Left: brain + controls */}
                <div className="worker-card__brain-col">
                  <div
                    className={`worker-card__brain${isActive(worker.effective_state) ? '' : ' worker-card__brain--disabled'}`}
                    onClick={isActive(worker.effective_state) ? () => getWorkerVscodeUri(worker.id).then(({ uri }) => { window.location.href = uri; }) : undefined}
                    role={isActive(worker.effective_state) ? 'button' : undefined}
                    tabIndex={isActive(worker.effective_state) ? 0 : undefined}
                  >
                    <WorkerBrain state={worker.effective_state} />
                  </div>
                  <div className="worker-card__controls">
                    {isActive(worker.effective_state) && (
                      <IconButton aria-label="Stop worker" variant="ghost" size="sm" onClick={() => archiveWorkerMutation.mutate(worker.id)} className="worker-card__stop">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" /></svg>
                      </IconButton>
                    )}
                    <IconButton aria-label="Delete worker" variant="ghost" size="sm" onClick={() => { if (confirm('Delete this worker and its resources?')) deleteWorkerMutation.mutate(worker.id); }} className="worker-card__delete-btn">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </IconButton>
                  </div>
                </div>

                {/* Right: details */}
                <div className="worker-card__details">
                  <div className="worker-card__task-title">
                    {task?.source_id ? `[${task.source_id}] ` : ''}{task?.title ?? `Task #${worker.task_id}`}
                  </div>
                  <div className="worker-card__meta">
                    <span className="worker-card__id">{worker.id.slice(0, 12)}</span>
                    <span className="worker-card__type-badge">{worker.type.replace('_', ' ')}</span>
                    <span className="worker-card__time">{formatTime(worker.created_at)}</span>
                  </div>

                  {/* Repositories */}
                  {worker.repositories.length > 0 && (
                    <div className="worker-card__repos">
                      {worker.repositories.map((repo) => (
                        <div key={repo.id} className="worker-card__repo">
                          <span className="worker-card__repo-icon">{isGitHub(repo.git_url) ? <GitHubMiniIcon /> : <GitBranchIcon />}</span>
                          <span className="worker-card__repo-name">{extractOwner(repo.git_url)}/{extractRepoName(repo.git_url)}</span>
                          <span className="worker-card__repo-branch"><GitBranchIcon /> {repo.branch}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create Worker Overlay */}
      {showCreate && (
        <div className="workers__overlay" onClick={resetCreateForm}>
          <div className="workers__create-form" onClick={(e) => e.stopPropagation()}>
            <h3>Create Worker</h3>
            <div className="workers__create-field">
              <label>Task</label>
              <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select a task...</option>
                {availableTasks.map((t: Task) => (
                  <option key={t.id} value={t.id}>{t.source_id ? `[${t.source_id}] ` : ''}{t.title}</option>
                ))}
              </select>
            </div>
            <div className="workers__create-field">
              <label>Repositories</label>
              {repos.length === 0 ? (
                <p className="workers__repo-empty">Add repositories in the Repositories tab first</p>
              ) : (
                <div className="workers__repo-picker">
                  {repos.map((repo: Repository) => {
                    const selected = selectedRepoIds.includes(repo.id);
                    return (
                      <button key={repo.id} type="button" className={`workers__repo-card${selected ? ' workers__repo-card--selected' : ''}`} onClick={() => toggleRepoId(repo.id)}>
                        <span className="workers__repo-card-icon">{isGitHub(repo.git_url) ? <GitHubMiniIcon /> : <GitBranchIcon />}</span>
                        <span className="workers__repo-card-info">
                          <span className="workers__repo-card-name">{extractRepoName(repo.git_url)}</span>
                          {extractOwner(repo.git_url) && <span className="workers__repo-card-owner">{extractOwner(repo.git_url)}</span>}
                        </span>
                        <span className="workers__repo-card-branch"><GitBranchIcon /> {repo.branch}</span>
                        <span className="workers__repo-card-check">{selected ? '✓' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {createError && <div className="workers__error">{createError}</div>}
            <div className="workers__create-actions">
              <Button onClick={resetCreateForm}>Cancel</Button>
              <Button onClick={() => { if (selectedTaskId) createWorkerMutation.mutate({ task_id: selectedTaskId as number, repository_ids: selectedRepoIds }); }} disabled={!selectedTaskId}>Create Worker</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
