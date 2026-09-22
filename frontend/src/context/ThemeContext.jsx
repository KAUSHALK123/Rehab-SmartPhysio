import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const DARK_STYLES = {
  oled: {
    id: 'oled',
    name: 'OLED Pitch Black',
    description: 'Pure zero-light black with zero blue tint for maximum contrast',
    bgMain: '#000000',
    bgNav: '#070709',
    bgCard: '#0c0d10',
    bgElevated: '#14151a',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSubtle: 'rgba(255, 255, 255, 0.04)'
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Carbon',
    description: 'Deep architectural graphite and brushed titanium luster',
    bgMain: '#08090c',
    bgNav: '#0e0f14',
    bgCard: '#13141a',
    bgElevated: '#1a1b22',
    border: 'rgba(255, 255, 255, 0.09)',
    borderSubtle: 'rgba(255, 255, 255, 0.05)'
  },
  stealth: {
    id: 'stealth',
    name: 'Stealth Charcoal',
    description: 'Matte studio dark gray for long therapeutic monitoring sessions',
    bgMain: '#101114',
    bgNav: '#16171c',
    bgCard: '#1b1c23',
    bgElevated: '#23242c',
    border: 'rgba(255, 255, 255, 0.1)',
    borderSubtle: 'rgba(255, 255, 255, 0.06)'
  }
};

export const ACCENT_PRESETS = [
  { name: 'Emerald Cyber', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.25)' },
  { name: 'Electric Violet', hex: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.25)' },
  { name: 'Royal Cyan', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.25)' },
  { name: 'Azure Blue', hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.25)' },
  { name: 'Sunset Amber', hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.25)' },
  { name: 'Neon Rose', hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.25)' },
  { name: 'Pure Minimal', hex: '#ffffff', glow: 'rgba(255, 255, 255, 0.2)' },
  { name: 'Hyper Orange', hex: '#ff6b00', glow: 'rgba(255, 107, 0, 0.25)' }
];

export function applyThemeVariables(isDark, styleKey, accent) {
  const root = document.documentElement;
  const styleConfig = DARK_STYLES[styleKey] || DARK_STYLES.oled;

  if (isDark) {
    root.classList.add('dark');
    root.style.setProperty('--theme-bg-main', styleConfig.bgMain);
    root.style.setProperty('--theme-bg-nav', styleConfig.bgNav);
    root.style.setProperty('--theme-bg-card', styleConfig.bgCard);
    root.style.setProperty('--theme-bg-elevated', styleConfig.bgElevated);
    root.style.setProperty('--theme-border-main', styleConfig.border);
    root.style.setProperty('--theme-border-subtle', styleConfig.borderSubtle);
  } else {
    root.classList.remove('dark');
    root.style.setProperty('--theme-bg-main', '#f8fafc');
    root.style.setProperty('--theme-bg-nav', '#ffffff');
    root.style.setProperty('--theme-bg-card', '#ffffff');
    root.style.setProperty('--theme-bg-elevated', '#f1f5f9');
    root.style.setProperty('--theme-border-main', '#e2e8f0');
    root.style.setProperty('--theme-border-subtle', '#f1f5f9');
  }

  // Accent color variables
  root.style.setProperty('--theme-accent', accent);
  root.style.setProperty('--theme-accent-glow', `${accent}33`);
  root.style.setProperty('--color-primary', accent);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [darkStyle, setDarkStyleState] = useState(() => {
    return localStorage.getItem('smartphysio_dark_style') || 'oled';
  });

  const [accentColor, setAccentColorState] = useState(() => {
    return localStorage.getItem('smartphysio_theme_accent') || '#10b981';
  });

  const isDark = theme === 'dark';

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    applyThemeVariables(newTheme === 'dark', darkStyle, accentColor);
    window.dispatchEvent(new Event('themeChange'));
  };

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const setDarkStyle = (newStyle) => {
    setDarkStyleState(newStyle);
    localStorage.setItem('smartphysio_dark_style', newStyle);
    applyThemeVariables(isDark, newStyle, accentColor);
    window.dispatchEvent(new Event('themeChange'));
  };

  const setAccentColor = (newAccent) => {
    setAccentColorState(newAccent);
    localStorage.setItem('smartphysio_theme_accent', newAccent);
    applyThemeVariables(isDark, darkStyle, newAccent);
    window.dispatchEvent(new Event('themeChange'));
  };

  useEffect(() => {
    applyThemeVariables(isDark, darkStyle, accentColor);
  }, [isDark, darkStyle, accentColor]);

  useEffect(() => {
    const handleStorage = () => {
      const storedTheme = localStorage.getItem('theme') || 'dark';
      const storedStyle = localStorage.getItem('smartphysio_dark_style') || 'oled';
      const storedAccent = localStorage.getItem('smartphysio_theme_accent') || '#10b981';
      setThemeState(storedTheme);
      setDarkStyleState(storedStyle);
      setAccentColorState(storedAccent);
      applyThemeVariables(storedTheme === 'dark', storedStyle, storedAccent);
    };

    window.addEventListener('themeChange', handleStorage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('themeChange', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      isDark, 
      darkStyle, 
      setDarkStyle, 
      accentColor, 
      setAccentColor, 
      setTheme, 
      toggleTheme,
      DARK_STYLES,
      ACCENT_PRESETS
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    const storedTheme = localStorage.getItem('theme') || 'dark';
    const isDark = storedTheme === 'dark';
    const darkStyle = localStorage.getItem('smartphysio_dark_style') || 'oled';
    const accentColor = localStorage.getItem('smartphysio_theme_accent') || '#10b981';

    return {
      theme: storedTheme,
      isDark,
      darkStyle,
      setDarkStyle: (newStyle) => {
        localStorage.setItem('smartphysio_dark_style', newStyle);
        applyThemeVariables(isDark, newStyle, accentColor);
        window.dispatchEvent(new Event('themeChange'));
      },
      accentColor,
      setAccentColor: (newAccent) => {
        localStorage.setItem('smartphysio_theme_accent', newAccent);
        applyThemeVariables(isDark, darkStyle, newAccent);
        window.dispatchEvent(new Event('themeChange'));
      },
      setTheme: (newTheme) => {
        localStorage.setItem('theme', newTheme);
        applyThemeVariables(newTheme === 'dark', darkStyle, accentColor);
        window.dispatchEvent(new Event('themeChange'));
      },
      toggleTheme: () => {
        const next = isDark ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        applyThemeVariables(next === 'dark', darkStyle, accentColor);
        window.dispatchEvent(new Event('themeChange'));
      },
      DARK_STYLES,
      ACCENT_PRESETS
    };
  }
  return context;
}
