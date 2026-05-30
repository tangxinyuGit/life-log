import { useState, useCallback, useEffect } from 'react';
import type { Entry, Category } from '../types';
import { getEntries, getCategories, deleteEntry } from '../api';
import { catDisplay } from '../helpers';

// ---- helpers ------------------------------------------------

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function durationHrs(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3600_000;
}

function fmtDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}分钟`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- Component ----------------------------------------------

export default function Search() {
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState(daysAgo(7));
  const [endDate, setEndDate] = useState(todayStr());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const res = await getEntries({
        keyword: keyword.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        page_size: 100,
      });
      const sorted = [...res.items].sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
      );
      setEntries(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, startDate, endDate]);

  const totalHrs = entries.reduce((s, e) => s + durationHrs(e.start_time, e.end_time), 0);

  const handleDelete = async (id: number) => {
    try {
      await deleteEntry(id);
      search();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">搜索</h1>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* Search Form */}
      <section className="settings-section">
        <div className="search-form">
          <div className="search-form-row">
            <input
              className="form-input"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索标题或备注…"
              onKeyDown={(e) => e.key === 'Enter' && search()}
              autoFocus
            />
            <input
              className="form-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: 160 }}
            />
            <span className="search-form-sep">至</span>
            <input
              className="form-input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: 160 }}
            />
            <button className="btn btn-primary" onClick={search}>
              搜索
            </button>
          </div>
        </div>
      </section>

      {/* Results */}
      {loading && (
        <div className="loading">
          <div className="loading-spinner" />
          搜索中…
        </div>
      )}

      {!loading && searched && entries.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">无结果</div>
          <div className="empty-state-desc">尝试更换关键词或调整日期范围</div>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <>
          <div className="search-summary">
            共 {entries.length} 条记录 · 合计 {fmtDuration(totalHrs)}
          </div>
          <div className="search-results">
            {entries.map((entry) => {
              const cat = categories.find((c) => c.id === entry.category_id);
              return (
                <div key={entry.id} className="search-item">
                  <div className="search-item-left">
                    <div className="search-item-header">
                      <span className="search-item-title">{entry.title}</span>
                      <span className="search-item-time">
                        {fmtDate(entry.start_time)} {fmtTime(entry.start_time)} – {fmtTime(entry.end_time)}
                      </span>
                    </div>
                    <div className="search-item-meta">
                      {(() => {
                        const d = catDisplay(cat ?? null);
                        return (
                          <span
                            className="category-badge"
                            style={{
                              '--badge-bg': d.color + '18',
                              '--badge-color': d.color,
                            } as React.CSSProperties}
                          >
                            <span className="category-badge-dot" />
                            {d.name}
                          </span>
                        );
                      })()}
                      {entry.tags.map((t) => (
                        <span key={t.id} className="tag-badge">{t.name}</span>
                      ))}
                      <span className="search-item-duration">
                        {fmtDuration(durationHrs(entry.start_time, entry.end_time))}
                      </span>
                    </div>
                    {entry.note && (
                      <div className="search-item-note">{entry.note}</div>
                    )}
                  </div>
                  <button
                    className="btn-text-sm btn-text-danger"
                    onClick={() => handleDelete(entry.id)}
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
