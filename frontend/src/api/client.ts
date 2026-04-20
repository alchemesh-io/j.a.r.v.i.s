const API_BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

// --- Types ---

export type TaskType = 'refinement' | 'implementation' | 'review';
export type TaskStatus = 'created' | 'done';
export type SourceType = 'jira' | 'gcal';
export type KeyFocusKind = 'delivery' | 'learning' | 'support' | 'operational' | 'side_quest';
export type KeyFocusStatus = 'in_progress' | 'succeed' | 'failed';
export type KeyFocusFrequency = 'weekly' | 'quarterly';
export type BlockerStatus = 'opened' | 'resolved';
export type WorkerState = 'initialized' | 'working' | 'waiting_for_human' | 'done' | 'archived';
export type WorkerType = 'claude_code';

export interface TaskKeyFocusSummary {
  id: number;
  title: string;
  kind: KeyFocusKind;
}

export interface WorkerSummary {
  id: string;
  state: WorkerState;
  effective_state: WorkerState;
}

export interface Task {
  id: number;
  source_type: SourceType | null;
  source_id: string | null;
  title: string;
  type: TaskType;
  status: TaskStatus;
  dates?: string[];
  note_count: number;
  key_focuses: TaskKeyFocusSummary[];
  blocker_count: number;
  worker: WorkerSummary | null;
}

export interface Repository {
  id: number;
  git_url: string;
  branch: string;
  worker_count: number;
  active_worker_count: number;
}

export interface Worker {
  id: string;
  task_id: number;
  type: WorkerType;
  state: WorkerState;
  effective_state: WorkerState;
  pod_status: string | null;
  created_at: string;
  updated_at: string;
  repositories: Repository[];
  skills: SkillRef[];
}

export interface KeyFocus {
  id: number;
  title: string;
  description: string | null;
  kind: KeyFocusKind;
  status: KeyFocusStatus;
  frequency: KeyFocusFrequency;
  weekly_id: number;
  task_count: number;
  blocker_count: number;
}

export interface Blocker {
  id: number;
  title: string;
  description: string | null;
  status: BlockerStatus;
  task_id: number | null;
  key_focus_id: number | null;
}

