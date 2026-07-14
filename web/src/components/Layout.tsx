import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Users, ShieldCheck, LogOut, Activity, KeyRound, Pill } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const initials = user ? (user.firstName[0] + user.lastName[0]).toUpperCase() : '';

  return (
    <div className="app-shell">
      <aside className="sidebar">
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
          <NavLink to="/patients" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Users size={17} strokeWidth={2} />
            Patients
          </NavLink>
          <NavLink to="/medications" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Pill size={17} strokeWidth={2} />
            Medications
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/users" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <ShieldCheck size={17} strokeWidth={2} />
              Manage Users
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
