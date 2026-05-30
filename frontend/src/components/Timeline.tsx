import { useState, useEffect, useCallback } from 'react';
import type { Entry, Category } from '../types';
import { getEntries, getCategories, deleteEntry } from '../api';
import { catDisplay } from '../helpers';
import EntryForm from './EntryForm';

// ---- helpers ------------------------------------------------

/** Format an ISO datetime to HH:mm */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Calculate duration in hours between two ISO datetimes */
function durationHours(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3600_000;
}

/** Format a duration in hours to a readable string */
function fmtDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}分钟`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

/** Get today's date as YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Shift a date string by N days */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Mood emoji mapping */
const MOOD_EMOJIS = ['', '😞', '😐', '🙂', '😊', '🤩'];

/** Energy emoji mapping */
const ENERGY_EMOJIS = ['', '🪫', '🔋', '🔋', '🔋', '⚡'];

/** Lighten / soften a hex color for badge background */
function badgeBg(hex: string): string {
  return hex + '18'; // Add alpha transparency
}

// ---- Component ----------------------------------------------

export default function Timeline() {
  const [date, setDate] = useState(todayStr);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [presetStart, setPresetStart] = useState<string | undefined>();
  const [presetEnd, setPresetEnd] = useState<string | undefined>();

  // Fetch categories once
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => { /* silently fail, form will show empty */ });
  }, []);

  // Fetch entries when date changes
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEntries({ date, page_size: 100 });
      // Sort chronologically (earliest first)
      const sorted = [...res.items].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
      setEntries(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Summary calculations
  const totalHours = entries.reduce(
    (sum, e) => sum + durationHours(e.start_time, e.end_time),
    0,
  );

  // ---- Category breakdown (name → total hours) ----
  interface CatBreakdown {
    name: string;
    color: string;
    icon: string | null;
    hours: number;
  }

  const catMap = new Map<string, CatBreakdown>();
  for (const e of entries) {
    const dur = durationHours(e.start_time, e.end_time);
    const name = e.category?.name ?? '未分类';
    const existing = catMap.get(name);
    if (existing) {
      existing.hours += dur;
    } else {
      catMap.set(name, {
        name,
        color: e.category?.color ?? '#6b7280',
        icon: e.category?.icon ?? null,
        hours: dur,
      });
    }
  }
  const catBreakdown = [...catMap.values()].sort((a, b) => b.hours - a.hours);

  // ---- Gap detection ----
  interface Gap {
    start: string;   // ISO
    end: string;     // ISO
  }

  /** Format a Date to naive ISO local string matching entry timestamp format. */
  function fmtLocalISO(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  }

  function findGaps(entryList: Entry[], selectedDate: string, now = new Date()): Gap[] {
    const today = todayStr();

    // Future date → no gaps
    if (selectedDate > today) return [];

    // Effective end of the day
    const isToday = selectedDate === today;
    const dayEndMs = isToday
      ? now.getTime()
      : new Date(`${selectedDate}T23:59:59`).getTime();

    if (entryList.length === 0) return [];

    const gaps: Gap[] = [];
    const dayStartMs = new Date(`${selectedDate}T00:00:00`).getTime();

    // Before first entry
    const firstStartMs = new Date(entryList[0].start_time).getTime();
    if (firstStartMs > dayStartMs) {
      const gapEndMs = Math.min(firstStartMs, dayEndMs);
      if (gapEndMs > dayStartMs) {
        gaps.push({
          start: `${selectedDate}T00:00:00`,
          end: fmtLocalISO(new Date(gapEndMs)),
        });
      }
    }

    // Between consecutive entries
    for (let i = 0; i < entryList.length - 1; i++) {
      const prevEndMs = new Date(entryList[i].end_time).getTime();
      const nextStartMs = new Date(entryList[i + 1].start_time).getTime();
      if (prevEndMs >= dayEndMs) continue;
      const gapEndMs = Math.min(nextStartMs, dayEndMs);
      if (gapEndMs > prevEndMs) {
        gaps.push({
          start: entryList[i].end_time,
          end: fmtLocalISO(new Date(gapEndMs)),
        });
      }
    }

    // After last entry — capped by effective end
    const lastEndMs = new Date(entryList[entryList.length - 1].end_time).getTime();
    if (dayEndMs > lastEndMs) {
      gaps.push({
        start: entryList[entryList.length - 1].end_time,
        end: fmtLocalISO(new Date(dayEndMs)),
      });
    }

    return gaps;
  }

  const gaps = entries.length > 0 ? findGaps(entries, date) : [];

  const isToday = date === todayStr();

  // Format date for display – e.g. "2026-05-30 周六"
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dateObj = new Date(date + 'T00:00:00');
  const weekday = weekdays[dateObj.getDay()];

  // Handlers
  const handlePrev = () => setDate((d) => shiftDate(d, -1));
  const handleNext = () => setDate((d) => shiftDate(d, 1));
  const handleToday = () => setDate(todayStr());

  const handleAdd = () => {
    setEditingEntry(null);
    setPresetStart(undefined);
    setPresetEnd(undefined);
    setShowForm(true);
  };

  const handleGapFill = (start: string, end: string) => {
    setEditingEntry(null);
    setPresetStart(start);
    setPresetEnd(end);
    setShowForm(true);
  };

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteEntry(id);
      setShowForm(false);
      setEditingEntry(null);
      fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEntry(null);
    setPresetStart(undefined);
    setPresetEnd(undefined);
  };

  const handleFormSaved = () => {
    setShowForm(false);
    setEditingEntry(null);
    fetchEntries();
  };

  // last entry end_time for smart defaults
  const lastEndTime = entries.length > 0 ? entries[entries.length - 1].end_time : undefined;

  return (
    <>
      {/* Date Navigation */}
      <div className="date-nav">
        <button className="date-nav-btn" onClick={handlePrev} title="前一天">
          ←
        </button>
        <h1 className="date-nav-label">
          {date} {weekday}
        </h1>
        <button className="date-nav-btn" onClick={handleNext} title="后一天">
          →
        </button>
        {!isToday && (
          <button className="date-nav-today" onClick={handleToday}>
            回到今天
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* Summary Card */}
      {!loading && entries.length > 0 && (
        <div className="summary-card">
          <div className="summary-stat">
            <span className="summary-stat-value">{totalHours.toFixed(1)}</span>
            <span className="summary-stat-label">总小时</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-stat">
            <span className="summary-stat-value">{entries.length}</span>
            <span className="summary-stat-label">记录条目</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-stat">
            <span className="summary-stat-value">
              {new Set(entries.map((e) => catDisplay(e.category).name)).size}
            </span>
            <span className="summary-stat-label">类别</span>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {!loading && catBreakdown.length > 0 && (
        <div className="breakdown-section">
          <h2 className="breakdown-title">分类耗时</h2>
          <div className="breakdown-list">
            {catBreakdown.map((cat) => (
              <div key={cat.name} className="breakdown-item">
                <div className="breakdown-item-left">
                  <span
                    className="breakdown-dot"
                    style={{ background: cat.color }}
                  />
                  <span className="breakdown-item-name">
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </span>
                </div>
                <div className="breakdown-item-right">
                  <span className="breakdown-item-hours">{fmtDuration(cat.hours)}</span>
                  <span className="breakdown-item-pct">
                    {totalHours > 0
                      ? `${Math.round((cat.hours / totalHours) * 100)}%`
                      : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps */}
      {!loading && gaps.length > 0 && (
        <div className="gaps-section">
          {gaps.map((gap, idx) => {
            const dur = durationHours(gap.start, gap.end);
            if (dur < 0.02) return null; // skip < 1 minute
            return (
              <div key={idx} className="gap-entry">
                <div className="gap-line" />
                <div className="gap-info">
                  <span className="gap-label">未记录</span>
                  <span className="gap-time">
                    {fmtTime(gap.start)} – {fmtTime(gap.end)}
                  </span>
                  <span className="gap-duration">{fmtDuration(dur)}</span>
                  <button
                    className="gap-fill-btn"
                    onClick={() => handleGapFill(gap.start, gap.end)}
                    title="快速补记此段时间"
                  >
                    + 补记
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading">
          <div className="loading-spinner" />
          加载中…
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">还没有记录</div>
          <div className="empty-state-desc">
            点击右下角的 + 按钮，开始记录你的第一个时间条目吧
          </div>
        </div>
      )}

      {/* Timeline */}
      {!loading && entries.length > 0 && (
        <div className="timeline">
          {entries.map((entry) => {
            const dur = durationHours(entry.start_time, entry.end_time);
            const cat = catDisplay(entry.category);
            return (
              <div key={entry.id} className="timeline-entry">
                <div
                  className="entry-card"
                  style={{ '--entry-color': cat.color } as React.CSSProperties}
                  onClick={() => handleEdit(entry)}
                >
                  <div className="entry-card-header">
                    <span className="entry-card-title">{entry.title}</span>
                    <span className="entry-card-time">
                      {fmtTime(entry.start_time)} – {fmtTime(entry.end_time)}
                    </span>
                  </div>
                  <div className="entry-card-meta">
                    <span
                      className="category-badge"
                      style={{
                        '--badge-bg': badgeBg(cat.color),
                        '--badge-color': cat.color,
                      } as React.CSSProperties}
                    >
                      <span className="category-badge-dot" />
                      {cat.name}
                    </span>
                    {entry.tags.map((t) => (
                      <span key={t.id} className="tag-badge">
                        {t.name}
                      </span>
                    ))}
                    <span className="entry-card-duration">{fmtDuration(dur)}</span>
                  </div>
                  {entry.note && (
                    <div className="entry-card-note">{entry.note}</div>
                  )}
                  {(entry.mood || entry.energy) && (
                    <div className="entry-card-indicators">
                      {entry.mood && (
                        <span className="entry-card-indicator">
                          {MOOD_EMOJIS[entry.mood]} 心情
                        </span>
                      )}
                      {entry.energy && (
                        <span className="entry-card-indicator">
                          {ENERGY_EMOJIS[entry.energy]} 精力
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button className="fab" onClick={handleAdd} title="添加新记录">
        +
      </button>

      {/* Entry Form Modal */}
      {showForm && (
        <EntryForm
          entry={editingEntry}
          categories={categories}
          date={date}
          lastEndTime={lastEndTime}
          presetStartTime={presetStart}
          presetEndTime={presetEnd}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
          onDelete={editingEntry ? () => handleDelete(editingEntry.id) : undefined}
        />
      )}
    </>
  );
}
