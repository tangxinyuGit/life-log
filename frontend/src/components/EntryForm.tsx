import { useState, useEffect } from 'react';
import type { Entry, Category } from '../types';
import { createEntry, updateEntry } from '../api';

// ---- Props --------------------------------------------------

interface EntryFormProps {
  entry: Entry | null;          // null = create, Entry = edit
  categories: Category[];
  date: string;                 // current date YYYY-MM-DD
  lastEndTime?: string;         // last entry's end_time for smart defaults
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}

// ---- helpers ------------------------------------------------

/** Get the current hour rounded down as HH:00 datetime-local value */
function nowHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return toDatetimeLocal(d);
}

/** Add hours to an ISO string, return datetime-local value */
function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setTime(d.getTime() + hours * 3600_000);
  return toDatetimeLocal(d);
}

/** Convert a Date to the value format for <input type="datetime-local"> */
function toDatetimeLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/** Convert datetime-local value to ISO string (local time interpreted as UTC offset) */
function toISO(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

/** Convert an ISO string to datetime-local value */
function isoToLocal(iso: string): string {
  return toDatetimeLocal(new Date(iso));
}

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: '很差' },
  { value: 2, emoji: '😐', label: '一般' },
  { value: 3, emoji: '🙂', label: '还行' },
  { value: 4, emoji: '😊', label: '不错' },
  { value: 5, emoji: '🤩', label: '很棒' },
];

const ENERGY_OPTIONS = [
  { value: 1, emoji: '🪫', label: '耗尽' },
  { value: 2, emoji: '🔋', label: '偏低' },
  { value: 3, emoji: '🔋', label: '中等' },
  { value: 4, emoji: '🔋', label: '充沛' },
  { value: 5, emoji: '⚡', label: '满格' },
];

// ---- Component ----------------------------------------------

export default function EntryForm({
  entry,
  categories,
  date,
  lastEndTime,
  onClose,
  onSaved,
  onDelete,
}: EntryFormProps) {
  const isEditing = entry !== null;

  // Smart defaults for start_time
  const defaultStart = entry
    ? isoToLocal(entry.start_time)
    : lastEndTime
      ? isoToLocal(lastEndTime)
      : nowHourLocal();

  const defaultEnd = entry
    ? isoToLocal(entry.end_time)
    : addHours(defaultStart, 1);

  // Form state
  const [title, setTitle] = useState(entry?.title ?? '');
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [categoryId, setCategoryId] = useState<number>(
    entry?.category_id ?? (categories[0]?.id ?? 0),
  );
  const [tagsInput, setTagsInput] = useState(
    entry?.tags.map((t) => t.name).join(', ') ?? '',
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(entry?.energy ?? null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update default category when categories load
  useEffect(() => {
    if (!entry && categoryId === 0 && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, entry, categoryId]);

  // Auto-adjust endTime when startTime changes (only for new entries)
  const handleStartChange = (val: string) => {
    setStartTime(val);
    if (!isEditing) {
      setEndTime(addHours(val, 1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError(null);

    const tagNames = tagsInput
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (isEditing && entry) {
        await updateEntry(entry.id, {
          title: title.trim(),
          start_time: toISO(startTime),
          end_time: toISO(endTime),
          category_id: categoryId,
          tags: tagNames,
          note: note.trim() || undefined,
          mood,
          energy,
        });
      } else {
        await createEntry({
          title: title.trim(),
          start_time: toISO(startTime),
          end_time: toISO(endTime),
          category_id: categoryId,
          tags: tagNames,
          note: note.trim() || undefined,
          mood: mood ?? undefined,
          energy: energy ?? undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Use date to anchor defaults but we don't need it beyond the initial state
  void date;

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? '编辑记录' : '新建记录'}
          </h2>
          <div className="modal-header-actions">
            {isEditing && onDelete && (
              <button
                className="btn-icon-danger"
                onClick={onDelete}
                title="删除"
              >
                🗑️
              </button>
            )}
            <button className="modal-close" onClick={onClose} title="关闭">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="error-message">
                <span>⚠️</span>
                {error}
              </div>
            )}

            {/* Title */}
            <div className="form-group">
              <label className="form-label">标题</label>
              <input
                className="form-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="你做了什么？"
                autoFocus
                required
              />
            </div>

            {/* Time Range */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">开始时间</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => handleStartChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">结束时间</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Category */}
            <div className="form-group">
              <label className="form-label">类别</label>
              <select
                className="form-select"
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
              >
                {categories.length === 0 && (
                  <option value={0} disabled>加载中…</option>
                )}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : '● '}{cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="form-group">
              <label className="form-label">标签（逗号分隔）</label>
              <input
                className="form-input"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="学习, 编程, 阅读"
              />
            </div>

            {/* Note */}
            <div className="form-group">
              <label className="form-label">备注</label>
              <textarea
                className="form-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="添加一些备注…"
              />
            </div>

            {/* Mood & Energy */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">心情</label>
                <div className="selector-row">
                  {MOOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`selector-btn${mood === opt.value ? ' selected' : ''}`}
                      onClick={() => setMood(mood === opt.value ? null : opt.value)}
                      title={opt.label}
                    >
                      {opt.emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">精力</label>
                <div className="selector-row">
                  {ENERGY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`selector-btn${energy === opt.value ? ' selected' : ''}`}
                      onClick={() => setEnergy(energy === opt.value ? null : opt.value)}
                      title={opt.label}
                    >
                      {opt.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !title.trim()}
            >
              {saving ? '保存中…' : isEditing ? '更新' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
