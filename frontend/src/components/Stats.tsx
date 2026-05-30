import { useState, useEffect, useCallback } from 'react';
import type { StatsSummary } from '../types';
import { getStatsSummary } from '../api';

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
  const [data, setData] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = daysAgoStr(period - 1);
      const end = todayStr();
      const summary = await getStatsSummary(start, end);
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetch(); }, [fetch]);

  // Build day map with zeroes for missing days (for consistent bar widths)
  const maxDayHrs = data ? Math.max(1, ...data.by_day.map((d) => d.hours)) : 1;
  const maxCatHrs = data ? Math.max(1, ...data.by_category.map((c) => c.hours)) : 1;

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

      {loading && (
        <div className="loading">
          <div className="loading-spinner" />
        </div>
      )}

      {!loading && data && data.total_entries === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">暂无数据</div>
          <div className="empty-state-desc">添加一些时间记录后再来看统计</div>
        </div>
      )}

      {!loading && data && data.total_entries > 0 && (
        <>
          {/* Summary */}
          <div className="summary-card">
            <div className="summary-stat">
              <span className="summary-stat-value">{data.total_hours.toFixed(1)}</span>
              <span className="summary-stat-label">总小时</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-value">{data.active_days}</span>
              <span className="summary-stat-label">活跃天数</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-value">{data.avg_hours_per_active_day.toFixed(1)}</span>
              <span className="summary-stat-label">日均小时</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-value">{data.total_entries}</span>
              <span className="summary-stat-label">总条目</span>
            </div>
          </div>

          {/* Daily breakdown */}
          <section className="settings-section">
            <h2 className="settings-section-title">每日时长</h2>
            <div className="stats-bar-list">
              {data.by_day.map((d) => (
                <div key={d.date} className="stats-bar-row">
                  <span className="stats-bar-label">
                    {d.date.slice(5)} {weekdayLabel(d.date)}
                  </span>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{ width: `${(d.hours / maxDayHrs) * 100}%` }}
                    />
                  </div>
                  <span className="stats-bar-value">
                    {d.hours > 0 ? fmtDuration(d.hours) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Category breakdown */}
          <section className="settings-section">
            <h2 className="settings-section-title">分类分布</h2>
            <div className="stats-bar-list">
              {data.by_category.map((cat) => (
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
                    {fmtDuration(cat.hours)} ({cat.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Mood & Energy */}
          <section className="settings-section">
            <h2 className="settings-section-title">心情与精力</h2>
            <div className="stats-mood-row">
              {data.mood.count > 0 ? (
                <div className="stats-mood-item">
                  <span className="stats-mood-emoji">
                    {MOOD_LABELS[Math.round(data.mood.average!)]}
                  </span>
                  <span className="stats-mood-value">
                    平均心情 {data.mood.average!.toFixed(1)} / 5
                  </span>
                  <span className="stats-mood-count">
                    （{data.mood.count} 次记录）
                  </span>
                </div>
              ) : (
                <span className="stats-no-data">暂无心情数据</span>
              )}
              {data.energy.count > 0 ? (
                <div className="stats-mood-item">
                  <span className="stats-mood-emoji">
                    {ENERGY_LABELS[Math.round(data.energy.average!)]}
                  </span>
                  <span className="stats-mood-value">
                    平均精力 {data.energy.average!.toFixed(1)} / 5
                  </span>
                  <span className="stats-mood-count">
                    （{data.energy.count} 次记录）
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
