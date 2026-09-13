import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  const isDark = theme === 'dark';

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new Event('themeChange'));
  };

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem('theme') || 'light';
      setThemeState(stored);
    };
    window.addEventListener('themeChange', handleStorage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('themeChange', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    const storedTheme = localStorage.getItem('theme') || 'light';
    const isDark = storedTheme === 'dark';
    return {
      theme: storedTheme,
      isDark,
      setTheme: (newTheme) => {
        localStorage.setItem('theme', newTheme);
        window.dispatchEvent(new Event('themeChange'));
      },
      toggleTheme: () => {
        const next = isDark ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        window.dispatchEvent(new Event('themeChange'));
      }
    };
  }
  return context;
}
