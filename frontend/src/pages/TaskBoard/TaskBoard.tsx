import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Select, TaskCard, Button, Input } from '@jarvis/jads';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderDailyTasks,
  getDailyByDate,
  assignTaskToDates,
  removeTaskFromDaily,
  ensureDaily,
  getJiraConfig,
  listJiraTickets,
  getGcalAuthStatus,
  getGcalAuthLoginUrl,
  listGcalEvents,
  getJiraTicket,
  getGcalEvent,
  listTaskNotes,
  createTaskNote,
  updateTaskNote,
  deleteTaskNote,
  listTaskBlockers,
  createTaskBlocker,
  updateBlocker,
  deleteBlocker,
  listKeyFocuses,
  addKeyFocusToTask,
  removeKeyFocusFromTask,
  createWorker,
  listRepositories,
  type Task,
  type TaskType,
  type JiraTicket,
  type CalendarEvent,
  type KeyFocus,
  type Repository,
} from '../../api/client';
import { NotePanel } from './NotePanel';
import { BlockerPanel } from './BlockerPanel';
import { EmptyState } from './EmptyState';
import './TaskBoard.css';

// --- localStorage helpers ---

const STORAGE_KEY = 'jarvis-taskboard';

type DoneMode = 'dim' | 'hide';

interface BoardPrefs {
  scope: 'daily' | 'weekly' | 'all';
  selectedDate: string;
  doneMode: DoneMode;
}

function loadPrefs(): BoardPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { scope: 'daily', selectedDate: formatDate(new Date()), doneMode: 'dim' };
}

function savePrefs(prefs: BoardPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// --- Helpers ---

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TYPE_ORDER: Record<string, number> = { review: 0, implementation: 1, refinement: 2 };

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SCOPE_OPTIONS = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'all', label: 'All' },
];

type ImportSource = 'manual' | 'jira' | 'gcal';

