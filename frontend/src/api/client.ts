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

export interface Task {
  id: number;
  jira_ticket_id: string | null;
  title: string;
  type: TaskType;
  status: TaskStatus;
  dates?: string[];
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
  jira_ticket_id?: string;
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
  body: Partial<Pick<Task, 'title' | 'type' | 'status' | 'jira_ticket_id'>>,
): Promise<Task> {
  return request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteTask(id: number): Promise<void> {
  return request(`/tasks/${id}`, { method: 'DELETE' });
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
