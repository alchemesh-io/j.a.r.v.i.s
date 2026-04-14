import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from '@jarvis/jads';
import {
  listKeyFocuses,
  listTasks,
  listBlockers,
} from '../../api/client';
import { DateNavPrev, DateNavNext, DateNavToday } from '../../components/DateNav';
import './Reports.css';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPreviousDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

function getPreviousWeekDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  return formatDate(d);
}

type ReportScope = 'daily' | 'weekly';

const SCOPE_OPTIONS: { value: ReportScope; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const STORAGE_KEY = 'jarvis-reports';

interface ReportPrefs {
  scope: ReportScope;
  selectedDate: string;
}

function loadPrefs(): ReportPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { scope: 'weekly', selectedDate: formatDate(new Date()) };
}

function savePrefs(prefs: ReportPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const KIND_COLORS: Record<string, string> = {
  delivery: '#3b82f6',
  learning: '#22c55e',
  support: '#a855f7',
  operational: '#f97316',
  side_quest: '#06b6d4',
};

export default function Reports() {
  const [prefs] = useState(loadPrefs);
  const [selectedDate, setSelectedDate] = useState(() => new Date(prefs.selectedDate + 'T00:00:00'));
  const [scope, setScope] = useState<ReportScope>(prefs.scope);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const dateStr = formatDate(selectedDate);

  useEffect(() => {
    savePrefs({ scope, selectedDate: dateStr });
  }, [scope, dateStr]);

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

  // Weekly report queries
  const prevWeekDate = getPreviousWeekDate(dateStr);
  const { data: prevWeekKFs = [] } = useQuery({
    queryKey: ['report-kf-prev', prevWeekDate],
    queryFn: () => listKeyFocuses({ date: prevWeekDate, scope: 'weekly', frequency: 'weekly' }),
    enabled: scope === 'weekly',
  });
  const { data: currentWeekKFs = [] } = useQuery({
    queryKey: ['report-kf-current', dateStr],
    queryFn: () => listKeyFocuses({ date: dateStr, scope: 'weekly', frequency: 'weekly' }),
    enabled: scope === 'weekly',
  });
  const { data: allBlockers = [] } = useQuery({
    queryKey: ['report-blockers'],
    queryFn: () => listBlockers({ status: 'opened' }),
    enabled: scope === 'weekly',
  });

  // Daily report queries
  const prevDay = getPreviousDay(dateStr);
  const { data: prevDayTasks = [] } = useQuery({
    queryKey: ['report-tasks-prev', prevDay],
    queryFn: () => listTasks({ date: prevDay, scope: 'daily' }),
    enabled: scope === 'daily',
  });
  const { data: currentDayTasks = [] } = useQuery({
    queryKey: ['report-tasks-current', dateStr],
    queryFn: () => listTasks({ date: dateStr, scope: 'daily' }),
    enabled: scope === 'daily',
  });
  const { data: allBlockersDaily = [] } = useQuery({
    queryKey: ['report-blockers-daily'],
    queryFn: () => listBlockers({ status: 'opened' }),
    enabled: scope === 'daily',
  });

  // Weekly derived data
  const prevWeekDone = prevWeekKFs.filter((kf) => kf.status === 'succeed');
  const prevWeekNotDone = prevWeekKFs.filter((kf) => kf.status === 'in_progress' || kf.status === 'failed');
  const prevWeekKFIds = new Set(prevWeekKFs.map((kf) => kf.id));
  const prevWeekBlockers = allBlockers.filter((b) => b.key_focus_id && prevWeekKFIds.has(b.key_focus_id));

  // Daily derived data
  const prevDayDone = prevDayTasks.filter((t) => t.status === 'done');
  const prevDayNotDone = prevDayTasks.filter((t) => t.status === 'created');
  const prevDayTaskIds = new Set(prevDayTasks.map((t) => t.id));
  const prevDayBlockers = allBlockersDaily.filter((b) => b.task_id && prevDayTaskIds.has(b.task_id));

  // Lookup maps for blocker parent context
  const kfNameMap = new Map(prevWeekKFs.map((kf) => [kf.id, kf.title]));
  const taskNameMap = new Map(prevDayTasks.map((t) => [t.id, t.title]));

  const hasWeeklyData = prevWeekKFs.length > 0 || currentWeekKFs.length > 0;
  const hasDailyData = prevDayTasks.length > 0 || currentDayTasks.length > 0;

  return (
    <div className="reports">
      <div className="reports__toolbar">
        <div className="reports__toolbar-left">
          <DateNavPrev selectedDate={selectedDate} onDateChange={(d) => setSelectedDate(d)} scope={scope} />
          <div className="reports__calendar-dropdown" ref={calendarRef}>
            <button
              type="button"
              className={`reports__date-btn${showCalendar ? ' reports__date-btn--open' : ''}`}
              onClick={() => setShowCalendar((v) => !v)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M2 6H14" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 1.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M10.5 1.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {formatDateDisplay(selectedDate)}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showCalendar && (
              <div className="reports__calendar-panel">
                <Calendar
                  selectedDate={selectedDate}
                  onDateSelect={(d) => { setSelectedDate(d); setShowCalendar(false); }}
                />
              </div>
            )}
          </div>
          <DateNavNext selectedDate={selectedDate} onDateChange={(d) => setSelectedDate(d)} scope={scope} />
          <DateNavToday selectedDate={selectedDate} onDateChange={(d) => setSelectedDate(d)} />
        </div>
        <div className="reports__toolbar-right">
          <div className="reports__scope-tabs" role="tablist" aria-label="Report scope">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={scope === opt.value}
                className={`reports__scope-tab${scope === opt.value ? ' reports__scope-tab--active' : ''}`}
                onClick={() => setScope(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="reports__content">
        {scope === 'weekly' && !hasWeeklyData && (
          <div className="reports__empty">No key focuses for this period or the previous week</div>
        )}

        {scope === 'weekly' && hasWeeklyData && (
          <>
            <section className="reports__section">
              <h3 className="reports__section-title">Previous Week — Key Focuses Done</h3>
              {prevWeekDone.length === 0 ? (
                <p className="reports__empty-section">No key focuses completed</p>
              ) : (
                <div className="reports__list">
                  {prevWeekDone.map((kf) => (
                    <div key={kf.id} className="reports__kf-item reports__kf-item--succeed">
                      <span className="reports__kind-badge" style={{ backgroundColor: KIND_COLORS[kf.kind] }}>{kf.kind.replace('_', ' ')}</span>
                      <div className="reports__item-body">
                        <span className="reports__item-title">{kf.title}</span>
                        {kf.description && <span className="reports__item-desc">{kf.description}</span>}
                      </div>
                      <span className="reports__status-icon">✓</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="reports__section">
              <h3 className="reports__section-title">Previous Week — Key Focuses Not Done</h3>
              {prevWeekNotDone.length === 0 ? (
                <p className="reports__empty-section">All key focuses completed!</p>
              ) : (
                <div className="reports__list">
                  {prevWeekNotDone.map((kf) => (
                    <div key={kf.id} className={`reports__kf-item reports__kf-item--${kf.status}`}>
                      <span className="reports__kind-badge" style={{ backgroundColor: KIND_COLORS[kf.kind] }}>{kf.kind.replace('_', ' ')}</span>
                      <div className="reports__item-body">
                        <span className="reports__item-title">{kf.title}</span>
                        {kf.description && <span className="reports__item-desc">{kf.description}</span>}
                      </div>
                      <span className={`reports__status-label reports__status-label--${kf.status}`}>{kf.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="reports__section">
              <h3 className="reports__section-title">Remaining Blockers from Previous Week</h3>
              {prevWeekBlockers.length === 0 ? (
                <p className="reports__empty-section">No remaining blockers</p>
              ) : (
                <div className="reports__list">
                  {prevWeekBlockers.map((b) => (
                    <div key={b.id} className="reports__blocker-item">
                      <span className="reports__blocker-icon">!</span>
                      <span className="reports__item-title">{b.title}</span>
                      {b.key_focus_id && kfNameMap.has(b.key_focus_id) && (
                        <span className="reports__blocker-parent">{kfNameMap.get(b.key_focus_id)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="reports__section">
              <h3 className="reports__section-title">Current Week — Key Focuses</h3>
              {currentWeekKFs.length === 0 ? (
                <p className="reports__empty-section">No key focuses for this week</p>
              ) : (
                <div className="reports__list">
                  {currentWeekKFs.map((kf) => (
                    <div key={kf.id} className={`reports__kf-item reports__kf-item--${kf.status}`}>
                      <span className="reports__kind-badge" style={{ backgroundColor: KIND_COLORS[kf.kind] }}>{kf.kind.replace('_', ' ')}</span>
                      <div className="reports__item-body">
                        <span className="reports__item-title">{kf.title}</span>
                        {kf.description && <span className="reports__item-desc">{kf.description}</span>}
                      </div>
                      <span className={`reports__status-label reports__status-label--${kf.status}`}>{kf.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {scope === 'daily' && !hasDailyData && (
          <div className="reports__empty">No tasks for this day or the previous day</div>
        )}

        {scope === 'daily' && hasDailyData && (
          <>
            <section className="reports__section">
              <h3 className="reports__section-title">Previous Day — Tasks Done</h3>
              {prevDayDone.length === 0 ? (
                <p className="reports__empty-section">No tasks completed</p>
              ) : (
                <div className="reports__list">
                  {prevDayDone.map((t) => (
                    <div key={t.id} className="reports__task-item reports__task-item--done">
                      <span className={`reports__type-badge reports__type-badge--${t.type}`}>{t.type}</span>
                      <span className="reports__item-title">{t.title}</span>
                      {t.key_focuses?.map((kf) => (
                        <span key={kf.id} className="reports__kf-mini-badge" style={{ backgroundColor: KIND_COLORS[kf.kind] }}>{kf.kind.replace('_', ' ')}</span>
                      ))}
                      <span className="reports__status-icon">✓</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="reports__section">
              <h3 className="reports__section-title">Previous Day — Tasks Not Done</h3>
              {prevDayNotDone.length === 0 ? (
                <p className="reports__empty-section">All tasks completed!</p>
              ) : (
                <div className="reports__list">
                  {prevDayNotDone.map((t) => (
                    <div key={t.id} className="reports__task-item">
                      <span className={`reports__type-badge reports__type-badge--${t.type}`}>{t.type}</span>
                      <span className="reports__item-title">{t.title}</span>
                      {t.key_focuses?.map((kf) => (
                        <span key={kf.id} className="reports__kf-mini-badge" style={{ backgroundColor: KIND_COLORS[kf.kind] }}>{kf.kind.replace('_', ' ')}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="reports__section">
              <h3 className="reports__section-title">Remaining Blockers from Previous Day</h3>
              {prevDayBlockers.length === 0 ? (
                <p className="reports__empty-section">No remaining blockers</p>
              ) : (
                <div className="reports__list">
                  {prevDayBlockers.map((b) => (
                    <div key={b.id} className="reports__blocker-item">
                      <span className="reports__blocker-icon">!</span>
                      <span className="reports__item-title">{b.title}</span>
                      {b.task_id && taskNameMap.has(b.task_id) && (
                        <span className="reports__blocker-parent">{taskNameMap.get(b.task_id)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="reports__section">
              <h3 className="reports__section-title">Current Day — Tasks</h3>
              {currentDayTasks.length === 0 ? (
                <p className="reports__empty-section">No tasks for today</p>
              ) : (
                <div className="reports__list">
                  {currentDayTasks.map((t) => (
                    <div key={t.id} className={`reports__task-item${t.status === 'done' ? ' reports__task-item--done' : ''}`}>
                      <span className={`reports__type-badge reports__type-badge--${t.type}`}>{t.type}</span>
                      <span className="reports__item-title">{t.title}</span>
                      {t.key_focuses?.map((kf) => (
                        <span key={kf.id} className="reports__kf-mini-badge" style={{ backgroundColor: KIND_COLORS[kf.kind] }}>{kf.kind.replace('_', ' ')}</span>
                      ))}
                      <span className={`reports__status-label reports__status-label--${t.status}`}>{t.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