function jiraWikiToHtml(wiki: string): string {
  const lines = wiki.split('\n');
  const result: string[] = [];
  // Stack tracks open list tags: { tag: 'ul'|'ol', depth: number }
  const listStack: { tag: string; depth: number }[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  function closeListsTo(targetDepth: number) {
    while (listStack.length > 0 && listStack[listStack.length - 1].depth > targetDepth) {
      const popped = listStack.pop()!;
      result.push(`</${popped.tag}>`);
    }
  }

  function closeAllLists() {
    while (listStack.length > 0) {
      const popped = listStack.pop()!;
      result.push(`</${popped.tag}>`);
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Code blocks: {code} or {noformat}
    if (/^\{(code|noformat)\}/.test(trimmed)) {
      if (inCodeBlock) {
        result.push(`<pre><code>${codeBlockContent.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        closeAllLists();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headings: h1. through h6.
    const headingMatch = trimmed.match(/^h([1-6])\.\s*(.+)/);
    if (headingMatch) {
      closeAllLists();
      result.push(`<h${headingMatch[1]}>${formatInline(headingMatch[2])}</h${headingMatch[1]}>`);
      continue;
    }

    // Bullet list items: * or ** or *** etc.
    const bulletMatch = trimmed.match(/^(\*+)\s+(.+)/);
    if (bulletMatch) {
      const depth = bulletMatch[1].length;
      const content = formatInline(bulletMatch[2]);
      if (listStack.length === 0 || listStack[listStack.length - 1].depth < depth) {
        listStack.push({ tag: 'ul', depth });
        result.push('<ul>');
      } else {
        closeListsTo(depth);
      }
      result.push(`<li>${content}</li>`);
      continue;
    }

    // Ordered list items: # or ## or ### etc.
    const orderedMatch = trimmed.match(/^(#+)\s+(.+)/);
    if (orderedMatch) {
      const depth = orderedMatch[1].length;
      const content = formatInline(orderedMatch[2]);
      if (listStack.length === 0 || listStack[listStack.length - 1].depth < depth) {
        listStack.push({ tag: 'ol', depth });
        result.push('<ol>');
      } else {
        closeListsTo(depth);
      }
      result.push(`<li>${content}</li>`);
      continue;
    }

    // Empty line
    if (!trimmed) {
      closeAllLists();
      continue;
    }

    // Regular paragraph
    closeAllLists();
    result.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeAllLists();
  if (inCodeBlock) {
    result.push(`<pre><code>${codeBlockContent.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
  }
  return result.join('');
}

function formatInline(text: string): string {
  return text
    // Monospace: {{text}} — must run before bold to avoid conflicts
    .replace(/\{\{([^}]+)\}\}/g, '<code>$1</code>')
    // Links: [label|url] or [label|url|smart-link]
    .replace(/\[([^|\]]+)\|([^|\]]+)(?:\|[^\]]*)?\]/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Standalone URLs (not already inside an href)
    .replace(/(?<![">])(https?:\/\/[^\s<\]|)]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    // Bold: *text*
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    // Italic: _text_
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');
}

const JIRA_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'to do':       { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' },
  'backlog':     { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' },
  'in progress': { bg: 'rgba(59, 130, 246, 0.2)',  color: '#60a5fa' },
  'in review':   { bg: 'rgba(168, 85, 247, 0.2)',  color: '#c084fc' },
  'done':        { bg: 'rgba(34, 197, 94, 0.2)',   color: '#4ade80' },
  'closed':      { bg: 'rgba(34, 197, 94, 0.2)',   color: '#4ade80' },
  'blocked':     { bg: 'rgba(239, 68, 68, 0.2)',   color: '#f87171' },
};

function getStatusStyle(status: string) {
  const key = status.toLowerCase();
  return JIRA_STATUS_COLORS[key] ?? { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' };
}

const JIRA_PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  'highest':  { bg: 'rgba(239, 68, 68, 0.2)',   color: '#f87171' },
  'high':     { bg: 'rgba(249, 115, 22, 0.2)',  color: '#fb923c' },
  'medium':   { bg: 'rgba(234, 179, 8, 0.2)',   color: '#facc15' },
  'low':      { bg: 'rgba(34, 197, 94, 0.2)',   color: '#4ade80' },
  'lowest':   { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' },
};

function getPriorityStyle(priority: string) {
  const key = priority.toLowerCase();
  return JIRA_PRIORITY_COLORS[key] ?? { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' };
}

// --- SortableTaskCard ---

function SortableTaskCard({
  task,
  jiraProjectUrl,
  gcalCalendarEmail,
  onEdit,
  onDelete,
  onToggleStatus,
  onExpand,
  onNotes,
  onBlockers,
  onPlayClick,
  onWorkerClick,
  onVscodeClick,
}: {
  task: Task;
  jiraProjectUrl?: string;
  gcalCalendarEmail?: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onExpand: () => void;
  onNotes: () => void;
  onBlockers: () => void;
  onPlayClick?: () => void;
  onWorkerClick?: () => void;
  onVscodeClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
    touchAction: 'manipulation' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} data-dragging={isDragging || undefined}>
      <TaskCard
        title={task.title}
        type={task.type}
        status={task.status}
        sourceType={task.source_type ?? undefined}
        sourceId={task.source_id ?? undefined}
        jiraProjectUrl={jiraProjectUrl}
        gcalCalendarEmail={gcalCalendarEmail}
        dates={task.dates}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
        onExpand={task.source_type ? onExpand : undefined}
        onNotes={onNotes}
        noteCount={task.note_count}
        onBlockers={onBlockers}
        blockerCount={task.blocker_count}
        keyFocuses={task.key_focuses}
        dragListeners={listeners}
        worker={task.worker ?? undefined}
        onPlayClick={onPlayClick}
        onWorkerClick={onWorkerClick}
        onVscodeClick={onVscodeClick}
      />
    </div>
  );
}

// --- TaskBoard ---

export default function TaskBoard() {
  const queryClient = useQueryClient();
  const [prefs] = useState(loadPrefs);

  const [selectedDate, setSelectedDate] = useState(() => new Date(prefs.selectedDate + 'T00:00:00'));
  const [scope, setScope] = useState<'daily' | 'weekly' | 'all'>(prefs.scope);
  const [doneMode, setDoneMode] = useState<DoneMode>(prefs.doneMode);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<TaskType>('implementation');
  const [formJira, setFormJira] = useState('');
  const [formDates, setFormDates] = useState<string[]>([]);
  const [formDateInput, setFormDateInput] = useState('');
  const [formKeyFocusIds, setFormKeyFocusIds] = useState<Set<number>>(new Set());

  // Batch creation: list of items queued for creation
  interface PendingItem {
    title: string;
    type: TaskType;
    source_type?: 'jira' | 'gcal';
    source_id?: string;
  }
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  const [importSource, setImportSource] = useState<ImportSource>('manual');
  const [gcalDate, setGcalDate] = useState(() => formatDate(new Date()));
  const [gcalView, setGcalView] = useState<'daily' | 'weekly'>('daily');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [jiraSearch, setJiraSearch] = useState('');
  const [jiraProjectFilter, setJiraProjectFilter] = useState('all');
  const [fullscreenTicket, setFullscreenTicket] = useState<JiraTicket | null>(null);
  const [fullscreenEvent, setFullscreenEvent] = useState<CalendarEvent | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  const [notePanelTask, setNotePanelTask] = useState<Task | null>(null);
  const [blockerPanelTask, setBlockerPanelTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  // Worker creation from task card
  const [workerCreateTask, setWorkerCreateTask] = useState<Task | null>(null);
  const [workerRepoIds, setWorkerRepoIds] = useState<number[]>([]);

  const { data: repositories = [] } = useQuery({
    queryKey: ['repositories'],
    queryFn: listRepositories,
    enabled: workerCreateTask !== null,
  });

  const createWorkerMutation = useMutation({
    mutationFn: createWorker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setWorkerCreateTask(null);
      setWorkerRepoIds([]);
    },
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const today = formatDate(new Date());
  const dateStr = formatDate(selectedDate);

  // Persist prefs
  useEffect(() => {
    const newPrefs: BoardPrefs = { scope, selectedDate: dateStr, doneMode };
    savePrefs(newPrefs);
  }, [scope, dateStr, doneMode]);

  // Close calendar dropdown on outside click
  useEffect(() => {
    if (!showCalendar) return;
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalendar]);

  const { data: jiraConfig } = useQuery({
    queryKey: ['jira-config'],
    queryFn: getJiraConfig,
    staleTime: 5 * 60 * 1000,
  });

  const { data: gcalAuthStatus } = useQuery({
    queryKey: ['gcal-auth-status'],
    queryFn: getGcalAuthStatus,
    staleTime: 30 * 1000,
  });

  const { data: jiraTickets = [], isFetching: jiraLoading } = useQuery({
    queryKey: ['jira-tickets'],
    queryFn: listJiraTickets,
    enabled: showCreateForm && importSource === 'jira' && !!jiraConfig?.configured,
  });

  const { data: gcalGroups = [], isFetching: gcalLoading } = useQuery({
    queryKey: ['gcal-events', gcalDate, gcalView],
    queryFn: () => listGcalEvents(gcalDate, gcalView),
    enabled: showCreateForm && importSource === 'gcal' && !!gcalAuthStatus?.authenticated,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', dateStr, scope],
    queryFn: () => listTasks({ date: dateStr, scope }),
  });

  const [manualOrder, setManualOrder] = useState<number[] | null>(null);

  // Reset manual order when date/scope changes
  useEffect(() => {
    setManualOrder(null);
  }, [dateStr, scope]);

  const sortedTasks = useMemo(() => {
    if (manualOrder) {
      const byId = new Map(tasks.map((t) => [t.id, t]));
      return manualOrder.map((id) => byId.get(id)).filter(Boolean) as Task[];
    }
    return [...tasks].sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));
  }, [tasks, manualOrder]);

  const visibleTasks = doneMode === 'hide'
    ? sortedTasks.filter((t) => t.status !== 'done')
    : sortedTasks;

  const { data: daily } = useQuery({
    queryKey: ['daily', dateStr],
    queryFn: () => getDailyByDate(dateStr).catch(() => null),
  });

  const { data: weeklyKeyFocuses = [] } = useQuery({
    queryKey: ['key-focuses-weekly', dateStr],
    queryFn: () => listKeyFocuses({ date: dateStr, scope: 'weekly', frequency: 'weekly' }),
  });

  const { data: quarterlyKeyFocuses = [] } = useQuery({
    queryKey: ['key-focuses-quarterly', dateStr],
    queryFn: () => listKeyFocuses({ date: dateStr, scope: 'quarterly', frequency: 'quarterly' }),
  });

  const relevantKeyFocuses = [...weeklyKeyFocuses, ...quarterlyKeyFocuses];

  const toggleStatusMutation = useMutation({
    mutationFn: (task: Task) =>
      updateTask(task.id, { status: task.status === 'done' ? 'created' : 'done' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDeletingTask(null);
    },
  });

  const { data: taskNotes = [] } = useQuery({
    queryKey: ['task-notes', notePanelTask?.id],
    queryFn: () => listTaskNotes(notePanelTask!.id),
    enabled: !!notePanelTask,
  });

  const createNoteMutation = useMutation({
    mutationFn: ({ taskId, content }: { taskId: number; content: string }) =>
      createTaskNote(taskId, { content }),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-notes', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ taskId, noteId, content }: { taskId: number; noteId: number; content: string }) =>
      updateTaskNote(taskId, noteId, { content }),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-notes', taskId] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: ({ taskId, noteId }: { taskId: number; noteId: number }) =>
      deleteTaskNote(taskId, noteId),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-notes', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // --- Blocker queries/mutations ---
  const { data: taskBlockers = [] } = useQuery({
    queryKey: ['task-blockers', blockerPanelTask?.id],
    queryFn: () => listTaskBlockers(blockerPanelTask!.id),
    enabled: !!blockerPanelTask,
  });

  const createBlockerMutation = useMutation({
    mutationFn: ({ taskId, title }: { taskId: number; title: string }) =>
      createTaskBlocker(taskId, { title }),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-blockers', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const resolveBlockerMutation = useMutation({
    mutationFn: (blockerId: number) => updateBlocker(blockerId, { status: 'resolved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-blockers'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteBlockerMutation = useMutation({
    mutationFn: deleteBlocker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-blockers'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({
      dailyId,
      items,
    }: {
      dailyId: number;
      items: { task_id: number; priority: number }[];
    }) => reorderDailyTasks(dailyId, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function resetForm() {
    setFormTitle('');
    setFormType('implementation');
    setFormJira('');
    setFormDates([]);
    setFormDateInput('');
    setFormKeyFocusIds(new Set());
    setImportSource('manual');
    setJiraSearch('');
    setJiraProjectFilter('all');
    setSelectedTickets(new Set());
    setSelectedEvents(new Set());
    setPendingItems([]);
  }

  function toggleTicketSelection(key: string) {
    setSelectedTickets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleEventSelection(id: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectJiraTicket(ticket: JiraTicket) {
    setPendingItems([{ title: ticket.summary, type: 'implementation', source_type: 'jira', source_id: ticket.key }]);
    setFormTitle('');
    setFormJira('');
    setImportSource('manual');
  }

  function selectGcalEvent(event: CalendarEvent) {
    const eventDate = event.start.slice(0, 10);
    if (eventDate && !formDates.includes(eventDate)) {
      setFormDates((prev) => [...prev, eventDate].sort());
    }
    setPendingItems([{ title: event.summary, type: 'refinement', source_type: 'gcal', source_id: event.id }]);
    setFormTitle('');
    setFormJira('');
    setImportSource('manual');
  }

  function confirmSelectedTickets() {
    const tickets = jiraTickets.filter((t) => selectedTickets.has(t.key));
    setPendingItems(tickets.map((t) => ({ title: t.summary, type: 'implementation' as TaskType, source_type: 'jira' as const, source_id: t.key })));
    setSelectedTickets(new Set());
    setFormTitle('');
    setFormJira('');
    setImportSource('manual');
  }

  function confirmSelectedEvents() {
    const allEvents = gcalGroups.flatMap((g) => g.events);
    const events = allEvents.filter((e) => selectedEvents.has(e.id));
    const dates = new Set(formDates);
    for (const ev of events) {
      const d = ev.start.slice(0, 10);
      if (d) dates.add(d);
    }
    setFormDates([...dates].sort());
    setPendingItems(events.map((e) => ({ title: e.summary, type: 'refinement' as TaskType, source_type: 'gcal' as const, source_id: e.id })));
    setSelectedEvents(new Set());
    setFormTitle('');
    setFormJira('');
    setImportSource('manual');
  }

  function removePendingItem(index: number) {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addManualItem() {
    if (!formTitle) return;
    const jiraId = formJira ? extractJiraId(formJira) : undefined;
    setPendingItems((prev) => [
      ...prev,
      {
        title: formTitle,
        type: formType,
        source_type: jiraId ? 'jira' as const : undefined,
        source_id: jiraId || undefined,
      },
    ]);
    setFormTitle('');
    setFormJira('');
  }

  async function handleExpandBoardTask(task: Task) {
    if (task.source_type === 'jira' && task.source_id) {
      try {
        const ticket = await getJiraTicket(task.source_id);
        setFullscreenTicket(ticket);
      } catch { /* ignore */ }
    } else if (task.source_type === 'gcal' && task.source_id) {
      try {
        const status = await getGcalAuthStatus();
        if (!status.authenticated) {
          window.location.href = getGcalAuthLoginUrl();
          return;
        }
        const event = await getGcalEvent(task.source_id);
        setFullscreenEvent(event);
      } catch { /* ignore */ }
    }
  }

  function extractJiraId(input: string): string | undefined {
    const match = input.match(/([A-Z]+-\d+)/);
    return match ? match[1] : undefined;
  }

  function addDate(date: string) {
    if (!date || formDates.includes(date)) {
      setFormDateInput('');
      return;
    }
    setFormDates((prev) => [...prev, date].sort());
    setFormDateInput('');
  }

  function removeDate(date: string) {
    setFormDates((prev) => prev.filter((d) => d !== date));
  }

  async function handleCreate() {
    // Collect all items to create: pending items + current form if filled
    const items = [...pendingItems];
    if (formTitle) {
      const jiraId = formJira ? extractJiraId(formJira) : undefined;
      items.push({
        title: formTitle,
        type: formType,
        source_type: jiraId ? 'jira' as const : undefined,
        source_id: jiraId || undefined,
      });
    }
    if (items.length === 0) return;

    for (const item of items) {
      const task = await createTask(item);
      if (formDates.length > 0) {
        await assignTaskToDates(task.id, formDates);
      }
      for (const kfId of formKeyFocusIds) {
        await addKeyFocusToTask(task.id, kfId);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['daily'] });
    setShowCreateForm(false);
    resetForm();
  }

  async function handleSaveEdit() {
    if (!editingTask) return;

    const jiraId = formJira ? extractJiraId(formJira) : undefined;
    await updateTask(editingTask.id, {
      title: formTitle,
      type: formType,
      source_type: jiraId ? 'jira' : undefined,
      source_id: jiraId || undefined,
    });

    const oldDates = new Set(editingTask.dates ?? []);
    const newDates = new Set(formDates);
    const toAdd = formDates.filter((d) => !oldDates.has(d));
    const toRemove = (editingTask.dates ?? []).filter((d) => !newDates.has(d));

    if (toAdd.length > 0) {
      await assignTaskToDates(editingTask.id, toAdd);
    }
    for (const date of toRemove) {
      try {
        const daily = await getDailyByDate(date);
        await removeTaskFromDaily(daily.id, editingTask.id);
      } catch { /* ignore */ }
    }

    // Sync key focus associations
    const oldKFIds = new Set(editingTask.key_focuses?.map((kf) => kf.id) ?? []);
    const kfToAdd = [...formKeyFocusIds].filter((id) => !oldKFIds.has(id));
    const kfToRemove = [...oldKFIds].filter((id) => !formKeyFocusIds.has(id));
    for (const kfId of kfToAdd) {
      await addKeyFocusToTask(editingTask.id, kfId);
    }
    for (const kfId of kfToRemove) {
      await removeKeyFocusFromTask(editingTask.id, kfId);
    }

    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['daily'] });
    queryClient.invalidateQueries({ queryKey: ['key-focuses'] });
    setEditingTask(null);
    resetForm();
  }

  function startEdit(task: Task) {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormType(task.type);
    setFormJira(task.source_id ?? '');
    setFormDates(task.dates ?? []);
    setFormDateInput('');
    setFormKeyFocusIds(new Set(task.key_focuses?.map((kf) => kf.id) ?? []));
    setShowCreateForm(false);
  }

  function handleDateChange(date: Date) {
    setSelectedDate(date);
  }

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = visibleTasks.findIndex((t) => t.id === active.id);
      const newIndex = visibleTasks.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(visibleTasks, oldIndex, newIndex);
      setManualOrder(reordered.map((t) => t.id));

      try {
        const d = daily ?? await ensureDaily(dateStr);
        await reorderMutation.mutateAsync({
          dailyId: d.id,
          items: reordered.map((t, i) => ({ task_id: t.id, priority: i + 1 })),
        });
      } catch {
        setManualOrder(null);
      }
    },
    [visibleTasks, daily, dateStr, reorderMutation],
  );

  const closeForm = () => { setShowCreateForm(false); setEditingTask(null); resetForm(); };

  return (
    <div className="task-board">
      <div className="task-board__toolbar">
        <div className="task-board__toolbar-left">
          <button
            type="button"
            className="task-board__create-btn"
            onClick={() => { setShowCreateForm(true); setEditingTask(null); resetForm(); }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Create
          </button>
          <div className="task-board__calendar-dropdown" ref={calendarRef}>
            <button
              type="button"
              className={`task-board__date-btn${showCalendar ? ' task-board__date-btn--open' : ''}`}
              onClick={() => setShowCalendar((v) => !v)}
              aria-haspopup="true"
              aria-expanded={showCalendar}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M2 6H14" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 1.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M10.5 1.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {formatDateDisplay(selectedDate)}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="task-board__date-chevron">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showCalendar && (
              <div className="task-board__calendar-panel">
                <Calendar
                  selectedDate={selectedDate}
                  onDateSelect={(d) => { handleDateChange(d); setShowCalendar(false); }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="task-board__toolbar-right">
          <div className="task-board__scope-tabs" role="tablist" aria-label="Scope filter">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={scope === opt.value}
                className={`task-board__scope-tab${scope === opt.value ? ' task-board__scope-tab--active' : ''}`}
                onClick={() => setScope(opt.value as 'daily' | 'weekly' | 'all')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`task-board__hud-toggle${doneMode !== 'hide' ? ' task-board__hud-toggle--active' : ''}`}
            onClick={() => setDoneMode((m) => m === 'dim' ? 'hide' : 'dim')}
            aria-pressed={doneMode !== 'hide'}
            title={doneMode === 'hide' ? 'Show done tasks' : 'Dim done tasks'}
          >
            Done
          </button>
        </div>
      </div>

      <section className="task-board__content">
        {(showCreateForm || editingTask) && (
          <div className="task-board__form-overlay" onClick={closeForm}>
            <div
              className={`task-board__form${editingTask ? ` task-board__form--${editingTask.type}` : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              {!editingTask && (
                <div className="task-board__source-selector">
                  <button
                    type="button"
                    className={`task-board__source-tab ${importSource === 'manual' ? 'task-board__source-tab--active' : ''}`}
                    onClick={() => setImportSource('manual')}
                  >
                    Manual
                  </button>
                  {jiraConfig?.configured && (
                    <button
                      type="button"
                      className={`task-board__source-tab ${importSource === 'jira' ? 'task-board__source-tab--active' : ''}`}
                      onClick={() => setImportSource('jira')}
                    >
                      JIRA
                    </button>
                  )}
                  {gcalAuthStatus?.configured && (
                    <button
                      type="button"
                      className={`task-board__source-tab ${importSource === 'gcal' ? 'task-board__source-tab--active' : ''}`}
                      onClick={() => setImportSource('gcal')}
                    >
                      Google Calendar
                    </button>
                  )}
                </div>
              )}

              {importSource === 'jira' && !editingTask && (
                <div className="task-board__import-list">
                  <div className="task-board__jira-filters">
                    <input
                      type="text"
                      className="task-board__jira-search"
                      placeholder="Search tickets..."
                      value={jiraSearch}
                      onChange={(e) => setJiraSearch(e.target.value)}
                    />
                    <select
                      className="task-board__jira-project-filter"
                      value={jiraProjectFilter}
                      onChange={(e) => setJiraProjectFilter(e.target.value)}
                    >
                      <option value="all">All projects</option>
                      {[...new Set(jiraTickets.map((t) => t.key.split('-')[0]))].sort().map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  {jiraLoading && <p className="task-board__import-loading">Loading tickets...</p>}
                  {!jiraLoading && jiraTickets.length === 0 && (
                    <p className="task-board__import-empty">No tickets available</p>
                  )}
                  {!jiraLoading && (() => {
                    const query = jiraSearch.toLowerCase();
                    const filtered = jiraTickets
                      .filter((t) => {
                        const s = t.status.toLowerCase();
                        return s !== 'done' && s !== 'closed';
                      })
                      .filter((t) =>
                        jiraProjectFilter === 'all' || t.key.split('-')[0] === jiraProjectFilter
                      )
                      .filter((t) =>
                        !query ||
                        t.key.toLowerCase().includes(query) ||
                        t.summary.toLowerCase().includes(query) ||
                        (t.assignee?.toLowerCase().includes(query) ?? false)
                      );
                    const PRIORITY_ORDER: Record<string, number> = {
                      highest: 0, high: 1, medium: 2, low: 3, lowest: 4,
                    };
                    filtered.sort((a, b) => {
                      const projA = a.key.split('-')[0];
                      const projB = b.key.split('-')[0];
                      if (projA !== projB) return projA.localeCompare(projB);
                      if (a.status !== b.status) return a.status.localeCompare(b.status);
                      const pa = PRIORITY_ORDER[(a.priority ?? '').toLowerCase()] ?? 5;
                      const pb = PRIORITY_ORDER[(b.priority ?? '').toLowerCase()] ?? 5;
                      return pa - pb;
                    });
                    return filtered.map((ticket) => (
                      <div key={ticket.key} className={`task-board__jira-card ${selectedTickets.has(ticket.key) ? 'task-board__jira-card--selected' : ''}`}>
                        <div className="task-board__jira-card-top">
                          <div className="task-board__jira-card-header">
                            <a
                              href={ticket.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="task-board__jira-card-key"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ticket.key}
                            </a>
                            <span
                              className="task-board__jira-status-badge"
                              style={{ backgroundColor: getStatusStyle(ticket.status).bg, color: getStatusStyle(ticket.status).color }}
                            >
                              {ticket.status}
                            </span>
                            {ticket.priority && (
                              <span className="task-board__jira-card-priority" style={{ backgroundColor: getPriorityStyle(ticket.priority).bg, color: getPriorityStyle(ticket.priority).color }}>{ticket.priority}</span>
                            )}
                          </div>
                          <div className="task-board__jira-card-toolbar">
                            {ticket.description && (
                              <button
                                type="button"
                                className="task-board__toolbar-icon-btn"
                                onClick={() => setExpandedTicket(expandedTicket === ticket.key ? null : ticket.key)}
                                aria-label={expandedTicket === ticket.key ? 'Hide details' : 'Show details'}
                                title={expandedTicket === ticket.key ? 'Hide details' : 'Show details'}
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                  <path d="M3 4H13M3 8H10M3 12H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              className="task-board__toolbar-icon-btn"
                              onClick={() => setFullscreenTicket(ticket)}
                              aria-label="View full ticket"
                              title="View full ticket"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M2 2H6M2 2V6M2 2L6.5 6.5M14 14H10M14 14V10M14 14L9.5 9.5M14 2H10M14 2V6M14 2L9.5 6.5M2 14H6M2 14V10M2 14L6.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              type="button"
                              className={`task-board__import-icon-btn ${selectedTickets.has(ticket.key) ? 'task-board__import-icon-btn--selected' : ''}`}
                              onClick={() => toggleTicketSelection(ticket.key)}
                              aria-label={selectedTickets.has(ticket.key) ? 'Deselect ticket' : 'Select ticket'}
                              title={selectedTickets.has(ticket.key) ? 'Deselect ticket' : 'Select ticket'}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="task-board__jira-card-title">{ticket.summary}</div>
                        {ticket.assignee && (
                          <div className="task-board__jira-card-assignee">{ticket.assignee}</div>
                        )}
                        {expandedTicket === ticket.key && ticket.description && (
                          <div className="task-board__jira-card-detail-panel">
                            <div
                              className="task-board__jira-card-description"
                              dangerouslySetInnerHTML={{ __html: jiraWikiToHtml(ticket.description) }}
                            />
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                  {selectedTickets.size > 0 && (
                    <div className="task-board__selection-bar">
                      <span>{selectedTickets.size} ticket{selectedTickets.size > 1 ? 's' : ''} selected</span>
                      <Button onClick={confirmSelectedTickets}>
                        Confirm selection
                      </Button>
                      <Button variant="ghost" onClick={() => setSelectedTickets(new Set())}>
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {importSource === 'gcal' && !editingTask && (
                <div className="task-board__import-gcal">
                  {!gcalAuthStatus?.authenticated && gcalAuthStatus?.mode === 'oauth2' ? (
                    <a
                      href={getGcalAuthLoginUrl()}
                      className="task-board__gcal-login-btn"
                    >
                      Login with Google
                    </a>
                  ) : (
                    <>
                      <div className="task-board__gcal-nav">
                        <input
                          type="date"
                          className="task-board__form-date-input"
                          value={gcalDate}
                          onChange={(e) => setGcalDate(e.target.value)}
                        />
                        <button
                          type="button"
                          className={`task-board__gcal-view-btn ${gcalView === 'daily' ? 'task-board__gcal-view-btn--active' : ''}`}
                          onClick={() => setGcalView('daily')}
                        >
                          Day
                        </button>
                        <button
                          type="button"
                          className={`task-board__gcal-view-btn ${gcalView === 'weekly' ? 'task-board__gcal-view-btn--active' : ''}`}
                          onClick={() => setGcalView('weekly')}
                        >
                          Week
                        </button>
                      </div>
                      <div className="task-board__gcal-timeline">
                        {gcalLoading && <p className="task-board__import-loading">Loading events...</p>}
                        {!gcalLoading && gcalGroups.length === 0 && (
                          <p className="task-board__import-empty">No events found</p>
                        )}
                        {!gcalLoading && (() => {
                          const allEvents = gcalGroups.flatMap((g) => g.events);
                          allEvents.sort((a, b) => a.start.localeCompare(b.start));
                          let lastDate = '';
                          return allEvents.map((event) => {
                            const eventDate = event.start.slice(0, 10);
                            const showDateHeader = eventDate !== lastDate;
                            lastDate = eventDate;
                            const startTime = event.start.slice(11, 16);
                            const endTime = event.end.slice(11, 16);
                            const timeLabel = startTime ? `${startTime} – ${endTime}` : 'All day';
                            const isExpanded = expandedEvent === event.id;

                            return (
                              <div key={event.id}>
                                {showDateHeader && (
                                  <div className="task-board__gcal-date-header">
                                    {new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                                <div className={`task-board__gcal-event ${selectedEvents.has(event.id) ? 'task-board__gcal-event--selected' : ''}`}>
                                  <div
                                    className="task-board__gcal-event-bar"
                                    style={{ backgroundColor: event.calendar_color }}
                                  />
                                  <div className="task-board__gcal-event-body">
                                    <div className="task-board__gcal-event-top">
                                      <div className="task-board__gcal-event-header">
                                        <span className="task-board__gcal-event-time">{timeLabel}</span>
                                        <span className="task-board__gcal-event-calendar">{event.calendar_name}</span>
                                      </div>
                                      <div className="task-board__jira-card-toolbar">
                                        {(event.description || event.attendees.length > 0 || event.attachments.length > 0) && (
                                          <button
                                            type="button"
                                            className="task-board__toolbar-icon-btn"
                                            onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                            aria-label={isExpanded ? 'Hide details' : 'Show details'}
                                            title={isExpanded ? 'Hide details' : 'Show details'}
                                          >
                                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                              <path d="M3 4H13M3 8H10M3 12H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                            </svg>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="task-board__toolbar-icon-btn"
                                          onClick={() => setFullscreenEvent(event)}
                                          aria-label="View full event"
                                          title="View full event"
                                        >
                                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                            <path d="M2 2H6M2 2V6M2 2L6.5 6.5M14 14H10M14 14V10M14 14L9.5 9.5M14 2H10M14 2V6M14 2L9.5 6.5M2 14H6M2 14V10M2 14L6.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          className={`task-board__import-icon-btn ${selectedEvents.has(event.id) ? 'task-board__import-icon-btn--selected' : ''}`}
                                          onClick={() => toggleEventSelection(event.id)}
                                          aria-label={selectedEvents.has(event.id) ? 'Deselect event' : 'Select event'}
                                          title={selectedEvents.has(event.id) ? 'Deselect event' : 'Select event'}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                            <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                    <div className="task-board__gcal-event-title">{event.summary}</div>
                                    {event.location && (
                                      <div className="task-board__gcal-event-location">{event.location}</div>
                                    )}
                                    {isExpanded && (
                                      <div className="task-board__gcal-event-details">
                                        {event.description && (
                                          <div className="task-board__gcal-event-description" dangerouslySetInnerHTML={{ __html: event.description }} />
                                        )}
                                        {event.attendees.length > 0 && (
                                          <div className="task-board__gcal-event-attendees">
                                            <span className="task-board__gcal-event-detail-label">Guests</span>
                                            {event.attendees.map((a) => (
                                              <div key={a.email} className="task-board__gcal-attendee">
                                                <span className="task-board__gcal-attendee-name">{a.display_name || a.email}</span>
                                                {a.response_status && (
                                                  <span className={`task-board__gcal-attendee-status task-board__gcal-attendee-status--${a.response_status}`}>
                                                    {a.response_status}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {event.attachments.length > 0 && (
                                          <div className="task-board__gcal-event-attachments">
                                            <span className="task-board__gcal-event-detail-label">Files</span>
                                            {event.attachments.map((att) => (
                                              <a
                                                key={att.file_url}
                                                href={att.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="task-board__gcal-attachment"
                                              >
                                                {att.icon_link && <img src={att.icon_link} alt="" className="task-board__gcal-attachment-icon" />}
                                                {att.title}
                                              </a>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      {selectedEvents.size > 0 && (
                        <div className="task-board__selection-bar">
                          <span>{selectedEvents.size} event{selectedEvents.size > 1 ? 's' : ''} selected</span>
                          <Button onClick={confirmSelectedEvents}>
                            Confirm selection
                          </Button>
                          <Button variant="ghost" onClick={() => setSelectedEvents(new Set())}>
                            Clear
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {(importSource === 'manual' || editingTask) && (
                <>
                  {/* Pending items list (batch mode) */}
                  {!editingTask && pendingItems.length > 0 && (
                    <div className="task-board__pending-items">
                      <label className="task-board__form-label">
                        Tasks to create ({pendingItems.length})
                      </label>
                      {pendingItems.map((item, i) => (
                        <div key={i} className="task-board__pending-item">
                          <select
                            className="task-board__pending-item-type-select"
                            value={item.type}
                            onChange={(e) => setPendingItems((prev) => prev.map((p, j) => j === i ? { ...p, type: e.target.value as TaskType } : p))}
                          >
                            <option value="refinement">Refinement</option>
                            <option value="implementation">Implementation</option>
                            <option value="review">Review</option>
                          </select>
                          {item.source_id && (
                            <span className="task-board__pending-item-source">
                              {item.source_type === 'jira' ? item.source_id : item.source_type === 'gcal' ? 'GCal' : ''}
                            </span>
                          )}
                          <span className="task-board__pending-item-title">{item.title}</span>
                          <button
                            type="button"
                            className="task-board__pending-item-remove"
                            onClick={() => removePendingItem(i)}
                            aria-label={`Remove ${item.title}`}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add another task form */}
                  {!editingTask && (
                    <label className="task-board__form-label">
                      {pendingItems.length > 0 ? 'Add another task' : 'New task'}
                    </label>
                  )}
                  <Input
                    label="Title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Task title"
                  />
                  <Input
                    label={editingTask?.source_type === 'gcal' ? 'Event ID' : 'JIRA Ticket'}
                    value={formJira}
                    onChange={(e) => setFormJira(e.target.value)}
                    placeholder={editingTask?.source_type === 'gcal' ? 'Google Calendar event ID' : 'JAR-123 or full URL'}
                    disabled={editingTask?.source_type === 'gcal'}
                  />
                  <Select
                    label="Type"
                    value={formType}
                    options={[
                      { value: 'refinement', label: 'Refinement' },
                      { value: 'implementation', label: 'Implementation' },
                      { value: 'review', label: 'Review' },
                    ]}
                    onChange={(e) => setFormType(e.target.value as TaskType)}
                  />

                  {/* Add to batch button (only in batch/new mode) */}
                  {!editingTask && (
                    <Button
                      variant="ghost"
                      onClick={addManualItem}
                      disabled={!formTitle}
                    >
                      + Add to list
                    </Button>
                  )}

                  <div className="task-board__form-dates">
                    <label className="task-board__form-label">
                      Dates {!editingTask && pendingItems.length > 0 ? '(shared)' : ''}
                    </label>
                    <div className="task-board__form-date-row">
                      <input
                        type="date"
                        className="task-board__form-date-input"
                        value={formDateInput}
                        onChange={(e) => setFormDateInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDate(formDateInput); } }}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => addDate(formDateInput)}
                        disabled={!formDateInput}
                      >
                        Add
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => addDate(today)}
                      >
                        + Today
                      </Button>
                    </div>
                    {formDates.length > 0 && (
                      <div className="task-board__form-date-tags">
                        {formDates.map((d) => (
                          <span key={d} className="task-board__form-date-tag">
                            {d}
                            <button
                              type="button"
                              className="task-board__form-date-tag-remove"
                              onClick={() => removeDate(d)}
                              aria-label={`Remove date ${d}`}
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {relevantKeyFocuses.length > 0 && (
                    <div className="task-board__form-key-focuses">
                      <label className="task-board__form-label">Key Focuses</label>
                      <div className="task-board__form-kf-list">
                        {weeklyKeyFocuses.length > 0 && (
                          <>
                            <div className="task-board__form-kf-group">Weekly</div>
                            {weeklyKeyFocuses.map((kf: KeyFocus) => (
                              <label key={kf.id} className="task-board__form-kf-item">
                                <input
                                  type="checkbox"
                                  checked={formKeyFocusIds.has(kf.id)}
                                  onChange={() => {
                                    setFormKeyFocusIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(kf.id)) next.delete(kf.id);
                                      else next.add(kf.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="task-board__form-kf-kind" style={{ backgroundColor: { delivery: '#3b82f6', learning: '#22c55e', support: '#a855f7', operational: '#f97316', side_quest: '#06b6d4' }[kf.kind] }} />
                                <span>{kf.title}</span>
                              </label>
                            ))}
                          </>
                        )}
                        {quarterlyKeyFocuses.length > 0 && (
                          <>
                            <div className="task-board__form-kf-group">Quarterly</div>
                            {quarterlyKeyFocuses.map((kf: KeyFocus) => (
                              <label key={kf.id} className="task-board__form-kf-item">
                                <input
                                  type="checkbox"
                                  checked={formKeyFocusIds.has(kf.id)}
                                  onChange={() => {
                                    setFormKeyFocusIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(kf.id)) next.delete(kf.id);
                                      else next.add(kf.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="task-board__form-kf-kind" style={{ backgroundColor: { delivery: '#3b82f6', learning: '#22c55e', support: '#a855f7', operational: '#f97316', side_quest: '#06b6d4' }[kf.kind] }} />
                                <span>{kf.title}</span>
                              </label>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="task-board__form-actions">
                    {editingTask ? (
                      <Button onClick={handleSaveEdit}>Save</Button>
                    ) : (
                      <Button
                        onClick={handleCreate}
                        disabled={!formTitle && pendingItems.length === 0}
                      >
                        {pendingItems.length > 0
                          ? `Create ${pendingItems.length + (formTitle ? 1 : 0)} task${pendingItems.length + (formTitle ? 1 : 0) > 1 ? 's' : ''}`
                          : 'Create'}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={closeForm}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {fullscreenTicket && (
          <div className="task-board__fullscreen-overlay" onClick={() => setFullscreenTicket(null)}>
            <div className="task-board__fullscreen-panel" onClick={(e) => e.stopPropagation()}>
              <div className="task-board__fullscreen-header">
                <a
                  href={fullscreenTicket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="task-board__jira-card-key"
                >
                  {fullscreenTicket.key}
                </a>
                <span
                  className="task-board__jira-status-badge"
                  style={{ backgroundColor: getStatusStyle(fullscreenTicket.status).bg, color: getStatusStyle(fullscreenTicket.status).color }}
                >
                  {fullscreenTicket.status}
                </span>
                {fullscreenTicket.priority && (
                  <span className="task-board__jira-card-priority" style={{ backgroundColor: getPriorityStyle(fullscreenTicket.priority).bg, color: getPriorityStyle(fullscreenTicket.priority).color }}>{fullscreenTicket.priority}</span>
                )}
                <button
                  type="button"
                  className="task-board__fullscreen-close"
                  onClick={() => setFullscreenTicket(null)}
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <h3 className="task-board__fullscreen-title">{fullscreenTicket.summary}</h3>
              {fullscreenTicket.assignee && (
                <div className="task-board__jira-card-assignee">{fullscreenTicket.assignee}</div>
              )}
              {fullscreenTicket.description && (
                <div
                  className="task-board__jira-card-description task-board__fullscreen-body"
                  dangerouslySetInnerHTML={{ __html: jiraWikiToHtml(fullscreenTicket.description) }}
                />
              )}
              <div className="task-board__fullscreen-footer">
                <button
                  type="button"
                  className="task-board__import-icon-btn"
                  onClick={() => { selectJiraTicket(fullscreenTicket); setFullscreenTicket(null); }}
                  aria-label="Import ticket"
                  title="Import ticket"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2V11M8 11L4.5 7.5M8 11L11.5 7.5M3 14H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <a
                  href={fullscreenTicket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="task-board__gcal-event-link"
                >
                  Open in JIRA
                </a>
              </div>
            </div>
          </div>
        )}

        {fullscreenEvent && (
          <div className="task-board__fullscreen-overlay" onClick={() => setFullscreenEvent(null)}>
            <div className="task-board__fullscreen-panel" onClick={(e) => e.stopPropagation()}>
              <div className="task-board__fullscreen-header">
                <span
                  className="task-board__gcal-event-bar-dot"
                  style={{ backgroundColor: fullscreenEvent.calendar_color }}
                />
                <span className="task-board__gcal-event-calendar">{fullscreenEvent.calendar_name}</span>
                <button
                  type="button"
                  className="task-board__fullscreen-close"
                  onClick={() => setFullscreenEvent(null)}
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <h3 className="task-board__fullscreen-title">{fullscreenEvent.summary}</h3>
              <div className="task-board__gcal-event-time" style={{ fontSize: '0.85rem' }}>
                {fullscreenEvent.start.slice(11, 16)
                  ? `${fullscreenEvent.start.slice(11, 16)} – ${fullscreenEvent.end.slice(11, 16)}`
                  : 'All day'}
                {' · '}
                {new Date(fullscreenEvent.start.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              {fullscreenEvent.location && (
                <div className="task-board__gcal-event-location" style={{ fontSize: '0.85rem', marginTop: '4px' }}>{fullscreenEvent.location}</div>
              )}
              {fullscreenEvent.description && (
                <div
                  className="task-board__fullscreen-body task-board__gcal-event-description"
                  dangerouslySetInnerHTML={{ __html: fullscreenEvent.description }}
                />
              )}
              {fullscreenEvent.attendees.length > 0 && (
                <div className="task-board__fullscreen-section">
                  <span className="task-board__gcal-event-detail-label">Guests ({fullscreenEvent.attendees.length})</span>
                  {fullscreenEvent.attendees.map((a) => (
                    <div key={a.email} className="task-board__gcal-attendee">
                      <span className="task-board__gcal-attendee-name">{a.display_name || a.email}</span>
                      {a.response_status && (
                        <span className={`task-board__gcal-attendee-status task-board__gcal-attendee-status--${a.response_status}`}>
                          {a.response_status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {fullscreenEvent.attachments.length > 0 && (
                <div className="task-board__fullscreen-section">
                  <span className="task-board__gcal-event-detail-label">Files</span>
                  {fullscreenEvent.attachments.map((att) => (
                    <a
                      key={att.file_url}
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="task-board__gcal-attachment"
                    >
                      {att.icon_link && <img src={att.icon_link} alt="" className="task-board__gcal-attachment-icon" />}
                      {att.title}
                    </a>
                  ))}
                </div>
              )}
              <div className="task-board__fullscreen-footer">
                <button
                  type="button"
                  className="task-board__import-icon-btn"
                  onClick={() => { selectGcalEvent(fullscreenEvent); setFullscreenEvent(null); }}
                  aria-label="Import event"
                  title="Import event"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2V11M8 11L4.5 7.5M8 11L11.5 7.5M3 14H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {fullscreenEvent.html_link && (
                  <a
                    href={fullscreenEvent.html_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="task-board__gcal-event-link"
                  >
                    Open in Google Calendar
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleTasks.map((t) => t.id)}
            strategy={rectSortingStrategy}
          >
            <div className="task-board__grid">
              {visibleTasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  jiraProjectUrl={jiraConfig?.projectUrl ?? undefined}
                  gcalCalendarEmail={gcalAuthStatus?.calendarEmail ?? undefined}
                  onEdit={() => startEdit(task)}
                  onDelete={() => setDeletingTask(task)}
                  onToggleStatus={() => toggleStatusMutation.mutate(task)}
                  onExpand={() => handleExpandBoardTask(task)}
                  onNotes={() => setNotePanelTask(task)}
                  onBlockers={() => setBlockerPanelTask(task)}
                  onPlayClick={!task.worker ? () => setWorkerCreateTask(task) : undefined}
                  onWorkerClick={task.worker ? () => window.open(`http://jaw.jarvis.io/${task.worker!.id}`, '_blank') : undefined}
                  onVscodeClick={task.worker && task.worker.effective_state !== 'archived' ? () => window.location.href = `vscode://vscode-remote/ssh-remote+jarvis-worker-${task.worker!.id}.jarvis.svc/home/node/jarvis` : undefined}
                />
              ))}
              {visibleTasks.length === 0 && (
                <EmptyState
                  scope={scope}
                  date={dateStr}
                />
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* Notes panel overlay */}
        {notePanelTask && (
          <NotePanel
            taskTitle={notePanelTask.title}
            notes={taskNotes}
            onClose={() => setNotePanelTask(null)}
            onCreate={(content) => createNoteMutation.mutate({ taskId: notePanelTask.id, content })}
            onUpdate={(noteId, content) => updateNoteMutation.mutate({ taskId: notePanelTask.id, noteId, content })}
            onDelete={(noteId) => deleteNoteMutation.mutate({ taskId: notePanelTask.id, noteId })}
          />
        )}
        {blockerPanelTask && (
          <BlockerPanel
            title={blockerPanelTask.title}
            blockers={taskBlockers}
            onClose={() => setBlockerPanelTask(null)}
            onCreate={(title) => createBlockerMutation.mutate({ taskId: blockerPanelTask.id, title })}
            onResolve={(blockerId) => resolveBlockerMutation.mutate(blockerId)}
            onDelete={(blockerId) => deleteBlockerMutation.mutate(blockerId)}
          />
        )}
      </section>

      {/* Worker creation dialog from task card */}
      {workerCreateTask && (
        <div className="task-board__confirm-overlay" onClick={() => { setWorkerCreateTask(null); setWorkerRepoIds([]); }}>
          <div className="task-board__confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Create worker for <strong>{workerCreateTask.title}</strong>?</p>
            {repositories.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 6 }}>Repositories:</p>
                {repositories.map((repo: Repository) => (
                  <label key={repo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#e2e8f0', marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={workerRepoIds.includes(repo.id)}
                      onChange={() => setWorkerRepoIds(prev => prev.includes(repo.id) ? prev.filter(r => r !== repo.id) : [...prev, repo.id])}
                    />
                    {repo.git_url} @{repo.branch}
                  </label>
                ))}
              </div>
            )}
            <div className="task-board__confirm-actions">
              <Button onClick={() => createWorkerMutation.mutate({ task_id: workerCreateTask.id, repository_ids: workerRepoIds })}>
                Create Worker
              </Button>
              <Button variant="ghost" onClick={() => { setWorkerCreateTask(null); setWorkerRepoIds([]); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Task deletion confirmation */}
      {deletingTask && (
        <div className="task-board__confirm-overlay" onClick={() => setDeletingTask(null)}>
          <div className="task-board__confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Delete <strong>{deletingTask.title}</strong>?</p>
            {deletingTask.note_count > 0 && (
              <p className="task-board__confirm-warn">
                This will also delete {deletingTask.note_count} note{deletingTask.note_count > 1 ? 's' : ''}.
              </p>
            )}
            <div className="task-board__confirm-actions">
              <Button onClick={() => deleteMutation.mutate(deletingTask.id)}>
                Delete
              </Button>
              <Button variant="ghost" onClick={() => setDeletingTask(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
