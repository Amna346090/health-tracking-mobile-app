import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Users, ShieldCheck, LogOut, Activity, KeyRound, Pill, Calendar, ClipboardCheck, HeartPulse, Settings, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { NotificationBell } from './NotificationBell';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const closeMobileNav = () => setMobileNavOpen(false);
  const linkClass = ({ isActive }: { isActive: boolean }) => `sidebar-link${isActive ? ' active' : ''}`;

  const initials = user ? (user.firstName[0] + user.lastName[0]).toUpperCase() : '';

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <button className="mobile-topbar-toggle" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <span className="mobile-topbar-brand">SFLBiotrack</span>
      </div>

      {mobileNavOpen && <div className="sidebar-backdrop" onClick={closeMobileNav} />}

      <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
        <button className="sidebar-mobile-close" onClick={closeMobileNav} aria-label="Close menu">
          <X size={16} />
        </button>

        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <Activity size={17} strokeWidth={2.4} />
          </div>
          <div>
            <div className="sidebar-brand-text">SFLBiotrack</div>
            <div className="sidebar-brand-sub">CRM</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/patients" className={linkClass} onClick={closeMobileNav}>
            <Users size={17} strokeWidth={2} />
            Patients
          </NavLink>
          <NavLink to="/medications" className={linkClass} onClick={closeMobileNav}>
            <Pill size={17} strokeWidth={2} />
            Medications
          </NavLink>
          <NavLink to="/appointments" className={linkClass} onClick={closeMobileNav}>
            <Calendar size={17} strokeWidth={2} />
            Appointments
          </NavLink>
          <NavLink to="/test-requests" className={linkClass} onClick={closeMobileNav}>
            <ClipboardCheck size={17} strokeWidth={2} />
            Test/Scan Requests
          </NavLink>
          <NavLink to="/touch-base" className={linkClass} onClick={closeMobileNav}>
            <HeartPulse size={17} strokeWidth={2} />
            Touch-Base Queue
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/users" className={linkClass} onClick={closeMobileNav}>
              <ShieldCheck size={17} strokeWidth={2} />
              Manage Users
            </NavLink>
          )}
          {user?.role === 'ADMIN' && (
            <NavLink to="/settings" className={linkClass} onClick={closeMobileNav}>
              <Settings size={17} strokeWidth={2} />
              Settings
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.firstName} {user?.lastName}</div>
              <div className="sidebar-user-role">{user?.role.toLowerCase()}</div>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <NotificationBell />
          </div>
          <button className="sidebar-signout" onClick={() => setShowChangePassword(true)} style={{ marginBottom: 8 }}>
            <KeyRound size={14} strokeWidth={2.2} />
            Change password
          </button>
          <button className="sidebar-signout" onClick={handleLogout}>
            <LogOut size={14} strokeWidth={2.2} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <Outlet />
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
