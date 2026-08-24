import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Edit2, UserCheck, Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { 
  ContractSignerSettings, 
  WardSignerConfig, 
  DEFAULT_CONTRACT_SIGNER_SETTINGS, 
  fetchContractSignerSettings, 
  saveContractSignerSettings 
} from '../services/apiSystem';
import { confirmAction, showToast } from '../utils/appHelpers';

interface ContractSignerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  wards?: string[];
  onUpdate?: () => void;
}

const ContractSignerConfigModal: React.FC<ContractSignerConfigModalProps> = ({
  isOpen,
  onClose,
  wards = ['Phường Minh Hưng', 'Xã Nha Bích', 'Phường Chơn Thành', 'Phường Hưng Long', 'Phường Thành Tâm'],
  onUpdate
}) => {
  const [settings, setSettings] = useState<ContractSignerSettings>(DEFAULT_CONTRACT_SIGNER_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form thêm / sửa người ký theo xã phường
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempWardName, setTempWardName] = useState('');
  const [tempSignerName, setTempSignerName] = useState('');
  const [tempSignerPosition, setTempSignerPosition] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchContractSignerSettings();
      setSettings(data);
    } catch (e) {
      console.error("Lỗi khi tải cấu hình người ký:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleAddOrUpdateWardSigner = () => {
    const ward = tempWardName.trim();
    const name = tempSignerName.trim();
    const pos = tempSignerPosition.trim();

    if (!ward) {
      showToast("Vui lòng nhập tên hoặc chọn Xã/Phường!", "error");
      return;
    }
    if (!name) {
      showToast("Vui lòng nhập Tên người ký bên B!", "error");
      return;
    }
    if (!pos) {
      showToast("Vui lòng nhập Chức vụ người ký!", "error");
      return;
    }

    if (editingId) {
      // Cập nhật dòng hiện tại
      setSettings(prev => ({
        ...prev,
        wardSigners: prev.wardSigners.map(item => 
          item.id === editingId ? { ...item, wardName: ward, signerName: name, signerPosition: pos } : item
        )
      }));
      showToast(`Đã cập nhật người ký cho ${ward}`, "success");
    } else {
      // Thêm dòng mới
      const newId = Math.random().toString(36).substring(2, 9);
      const newItem: WardSignerConfig = {
        id: newId,
        wardName: ward,
        signerName: name,
        signerPosition: pos
      };
      setSettings(prev => ({
        ...prev,
        wardSigners: [...prev.wardSigners, newItem]
      }));
      showToast(`Đã thêm thiết lập người ký cho ${ward}`, "success");
    }

    // Reset form
    setEditingId(null);
    setTempWardName('');
    setTempSignerName('');
    setTempSignerPosition('');
  };

  const handleEditWardSigner = (item: WardSignerConfig) => {
    setEditingId(item.id);
    setTempWardName(item.wardName);
    setTempSignerName(item.signerName);
    setTempSignerPosition(item.signerPosition);
  };

  const handleDeleteWardSigner = async (id: string, wardName: string) => {
    if (await confirmAction(`Bạn có chắc muốn xóa thiết lập người ký cho "${wardName}"?`)) {
      setSettings(prev => ({
        ...prev,
        wardSigners: prev.wardSigners.filter(item => item.id !== id)
      }));
      if (editingId === id) {
        setEditingId(null);
        setTempWardName('');
        setTempSignerName('');
        setTempSignerPosition('');
      }
      showToast(`Đã xóa thiết lập người ký của ${wardName}`, "success");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTempWardName('');
    setTempSignerName('');
    setTempSignerPosition('');
  };

  const handleSaveAll = async () => {
    if (!settings.defaultSignerName.trim()) {
      showToast("Vui lòng điền Tên người ký mặc định!", "error");
      return;
    }
    if (!settings.defaultSignerPosition.trim()) {
      showToast("Vui lòng điền Chức vụ người ký mặc định!", "error");
      return;
    }

    setSaving(true);
    try {
      const success = await saveContractSignerSettings(settings);
      if (success) {
        showToast("Lưu cấu hình người ký hợp đồng thành công lên Supabase!", "success");
        if (onUpdate) onUpdate();
        onClose();
      } else {
        showToast("Lỗi khi lưu cấu hình người ký hợp đồng.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Có lỗi xảy ra khi lưu cấu hình.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <UserCheck size={22} className="text-purple-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight">Cấu Hình Người Ký Hợp Đồng Bên B</h3>
              <p className="text-xs text-purple-200 font-medium">
                Thiết lập Tên và Chức vụ người ký bên B theo từng Xã/Phường (Đồng bộ Supabase)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-purple-200 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {loading ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-purple-600" size={28} />
              <span className="text-sm font-semibold">Đang tải cấu hình từ Supabase...</span>
            </div>
          ) : (
            <>
              {/* SECTION 1: CẤU HÌNH MẶC ĐỊNH */}
              <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-purple-50 pb-3">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    1. Người ký Mặc định (Áp dụng chung khi xã/phường chưa có cấu hình riêng)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Tên người ký Mặc định <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                      placeholder="VD: PHẠM VĂN NAM"
                      value={settings.defaultSignerName}
                      onChange={e => setSettings({ ...settings, defaultSignerName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Chức vụ Mặc định <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                      placeholder="VD: PHÓ GIÁM ĐỐC"
                      value={settings.defaultSignerPosition}
                      onChange={e => setSettings({ ...settings, defaultSignerPosition: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CẤU HÌNH THEO XÃ/PHƯỜNG */}
              <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-purple-50 pb-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    2. Thiết lập Người ký riêng theo Xã/Phường
                  </h4>
                </div>

                {/* Form thêm/sửa */}
                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100/80 space-y-3">
                  <p className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    {editingId ? <Edit2 size={14} className="text-purple-600" /> : <Plus size={14} className="text-purple-600" />}
                    {editingId ? 'Chỉnh sửa người ký Xã/Phường' : 'Thêm cấu hình Người ký theo Xã/Phường mới'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Xã / Phường</label>
                      <div className="relative">
                        <input 
                          type="text"
                          list="ward-options"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                          placeholder="Chọn hoặc nhập tên Xã/Phường..."
                          value={tempWardName}
                          onChange={e => setTempWardName(e.target.value)}
                        />
                        <datalist id="ward-options">
                          {wards.map(w => (
                            <option key={w} value={w} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Họ và Tên người ký</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                        placeholder="VD: TRỊNH QUANG HƯNG"
                        value={tempSignerName}
                        onChange={e => setTempSignerName(e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chức vụ</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                        placeholder="VD: PHÓ GIÁM ĐỐC"
                        value={tempSignerPosition}
                        onChange={e => setTempSignerPosition(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    {editingId && (
                      <button 
                        type="button" 
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Hủy
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={handleAddOrUpdateWardSigner}
                      className="px-4 py-1.5 bg-purple-700 text-white text-xs font-bold rounded-lg hover:bg-purple-800 transition-colors shadow-sm flex items-center gap-1"
                    >
                      {editingId ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                      {editingId ? 'Cập nhật dòng này' : 'Thêm vào danh sách'}
                    </button>
                  </div>
                </div>

                {/* List/Table */}
                <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-gray-100">
                      <tr>
                        <th className="p-3">Xã / Phường</th>
                        <th className="p-3">Họ và Tên Người Ký</th>
                        <th className="p-3">Chức vụ</th>
                        <th className="p-3 text-right w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {settings.wardSigners && settings.wardSigners.length > 0 ? (
                        settings.wardSigners.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-purple-50/30 transition-colors ${editingId === item.id ? 'bg-purple-50/80 font-bold' : ''}`}
                          >
                            <td className="p-3 font-bold text-purple-900 flex items-center gap-1.5">
                              <Building2 size={14} className="text-purple-500 shrink-0" />
                              {item.wardName}
                            </td>
                            <td className="p-3 font-black text-slate-800">{item.signerName}</td>
                            <td className="p-3 font-semibold text-slate-600">{item.signerPosition}</td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button 
                                  onClick={() => handleEditWardSigner(item)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Chỉnh sửa"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteWardSigner(item.id, item.wardName)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Xóa"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                            Chưa có thiết lập riêng cho xã/phường nào. Tất cả sẽ dùng người ký mặc định.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Dữ liệu được áp dụng tự động cho toàn hệ thống
          </span>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 bg-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-300 transition-colors"
            >
              Đóng
            </button>
            <button 
              type="button" 
              onClick={handleSaveAll} 
              disabled={saving || loading}
              className="px-6 py-2.5 bg-purple-700 text-white font-bold text-xs rounded-xl hover:bg-purple-800 transition-colors shadow-lg shadow-purple-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Đang lưu lên Supabase...' : 'Lưu Cấu Hình Người Ký'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ContractSignerConfigModal;
