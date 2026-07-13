import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [themePref, setThemePref] = useState(() => {
    return localStorage.getItem('theme-preference') || 'system';
  });

  // Derived actual theme: resolve 'system' using media query
  const getEffectiveTheme = (pref) => {
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref;
  };

  const [theme, setTheme] = useState(() => getEffectiveTheme(
    localStorage.getItem('theme-preference') || 'system'
  ));

  // Apply dark class to <html> and persist preference
  useEffect(() => {
    const effective = getEffectiveTheme(themePref);
    setTheme(effective);
    const root = window.document.documentElement;
    if (effective === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme-preference', themePref);
  }, [themePref]);

  // Listen to system preference changes when in 'system' mode
  useEffect(() => {
    if (themePref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const root = window.document.documentElement;
      if (e.matches) {
        root.classList.add('dark');
        setTheme('dark');
      } else {
        root.classList.remove('dark');
        setTheme('light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themePref]);

  // updateTheme accepts 'light' | 'dark' | 'system'
  const updateTheme = (newPref) => setThemePref(newPref);

  const toggleTheme = () => {
    setThemePref(prev => (getEffectiveTheme(prev) === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, themePref, toggleTheme, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
