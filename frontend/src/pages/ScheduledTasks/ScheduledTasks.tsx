import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, IconButton } from '@jarvis/jads';
import {
  createScheduledTask,
  deleteScheduledTask,
  listRepositories,
  listScheduledTasks,
  listSkills,
  runScheduledTaskNow,
  updateScheduledTask,
  type Repository,
  type ScheduledTask,
  type ScheduledTaskInput,
  type ScheduledTaskStatus,
  type SkillRef,
  type TaskType,
  type WorkerMode,
  type WorkerSessionMode,
} from '../../api/client';
import './ScheduledTasks.css';

function extractRepoName(gitUrl: string): string {
  const match = gitUrl.match(/\/([^/]+?)(\.git)?$/);
  return match ? match[1] : gitUrl;
}

function extractOwner(gitUrl: string): string {
  const match = gitUrl.match(/[/:]([^/:]+)\/[^/]+?(?:\.git)?$/);
  return match ? match[1] : '';
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TASK_TYPE_OPTIONS: TaskType[] = ['implementation', 'refinement', 'review'];
const WORKER_SESSION_MODE_OPTIONS: WorkerSessionMode[] = ['auto', 'plan', 'manual', 'edit'];

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l10-5.5-10-5.5z" /></svg>
);
const PauseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2.5" width="3.5" height="11" /><rect x="9.5" y="2.5" width="3.5" height="11" /></svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11.5 2.5l2 2L5 13l-3 1 1-3z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

interface FormState {
  title: string;
  taskType: TaskType;
  cronExpression: string;
  noteContent: string;
  status: ScheduledTaskStatus;
  repositoryIds: number[];
  skills: SkillRef[];
  workerMode: WorkerMode;
  workerSessionMode: WorkerSessionMode;
}

const EMPTY_FORM: FormState = {
  title: '',
  taskType: 'implementation',
  cronExpression: '',
  noteContent: '',
  status: 'active',
  repositoryIds: [],
  skills: [],
  workerMode: 'ephemeral',
  workerSessionMode: 'auto',
};

function toFormState(scheduledTask: ScheduledTask): FormState {
  return {
    title: scheduledTask.title,
    taskType: scheduledTask.task_type,
    cronExpression: scheduledTask.cron_expression,
    noteContent: scheduledTask.note_content ?? '',
    status: scheduledTask.status,
    repositoryIds: scheduledTask.repositories.map((r) => r.id),
    skills: scheduledTask.skills,
    workerMode: scheduledTask.worker_mode,
    workerSessionMode: scheduledTask.worker_session_mode,
  };
}

function toInput(form: FormState): ScheduledTaskInput {
  return {
    title: form.title.trim(),
    task_type: form.taskType,
    cron_expression: form.cronExpression.trim(),
    note_content: form.noteContent.trim() ? form.noteContent.trim() : null,
    status: form.status,
    repository_ids: form.repositoryIds,
    skills: form.skills,
    worker_mode: form.workerMode,
    worker_session_mode: form.workerSessionMode,
  };
}

