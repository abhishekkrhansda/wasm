import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import NewCase from './pages/NewCase';

// Components
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

function PrivateRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <LoadingSpinner />;
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
    const { loading } = useAuth();

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                path="/*"
                element={
                    <PrivateRoute>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/cases" element={<Cases />} />
                                <Route path="/cases/new" element={<NewCase />} />
                                <Route path="/cases/:id" element={<CaseDetail />} />
                            </Routes>
                        </Layout>
                    </PrivateRoute>
                }
            />
        </Routes>
    );
}

export default App;
