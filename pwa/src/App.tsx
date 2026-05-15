import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Client Pages
import { LandingPage } from './routes/client/LandingPage';
import { WaitingRoom } from './routes/client/WaitingRoom';
import { YourTurn } from './routes/client/YourTurn';
import { ThankYou } from './routes/client/ThankYou';

// Admin Pages
import { ControlRoom } from './routes/admin/ControlRoom';
import { LoginGate } from './routes/admin/LoginGate';

import { useSessionStore } from './store/useSessionStore';

// Client Protected Routes (requires active session)
const ClientProtectedLayout = () => {
  const { sessionId, status } = useSessionStore();

  if (!sessionId && status === 'idle') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

// Admin Protected Routes (requires PIN authentication)
const AdminProtectedLayout = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedSession = localStorage.getItem('kyros_admin_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (new Date(session.expires_at) > new Date()) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('kyros_admin_session');
        }
      } catch (e) {
        localStorage.removeItem('kyros_admin_session');
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-teal-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/control-room/login" replace />;
  }

  return <Outlet />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Client Routes (Public) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/thank-you" element={<ThankYou />} />

        {/* Client Protected Routes */}
        <Route element={<ClientProtectedLayout />}>
          <Route path="/waiting" element={<WaitingRoom />} />
          <Route path="/your-turn" element={<YourTurn />} />
        </Route>

        {/* Admin Public Route */}
        <Route path="/control-room/login" element={<LoginGate />} />

        {/* Admin Protected Routes */}
        <Route path="/control-room" element={<AdminProtectedLayout />}>
          <Route index element={<Navigate to="/control-room/counter" replace />} />
          <Route path="counter" element={<ControlRoom mode="counter" />} />
          <Route path="analytics" element={<ControlRoom mode="analytics" />} />
          <Route path="zones" element={<ControlRoom mode="zones" />} />
          <Route path="content" element={<ControlRoom mode="content" />} />
          <Route path="settings" element={<ControlRoom mode="settings" />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
