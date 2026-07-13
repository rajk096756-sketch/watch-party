import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function AppContent() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-luxury-linen dark:bg-luxury-plum flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-luxury-rose border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-luxury-roseDark dark:text-luxury-rose">
            Preparing your theater...
          </p>
        </div>
      </div>
    );
  }

  if (user && token) {
    return <Dashboard />;
  }

  return <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

