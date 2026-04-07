import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Select, Button, Input } from '@jarvis/jads';
import {
  listKeyFocuses,
  createKeyFocus,
  updateKeyFocus,
  deleteKeyFocus,
  listWeeklies,
  createWeekly,
  createKeyFocusBlocker,
  listKeyFocusBlockers,
  updateBlocker,
  deleteBlocker,
  type KeyFocus,
  type KeyFocusKind,
  type KeyFocusStatus,
  type KeyFocusFrequency,
} from '../../api/client';
import { BlockerPanel } from '../TaskBoard/BlockerPanel';
import './KeyFocusBoard.css';

// --- helpers ---

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getWeekStart(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  return formatDate(d);
}

function getQuarterStartWeek(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const quarterMonth = Math.floor(d.getMonth() / 3) * 3;
  const quarterStart = new Date(d.getFullYear(), quarterMonth, 1);
  // Find the Sunday (week start) on or before the quarter start
  const dow = quarterStart.getDay();
  quarterStart.setDate(quarterStart.getDate() - dow);
  return formatDate(quarterStart);
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  return `W${getISOWeek(d)} — ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function getISOWeek(d: Date): number {
  const tmp = new Date(d.getTime());
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatQuarterLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `Q${quarter} ${d.getFullYear()}`;
}

const KIND_OPTIONS: { value: KeyFocusKind; label: string }[] = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'learning', label: 'Learning' },
  { value: 'support', label: 'Support' },
  { value: 'operational', label: 'Operational' },
  { value: 'side_quest', label: 'Side Quest' },
];

const STATUS_OPTIONS: { value: KeyFocusStatus; label: string }[] = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'succeed', label: 'Succeed' },
  { value: 'failed', label: 'Failed' },
];

const FREQUENCY_OPTIONS: { value: KeyFocusFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'quarterly', label: 'Quarterly' },
];

type FrequencyFilter = KeyFocusFrequency | 'all';

const FREQUENCY_FILTER_OPTIONS: { value: FrequencyFilter; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'all', label: 'All' },
];

const KIND_COLORS: Record<KeyFocusKind, string> = {
  delivery: '#3b82f6',
  learning: '#22c55e',
  support: '#a855f7',
  operational: '#f97316',
  side_quest: '#06b6d4',
};

const STORAGE_KEY = 'jarvis-keyfocusboard';

interface BoardPrefs {
  frequency: FrequencyFilter;
  selectedDate: string;
}

function loadPrefs(): BoardPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { frequency: 'weekly', selectedDate: formatDate(new Date()) };
}

function savePrefs(prefs: BoardPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export default function KeyFocusBoard() {
  const queryClient = useQueryClient();
  const [prefs] = useState(loadPrefs);

  const [selectedDate, setSelectedDate] = useState(() => new Date(prefs.selectedDate + 'T00:00:00'));
  const [frequency, setFrequency] = useState<FrequencyFilter>(prefs.frequency);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingKF, setEditingKF] = useState<KeyFocus | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formKind, setFormKind] = useState<KeyFocusKind>('delivery');
  const [formFrequency, setFormFrequency] = useState<KeyFocusFrequency>('weekly');
  const [formStatus, setFormStatus] = useState<KeyFocusStatus>('in_progress');
  const [formDate, setFormDate] = useState(() => formatDate(selectedDate));

  const [deletingKF, setDeletingKF] = useState<KeyFocus | null>(null);
  const [blockerPanelKF, setBlockerPanelKF] = useState<KeyFocus | null>(null);

  const dateStr = formatDate(selectedDate);

  useEffect(() => {
    savePrefs({ frequency, selectedDate: dateStr });
  }, [frequency, dateStr]);

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

  const { data: weeklies = [] } = useQuery({
    queryKey: ['weeklies'],
    queryFn: listWeeklies,
  });

  const weeklyMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const w of weeklies) map.set(w.id, w.week_start);
    return map;
  }, [weeklies]);

  const { data: keyFocuses = [] } = useQuery({
    queryKey: ['key-focuses', dateStr, frequency],
    queryFn: () => listKeyFocuses(
      frequency === 'all'
        ? { scope: 'all' }
        : { date: dateStr, scope: frequency, frequency: frequency }
    ),
  });

  const { data: blockers = [] } = useQuery({
    queryKey: ['key-focus-blockers', blockerPanelKF?.id],
    queryFn: () => blockerPanelKF ? listKeyFocusBlockers(blockerPanelKF.id) : Promise.resolve([]),
    enabled: !!blockerPanelKF,
  });

  const createMutation = useMutation({
    mutationFn: async (body: Parameters<typeof createKeyFocus>[0]) => {
      return createKeyFocus(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-focuses'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Parameters<typeof updateKeyFocus>[1] }) => {
      return updateKeyFocus(id, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-focuses'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKeyFocus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-focuses'] });
      setDeletingKF(null);
    },
  });

  const createBlockerMutation = useMutation({
    mutationFn: async ({ kfId, title }: { kfId: number; title: string }) => {
      return createKeyFocusBlocker(kfId, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-focus-blockers'] });
      queryClient.invalidateQueries({ queryKey: ['key-focuses'] });
    },
  });

  const resolveBlockerMutation = useMutation({
    mutationFn: async (blockerId: number) => {
      return updateBlocker(blockerId, { status: 'resolved' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-focus-blockers'] });
      queryClient.invalidateQueries({ queryKey: ['key-focuses'] });
    },
  });

  const deleteBlockerMutation = useMutation({
    mutationFn: deleteBlocker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-focus-blockers'] });
      queryClient.invalidateQueries({ queryKey: ['key-focuses'] });
    },
  });

  function resetForm() {
    setShowForm(false);
    setEditingKF(null);
    setFormTitle('');
    setFormDescription('');
    setFormKind('delivery');
    setFormFrequency('weekly');
    setFormStatus('in_progress');
    setFormDate(dateStr);
  }

  async function openEditForm(kf: KeyFocus) {
    setEditingKF(kf);
    setFormTitle(kf.title);
    setFormDescription(kf.description ?? '');
    setFormKind(kf.kind);
    setFormFrequency(kf.frequency);
    setFormStatus(kf.status);
    // Resolve the weekly's week_start to pre-fill date
    const weeklies = await listWeeklies();
    const weekly = weeklies.find((w) => w.id === kf.weekly_id);
    setFormDate(weekly?.week_start ?? dateStr);
    setShowForm(true);
  }

  const handleSubmit = useCallback(async () => {
    if (!formTitle.trim()) return;

    // Resolve weekly from formDate
    const weekStart = formFrequency === 'quarterly'
      ? getQuarterStartWeek(formDate)
      : getWeekStart(formDate);
    let weeklies = await listWeeklies();
    let weekly = weeklies.find((w) => w.week_start === weekStart);
    if (!weekly) {
      weekly = await createWeekly({ week_start: weekStart });
    }

    if (editingKF) {
      updateMutation.mutate({
        id: editingKF.id,
        body: {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          kind: formKind,
          status: formStatus,
          frequency: formFrequency,
          weekly_id: weekly.id,
        },
      });
    } else {
      createMutation.mutate({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        kind: formKind,
        frequency: formFrequency,
        weekly_id: weekly.id,
      });
    }
  }, [formTitle, formDescription, formKind, formFrequency, formStatus, formDate, editingKF]);

  return (
    <div className="kf-board">
      <div className="kf-board__toolbar">
        <div className="kf-board__toolbar-left">
          <button
            type="button"
            className="kf-board__create-btn"
            onClick={() => { setShowForm(true); setEditingKF(null); }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Create
          </button>
          <div className="kf-board__calendar-dropdown" ref={calendarRef}>
            <button
              type="button"
              className={`kf-board__date-btn${showCalendar ? ' kf-board__date-btn--open' : ''}`}
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
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="kf-board__date-chevron">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showCalendar && (
              <div className="kf-board__calendar-panel">
                <Calendar
                  selectedDate={selectedDate}
                  onDateSelect={(d) => { setSelectedDate(d); setShowCalendar(false); }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="kf-board__toolbar-right">
          <div className="kf-board__frequency-tabs" role="tablist" aria-label="Frequency filter">
            {FREQUENCY_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={frequency === opt.value}
                className={`kf-board__freq-tab${frequency === opt.value ? ' kf-board__freq-tab--active' : ''}`}
                onClick={() => setFrequency(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div className="kf-board__grid">
        {keyFocuses.length === 0 && (
          <div className="kf-board__empty">
            <p>No key focuses for this period</p>
            <Button variant="primary" onClick={() => setShowForm(true)}>Create one</Button>
          </div>
        )}
        {keyFocuses.map((kf) => (
          <article
            key={kf.id}
            className={`kf-card kf-card--${kf.status}`}
          >
            <div className="kf-card__header">
              <span className="kf-card__kind-badge" style={{ backgroundColor: KIND_COLORS[kf.kind] }}>
                {kf.kind.replace('_', ' ')}
              </span>
              <span className={`kf-card__status kf-card__status--${kf.status}`}>
                {kf.status === 'in_progress' && '●'}
                {kf.status === 'succeed' && '✓'}
                {kf.status === 'failed' && '✕'}
              </span>
            </div>
            <h4 className="kf-card__title">{kf.title}</h4>
            {kf.description && (
              <p className="kf-card__description">{kf.description.length > 100 ? kf.description.slice(0, 100) + '...' : kf.description}</p>
            )}
            <div className="kf-card__meta">
              <span className="kf-card__freq-badge">{kf.frequency}</span>
              {weeklyMap.has(kf.weekly_id) && (
                <span className="kf-card__period">
                  {kf.frequency === 'quarterly'
                    ? formatQuarterLabel(weeklyMap.get(kf.weekly_id)!)
                    : formatWeekLabel(weeklyMap.get(kf.weekly_id)!)}
                </span>
              )}
              <span className="kf-card__task-count">{kf.task_count} task{kf.task_count !== 1 ? 's' : ''}</span>
            </div>
            <div className="kf-card__actions">
              <button type="button" className="kf-card__action-btn" onClick={() => openEditForm(kf)} aria-label="Edit">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button type="button" className="kf-card__action-btn" onClick={() => setDeletingKF(kf)} aria-label="Delete">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                type="button"
                className="kf-card__action-btn"
                onClick={() => setBlockerPanelKF(blockerPanelKF?.id === kf.id ? null : kf)}
                aria-label="Blockers"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {kf.blocker_count > 0 && <span className="kf-card__blocker-badge">{kf.blocker_count}</span>}
              </button>
            </div>

          </article>
        ))}
      </div>

      {/* Blocker panel overlay */}
      {blockerPanelKF && (
        <BlockerPanel
          title={blockerPanelKF.title}
          blockers={blockers}
          onClose={() => setBlockerPanelKF(null)}
          onCreate={(title) => createBlockerMutation.mutate({ kfId: blockerPanelKF.id, title })}
          onResolve={(blockerId) => resolveBlockerMutation.mutate(blockerId)}
          onDelete={(blockerId) => deleteBlockerMutation.mutate(blockerId)}
        />
      )}

      {/* Create/Edit form overlay */}
      {showForm && (
        <div className="kf-board__overlay" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="kf-board__form">
            <h3>{editingKF ? 'Edit Key Focus' : 'Create Key Focus'}</h3>
            <Input
              label="Title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Key focus title..."
              autoFocus
            />
            <Input
              label="Description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description..."
            />
            <Select
              label="Kind"
              options={KIND_OPTIONS}
              value={formKind}
              onChange={(e) => setFormKind(e.target.value as KeyFocusKind)}
            />
            <Select
              label="Frequency"
              options={FREQUENCY_OPTIONS}
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value as KeyFocusFrequency)}
            />
            <div className="kf-board__form-field">
              <label className="kf-board__form-label">Date</label>
              <input
                type="date"
                className="kf-board__form-date-input"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            {editingKF && (
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as KeyFocusStatus)}
              />
            )}
            <div className="kf-board__form-actions">
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={!formTitle.trim()}>
                {editingKF ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingKF && (
        <div className="kf-board__overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeletingKF(null); }}>
          <div className="kf-board__form kf-board__form--confirm">
            <h3>Delete Key Focus</h3>
            <p>Are you sure you want to delete "<strong>{deletingKF.title}</strong>"? This will also remove all associated blockers and task links.</p>
            <div className="kf-board__form-actions">
              <Button variant="ghost" onClick={() => setDeletingKF(null)}>Cancel</Button>
              <Button variant="primary" className="kf-board__delete-btn" onClick={() => deleteMutation.mutate(deletingKF.id)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