export default function ScheduledTasks() {
  const queryClient = useQueryClient();

  const { data: scheduledTasks = [] } = useQuery({
    queryKey: ['scheduled-tasks'],
    queryFn: listScheduledTasks,
    refetchInterval: 15000,
  });
  const { data: repos = [] } = useQuery({ queryKey: ['repositories'], queryFn: listRepositories });
  const { data: availableSkills = [] } = useQuery({ queryKey: ['skills'], queryFn: listSkills });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');

  const skillsByName = useMemo(() => {
    const map = new Map<string, SkillRef[]>();
    for (const skill of availableSkills) {
      const arr = map.get(skill.name) ?? [];
      arr.push(skill);
      map.set(skill.name, arr);
    }
    return map;
  }, [availableSkills]);

  const defaultSkillVersion = useCallback(
    (name: string): SkillRef | undefined => {
      const versions = skillsByName.get(name) ?? [];
      return versions.find((v) => v.is_latest) ?? versions[0];
    },
    [skillsByName],
  );

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }, []);

  const openCreateForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((scheduledTask: ScheduledTask) => {
    setForm(toFormState(scheduledTask));
    setEditingId(scheduledTask.id);
    setError('');
    setShowForm(true);
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: createScheduledTask,
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<ScheduledTaskInput> }) => updateScheduledTask(id, body),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScheduledTask,
    onSuccess: invalidate,
  });

  const runNowMutation = useMutation({
    mutationFn: runScheduledTaskNow,
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['workers'] }); },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ScheduledTaskStatus }) => updateScheduledTask(id, { status }),
    onSuccess: invalidate,
  });

  const toggleRepoId = useCallback((id: number) => {
    setForm((prev) => ({
      ...prev,
      repositoryIds: prev.repositoryIds.includes(id)
        ? prev.repositoryIds.filter((r) => r !== id)
        : [...prev.repositoryIds, id],
    }));
  }, []);

  const toggleSkill = useCallback((name: string) => {
    setForm((prev) => {
      if (prev.skills.some((s) => s.name === name)) {
        return { ...prev, skills: prev.skills.filter((s) => s.name !== name) };
      }
      const def = defaultSkillVersion(name);
      return def ? { ...prev, skills: [...prev.skills, def] } : prev;
    });
  }, [defaultSkillVersion]);

  const handleSubmit = useCallback(() => {
    if (!form.title.trim() || !form.cronExpression.trim()) return;
    const body = toInput(form);
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  }, [form, editingId, createMutation, updateMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="scheduled-tasks">
      <div className="scheduled-tasks__header">
        <h2 className="scheduled-tasks__title">Scheduled Tasks</h2>
        <button type="button" className="create-btn" onClick={openCreateForm}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          New Schedule
        </button>
      </div>

      {scheduledTasks.length === 0 ? (
        <div className="scheduled-tasks__empty">No scheduled tasks yet. Create one to automate recurring work.</div>
      ) : (
        <div className="scheduled-tasks__grid">
          {scheduledTasks.map((scheduledTask: ScheduledTask) => (
            <article key={scheduledTask.id} className={`schedule-card schedule-card--${scheduledTask.status}`}>
              <div className="schedule-card__title-row">
                <h3 className="schedule-card__title">{scheduledTask.title}</h3>
                <span className={`schedule-card__status schedule-card__status--${scheduledTask.status}`}>
                  {scheduledTask.status}
                </span>
              </div>

              <div className="schedule-card__badge-row">
                <span className="schedule-card__badge">{scheduledTask.task_type}</span>
                <span className="schedule-card__badge schedule-card__badge--mono">{scheduledTask.cron_expression}</span>
                <span className="schedule-card__badge">{scheduledTask.worker_mode}</span>
                {scheduledTask.worker_session_mode !== 'auto' && (
                  <span className="schedule-card__badge">{scheduledTask.worker_session_mode}</span>
                )}
              </div>

              {scheduledTask.note_content && (
                <p className="schedule-card__note">{scheduledTask.note_content}</p>
              )}

              {scheduledTask.repositories.length > 0 && (
                <div className="schedule-card__chips">
                  {scheduledTask.repositories.map((repo: Repository) => (
                    <span key={repo.id} className="schedule-card__chip">
                      {extractOwner(repo.git_url)}/{extractRepoName(repo.git_url)}
                    </span>
                  ))}
                </div>
              )}

              {scheduledTask.skills.length > 0 && (
                <div className="schedule-card__chips">
                  {scheduledTask.skills.map((skill) => (
                    <span key={`${skill.name}@${skill.version}`} className="schedule-card__chip schedule-card__chip--skill">
                      {skill.name}@{skill.version}
                    </span>
                  ))}
                </div>
              )}

              <div className="schedule-card__runs">
                <span>Last run: {formatTime(scheduledTask.last_run_at)}</span>
                <span>Next run: {scheduledTask.status === 'active' ? formatTime(scheduledTask.next_run_at) : '—'}</span>
              </div>

              <div className="schedule-card__actions">
                <IconButton
                  aria-label="Run now"
                  variant="ghost"
                  size="sm"
                  onClick={() => runNowMutation.mutate(scheduledTask.id)}
                  disabled={runNowMutation.isPending}
                >
                  <PlayIcon />
                </IconButton>
                <IconButton
                  aria-label={scheduledTask.status === 'active' ? 'Pause schedule' : 'Resume schedule'}
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleStatusMutation.mutate({
                    id: scheduledTask.id,
                    status: scheduledTask.status === 'active' ? 'paused' : 'active',
                  })}
                >
                  {scheduledTask.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
                <IconButton aria-label="Edit schedule" variant="ghost" size="sm" onClick={() => openEditForm(scheduledTask)}>
                  <EditIcon />
                </IconButton>
                <IconButton
                  aria-label="Delete schedule"
                  variant="ghost"
                  size="sm"
                  onClick={() => { if (confirm(`Delete scheduled task "${scheduledTask.title}"?`)) deleteMutation.mutate(scheduledTask.id); }}
                  className="schedule-card__delete"
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="scheduled-tasks__overlay" onClick={closeForm}>
          <div className="scheduled-tasks__form" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId != null ? 'Edit Scheduled Task' : 'New Scheduled Task'}</h3>

            <div className="scheduled-tasks__field">
              <label>Title</label>
              <input
                type="text"
                placeholder="Nightly sync"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="scheduled-tasks__field-row">
              <div className="scheduled-tasks__field">
                <label>Task type</label>
                <select
                  value={form.taskType}
                  onChange={(e) => setForm((prev) => ({ ...prev, taskType: e.target.value as TaskType }))}
                >
                  {TASK_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="scheduled-tasks__field">
                <label>
                  Cron expression
                  <span className="scheduled-tasks__field-help" title="Standard 5-field cron syntax, e.g. '0 20 * * 1,4,5' for Mon/Thu/Fri at 20:00">ⓘ</span>
                </label>
                <input
                  type="text"
                  placeholder="0 20 * * *"
                  value={form.cronExpression}
                  onChange={(e) => setForm((prev) => ({ ...prev, cronExpression: e.target.value }))}
                />
              </div>
            </div>

            <div className="scheduled-tasks__field">
              <label>Note</label>
              <textarea
                placeholder="Context passed to the worker on every run..."
                value={form.noteContent}
                onChange={(e) => setForm((prev) => ({ ...prev, noteContent: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="scheduled-tasks__field-row">
              <div className="scheduled-tasks__field">
                <label>Status</label>
                <div className="scheduled-tasks__toggle" role="radiogroup" aria-label="Schedule status">
                  {(['active', 'paused'] as ScheduledTaskStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={form.status === s}
                      className={`scheduled-tasks__toggle-option${form.status === s ? ' scheduled-tasks__toggle-option--selected' : ''}`}
                      onClick={() => setForm((prev) => ({ ...prev, status: s }))}
                    >
                      {s === 'active' ? 'Active' : 'Paused'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="scheduled-tasks__field">
                <label>Worker mode</label>
                <div className="scheduled-tasks__toggle" role="radiogroup" aria-label="Worker mode">
                  {(['ephemeral', 'stateful'] as WorkerMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={form.workerMode === m}
                      className={`scheduled-tasks__toggle-option${form.workerMode === m ? ' scheduled-tasks__toggle-option--selected' : ''}`}
                      onClick={() => setForm((prev) => ({ ...prev, workerMode: m }))}
                    >
                      {m === 'stateful' ? 'Stateful' : 'Ephemeral'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="scheduled-tasks__field">
              <label>
                Session mode
                <span className="scheduled-tasks__field-help" title="Claude Code permission mode the spawned worker starts in.">ⓘ</span>
              </label>
              <select
                value={form.workerSessionMode}
                onChange={(e) => setForm((prev) => ({ ...prev, workerSessionMode: e.target.value as WorkerSessionMode }))}
              >
                {WORKER_SESSION_MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="scheduled-tasks__field">
              <label>Repositories</label>
              {repos.length === 0 ? (
                <p className="scheduled-tasks__hint">Add repositories in the Repositories tab first</p>
              ) : (
                <div className="scheduled-tasks__picker">
                  {repos.map((repo: Repository) => {
                    const selected = form.repositoryIds.includes(repo.id);
                    return (
                      <button
                        key={repo.id}
                        type="button"
                        className={`scheduled-tasks__picker-item${selected ? ' scheduled-tasks__picker-item--selected' : ''}`}
                        onClick={() => toggleRepoId(repo.id)}
                      >
                        <span>{extractOwner(repo.git_url)}/{extractRepoName(repo.git_url)}</span>
                        <span className="scheduled-tasks__picker-check">{selected ? '✓' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="scheduled-tasks__field">
              <label>Skills</label>
              {skillsByName.size === 0 ? (
                <p className="scheduled-tasks__hint">No skills available in the registry</p>
              ) : (
                <div className="scheduled-tasks__picker">
                  {Array.from(skillsByName.keys()).map((name) => {
                    const selected = form.skills.some((s) => s.name === name);
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`scheduled-tasks__picker-item${selected ? ' scheduled-tasks__picker-item--selected' : ''}`}
                        onClick={() => toggleSkill(name)}
                      >
                        <span>{name}</span>
                        <span className="scheduled-tasks__picker-check">{selected ? '✓' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {error && <div className="scheduled-tasks__error">{error}</div>}

            <div className="scheduled-tasks__form-actions">
              <Button
                onClick={handleSubmit}
                disabled={!form.title.trim() || !form.cronExpression.trim() || isSaving}
              >
                {editingId != null ? 'Save changes' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
