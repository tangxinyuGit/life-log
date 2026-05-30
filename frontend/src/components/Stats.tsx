import { useState, useEffect, useCallback } from 'react';
import type { Entry } from '../types';
import { getEntries } from '../api';

// ---- helpers ------------------------------------------------

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function durationHrs(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3600_000;
}

function fmtDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function weekdayLabel(dateStr: string): string {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr);
  return `周${days[d.getDay()]}`;
}

type Period = 7 | 30;
const MOOD_LABELS = ['', '😞', '😐', '🙂', '😊', '🤩'];
const ENERGY_LABELS = ['', '🪫', '🔋', '🔋', '🔋', '⚡'];

// ---- Component ----------------------------------------------

export default function Stats() {
  const [period, setPeriod] = useState<Period>(7);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = daysAgoStr(period - 1);
      const end = todayStr();
      // Paginate to load all entries in the period
      let page = 1;
      const pageSize = 100;
      const all: Entry[] = [];
      while (true) {
        const res = await getEntries({ start_date: start, end_date: end, page, page_size: pageSize });
        all.push(...res.items);
        if (page >= res.total_pages) break;
        page++;
      }
      setEntries(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetch(); }, [fetch]);

  // ---- Computed stats ----

  // Total
  const totalHrs = entries.reduce((s, e) => s + durationHrs(e.start_time, e.end_time), 0);
  const totalDays = new Set(entries.map((e) => e.start_time.slice(0, 10))).size;
  const avgHrsPerDay = totalDays > 0 ? totalHrs / totalDays : 0;

  // By day
  const dayMap: Record<string, number> = {};
  for (let i = period - 1; i >= 0; i--) {
    dayMap[daysAgoStr(i)] = 0;
  }
  for (const e of entries) {
    const d = e.start_time.slice(0, 10);
    dayMap[d] = (dayMap[d] || 0) + durationHrs(e.start_time, e.end_time);
  }
  const maxDayHrs = Math.max(1, ...Object.values(dayMap));

  // By category
  const catMap: Record<string, { name: string; color: string; hours: number }> = {};
  for (const e of entries) {
    const name = e.category?.name ?? '未分类';
    if (!catMap[name]) {
      catMap[name] = { name, color: e.category?.color ?? '#6b7280', hours: 0 };
    }
    catMap[name].hours += durationHrs(e.start_time, e.end_time);
  }
  const catList = Object.values(catMap).sort((a, b) => b.hours - a.hours);
  const maxCatHrs = Math.max(1, ...catList.map((c) => c.hours));

  // Mood & Energy averages
  const moods = entries.filter((e) => e.mood).map((e) => e.mood!);
  const energies = entries.filter((e) => e.energy).map((e) => e.energy!);
  const avgMood = moods.length > 0 ? moods.reduce((s, m) => s + m, 0) / moods.length : 0;
  const avgEnergy = energies.length > 0 ? energies.reduce((s, e) => s + e, 0) / energies.length : 0;

  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">统计</h1>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* Period selector */}
      <div className="stats-period">
        {([7, 30] as Period[]).map((p) => (
          <button
            key={p}
            className={`stats-period-btn${period === p ? ' active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p === 7 ? '近 7 天' : '近 30 天'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="loading">
          <div className="loading-spinner" />
        </div>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">暂无数据</div>
          <div className="empty-state-desc">添加一些时间记录后再来看统计</div>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <>
          {/* Summary */}
          <div className="summary-card">
            <div className="summary-stat">
              <span className="summary-stat-value">{totalHrs.toFixed(1)}</span>
              <span className="summary-stat-label">总小时</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-value">{totalDays}</span>
              <span className="summary-stat-label">活跃天数</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-value">{avgHrsPerDay.toFixed(1)}</span>
              <span className="summary-stat-label">日均小时</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-value">{entries.length}</span>
              <span className="summary-stat-label">总条目</span>
            </div>
          </div>

          {/* Daily breakdown */}
          <section className="settings-section">
            <h2 className="settings-section-title">每日时长</h2>
            <div className="stats-bar-list">
              {Object.entries(dayMap).map(([d, hrs]) => (
                <div key={d} className="stats-bar-row">
                  <span className="stats-bar-label">
                    {d.slice(5)} {weekdayLabel(d)}
                  </span>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{ width: `${(hrs / maxDayHrs) * 100}%` }}
                    />
                  </div>
                  <span className="stats-bar-value">
                    {hrs > 0 ? fmtDuration(hrs) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Category breakdown */}
          <section className="settings-section">
            <h2 className="settings-section-title">分类分布</h2>
            <div className="stats-bar-list">
              {catList.map((cat) => (
                <div key={cat.name} className="stats-bar-row">
                  <span className="stats-bar-label">
                    <span
                      className="breakdown-dot"
                      style={{ background: cat.color, display: 'inline-block' }}
                    />
                    {' '}{cat.name}
                  </span>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{
                        width: `${(cat.hours / maxCatHrs) * 100}%`,
                        background: cat.color,
                      }}
                    />
                  </div>
                  <span className="stats-bar-value">
                    {fmtDuration(cat.hours)} ({Math.round((cat.hours / totalHrs) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Mood & Energy */}
          <section className="settings-section">
            <h2 className="settings-section-title">心情与精力</h2>
            <div className="stats-mood-row">
              {moods.length > 0 ? (
                <div className="stats-mood-item">
                  <span className="stats-mood-emoji">
                    {MOOD_LABELS[Math.round(avgMood)]}
                  </span>
                  <span className="stats-mood-value">
                    平均心情 {avgMood.toFixed(1)} / 5
                  </span>
                  <span className="stats-mood-count">
                    （{moods.length} 次记录）
                  </span>
                </div>
              ) : (
                <span className="stats-no-data">暂无心情数据</span>
              )}
              {energies.length > 0 ? (
                <div className="stats-mood-item">
                  <span className="stats-mood-emoji">
                    {ENERGY_LABELS[Math.round(avgEnergy)]}
                  </span>
                  <span className="stats-mood-value">
                    平均精力 {avgEnergy.toFixed(1)} / 5
                  </span>
                  <span className="stats-mood-count">
                    （{energies.length} 次记录）
                  </span>
                </div>
              ) : (
                <span className="stats-no-data">暂无精力数据</span>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
