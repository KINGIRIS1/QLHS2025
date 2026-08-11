import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Calendar,
  Zap,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Eye,
  Download,
  Upload,
  AlertCircle,
  HelpCircle,
  Sun,
  Moon,
  Layers,
  Flag,
  Snowflake,
  Flame,
  Check,
  RotateCcw
} from 'lucide-react';
import { ThemeConfig, CalendarType, EffectType, EffectIntensity, ActiveThemeState } from '../types';
import { BUILT_IN_THEMES } from '../constants/themePresets';
import { fetchThemeConfigs, saveThemeConfigs, broadcastAndApplyThemeNow, fetchActiveThemeState } from '../services/apiTheme';
import { convertSolarToLunar, isDateInSchedule } from '../utils/lunarCalendar';
import { confirmAction, showToast } from '../utils/appHelpers';

export const AdminThemeManager: React.FC = () => {
  const [themes, setThemes] = useState<ThemeConfig[]>(BUILT_IN_THEMES);
  const [activeState, setActiveState] = useState<ActiveThemeState>({
    activeThemeId: null,
    overrideActive: false,
    updatedAt: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Selected Theme for Editing
  const [selectedThemeId, setSelectedThemeId] = useState<string>(BUILT_IN_THEMES[0].id);
  const [editForm, setEditForm] = useState<ThemeConfig>(BUILT_IN_THEMES[0]);

  // Simulation Date Picker
  const [simulationDate, setSimulationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isPreviewingDate, setIsPreviewingDate] = useState<boolean>(false);
  const [previewingThemeName, setPreviewingThemeName] = useState<string>('');
  const [simulationResult, setSimulationResult] = useState<string>('');

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [list, state] = await Promise.all([
        fetchThemeConfigs(),
        fetchActiveThemeState()
      ]);
      setThemes(list);
      setActiveState(state);

      if (list.length > 0) {
        const found = list.find(t => t.id === selectedThemeId) || list[0];
        setSelectedThemeId(found.id);
        setEditForm(JSON.parse(JSON.stringify(found)));
      }
    } catch (err) {
      console.error("Error loading admin themes:", err);
      showToast("Lỗi khi tải danh sách giao diện", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update edit form when selected ID changes
  const handleSelectTheme = (id: string) => {
    setSelectedThemeId(id);
    const target = themes.find(t => t.id === id);
    if (target) {
      setEditForm(JSON.parse(JSON.stringify(target)));
    }
  };

  // Broadcast & Force Apply Theme Now
  const handleApplyNow = async (themeId: string | null) => {
    const actionText = themeId
      ? `Bạn có chắc muốn KÍCH HOẠT VÀ ÉP ÁP DỤNG ngay giao diện "${themes.find(t => t.id === themeId)?.name}" cho TẤT CẢ các máy Web & File .EXE trên hệ thống?`
      : `Bạn có chắc muốn CHUYỂN VỀ CHẾ ĐỘ ÁP DỤNG TỰ ĐỘNG THEO LỊCH NGHỈ LỄ cho toàn bộ hệ thống?`;

    if (!(await confirmAction(actionText))) return;

    setIsBroadcasting(true);
    try {
      const success = await broadcastAndApplyThemeNow(themeId);
      if (success) {
        setActiveState({
          activeThemeId: themeId,
          overrideActive: themeId !== null,
          updatedAt: new Date().toISOString()
        });
        showToast(
          themeId
            ? "⚡ Đã phát sóng & ép kích hoạt giao diện thành công tới toàn bộ hệ thống (< 0.5s)!"
            : "⏰ Đã chuyển hệ thống về chế độ Tự động áp dụng giao diện theo Lịch nghỉ lễ!",
          "success"
        );
      } else {
        showToast("Có lỗi xảy ra khi phát sóng giao diện.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gặp sự cố kết nối tới máy chủ Supabase.", "error");
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Save changes to current theme list
  const handleSaveThemesList = async () => {
    setIsSaving(true);
    try {
      // Update form data inside list
      const updatedList = themes.map(t => (t.id === editForm.id ? editForm : t));
      const success = await saveThemeConfigs(updatedList);
      if (success) {
        setThemes(updatedList);
        showToast("Đã lưu cấu hình giao diện lên Supabase thành công!", "success");
      } else {
        showToast("Lỗi khi lưu cấu hình lên Supabase.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Sự cố xảy ra khi lưu giao diện.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Create new Theme
  const handleCreateNewTheme = () => {
    const newId = 'THEME_CUSTOM_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const newTheme: ThemeConfig = {
      id: newId,
      code: 'CUSTOM_THEME_' + Date.now(),
      name: 'Giao diện Tùy chỉnh Mới',
      description: 'Mô tả cấu hình giao diện tùy biến...',
      priority: 10,
      schedule: {
        enabled: true,
        calendarType: 'SOLAR',
        startMonth: 1,
        startDay: 1,
        endMonth: 1,
        endDay: 15,
        yearSpecific: null
      },
      colors: {
        primary: '#2563eb',
        primaryHover: '#1d4ed8',
        headerBg: '#1e3a8a',
        headerText: '#ffffff',
        sidebarBg: '#0f172a',
        sidebarText: '#ffffff',
        accent: '#f59e0b',
        background: '#f8fafc',
        cardBg: '#ffffff',
        textColor: '#0f172a',
        borderRadius: 'md'
      },
      branding: {
        showEventBadge: true,
        eventBadgeText: '✨ Sự Kiện Đặc Biệt',
        greetingText: 'Chào mừng Quý khách & Cán bộ!'
      },
      effect: {
        type: 'NONE',
        intensity: 'STANDARD',
        disableOnMobile: true
      }
    };

    const nextList = [...themes, newTheme];
    setThemes(nextList);
    setSelectedThemeId(newId);
    setEditForm(newTheme);
    showToast("Đã tạo mẫu giao diện mới. Nhấn 'Lưu cấu hình' để hoàn tất.", "success");
  };

  // Delete Theme
  const handleDeleteTheme = async (id: string) => {
    const target = themes.find(t => t.id === id);
    if (target?.isSystemDefault) {
      showToast("Không thể xóa Giao diện Mặc định của hệ thống!", "error");
      return;
    }

    if (await confirmAction(`Bạn có chắc muốn xóa giao diện "${target?.name}"?`)) {
      const nextList = themes.filter(t => t.id !== id);
      setThemes(nextList);
      if (nextList.length > 0) {
        setSelectedThemeId(nextList[0].id);
        setEditForm(JSON.parse(JSON.stringify(nextList[0])));
      }
      showToast("Đã xóa giao diện khỏi danh sách.", "success");
    }
  };

  // Simulate Date Evaluation & Live Preview
  const handleRunSimulation = () => {
    if (!simulationDate) return;
    const dateObj = new Date(simulationDate);
    const lunarObj = convertSolarToLunar(dateObj.getDate(), dateObj.getMonth() + 1, dateObj.getFullYear());

    // Find matching theme for this date
    const matchedTheme = themes
      .filter(t => t.schedule.enabled)
      .filter(t => isDateInSchedule(dateObj, t.schedule))
      .sort((a, b) => b.priority - a.priority)[0] || themes.find(t => t.isSystemDefault) || themes[0];

    let matchMsg = `📅 DƯƠNG LỊCH: Ngày ${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}\n`;
    matchMsg += `🌙 ÂM LỊCH VN: Ngày ${lunarObj.day} tháng ${lunarObj.month} (Năm ${lunarObj.year})\n`;
    matchMsg += `✨ MẪU KHỚP LỊCH: "${matchedTheme.name}"\n\n`;
    matchMsg += `👉 Ứng dụng ĐANG BẬT XEM TRƯỚC LẬP TỨC giao diện này trên màn hình của bạn!`;

    setIsPreviewingDate(true);
    setPreviewingThemeName(matchedTheme.name);

    // Dispatch local preview event
    window.dispatchEvent(new CustomEvent('theme_local_preview', {
      detail: { previewTheme: matchedTheme, previewDate: simulationDate }
    }));

    setSimulationResult(matchMsg);
    showToast(`Đã bật XEM TRƯỚC giao diện "${matchedTheme.name}"!`, "success");
  };

  // Directly preview current edit form theme
  const handlePreviewCurrentForm = () => {
    setIsPreviewingDate(true);
    setPreviewingThemeName(editForm.name);

    window.dispatchEvent(new CustomEvent('theme_local_preview', {
      detail: { previewTheme: editForm }
    }));

    showToast(`Đang XEM TRƯỚC giao diện "${editForm.name}" trên máy bạn!`, "success");
  };

  // Stop Live Preview
  const handleStopPreview = () => {
    setIsPreviewingDate(false);
    setPreviewingThemeName('');
    window.dispatchEvent(new CustomEvent('theme_local_preview', { detail: null }));
    showToast("Đã dừng chế độ Xem trước.", "success");
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(themes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `app_theme_configs_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Đã xuất file JSON cấu hình giao diện!", "success");
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (Array.isArray(imported)) {
            setThemes(imported);
            if (imported.length > 0) {
              setSelectedThemeId(imported[0].id);
              setEditForm(imported[0]);
            }
            showToast("Đã nhập cấu hình từ file JSON thành công! Hãy nhấn 'Lưu cấu hình'.", "success");
          } else {
            showToast("Định dạng file JSON không hợp lệ.", "error");
          }
        } catch (err) {
          showToast("Lỗi khi đọc file JSON.", "error");
        }
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 gap-3">
        <RefreshCw className="animate-spin" size={20} />
        <span>Đang tải cấu hình giao diện từ Supabase...</span>
      </div>
    );
  }

  const currentlyActiveTheme = activeState.overrideActive && activeState.activeThemeId
    ? themes.find(t => t.id === activeState.activeThemeId)
    : themes.find(t => t.isSystemDefault) || themes[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* HEADER BANNER - STATUS OVERVIEW */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden border border-indigo-800/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1">
                <Sparkles size={12} />
                Quản lý Giao diện Tùy biến toàn Hệ thống
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Palette className="text-yellow-400" size={24} />
              Cấu hình Giao diện Lễ Tết & Tự động theo Lịch
            </h2>
            <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl">
              Hệ thống cho phép Admin tùy chỉnh màu sắc, banner & hiệu ứng cho toàn bộ người dùng (Web & các máy cài ứng dụng .EXE). Tự động áp dụng theo Âm/Dương lịch hoặc kích hoạt ngay tức thì.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-indigo-200 font-bold">Trạng thái hiện tại</div>
              <div className="text-sm font-black text-yellow-300 flex items-center justify-end gap-1.5">
                {activeState.overrideActive ? (
                  <>
                    <Zap size={14} className="text-amber-400 animate-pulse" />
                    <span>Ép kích hoạt: {currentlyActiveTheme?.name}</span>
                  </>
                ) : (
                  <>
                    <Clock size={14} className="text-emerald-400" />
                    <span>Chạy tự động theo Lịch</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE PREVIEW WARNING BANNER */}
      {isPreviewingDate && (
        <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white rounded-2xl p-4 shadow-lg border border-pink-400 flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl shrink-0 backdrop-blur-xs">
              <Eye size={22} className="text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h4 className="font-black text-sm tracking-tight flex items-center gap-2">
                🔍 ĐANG BẬT CHẾ ĐỘ XEM TRƯỚC GIAO DIỆN
              </h4>
              <p className="text-xs text-pink-100 mt-0.5">
                Giao diện <span className="font-bold underline text-white">"{previewingThemeName}"</span> đang được xem thử trực tiếp trên máy bạn (Không ảnh hưởng đến các máy user khác).
              </p>
            </div>
          </div>

          <button
            onClick={handleStopPreview}
            className="px-4 py-2 bg-white text-pink-700 hover:bg-pink-50 rounded-xl text-xs font-black shadow-md transition shrink-0 cursor-pointer"
          >
            ✖ Dừng Xem Trước
          </button>
        </div>
      )}

      {/* QUICK ACTION BAR - BROADCAST CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Zap size={22} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">Kích hoạt & Phát sóng Tức thì (Realtime Broadcast)</h4>
            <p className="text-xs text-slate-500">
              Bấm nút Áp dụng sẽ gửi tín hiệu Realtime đổi giao diện đến <span className="font-bold text-slate-700">TẤT CẢ máy người dùng (Web & .EXE)</span> ngay lập tức trong &lt;0.5 giây.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
          {activeState.overrideActive && (
            <button
              onClick={() => handleApplyNow(null)}
              disabled={isBroadcasting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-300"
            >
              <RotateCcw size={14} />
              Về Chế độ Tự động
            </button>
          )}

          <button
            onClick={() => handleApplyNow(selectedThemeId)}
            disabled={isBroadcasting}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center gap-2 tracking-wide"
          >
            {isBroadcasting ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <Zap size={16} className="fill-current" />
            )}
            <span>ÁP DỤNG NGAY CHO TẤT CẢ USER</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: THEME PRESET GALLERY & LIST */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                Thư viện Mẫu Giao diện ({themes.length})
              </h3>
              <button
                onClick={handleCreateNewTheme}
                className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition flex items-center gap-1"
                title="Tạo giao diện mới"
              >
                <Plus size={14} />
                <span>Tạo mới</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {themes.map((theme) => {
                const isSelected = theme.id === selectedThemeId;
                const isForceActive = activeState.overrideActive && activeState.activeThemeId === theme.id;

                return (
                  <div
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer relative ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {/* Color Dot Preview */}
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0 shadow-xs"
                            style={{ backgroundColor: theme.colors.primary }}
                          />
                          <span className="font-bold text-xs text-slate-800">{theme.name}</span>
                        </div>

                        <p className="text-[11px] text-slate-500 line-clamp-1">{theme.description}</p>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {isForceActive && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white flex items-center gap-0.5">
                            <Zap size={10} /> Đang chạy
                          </span>
                        )}
                        {theme.isSystemDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
                            Mặc định
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta tags */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {theme.schedule.calendarType === 'LUNAR' ? 'Âm lịch' : 'Dương lịch'}: {theme.schedule.startDay}/{theme.schedule.startMonth} - {theme.schedule.endDay}/{theme.schedule.endMonth}
                      </span>
                      {theme.effect.type !== 'NONE' && (
                        <span className="text-pink-600 font-semibold bg-pink-50 px-1.5 py-0.5 rounded">
                          ✨ {theme.effect.type}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BACKUP & IMPORT / EXPORT */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Sao lưu & Xuất File Cấu hình</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportJson}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Download size={14} /> Xuất JSON
              </button>
              <label className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
                <Upload size={14} /> Nhập JSON
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WYSIWYG EDITOR FOR SELECTED THEME */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">

            {/* Editor Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Chỉnh sửa Cấu hình
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">{editForm.name}</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviewCurrentForm}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-indigo-200 cursor-pointer"
                  title="Xem thử giao diện này ngay trên màn hình"
                >
                  <Eye size={15} /> <span>Xem thử Mẫu này</span>
                </button>

                {!editForm.isSystemDefault && (
                  <button
                    onClick={() => handleDeleteTheme(editForm.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition"
                    title="Xóa mẫu giao diện này"
                  >
                    <Trash2 size={18} />
                  </button>
                )}

                <button
                  onClick={handleSaveThemesList}
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center gap-2"
                >
                  {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                  <span>LƯU CẤU HÌNH</span>
                </button>
              </div>
            </div>

            {/* FORM SECTION 1: BASIC INFO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Giao diện / Sự kiện</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Vd: Tết Nguyên Đán 2027"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã Nhận Diện (Code)</label>
                <input
                  type="text"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  placeholder="Vd: TET_AM_LICH_2027"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả hiển thị</label>
                <input
                  type="text"
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ghi chú chi tiết về sự kiện..."
                />
              </div>
            </div>

            {/* FORM SECTION 2: SCHEDULE CONFIG (SOLAR / LUNAR) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-600" />
                  Cấu hình Lịch Tự Động Kích Hoạt
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.schedule.enabled}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        schedule: { ...editForm.schedule, enabled: e.target.checked }
                      })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-xs font-semibold text-slate-700">Bật kích hoạt theo Lịch</span>
                </label>
              </div>

              {editForm.schedule.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                  {/* Calendar Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Loại Lịch</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            schedule: { ...editForm.schedule, calendarType: 'SOLAR' }
                          })
                        }
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition ${
                          editForm.schedule.calendarType === 'SOLAR'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        <Sun size={12} /> Dương lịch
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            schedule: { ...editForm.schedule, calendarType: 'LUNAR' }
                          })
                        }
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition ${
                          editForm.schedule.calendarType === 'LUNAR'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        <Moon size={12} /> Âm lịch VN
                      </button>
                    </div>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Từ Ngày - Tháng</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editForm.schedule.startDay}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            schedule: { ...editForm.schedule, startDay: parseInt(e.target.value) || 1 }
                          })
                        }
                        className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-center"
                        placeholder="Ngày"
                      />
                      <span className="text-slate-400 font-bold">/</span>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={editForm.schedule.startMonth}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            schedule: { ...editForm.schedule, startMonth: parseInt(e.target.value) || 1 }
                          })
                        }
                        className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-center"
                        placeholder="Tháng"
                      />
                    </div>
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Đến Ngày - Tháng</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editForm.schedule.endDay}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            schedule: { ...editForm.schedule, endDay: parseInt(e.target.value) || 1 }
                          })
                        }
                        className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-center"
                        placeholder="Ngày"
                      />
                      <span className="text-slate-400 font-bold">/</span>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={editForm.schedule.endMonth}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            schedule: { ...editForm.schedule, endMonth: parseInt(e.target.value) || 1 }
                          })
                        }
                        className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-center"
                        placeholder="Tháng"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* FORM SECTION 3: COLOR PALETTE (DESIGN TOKENS) */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Palette size={16} className="text-indigo-600" />
                Bộ Màu Chủ Đạo & Giao Diện (Color Tokens)
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Primary Color */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Màu Chủ Đạo</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editForm.colors.primary}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          colors: { ...editForm.colors, primary: e.target.value }
                        })
                      }
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={editForm.colors.primary}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          colors: { ...editForm.colors, primary: e.target.value }
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                {/* Header Bg */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Thanh Header</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editForm.colors.headerBg}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          colors: { ...editForm.colors, headerBg: e.target.value }
                        })
                      }
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={editForm.colors.headerBg}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          colors: { ...editForm.colors, headerBg: e.target.value }
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                {/* Sidebar Bg */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Thanh Sidebar</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editForm.colors.sidebarBg}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          colors: { ...editForm.colors, sidebarBg: e.target.value }
                        })
                      }
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={editForm.colors.sidebarBg}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          colors: { ...editForm.colors, sidebarBg: e.target.value }
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Màu Điểm Nhấn</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editForm.colors.accent}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          colors: { ...editForm.colors, accent: e.target.value }
                        })
                      }
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={editForm.colors.accent}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          colors: { ...editForm.colors, accent: e.target.value }
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* FORM SECTION 4: BRANDING & DECORATION EFFECTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BRANDING */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Thông điệp Truyền thông & Lời chúc</h4>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Huy hiệu Sự kiện (Event Badge)</label>
                  <input
                    type="text"
                    value={editForm.branding.eventBadgeText || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        branding: { ...editForm.branding, eventBadgeText: e.target.value }
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    placeholder="Vd: 🌸 Mừng Xuân Ất Tỵ 2025"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Lời chúc / Khẩu hiệu</label>
                  <input
                    type="text"
                    value={editForm.branding.greetingText || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        branding: { ...editForm.branding, greetingText: e.target.value }
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    placeholder="Vd: Kính chúc Quý vị An Khang Thịnh Vượng!"
                  />
                </div>
              </div>

              {/* DECORATION EFFECT */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-pink-600" /> Hiệu ứng Đồ họa Hoạt họa
                </h4>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Loại Hiệu ứng Canvas</label>
                  <select
                    value={editForm.effect.type}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        effect: { ...editForm.effect, type: e.target.value as EffectType }
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                  >
                    <option value="NONE">Tắt Hiệu ứng (Không hoạt họa)</option>
                    <option value="PEACH_BLOSSOM">🌸 Hoa Đào Rơi (Tết)</option>
                    <option value="APRICOT_BLOSSOM">🌼 Hoa Mai Rơi (Tết)</option>
                    <option value="RED_FLAGS">🇻🇳 Cờ Đỏ Sao Vàng Bay (Quốc Khánh)</option>
                    <option value="SNOW">❄️ Tuyết Rơi (Giáng Sinh)</option>
                    <option value="LANTERNS">🏮 Lồng Đèn Đung Đưa (Trung Thu)</option>
                    <option value="FIREWORKS">🎆 Pháo Hoa / Kim Tuyến</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mật độ Hiệu ứng</label>
                  <select
                    value={editForm.effect.intensity}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        effect: { ...editForm.effect, intensity: e.target.value as EffectIntensity }
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                  >
                    <option value="MINIMAL_OFFICE">Nhẹ nhàng Công sở (Tiết kiệm tài nguyên)</option>
                    <option value="STANDARD">Tiêu chuẩn (Vừa phải)</option>
                    <option value="CELEBRATION">Tối đa Lễ hội (Rực rỡ)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* DATE SIMULATION ENGINE */}
            <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
              <h4 className="font-bold text-xs text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                <Eye size={16} className="text-indigo-600" />
                Bộ Giả Lập & Xem Trước Tự Động theo Ngày tương lai
              </h4>

              <div className="flex flex-col md:flex-row items-center gap-3">
                <input
                  type="date"
                  value={simulationDate}
                  onChange={(e) => setSimulationDate(e.target.value)}
                  className="px-3 py-1.5 border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900 bg-white"
                />

                <button
                  onClick={handleRunSimulation}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Eye size={14} /> <span>Chạy Giả lập & Xem Trước Ngay</span>
                </button>

                {isPreviewingDate && (
                  <button
                    onClick={handleStopPreview}
                    className="px-3 py-1.5 bg-pink-100 text-pink-700 hover:bg-pink-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Dừng Xem Trước
                  </button>
                )}
              </div>

              {simulationResult && (
                <div className="p-3 bg-white border border-indigo-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {simulationResult}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
