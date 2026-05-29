import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const navItems = [
  { to: '/', icon: '📅', label: '时间线' },
  { to: '/stats', icon: '📊', label: '统计' },
  { to: '/search', icon: '🔍', label: '搜索' },
  { to: '/settings', icon: '⚙️', label: '设置' },
];

export default function Layout() {
  const { theme, toggle } = useTheme();

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">🕐</span>
          <span className="sidebar-brand-text">Life Log</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <span className="nav-link-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggle}>
            <span>{theme === 'dark' ? '🌙 深色模式' : '☀️ 浅色模式'}</span>
            <div className="theme-toggle-track">
              <div className="theme-toggle-thumb" />
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
