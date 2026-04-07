import { useState, useCallback, useEffect, useRef } from 'react';
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
  type KeyFocus,
  type KeyFocusKind,
  type KeyFocusStatus,
  type KeyFocusFrequency,
  type Blocker,
} from '../../api/client';
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

const KIND_COLORS: Record<KeyFocusKind, string> = {
  delivery: '#3b82f6',
  learning: '#22c55e',
  support: '#a855f7',
  operational: '#f97316',
  side_quest: '#06b6d4',
};

const STORAGE_KEY = 'jarvis-keyfocusboard';

interface BoardPrefs {
  frequency: KeyFocusFrequency;
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
  const [frequency, setFrequency] = useState<KeyFocusFrequency>(prefs.frequency);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingKF, setEditingKF] = useState<KeyFocus | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formKind, setFormKind] = useState<KeyFocusKind>('delivery');
  const [formFrequency, setFormFrequency] = useState<KeyFocusFrequency>('weekly');
  const [formStatus, setFormStatus] = useState<KeyFocusStatus>('in_progress');

  const [deletingKF, setDeletingKF] = useState<KeyFocus | null>(null);
  const [blockerPanelKF, setBlockerPanelKF] = useState<KeyFocus | null>(null);
  const [blockerTitle, setBlockerTitle] = useState('');

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

  const { data: keyFocuses = [] } = useQuery({
    queryKey: ['key-focuses', dateStr, frequency],
    queryFn: () => listKeyFocuses({ date: dateStr, scope: frequency }),
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
      setBlockerTitle('');
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

  function resetForm() {
    setShowForm(false);
    setEditingKF(null);
    setFormTitle('');
    setFormDescription('');
    setFormKind('delivery');
    setFormFrequency('weekly');
    setFormStatus('in_progress');
  }

  function openEditForm(kf: KeyFocus) {
    setEditingKF(kf);
    setFormTitle(kf.title);
    setFormDescription(kf.description ?? '');
    setFormKind(kf.kind);
    setFormFrequency(kf.frequency);
    setFormStatus(kf.status);
    setShowForm(true);
  }

  const handleSubmit = useCallback(async () => {
    if (!formTitle.trim()) return;
    if (editingKF) {
      updateMutation.mutate({
        id: editingKF.id,
        body: {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          kind: formKind,
          status: formStatus,
          frequency: formFrequency,
        },
      });
    } else {
      // Find or create weekly for the selected date
      const weekStart = getWeekStart(dateStr);
      let weeklies = await listWeeklies();
      let weekly = weeklies.find((w) => w.week_start === weekStart);
      if (!weekly) {
        weekly = await createWeekly({ week_start: weekStart });
      }
      createMutation.mutate({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        kind: formKind,
        frequency: formFrequency,
        weekly_id: weekly.id,
      });
    }
  }, [formTitle, formDescription, formKind, formFrequency, formStatus, editingKF, dateStr]);

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
            {FREQUENCY_OPTIONS.map((opt) => (
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

            {/* Blocker panel */}
            {blockerPanelKF?.id === kf.id && (
              <div className="kf-card__blocker-panel">
                <h5>Blockers</h5>
                {blockers.length === 0 && <p className="kf-card__blocker-empty">No blockers</p>}
                {blockers.map((b: Blocker) => (
                  <div key={b.id} className={`kf-card__blocker kf-card__blocker--${b.status}`}>
                    <span>{b.title}</span>
                    {b.status === 'opened' && (
                      <button
                        type="button"
                        className="kf-card__blocker-resolve"
                        onClick={() => resolveBlockerMutation.mutate(b.id)}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                ))}
                <div className="kf-card__blocker-form">
                  <Input
                    value={blockerTitle}
                    onChange={(e) => setBlockerTitle(e.target.value)}
                    placeholder="New blocker..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && blockerTitle.trim()) {
                        createBlockerMutation.mutate({ kfId: kf.id, title: blockerTitle.trim() });
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

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
              onChange={(v) => setFormKind(v as KeyFocusKind)}
            />
            <Select
              label="Frequency"
              options={FREQUENCY_OPTIONS}
              value={formFrequency}
              onChange={(v) => setFormFrequency(v as KeyFocusFrequency)}
            />
            {editingKF && (
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={formStatus}
                onChange={(v) => setFormStatus(v as KeyFocusStatus)}
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
              <Button variant="danger" onClick={() => deleteMutation.mutate(deletingKF.id)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