export interface TaskNote {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DailyTask {
  daily_id: number;
  task_id: number;
  priority: number;
  task: Task;
}

export interface Daily {
  id: number;
  date: string;
  weekly_id: number;
  tasks: DailyTask[];
}

export interface Weekly {
  id: number;
  week_start: string;
  dailies: Daily[];
}

// --- Task API ---

export function createTask(body: {
  title: string;
  type: TaskType;
  source_type?: SourceType;
  source_id?: string;
  status?: TaskStatus;
}): Promise<Task> {
  return request('/tasks', { method: 'POST', body: JSON.stringify(body) });
}

export function listTasks(params?: {
  date?: string;
  scope?: 'daily' | 'weekly' | 'all';
}): Promise<Task[]> {
  const searchParams = new URLSearchParams();
  if (params?.date) searchParams.set('date', params.date);
  if (params?.scope) searchParams.set('scope', params.scope);
  const qs = searchParams.toString();
  return request(`/tasks${qs ? `?${qs}` : ''}`);
}

export function getTask(id: number): Promise<Task> {
  return request(`/tasks/${id}`);
}

export function updateTask(
  id: number,
  body: Partial<Pick<Task, 'title' | 'type' | 'status' | 'source_type' | 'source_id'>>,
): Promise<Task> {
  return request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteTask(id: number): Promise<void> {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

// --- Task Notes API ---

export function listTaskNotes(taskId: number): Promise<TaskNote[]> {
  return request(`/tasks/${taskId}/notes`);
}

export function createTaskNote(taskId: number, body: { content: string }): Promise<TaskNote> {
  return request(`/tasks/${taskId}/notes`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateTaskNote(
  taskId: number,
  noteId: number,
  body: { content: string },
): Promise<TaskNote> {
  return request(`/tasks/${taskId}/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteTaskNote(taskId: number, noteId: number): Promise<void> {
  return request(`/tasks/${taskId}/notes/${noteId}`, { method: 'DELETE' });
}

// --- Weekly API ---

export function createWeekly(body: { week_start: string }): Promise<Weekly> {
  return request('/weeklies', { method: 'POST', body: JSON.stringify(body) });
}

export function listWeeklies(): Promise<Weekly[]> {
  return request('/weeklies');
}

export function getWeekly(id: number): Promise<Weekly> {
  return request(`/weeklies/${id}`);
}

// --- Daily API ---

export function createDaily(body: {
  date: string;
  weekly_id: number;
}): Promise<Daily> {
  return request('/dailies', { method: 'POST', body: JSON.stringify(body) });
}

export function getDailyById(id: number): Promise<Daily> {
  return request(`/dailies/${id}`);
}

export function getDailyByDate(date: string): Promise<Daily> {
  return request(`/dailies?date=${date}`);
}

// --- Daily Task API ---

export function addTaskToDaily(
  dailyId: number,
  body: { task_id: number; priority: number },
): Promise<DailyTask> {
  return request(`/dailies/${dailyId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function removeTaskFromDaily(
  dailyId: number,
  taskId: number,
): Promise<void> {
  return request(`/dailies/${dailyId}/tasks/${taskId}`, { method: 'DELETE' });
}

export function reorderDailyTasks(
  dailyId: number,
  items: { task_id: number; priority: number }[],
): Promise<DailyTask[]> {
  return request(`/dailies/${dailyId}/tasks/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

// --- JIRA API ---

export interface JiraConfig {
  configured: boolean;
  projectUrl: string | null;
}

export interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  priority: string | null;
  description: string | null;
  url: string;
}

export function getJiraConfig(): Promise<JiraConfig> {
  return request('/jira/config');
}

export function listJiraTickets(): Promise<JiraTicket[]> {
  return request('/jira/tickets');
}

export function getJiraTicket(key: string): Promise<JiraTicket> {
  return request(`/jira/ticket?key=${encodeURIComponent(key)}`);
}

// --- Google Calendar API ---

export interface GCalAuthStatus {
  configured: boolean;
  authenticated: boolean;
  mode: 'oauth2' | 'service_account' | null;
  calendarEmail: string | null;
}

export interface EventAttendee {
  email: string;
  display_name: string | null;
  response_status: string | null;
}

export interface EventAttachment {
  title: string;
  file_url: string;
  icon_link: string | null;
  mime_type: string | null;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  description: string | null;
  location: string | null;
  attendees: EventAttendee[];
  attachments: EventAttachment[];
  html_link: string | null;
  calendar_name: string;
  calendar_color: string;
}

export interface CalendarGroup {
  calendar_name: string;
  calendar_color: string;
  events: CalendarEvent[];
}

export function getGcalAuthStatus(): Promise<GCalAuthStatus> {
  return request('/gcal/auth/status');
}

export function getGcalAuthLoginUrl(): string {
  return `${API_BASE}/gcal/auth/login`;
}

export function getGcalEvent(eventId: string): Promise<CalendarEvent> {
  return request(`/gcal/event?event_id=${encodeURIComponent(eventId)}`);
}

export function listGcalEvents(
  date: string,
  view: 'daily' | 'weekly' = 'daily',
): Promise<CalendarGroup[]> {
  return request(`/gcal/events?date=${date}&view=${view}`);
}

// --- Key Focus API ---

export function createKeyFocus(body: {
  title: string;
  kind: KeyFocusKind;
  frequency: KeyFocusFrequency;
  weekly_id: number;
  description?: string;
  status?: KeyFocusStatus;
}): Promise<KeyFocus> {
  return request('/key-focuses', { method: 'POST', body: JSON.stringify(body) });
}

export function listKeyFocuses(params?: {
  weekly_id?: number;
  frequency?: KeyFocusFrequency;
  date?: string;
  scope?: 'weekly' | 'quarterly' | 'all';
}): Promise<KeyFocus[]> {
  const searchParams = new URLSearchParams();
  if (params?.weekly_id != null) searchParams.set('weekly_id', String(params.weekly_id));
  if (params?.frequency) searchParams.set('frequency', params.frequency);
  if (params?.date) searchParams.set('date', params.date);
  if (params?.scope) searchParams.set('scope', params.scope);
  const qs = searchParams.toString();
  return request(`/key-focuses${qs ? `?${qs}` : ''}`);
}

export function getKeyFocus(id: number): Promise<KeyFocus> {
  return request(`/key-focuses/${id}`);
}

export function updateKeyFocus(
  id: number,
  body: Partial<Pick<KeyFocus, 'title' | 'description' | 'kind' | 'status' | 'frequency' | 'weekly_id'>>,
): Promise<KeyFocus> {
  return request(`/key-focuses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteKeyFocus(id: number): Promise<void> {
  return request(`/key-focuses/${id}`, { method: 'DELETE' });
}

// --- Task-KeyFocus Association API ---

export function addTaskToKeyFocus(keyFocusId: number, taskId: number): Promise<{ task_id: number; key_focus_id: number }> {
  return request(`/key-focuses/${keyFocusId}/tasks`, { method: 'POST', body: JSON.stringify({ task_id: taskId }) });
}

export function removeTaskFromKeyFocus(keyFocusId: number, taskId: number): Promise<void> {
  return request(`/key-focuses/${keyFocusId}/tasks/${taskId}`, { method: 'DELETE' });
}

export function listKeyFocusTasks(keyFocusId: number): Promise<Task[]> {
  return request(`/key-focuses/${keyFocusId}/tasks`);
}

export function addKeyFocusToTask(taskId: number, keyFocusId: number): Promise<{ task_id: number; key_focus_id: number }> {
  return request(`/tasks/${taskId}/key-focuses`, { method: 'POST', body: JSON.stringify({ key_focus_id: keyFocusId }) });
}

export function removeKeyFocusFromTask(taskId: number, keyFocusId: number): Promise<void> {
  return request(`/tasks/${taskId}/key-focuses/${keyFocusId}`, { method: 'DELETE' });
}

export function listTaskKeyFocuses(taskId: number): Promise<KeyFocus[]> {
  return request(`/tasks/${taskId}/key-focuses`);
}

// --- Blocker API ---

export function createBlocker(body: {
  title: string;
  description?: string;
  task_id?: number;
  key_focus_id?: number;
}): Promise<Blocker> {
  return request('/blockers', { method: 'POST', body: JSON.stringify(body) });
}

export function listBlockers(params?: { status?: BlockerStatus }): Promise<Blocker[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return request(`/blockers${qs ? `?${qs}` : ''}`);
}

export function getBlocker(id: number): Promise<Blocker> {
  return request(`/blockers/${id}`);
}

export function updateBlocker(
  id: number,
  body: Partial<Pick<Blocker, 'title' | 'description' | 'status'>>,
): Promise<Blocker> {
  return request(`/blockers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteBlocker(id: number): Promise<void> {
  return request(`/blockers/${id}`, { method: 'DELETE' });
}

export function listTaskBlockers(taskId: number): Promise<Blocker[]> {
  return request(`/tasks/${taskId}/blockers`);
}

export function createTaskBlocker(taskId: number, body: { title: string; description?: string }): Promise<Blocker> {
  return request(`/tasks/${taskId}/blockers`, { method: 'POST', body: JSON.stringify(body) });
}

export function listKeyFocusBlockers(keyFocusId: number): Promise<Blocker[]> {
  return request(`/key-focuses/${keyFocusId}/blockers`);
}

export function createKeyFocusBlocker(keyFocusId: number, body: { title: string; description?: string }): Promise<Blocker> {
  return request(`/key-focuses/${keyFocusId}/blockers`, { method: 'POST', body: JSON.stringify(body) });
}

// --- Worker API ---

export interface SkillRef {
  name: string;
  version: string;
  description?: string;
  is_latest?: boolean;
}

export function listSkills(): Promise<SkillRef[]> {
  return request('/skills');
}

export function createWorker(body: {
  task_id: number;
  repository_ids?: number[];
  skills?: { name: string; version: string }[];
  type?: WorkerType;
}): Promise<Worker> {
  return request('/workers', { method: 'POST', body: JSON.stringify(body) });
}

export function listWorkers(): Promise<Worker[]> {
  return request('/workers');
}

export function getWorker(id: string): Promise<Worker> {
  return request(`/workers/${id}`);
}

export function updateWorker(
  id: string,
  body: { state?: WorkerState },
): Promise<Worker> {
  return request(`/workers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteWorker(id: string): Promise<void> {
  return request(`/workers/${id}`, { method: 'DELETE' });
}

export function getWorkerVscodeUri(id: string): Promise<{ uri: string }> {
  return request(`/workers/${id}/vscode-uri`);
}

// --- Repository API ---

export function createRepository(body: {
  git_url: string;
  branch?: string;
}): Promise<Repository> {
  return request('/repositories', { method: 'POST', body: JSON.stringify(body) });
}

export function listRepositories(): Promise<Repository[]> {
  return request('/repositories');
}

export function getRepository(id: number): Promise<Repository> {
  return request(`/repositories/${id}`);
}

export function deleteRepository(id: number): Promise<void> {
  return request(`/repositories/${id}`, { method: 'DELETE' });
}

// --- Helpers ---

function getWeekStart(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function ensureDaily(date: string): Promise<Daily> {
  try {
    return await getDailyByDate(date);
  } catch {
    // Daily doesn't exist — create weekly first if needed
    const weekStart = getWeekStart(date);
    let weekly: Weekly;
    try {
      const weeklies = await listWeeklies();
      weekly = weeklies.find((w) => w.week_start === weekStart)!;
      if (!weekly) throw new Error('not found');
    } catch {
      weekly = await createWeekly({ week_start: weekStart });
    }
    return await createDaily({ date, weekly_id: weekly.id });
  }
}

export async function assignTaskToDates(
  taskId: number,
  dates: string[],
): Promise<void> {
  for (const date of dates) {
    const daily = await ensureDaily(date);
    const maxPriority = daily.tasks.reduce(
      (max, dt) => Math.max(max, dt.priority),
      0,
    );
    await addTaskToDaily(daily.id, {
      task_id: taskId,
      priority: maxPriority + 1,
    });
  }
}
