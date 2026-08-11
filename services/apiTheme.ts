import { supabase, isConfigured, presenceChannel } from './supabaseClient';
import { ThemeConfig, ActiveThemeState } from '../types';
import { BUILT_IN_THEMES, DEFAULT_THEME_ID } from '../constants/themePresets';
import { logError } from './apiCore';

const STORAGE_KEY_THEMES = 'app_custom_themes_v1';
const STORAGE_KEY_ACTIVE_STATE = 'app_active_theme_state_v1';

/**
 * Lấy danh sách toàn bộ các Cấu hình Theme (Bao gồm các Theme mặc định & Theme Admin tự thêm)
 */
export const fetchThemeConfigs = async (): Promise<ThemeConfig[]> => {
  if (!isConfigured) {
    return getLocalThemes();
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'app_themes_library')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn("fetchThemeConfigs error:", error.message);
    }

    if (data && data.value) {
      let dbThemes: ThemeConfig[] = [];
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed)) {
          dbThemes = parsed;
        }
      } catch (_e) {
        console.warn("fetchThemeConfigs: could not parse JSON array from app_themes_library");
      }

      // Merged with built-in themes to ensure defaults are always present
      const themeMap = new Map<string, ThemeConfig>();
      BUILT_IN_THEMES.forEach(t => themeMap.set(t.id, t));
      dbThemes.forEach(t => themeMap.set(t.id, t));

      const result = Array.from(themeMap.values());
      saveLocalThemes(result);
      return result;
    }
  } catch (err) {
    logError("fetchThemeConfigs", err);
  }

  return getLocalThemes();
};

/**
 * Lưu danh sách Cấu hình Themes vào Supabase & LocalStorage
 */
export const saveThemeConfigs = async (themes: ThemeConfig[]): Promise<boolean> => {
  saveLocalThemes(themes);

  if (!isConfigured) return true;

  try {
    const value = JSON.stringify(themes);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'app_themes_library', value });

    if (error) throw error;
    return true;
  } catch (err) {
    logError("saveThemeConfigs", err);
    return false;
  }
};

/**
 * Lấy trạng thái Theme đang Ép kích hoạt (Force Active Override State)
 */
export const fetchActiveThemeState = async (): Promise<ActiveThemeState> => {
  if (!isConfigured) {
    return getLocalActiveState();
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'active_theme_override')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn("fetchActiveThemeState error:", error.message);
    }

    if (data && data.value) {
      let parsed: any = null;
      try {
        parsed = JSON.parse(data.value);
      } catch (_) {
        parsed = data.value;
      }

      let state: ActiveThemeState;
      if (typeof parsed === 'string') {
        const trimmed = parsed.trim();
        state = {
          activeThemeId: trimmed || null,
          overrideActive: Boolean(trimmed),
          updatedAt: new Date().toISOString()
        };
      } else if (typeof parsed === 'object' && parsed !== null) {
        state = {
          activeThemeId: parsed.activeThemeId ?? null,
          overrideActive: parsed.overrideActive ?? Boolean(parsed.activeThemeId),
          updatedAt: parsed.updatedAt ?? new Date().toISOString()
        };
      } else {
        state = getLocalActiveState();
      }

      saveLocalActiveState(state);
      return state;
    }
  } catch (err) {
    logError("fetchActiveThemeState", err);
  }

  return getLocalActiveState();
};

/**
 * Admin KÍCH HOẠT VÀ PHÁT SÓNG LẬP TỨC CHO TẤT CẢ USER (Apply Now Broadcast)
 * Khi gọi hàm này:
 * 1. Ghi trạng thái active_theme_override vào Supabase
 * 2. Phát sóng Broadcast Realtime qua presenceChannel & custom event
 * 3. Tất cả các máy Web & App EXE đang mở sẽ đổi màu ngay tức thì (< 0.5s)
 */
export const broadcastAndApplyThemeNow = async (themeId: string | null): Promise<boolean> => {
  const activeState: ActiveThemeState = {
    activeThemeId: themeId,
    overrideActive: themeId !== null,
    updatedAt: new Date().toISOString()
  };

  saveLocalActiveState(activeState);

  // Dispatch local custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('global_theme_changed', { detail: activeState }));
  }

  if (!isConfigured) return true;

  try {
    const value = JSON.stringify(activeState);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'active_theme_override', value });

    if (error) throw error;

    // Send instant WebSocket broadcast to ALL connected apps (.exe and web)
    try {
      presenceChannel.send({
        type: 'broadcast',
        event: 'theme_instant_update',
        payload: activeState
      });
      console.log("⚡ [THEME] Đã phát sóng Realtime đổi giao diện toàn hệ thống!");
    } catch (broadcastErr) {
      console.warn("Realtime broadcast send failed:", broadcastErr);
    }

    return true;
  } catch (err) {
    logError("broadcastAndApplyThemeNow", err);
    return false;
  }
};

// --- LOCAL STORAGE FALLBACK HELPERS ---
function getLocalThemes(): ThemeConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THEMES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_) {}
  return BUILT_IN_THEMES;
}

function saveLocalThemes(themes: ThemeConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY_THEMES, JSON.stringify(themes));
  } catch (_) {}
}

function getLocalActiveState(): ActiveThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_STATE);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_) {}
  return {
    activeThemeId: null,
    overrideActive: false,
    updatedAt: new Date().toISOString()
  };
}

function saveLocalActiveState(state: ActiveThemeState) {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_STATE, JSON.stringify(state));
  } catch (_) {}
}
