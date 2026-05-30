import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const navItems = [
  { to: '/', icon: 'T', label: '时间线' },
  { to: '/stats', icon: 'A', label: '统计' },
  { to: '/search', icon: 'S', label: '搜索' },
  { to: '/settings', icon: 'C', label: '设置' },
];

export default function Layout() {
  const { theme, toggle } = useTheme();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon" aria-hidden="true" />
          <span className="sidebar-brand-text">Life Log</span>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
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
              <span className="nav-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggle} type="button">
            <span>{theme === 'dark' ? '深色' : '浅色'}</span>
            <div className="theme-toggle-track" aria-hidden="true">
              <div className="theme-toggle-thumb" />
            </div>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
