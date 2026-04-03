import { useState, useCallback, useEffect } from 'react';
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
  getJiraConfig,
  listJiraTickets,
  getGcalAuthStatus,
  getGcalAuthLoginUrl,
  listGcalEvents,
  type Task,
  type TaskType,
  type JiraTicket,
  type CalendarEvent,
} from '../../api/client';
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

const SCOPE_OPTIONS = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'all', label: 'All' },
];

type ImportSource = 'manual' | 'jira' | 'gcal';

// --- SortableTaskCard ---

function SortableTaskCard({
  task,
  jiraProjectUrl,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  task: Task;
  jiraProjectUrl?: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskCard
        title={task.title}
        type={task.type}
        status={task.status}
        jiraTicketId={task.jira_ticket_id ?? undefined}
        jiraProjectUrl={jiraProjectUrl}
        dates={task.dates}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
        dragListeners={listeners}
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

  const [importSource, setImportSource] = useState<ImportSource>('manual');
  const [gcalDate, setGcalDate] = useState(() => formatDate(new Date()));
  const [gcalView, setGcalView] = useState<'daily' | 'weekly'>('daily');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const today = formatDate(new Date());
  const dateStr = formatDate(selectedDate);

  // Persist prefs
  useEffect(() => {
    const newPrefs: BoardPrefs = { scope, selectedDate: dateStr, doneMode };
    savePrefs(newPrefs);
  }, [scope, dateStr, doneMode]);

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
    select: (data) => [...data].sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9)),
  });

  const visibleTasks = doneMode === 'hide'
    ? tasks.filter((t) => t.status !== 'done')
    : tasks;

  const { data: daily } = useQuery({
    queryKey: ['daily', dateStr],
    queryFn: () => getDailyByDate(dateStr).catch(() => null),
    enabled: scope === 'daily',
  });

  const createMutation = useMutation({
    mutationFn: async (params: {
      title: string;
      type: TaskType;
      jira_ticket_id?: string;
      dates: string[];
    }) => {
      const { dates, ...body } = params;
      const task = await createTask(body);
      if (dates.length > 0) {
        await assignTaskToDates(task.id, dates);
      }
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['daily'] });
      setShowCreateForm(false);
      resetForm();
    },
  });


  const toggleStatusMutation = useMutation({
    mutationFn: (task: Task) =>
      updateTask(task.id, { status: task.status === 'done' ? 'created' : 'done' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
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
    setImportSource('manual');
  }

  function selectJiraTicket(ticket: JiraTicket) {
    setFormTitle(ticket.summary);
    setFormJira(ticket.key);
    setImportSource('manual');
  }

  function selectGcalEvent(event: CalendarEvent) {
    setFormTitle(event.summary);
    setFormType('refinement');
    const eventDate = event.start.slice(0, 10);
    if (eventDate && !formDates.includes(eventDate)) {
      setFormDates((prev) => [...prev, eventDate].sort());
    }
    setImportSource('manual');
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

  function handleCreate() {
    const jiraId = formJira ? extractJiraId(formJira) : undefined;
    createMutation.mutate({
      title: formTitle,
      type: formType,
      jira_ticket_id: jiraId,
      dates: formDates,
    });
  }

  async function handleSaveEdit() {
    if (!editingTask) return;

    await updateTask(editingTask.id, {
      title: formTitle,
      type: formType,
      jira_ticket_id: formJira || undefined,
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

    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['daily'] });
    setEditingTask(null);
    resetForm();
  }

  function startEdit(task: Task) {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormType(task.type);
    setFormJira(task.jira_ticket_id ?? '');
    setFormDates(task.dates ?? []);
    setFormDateInput('');
    setShowCreateForm(false);
  }

  function handleDateChange(date: Date) {
    setSelectedDate(date);
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = visibleTasks.findIndex((t) => t.id === active.id);
      const newIndex = visibleTasks.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(visibleTasks, oldIndex, newIndex);
      queryClient.setQueryData(['tasks', dateStr, scope], reordered);

      if (daily) {
        reorderMutation.mutate({
          dailyId: daily.id,
          items: reordered.map((t, i) => ({ task_id: t.id, priority: i + 1 })),
        });
      }
    },
    [visibleTasks, daily, dateStr, scope, reorderMutation, queryClient],
  );

  const closeForm = () => { setShowCreateForm(false); setEditingTask(null); resetForm(); };

  return (
    <div className="task-board">
      <aside className="task-board__sidebar">
        <Button
          className="task-board__create-btn"
          onClick={() => { setShowCreateForm(true); setEditingTask(null); resetForm(); }}
        >
          + Create
        </Button>
        <Calendar selectedDate={selectedDate} onDateSelect={handleDateChange} />
      </aside>

      <div className="task-board__toolbar">
        <Select
          label=""
          value={scope}
          options={SCOPE_OPTIONS}
          onChange={(e) => setScope(e.target.value as 'daily' | 'weekly' | 'all')}
        />
        <button
          type="button"
          role="switch"
          className={`task-board__done-toggle ${doneMode === 'hide' ? 'task-board__done-toggle--off' : ''}`}
          onClick={() => setDoneMode((m) => m === 'dim' ? 'hide' : 'dim')}
          aria-checked={doneMode !== 'hide'}
          title={doneMode === 'hide' ? 'Show done tasks' : 'Hide done tasks'}
        >
          <span className="task-board__done-toggle-thumb" />
          <span className="task-board__done-toggle-label">Done</span>
        </button>
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
                  {jiraLoading && <p className="task-board__import-loading">Loading tickets...</p>}
                  {!jiraLoading && jiraTickets.length === 0 && (
                    <p className="task-board__import-empty">No tickets available</p>
                  )}
                  {!jiraLoading && (() => {
                    const grouped: Record<string, Record<string, typeof jiraTickets>> = {};
                    for (const ticket of jiraTickets) {
                      const project = ticket.key.split('-')[0];
                      if (!grouped[project]) grouped[project] = {};
                      if (!grouped[project][ticket.status]) grouped[project][ticket.status] = [];
                      grouped[project][ticket.status].push(ticket);
                    }
                    return Object.entries(grouped).map(([project, statuses]) => (
                      <div key={project} className="task-board__jira-group">
                        <h4 className="task-board__jira-group-project">{project}</h4>
                        {Object.entries(statuses).map(([status, tickets]) => (
                          <div key={status} className="task-board__jira-group-status">
                            <h5 className="task-board__jira-group-status-label">{status} ({tickets.length})</h5>
                            {tickets.map((ticket) => (
                              <div key={ticket.key} className="task-board__jira-card">
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
                                  {ticket.priority && (
                                    <span className="task-board__jira-card-priority">{ticket.priority}</span>
                                  )}
                                </div>
                                <div className="task-board__jira-card-title">{ticket.summary}</div>
                                {ticket.assignee && (
                                  <div className="task-board__jira-card-assignee">{ticket.assignee}</div>
                                )}
                                <div className="task-board__jira-card-actions">
                                  <Button
                                    variant="secondary"
                                    onClick={() => selectJiraTicket(ticket)}
                                  >
                                    Import
                                  </Button>
                                  {ticket.description && (
                                    <button
                                      type="button"
                                      className="task-board__jira-card-expand"
                                      onClick={() => setExpandedTicket(expandedTicket === ticket.key ? null : ticket.key)}
                                    >
                                      {expandedTicket === ticket.key ? 'Hide details' : 'Show details'}
                                    </button>
                                  )}
                                </div>
                                {expandedTicket === ticket.key && ticket.description && (
                                  <div className="task-board__jira-card-description">
                                    {ticket.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
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
                                <div className="task-board__gcal-event">
                                  <div
                                    className="task-board__gcal-event-bar"
                                    style={{ backgroundColor: event.calendar_color }}
                                  />
                                  <div className="task-board__gcal-event-body">
                                    <div className="task-board__gcal-event-header">
                                      <span className="task-board__gcal-event-time">{timeLabel}</span>
                                      <span className="task-board__gcal-event-calendar">{event.calendar_name}</span>
                                    </div>
                                    <div className="task-board__gcal-event-title">{event.summary}</div>
                                    {event.location && (
                                      <div className="task-board__gcal-event-location">{event.location}</div>
                                    )}
                                    <div className="task-board__gcal-event-actions">
                                      <Button variant="secondary" onClick={() => selectGcalEvent(event)}>
                                        Import
                                      </Button>
                                      {(event.description || event.attendees.length > 0 || event.attachments.length > 0) && (
                                        <button
                                          type="button"
                                          className="task-board__gcal-event-expand"
                                          onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                        >
                                          {isExpanded ? 'Hide details' : 'Show details'}
                                        </button>
                                      )}
                                      {event.html_link && (
                                        <a
                                          href={event.html_link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="task-board__gcal-event-link"
                                        >
                                          Open in Google
                                        </a>
                                      )}
                                    </div>
                                    {isExpanded && (
                                      <div className="task-board__gcal-event-details">
                                        {event.description && (
                                          <div className="task-board__gcal-event-description">{event.description}</div>
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
                    </>
                  )}
                </div>
              )}

              {(importSource === 'manual' || editingTask) && (
                <>
                  <Input
                    label="Title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Task title"
                  />
                  <Input
                    label="JIRA Ticket"
                    value={formJira}
                    onChange={(e) => setFormJira(e.target.value)}
                    placeholder="JAR-123 or full URL"
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

                  <div className="task-board__form-dates">
                    <label className="task-board__form-label">Dates</label>
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

                  <div className="task-board__form-actions">
                    {editingTask ? (
                      <>
                        <Button onClick={handleSaveEdit}>Save</Button>
                      </>
                    ) : (
                      <Button onClick={handleCreate} disabled={!formTitle}>Create</Button>
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
                  onEdit={() => startEdit(task)}
                  onDelete={() => deleteMutation.mutate(task.id)}
                  onToggleStatus={() => toggleStatusMutation.mutate(task)}
                />
              ))}
              {visibleTasks.length === 0 && (
                <p className="task-board__empty">No tasks for this selection.</p>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    </div>
  );
}
