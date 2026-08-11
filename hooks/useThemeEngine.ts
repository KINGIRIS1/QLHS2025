import { useState, useEffect, useCallback } from 'react';
import { ThemeConfig, ActiveThemeState } from '../types';
import { fetchThemeConfigs, fetchActiveThemeState } from '../services/apiTheme';
import { BUILT_IN_THEMES, DEFAULT_THEME_ID } from '../constants/themePresets';
import { isDateInSchedule } from '../utils/lunarCalendar';

export function useThemeEngine(simulatedDate?: Date) {
  const [themes, setThemes] = useState<ThemeConfig[]>(BUILT_IN_THEMES);
  const [activeState, setActiveState] = useState<ActiveThemeState>({
    activeThemeId: null,
    overrideActive: false,
    updatedAt: new Date().toISOString()
  });
  const [currentActiveTheme, setCurrentActiveTheme] = useState<ThemeConfig>(BUILT_IN_THEMES[0]);
  const [loading, setLoading] = useState(true);

  // Apply CSS Variables to :root
  const applyCssVariables = useCallback((theme: ThemeConfig) => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const c = theme.colors;

    root.style.setProperty('--app-primary', c.primary);
    root.style.setProperty('--app-primary-hover', c.primaryHover || c.primary);
    root.style.setProperty('--app-header-bg', c.headerBg);
    root.style.setProperty('--app-header-text', c.headerText);
    root.style.setProperty('--app-sidebar-bg', c.sidebarBg);
    root.style.setProperty('--app-sidebar-text', c.sidebarText);
    root.style.setProperty('--app-accent', c.accent);
    root.style.setProperty('--app-bg', c.background);
    root.style.setProperty('--app-card-bg', c.cardBg);
    root.style.setProperty('--app-text-main', c.textColor);

    const radiusMap = {
      none: '0px',
      sm: '4px',
      md: '8px',
      lg: '14px'
    };
    root.style.setProperty('--app-radius', radiusMap[c.borderRadius] || '8px');
  }, []);

  // Evaluate which theme should be active
  const evaluateActiveTheme = useCallback((
    themeList: ThemeConfig[],
    state: ActiveThemeState,
    targetDate: Date = new Date()
  ) => {
    // 0. Local preview override
    if (state.previewTheme) {
      return state.previewTheme;
    }
    if (state.previewThemeId) {
      const found = themeList.find(t => t.id === state.previewThemeId);
      if (found) return found;
    }
    if (state.previewDate) {
      const simDate = new Date(state.previewDate);
      const activeScheduled = themeList
        .filter(t => t.schedule.enabled)
        .filter(t => isDateInSchedule(simDate, t.schedule))
        .sort((a, b) => b.priority - a.priority);
      if (activeScheduled.length > 0) return activeScheduled[0];
    }

    // 1. Force override by Admin
    if (state.overrideActive && state.activeThemeId) {
      const forced = themeList.find(t => t.id === state.activeThemeId);
      if (forced) {
        return forced;
      }
    }

    // 2. Scheduled automatic theme
    const activeScheduled = themeList
      .filter(t => t.schedule.enabled)
      .filter(t => isDateInSchedule(targetDate, t.schedule))
      .sort((a, b) => b.priority - a.priority);

    if (activeScheduled.length > 0) {
      return activeScheduled[0];
    }

    // 3. Fallback to default
    const defaultTheme = themeList.find(t => t.isSystemDefault) || themeList[0] || BUILT_IN_THEMES[0];
    return defaultTheme;
  }, []);

  // Reload config and re-evaluate
  const refreshThemeEngine = useCallback(async () => {
    try {
      const [allThemes, state] = await Promise.all([
        fetchThemeConfigs(),
        fetchActiveThemeState()
      ]);

      setThemes(allThemes);
      setActiveState(state);

      const resolved = evaluateActiveTheme(allThemes, state, simulatedDate || new Date());
      setCurrentActiveTheme(resolved);
      applyCssVariables(resolved);
    } catch (err) {
      console.error("Error refreshing theme engine:", err);
    } finally {
      setLoading(false);
    }
  }, [evaluateActiveTheme, applyCssVariables, simulatedDate]);

  useEffect(() => {
    refreshThemeEngine();

    // Listen for Realtime global theme changes
    const handleGlobalThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log("⚡ [HOOK] Realtime theme change event received:", detail);
      if (detail) {
        setActiveState(detail);
        // Re-evaluate
        const resolved = evaluateActiveTheme(themes, detail, simulatedDate || new Date());
        setCurrentActiveTheme(resolved);
        applyCssVariables(resolved);
      } else {
        refreshThemeEngine();
      }
    };

    const handleLibraryChange = () => {
      refreshThemeEngine();
    };

    const handleLocalPreview = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log("👁️ [HOOK] Local preview event received:", detail);
      if (!detail) {
        setActiveState(prev => {
          const nextState = { ...prev, previewTheme: null, previewThemeId: null, previewDate: null };
          const resolved = evaluateActiveTheme(themes, nextState, simulatedDate || new Date());
          setCurrentActiveTheme(resolved);
          applyCssVariables(resolved);
          return nextState;
        });
        return;
      }

      setActiveState(prev => {
        const nextState = {
          ...prev,
          previewTheme: detail.previewTheme || null,
          previewThemeId: detail.previewThemeId || null,
          previewDate: detail.previewDate || null
        };
        const effectiveDate = detail.previewDate ? new Date(detail.previewDate) : (simulatedDate || new Date());
        const resolved = evaluateActiveTheme(themes, nextState, effectiveDate);
        setCurrentActiveTheme(resolved);
        applyCssVariables(resolved);
        return nextState;
      });
    };

    window.addEventListener('global_theme_changed', handleGlobalThemeChange);
    window.addEventListener('theme_library_changed', handleLibraryChange);
    window.addEventListener('theme_local_preview', handleLocalPreview);

    return () => {
      window.removeEventListener('global_theme_changed', handleGlobalThemeChange);
      window.removeEventListener('theme_library_changed', handleLibraryChange);
      window.removeEventListener('theme_local_preview', handleLocalPreview);
    };
  }, [refreshThemeEngine, evaluateActiveTheme, applyCssVariables, themes, simulatedDate]);

  return {
    themes,
    activeState,
    currentActiveTheme,
    loading,
    refreshThemeEngine,
    evaluateActiveTheme,
    applyCssVariables
  };
}
