import { useState, useCallback } from 'react';
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
  type Task,
  type TaskType,
} from '../../api/client';
import './TaskBoard.css';

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function SortableTaskCard({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        title={task.title}
        type={task.type}
        status={task.status}
        jiraTicketId={task.jira_ticket_id ?? undefined}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

const SCOPE_OPTIONS = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'all', label: 'All' },
];

export default function TaskBoard() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scope, setScope] = useState<'daily' | 'weekly' | 'all'>('daily');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<TaskType>('implementation');
  const [formJira, setFormJira] = useState('');

  const dateStr = formatDate(selectedDate);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', dateStr, scope],
    queryFn: () => listTasks({ date: dateStr, scope }),
  });

  const { data: daily } = useQuery({
    queryKey: ['daily', dateStr],
    queryFn: () => getDailyByDate(dateStr).catch(() => null),
    enabled: scope === 'daily',
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowCreateForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<Task>) =>
      updateTask(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTask(null);
    },
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
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function resetForm() {
    setFormTitle('');
    setFormType('implementation');
    setFormJira('');
  }

  function extractJiraId(input: string): string | undefined {
    const match = input.match(/([A-Z]+-\d+)/);
    return match ? match[1] : undefined;
  }

  function handleCreate() {
    const jiraId = formJira ? extractJiraId(formJira) : undefined;
    createMutation.mutate({
      title: formTitle,
      type: formType,
      jira_ticket_id: jiraId,
    });
  }

  function handleSaveEdit() {
    if (!editingTask) return;
    updateMutation.mutate({
      id: editingTask.id,
      title: formTitle,
      type: formType,
      jira_ticket_id: formJira || undefined,
    });
  }

  function startEdit(task: Task) {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormType(task.type);
    setFormJira(task.jira_ticket_id ?? '');
    setShowCreateForm(false);
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !daily) return;

      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(tasks, oldIndex, newIndex);
        reorderMutation.mutate({
          dailyId: daily.id,
          items: reordered.map((t, i) => ({ task_id: t.id, priority: i + 1 })),
        });
      }
    },
    [tasks, daily, reorderMutation],
  );

  return (
    <div className="task-board">
      {/* Left sidebar: create button + calendar */}
      <aside className="task-board__sidebar">
        <Button
          className="task-board__create-btn"
          onClick={() => { setShowCreateForm(true); setEditingTask(null); resetForm(); }}
        >
          + Create
        </Button>
        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
      </aside>

      {/* Top-right: scope dropdown */}
      <div className="task-board__toolbar">
        <Select
          label=""
          value={scope}
          options={SCOPE_OPTIONS}
          onChange={(e) => setScope(e.target.value as 'daily' | 'weekly' | 'all')}
        />
      </div>

      {/* Main content area */}
      <section className="task-board__content">
        {(showCreateForm || editingTask) && (
          <div className="task-board__form">
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
            <div className="task-board__form-actions">
              {editingTask ? (
                <Button onClick={handleSaveEdit}>Save</Button>
              ) : (
                <Button onClick={handleCreate}>Create</Button>
              )}
              <Button
                variant="ghost"
                onClick={() => { setShowCreateForm(false); setEditingTask(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={rectSortingStrategy}
          >
            <div className="task-board__grid">
              {tasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  onEdit={() => startEdit(task)}
                  onDelete={() => deleteMutation.mutate(task.id)}
                />
              ))}
              {tasks.length === 0 && (
                <p className="task-board__empty">No tasks for this selection.</p>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    </div>
  );
}
