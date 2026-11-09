import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Compass, Eye, Shield, Check, Palette } from 'lucide-react';
import { useTheme, THEME_OPTIONS, ThemeId } from '../../context/ThemeContext';

interface ThemeSwitcherProps {
  compact?: boolean;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false }) => {
  const { theme, setTheme, currentThemeConfig } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeIcon = (id: ThemeId) => {
    switch (id) {
      case 'dark':
        return <Moon className="w-3.5 h-3.5 text-amber-400" />;
      case 'blueprint':
        return <Compass className="w-3.5 h-3.5 text-sky-400" />;
      case 'daylight':
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      case 'steel':
        return <Shield className="w-3.5 h-3.5 text-slate-400" />;
      case 'field':
      default:
        return <Palette className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer ${
          compact ? 'px-2' : ''
        }`}
        title={`Current Theme: ${currentThemeConfig.name} - Click to switch`}
      >
        <span className="shrink-0">{getThemeIcon(theme)}</span>
        {!compact && (
          <span className="hidden sm:inline font-sans font-medium text-[11px] truncate max-w-[110px]">
            {currentThemeConfig.name.split(' (')[0]}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-500" />
              <span>Theme Appearance</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">5 Presets</span>
          </div>

          <div className="p-1.5 space-y-1">
            {THEME_OPTIONS.map((opt) => {
              const isSelected = opt.id === theme;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTheme(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 text-slate-900 dark:text-white font-medium border border-amber-500/30'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getThemeIcon(opt.id)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold truncate">{opt.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 leading-tight">
                      {opt.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Jobsite display mode</span>
            <span className="font-mono">{theme.toUpperCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
};
