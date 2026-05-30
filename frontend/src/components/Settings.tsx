import { useState, useEffect, useCallback } from 'react';
import type { Category, CategoryCreate, CategoryUpdate } from '../types';
import { getCategories, createCategory, updateCategory, archiveCategory } from '../api';

// ---- Component ----------------------------------------------

export default function Settings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Form state
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await getCategories(true);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Filter
  const active = categories.filter((c) => !c.is_archived);
  const archived = categories.filter((c) => c.is_archived);

  // ---- Handlers ----

  const resetForm = () => {
    setEditing(null);
    setName('');
    setColor('#6366f1');
    setIcon('');
    setError(null);
  };

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setColor(cat.color);
    setIcon(cat.icon ?? '');
    setError(null);
  };

  const handleArchive = async (cat: Category) => {
    try {
      await archiveCategory(cat.id);
      showToast(`「${cat.name}」已归档`);
      fetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleRestore = async (cat: Category) => {
    try {
      await updateCategory(cat.id, { is_archived: false });
      showToast(`「${cat.name}」已恢复`);
      fetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      if (editing) {
        await updateCategory(editing.id, {
          name: name.trim(),
          color,
          icon: icon.trim() || undefined,
        } satisfies CategoryUpdate);
      } else {
        await createCategory({
          name: name.trim(),
          color,
          icon: icon.trim() || undefined,
        } satisfies CategoryCreate);
      }
      showToast(editing ? '分类已更新' : '分类已添加');
      resetForm();
      fetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败';
      if (msg.includes('409')) {
        setError(`分类名「${name.trim()}」已存在，请换一个名称`);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">设置</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast">{toast}</div>
      )}

      {/* Category Form */}
      <section className="settings-section">
        <h2 className="settings-section-title">
          {editing ? '编辑分类' : '新增分类'}
        </h2>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">名称</label>
              <input
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="分类名称"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">颜色</label>
              <div className="color-picker-row">
                <input
                  className="form-input form-input-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className="color-hex">{color}</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">图标（emoji）</label>
              <input
                className="form-input"
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="💼"
                maxLength={4}
                style={{ width: 80 }}
              />
            </div>
          </div>

          <div className="settings-form-actions">
            {editing && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                取消编辑
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !name.trim()}
            >
              {saving ? '保存中…' : editing ? '更新' : '添加'}
            </button>
          </div>
        </form>
      </section>

      {/* Category List */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title">
            分类列表 ({active.length})
          </h2>
          {archived.length > 0 && (
            <button
              className="archive-toggle"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? '收起已归档 ↑' : `📦 已归档 (${archived.length})`}
            </button>
          )}
        </div>

        {loading && (
          <div className="loading">
            <div className="loading-spinner" />
            加载中…
          </div>
        )}

        {!loading && active.length === 0 && (
          <div className="empty-state-small">还没有分类，添加一个吧</div>
        )}

        <div className="settings-list">
          {active.map((cat) => (
            <div key={cat.id} className="settings-item">
              <div className="settings-item-left">
                <span
                  className="category-dot-lg"
                  style={{ background: cat.color }}
                />
                <span className="settings-item-icon">
                  {cat.icon ?? '●'}
                </span>
                <span className="settings-item-name">{cat.name}</span>
              </div>
              <div className="settings-item-actions">
                <button
                  className="btn-text-sm"
                  onClick={() => handleEdit(cat)}
                >
                  编辑
                </button>
                <button
                  className="btn-text-sm btn-text-danger"
                  onClick={() => handleArchive(cat)}
                >
                  归档
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Archived */}
        {showArchived && archived.length > 0 && (
          <>
            <h3 className="settings-subtitle">已归档</h3>
            <div className="settings-list">
              {archived.map((cat) => (
                <div key={cat.id} className="settings-item archived">
                  <div className="settings-item-left">
                    <span
                      className="category-dot-lg"
                      style={{ background: cat.color, opacity: 0.4 }}
                    />
                    <span className="settings-item-icon" style={{ opacity: 0.5 }}>
                      {cat.icon ?? '●'}
                    </span>
                    <span className="settings-item-name">{cat.name}</span>
                  </div>
                  <div className="settings-item-actions">
                    <button
                      className="btn-text-sm"
                      onClick={() => handleRestore(cat)}
                    >
                      恢复
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
