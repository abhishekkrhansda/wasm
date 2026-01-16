import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">
                        <span className="logo-icon">⚡</span>
                        <span className="logo-text">WACMS</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" className="nav-link" end>
                        <span className="nav-icon">📊</span>
                        Dashboard
                    </NavLink>
                    <NavLink to="/cases" className="nav-link" end>
                        <span className="nav-icon">📋</span>
                        Cases
                    </NavLink>
                    <NavLink to="/cases/new" className="nav-link">
                        <span className="nav-icon">➕</span>
                        New Case
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-details">
                            <div className="user-name">{user?.name}</div>
                            <div className="user-role">{user?.role}</div>
                        </div>
                    </div>
                    <button className="btn-logout" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
