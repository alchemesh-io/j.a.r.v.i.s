import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@jarvis/jads';
import {
  listWorkers,
  listRepositories,
  listTasks,
  createWorker,
  createRepository,
  deleteWorker,
  deleteRepository,
  type Worker,
  type Repository,
  type Task,
  type WorkerState,
} from '../../api/client';
import './Workers.css';

const STATE_LABELS: Record<WorkerState, string> = {
  initialized: 'Initialized',
  working: 'Working',
  waiting_for_human: 'Waiting',
  done: 'Done',
  archived: 'Archived',
};

const WORKER_HOST = 'jaw.jarvis.io';

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

  // --- Data queries ---
  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: listWorkers });
  const { data: repos = [] } = useQuery({ queryKey: ['repositories'], queryFn: listRepositories });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => listTasks() });

  // --- Repository panel state ---
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');
  const [repoError, setRepoError] = useState('');

  // --- Create worker state ---
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | ''>('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>([]);
  const [createError, setCreateError] = useState('');

  // --- Mutations ---
  const addRepoMutation = useMutation({
    mutationFn: createRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      setRepoUrl('');
      setRepoBranch('main');
      setRepoError('');
    },
    onError: (err: Error) => setRepoError(err.message.includes('409') ? 'Repository already exists' : err.message),
  });

  const deleteRepoMutation = useMutation({
    mutationFn: deleteRepository,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repositories'] }),
    onError: (err: Error) => setRepoError(err.message.includes('409') ? 'Repository in use by active worker' : err.message),
  });

  const createWorkerMutation = useMutation({
    mutationFn: createWorker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      resetCreateForm();
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const deleteWorkerMutation = useMutation({
    mutationFn: deleteWorker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // --- Handlers ---
  const handleAddRepo = useCallback(() => {
    if (!repoUrl.trim()) return;
    addRepoMutation.mutate({ git_url: repoUrl.trim(), branch: repoBranch || 'main' });
  }, [repoUrl, repoBranch, addRepoMutation]);

  const resetCreateForm = useCallback(() => {
    setShowCreate(false);
    setSelectedTaskId('');
    setSelectedRepoIds([]);
    setCreateError('');
  }, []);

  const handleCreateWorker = useCallback(() => {
    if (!selectedTaskId) return;
    createWorkerMutation.mutate({
      task_id: selectedTaskId as number,
      repository_ids: selectedRepoIds,
    });
  }, [selectedTaskId, selectedRepoIds, createWorkerMutation]);

  const handleDeleteWorker = useCallback(
    (e: React.MouseEvent, workerId: string) => {
      e.stopPropagation();
      if (confirm('Delete this worker? This will remove the pod and all associated resources.')) {
        deleteWorkerMutation.mutate(workerId);
      }
    },
    [deleteWorkerMutation],
  );

  const handleCardClick = useCallback((workerId: string) => {
    window.open(`http://${WORKER_HOST}/${workerId}`, '_blank');
  }, []);

  const toggleRepoId = useCallback((id: number) => {
    setSelectedRepoIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }, []);

  // Tasks without workers (for create form)
  const availableTasks = tasks.filter((t: Task) => !t.worker);

  return (
    <div className="workers">
      {/* Header */}
      <div className="workers__header">
        <h2 className="workers__title">Workers</h2>
        <Button onClick={() => setShowCreate(true)}>+ New Worker</Button>
      </div>

      {/* Repository Panel */}
      <div className="workers__repo-panel">
        <button
          className={`workers__repo-toggle${repoOpen ? ' workers__repo-toggle--open' : ''}`}
          onClick={() => setRepoOpen(!repoOpen)}
        >
          <span>Repositories ({repos.length})</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>

        {repoOpen && (
          <div className="workers__repo-content">
            <div className="workers__repo-form">
              <div className="workers__repo-form-field">
                <label>Git URL</label>
                <input
                  type="text"
                  placeholder="https://github.com/org/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                />
              </div>
              <div className="workers__repo-form-field workers__repo-form-field--branch">
                <label>Branch</label>
                <input
                  type="text"
                  placeholder="main"
                  value={repoBranch}
                  onChange={(e) => setRepoBranch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                />
              </div>
              <Button onClick={handleAddRepo}>Add</Button>
            </div>
            {repoError && <div className="workers__error">{repoError}</div>}

            {repos.length === 0 ? (
              <p className="workers__repo-empty">No repositories yet</p>
            ) : (
              <div className="workers__repo-list">
                {repos.map((repo: Repository) => (
                  <div key={repo.id} className="workers__repo-chip">
                    <span>{repo.git_url}</span>
                    <span className="workers__repo-chip-branch">@{repo.branch}</span>
                    <button onClick={() => deleteRepoMutation.mutate(repo.id)} title="Delete">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Worker Grid */}
      {workers.length === 0 ? (
        <div className="workers__empty">No workers running. Create one to get started.</div>
      ) : (
        <div className="workers__grid">
          {workers.map((worker: Worker) => {
            const task = tasks.find((t: Task) => t.id === worker.task_id);
            return (
              <article
                key={worker.id}
                className="worker-card"
                onClick={() => handleCardClick(worker.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(worker.id)}
              >
                <button
                  className="worker-card__delete"
                  onClick={(e) => handleDeleteWorker(e, worker.id)}
                  title="Delete worker"
                >
                  &times;
                </button>
                <div className="worker-card__header">
                  <span className="worker-card__id">{worker.id.slice(0, 8)}...</span>
                  <span className="worker-card__type">{worker.type.replace('_', ' ')}</span>
                </div>
                <div className="worker-card__task-title">
                  {task?.title ?? `Task #${worker.task_id}`}
                </div>
                <div className="worker-card__footer">
                  <div className="worker-card__state">
                    <span className={`worker-card__state-dot worker-card__state-dot--${worker.effective_state}`} />
                    <span className="worker-card__state-label">
                      {STATE_LABELS[worker.effective_state]}
                    </span>
                  </div>
                  <span className="worker-card__time">{formatTime(worker.created_at)}</span>
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
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select a task...</option>
                {availableTasks.map((t: Task) => (
                  <option key={t.id} value={t.id}>
                    {t.source_id ? `[${t.source_id}] ` : ''}{t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="workers__create-field">
              <label>Repositories</label>
              {repos.length === 0 ? (
                <p className="workers__repo-empty">Add repositories above first</p>
              ) : (
                <div className="workers__repo-checkboxes">
                  {repos.map((repo: Repository) => (
                    <label key={repo.id} className="workers__repo-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRepoIds.includes(repo.id)}
                        onChange={() => toggleRepoId(repo.id)}
                      />
                      {repo.git_url} @{repo.branch}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {createError && <div className="workers__error">{createError}</div>}

            <div className="workers__create-actions">
              <Button onClick={resetCreateForm}>Cancel</Button>
              <Button onClick={handleCreateWorker} disabled={!selectedTaskId}>
                Create Worker
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
