import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Timeline from './components/Timeline';
import './index.css';

// ---- Placeholder pages (P2 will replace these) -------------

function StatsPage() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page-icon">📊</div>
      <div className="placeholder-page-title">统计</div>
      <div className="placeholder-page-desc">
        这里将展示时间使用分析 —— 分类饼图、每日时长趋势、心情/精力分布。
      </div>
    </div>
  );
}

function SearchPage() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page-icon">🔍</div>
      <div className="placeholder-page-title">搜索</div>
      <div className="placeholder-page-desc">
        这里将支持按关键词、标签、日期范围搜索时间记录。
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page-icon">⚙️</div>
      <div className="placeholder-page-title">设置</div>
      <div className="placeholder-page-desc">
        这里将管理分类、标签和偏好设置。
      </div>
    </div>
  );
}

// ---- App ----------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Timeline />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
