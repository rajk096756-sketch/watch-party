import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Simple helper to generate/retrieve a persistent device fingerprint
function getDeviceFingerprint() {
  let fingerprint = localStorage.getItem('device-fingerprint');
  if (!fingerprint) {
    fingerprint = 'fp_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('device-fingerprint', fingerprint);
  }
  return fingerprint;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth-token') || null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState({
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India'
  });

  // Fetch approximate geolocation on startup (falls back to mock if blocked or offline)
  useEffect(() => {
    async function fetchLocation() {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          if (data.city && data.region && data.country_name) {
            setCurrentLocation({
              city: data.city,
              state: data.region,
              country: data.country_name
            });
          }
        }
      } catch (err) {
        console.warn('Geolocation API blocked or unavailable. Falling back to default mock location.');
      }
    }
    fetchLocation();
  }, []);

  // Sync profile details on mount or token change
  useEffect(() => {
    async function loadUser() {
      console.log('AuthContext: loadUser called, token:', token);
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        console.log('AuthContext: /auth/me response:', data);
        if (data.success) {
          setUser(data.user);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Failed to load user session', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const getSimulateHeaders = () => {
    const sim = localStorage.getItem('simulate-location-data');
    if (sim) {
      try {
        const parsed = JSON.parse(sim);
        return {
          'x-simulate-city': parsed.city || '',
          'x-simulate-state': parsed.state || '',
          'x-simulate-country': parsed.country || ''
        };
      } catch (e) {
        return {};
      }
    }
    return {};
  };

  const login = async (emailOrUsername, password) => {
    const fingerprint = getDeviceFingerprint();
    
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getSimulateHeaders()
      },
      body: JSON.stringify({
        emailOrUsername,
        password,
        deviceFingerprint: fingerprint
      })
    });
    
    const data = await res.json();
    if (data.success && data.token && !data.otpRequired) {
      localStorage.setItem('auth-token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const signup = async (email, phoneNumber, username, password) => {
    const fingerprint = getDeviceFingerprint();

    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getSimulateHeaders()
      },
      body: JSON.stringify({
        email,
        phoneNumber,
        username,
        password,
        deviceFingerprint: fingerprint
      })
    });

    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('auth-token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const verifyOtp = async (userId, code) => {
    const fingerprint = getDeviceFingerprint();

    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getSimulateHeaders()
      },
      body: JSON.stringify({
        userId,
        code,
        deviceFingerprint: fingerprint
      })
    });

    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('auth-token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('auth-token');
    setToken(null);
    setUser(null);
  };

  const updateProfileOptions = async (options) => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(options)
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
    }
    return data;
  };

  const uploadAvatar = async (file) => {
    if (!token) return;
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(`${API_BASE}/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      setUser(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
    }
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      currentLocation,
      setCurrentLocation,
      login,
      signup,
      verifyOtp,
      logout,
      updateProfileOptions,
      uploadAvatar,
      deviceFingerprint: getDeviceFingerprint()
    }}>
      {children}
    </AuthContext.Provider>
  );
};
