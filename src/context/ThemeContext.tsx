import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeId = 'field' | 'dark' | 'blueprint' | 'daylight' | 'steel';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  tagline: string;
  isDark: boolean;
  accentColor: string;
  badgeBg: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'field',
    name: 'Safety Field (Light)',
    tagline: 'Standard daytime jobsite with navy & safety amber',
    isDark: false,
    accentColor: '#f59e0b',
    badgeBg: '#fef3c7'
  },
  {
    id: 'dark',
    name: 'Industrial Dark (Night Shift)',
    tagline: 'Deep slate & high-contrast amber for low-light night shifts',
    isDark: true,
    accentColor: '#f59e0b',
    badgeBg: '#78350f'
  },
  {
    id: 'blueprint',
    name: 'Engineering Blueprint',
    tagline: 'Architectural drafting navy with cyan structural lines',
    isDark: true,
    accentColor: '#38bdf8',
    badgeBg: '#0369a1'
  },
  {
    id: 'daylight',
    name: 'Daylight High-Contrast',
    tagline: 'Stark white & bold black text for direct solar glare outdoors',
    isDark: false,
    accentColor: '#eab308',
    badgeBg: '#fef08a'
  },
  {
    id: 'steel',
    name: 'Steel & Concrete',
    tagline: 'Architectural gunmetal monochrome & structural titanium',
    isDark: true,
    accentColor: '#94a3b8',
    badgeBg: '#334155'
  }
];

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  isDark: boolean;
  currentThemeConfig: ThemeOption;
}

const THEME_STORAGE_KEY = 'buildpulse_lms_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && ['field', 'dark', 'blueprint', 'daylight', 'steel'].includes(stored)) {
        return stored as ThemeId;
      }
    } catch {
      // fallback
    }
    return 'field';
  });

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
  };

  const currentThemeConfig = THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0];
  const isDark = currentThemeConfig.isDark;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, isDark]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDark,
        currentThemeConfig
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
