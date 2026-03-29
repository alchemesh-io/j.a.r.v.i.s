import { useState, useEffect, useCallback } from 'react';
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
import { Card, Button, Input } from '@jarvis/jads';
import { listTasks, type Task } from '../../api/client';
import BrainAnimation from './BrainAnimation';
import './Dashboard.css';

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface MetricBlockProps {
  id: string;
  title: string;
  icon: string;
  metrics: { label: string; count: number; color: string }[];
  compact: boolean;
}

function MetricBlock({ id, title, icon, metrics, compact }: MetricBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card title={compact ? undefined : title}>
        <div className="dashboard__block-header">
          {compact && <span className="dashboard__block-icon">{icon}</span>}
        </div>
        <div className="dashboard__metrics">
          {metrics.map((m) => (
            <div key={m.label} className="dashboard__metric">
              <span
                className="dashboard__metric-dot"
                style={{ backgroundColor: m.color }}
              />
              {!compact && <span className="dashboard__metric-label">{m.label}</span>}
              <span className="dashboard__metric-count">{m.count}</span>
            </div>
          ))}
        </div>
      </Card>
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
    { label: 'Remaining', count: remaining, color: '#1a1a2e' },
  ];
}

export default function Dashboard() {
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
    { label: 'Idle', count: 2, color: '#1a1a2e' },
    { label: 'Working', count: 1, color: '#f97316' },
    { label: 'Attention', count: 0, color: '#ef4444' },
    { label: 'Done', count: 3, color: '#22c55e' },
  ];

  const blocks: Record<string, MetricBlockProps> = {
    workers: {
      id: 'workers',
      title: 'Workers',
      icon: '\u2699',
      metrics: mockWorkerMetrics,
      compact,
    },
    'daily-tasks': {
      id: 'daily-tasks',
      title: 'Daily Tasks',
      icon: '\ud83d\udcc5',
      metrics: getTaskMetrics(dailyTasks),
      compact,
    },
    'weekly-tasks': {
      id: 'weekly-tasks',
      title: 'Weekly Tasks',
      icon: '\ud83d\udcc6',
      metrics: getTaskMetrics(weeklyTasks),
      compact,
    },
  };

  return (
    <div className="dashboard">
      <div className="dashboard__controls">
        <Button
          variant="ghost"
          onClick={() => setCompact((c) => !c)}
          aria-label={compact ? 'Expand blocks' : 'Compact blocks'}
        >
          {compact ? 'Expand' : 'Compact'}
        </Button>
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
