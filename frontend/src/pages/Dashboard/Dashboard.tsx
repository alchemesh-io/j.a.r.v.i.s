import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, Input } from '@jarvis/jads';
import { listTasks, type Task } from '../../api/client';
import BrainAnimation from './BrainAnimation';
import './Dashboard.css';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RedirectIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 2H2V14H14V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 2H14V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface MetricBlockProps {
  id: string;
  title: string;
  metrics: { label: string; count: number; color: string }[];
  compact: boolean;
  onNavigate?: () => void;
}

function MetricBlock({ id, title, metrics, compact, onNavigate }: MetricBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div className="dashboard__card-wrapper">
        {onNavigate && (
          <button type="button" className="dashboard__card-redirect" onPointerDown={(e) => e.stopPropagation()} onClick={onNavigate} aria-label={`Go to ${title}`}>
            <RedirectIcon />
          </button>
        )}
        <Card title={title}>
          <div className="dashboard__metrics">
            {metrics.map((m) => (
              <div key={m.label} className="dashboard__metric">
                <span className="dashboard__metric-count" style={{ color: m.color }}>{m.count}</span>
                {!compact && <span className="dashboard__metric-label" style={{ color: m.color }}>{m.label}</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const STORAGE_KEY = 'jarvis-dashboard-layout';
const DEFAULT_ORDER = ['workers', 'daily-tasks', 'weekly-tasks'];

function getTaskMetrics(tasks: Task[]) {
  const refinement = tasks.filter((t) => t.type === 'refinement').length;
  const implementation = tasks.filter((t) => t.type === 'implementation').length;
  const review = tasks.filter((t) => t.type === 'review').length;
  const remaining = tasks.filter((t) => t.status !== 'done').length;
  return [
    { label: 'Refinement', count: refinement, color: '#3b82f6' },
    { label: 'Implementation', count: implementation, color: '#f97316' },
    { label: 'Review', count: review, color: '#ef4444' },
    { label: 'Remaining', count: remaining, color: '#94a3b8' },
  ];
}

const TASKBOARD_STORAGE_KEY = 'jarvis-taskboard';

function navigateToTasks(navigate: ReturnType<typeof useNavigate>, scope: 'daily' | 'weekly') {
  const today = formatDate(new Date());
  localStorage.setItem(TASKBOARD_STORAGE_KEY, JSON.stringify({
    scope,
    selectedDate: today,
    doneMode: 'dim',
  }));
  navigate('/tasks');
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [blockOrder, setBlockOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ORDER;
    } catch {
      return DEFAULT_ORDER;
    }
  });
  const [compact, setCompact] = useState(false);

  const today = formatDate(new Date());

  const { data: dailyTasks = [] } = useQuery({
    queryKey: ['tasks', today, 'daily'],
    queryFn: () => listTasks({ date: today, scope: 'daily' }),
  });

  const { data: weeklyTasks = [] } = useQuery({
    queryKey: ['tasks', today, 'weekly'],
    queryFn: () => listTasks({ date: today, scope: 'weekly' }),
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blockOrder));
  }, [blockOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setBlockOrder((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    [],
  );

  const mockWorkerMetrics = [
    { label: 'Idle', count: 2, color: '#94a3b8' },
    { label: 'Working', count: 1, color: '#f97316' },
    { label: 'Attention', count: 0, color: '#ef4444' },
    { label: 'Done', count: 3, color: '#22c55e' },
  ];

  const blocks: Record<string, MetricBlockProps> = {
    workers: {
      id: 'workers',
      title: 'Workers',
      metrics: mockWorkerMetrics,
      compact,
    },
    'daily-tasks': {
      id: 'daily-tasks',
      title: 'Daily Tasks',
      metrics: getTaskMetrics(dailyTasks),
      compact,
      onNavigate: () => navigateToTasks(navigate, 'daily'),
    },
    'weekly-tasks': {
      id: 'weekly-tasks',
      title: 'Weekly Tasks',
      metrics: getTaskMetrics(weeklyTasks),
      compact,
      onNavigate: () => navigateToTasks(navigate, 'weekly'),
    },
  };

  return (
    <div className="dashboard">
      <div className="dashboard__controls">
        <button
          type="button"
          role="switch"
          className={`dashboard__compact-toggle ${compact ? '' : 'dashboard__compact-toggle--off'}`}
          onClick={() => setCompact((c) => !c)}
          aria-checked={compact}
          title={compact ? 'Expand blocks' : 'Compact blocks'}
        >
          <span className="dashboard__compact-toggle-thumb" />
          <span className="dashboard__compact-toggle-label">Compact</span>
        </button>
      </div>

      <div className="dashboard__grid">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blockOrder}
            strategy={verticalListSortingStrategy}
          >
            {blockOrder.map((id) => {
              const block = blocks[id];
              return block ? <MetricBlock key={id} {...block} /> : null;
            })}
          </SortableContext>
        </DndContext>
      </div>

      <div className="dashboard__brain">
        <BrainAnimation />
      </div>

      <div className="dashboard__chat">
        <Input
          label=""
          placeholder="Ask J.A.R.V.I.S anything..."
          value=""
          onChange={() => {}}
          disabled
        />
      </div>
    </div>
  );
}
