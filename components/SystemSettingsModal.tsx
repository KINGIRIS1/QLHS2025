
import React, { useState, useEffect } from 'react';
import { X, Database, AlertTriangle, ShieldAlert, Cloud, Loader2, CheckCircle, Save, Globe, Calendar, Plus, Trash2 } from 'lucide-react';
import { Holiday } from '../types';
import { fetchHolidays, saveHolidays, testDatabaseConnection, saveUpdateInfo, fetchUpdateInfo } from '../services/api';
import { APP_VERSION } from '../constants';
import { confirmAction } from '../utils/appHelpers';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteAllData: () => void;
}

const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  onDeleteAllData 
}) => {
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMsg, setDbTestMsg] = useState('');
  
  // Update State (Manual Config)
  const [manualVersion, setManualVersion] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);

  // Holiday States
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  // Form thêm mới ngày lễ
  const [tempName, setTempName] = useState('');
  const [tempDay, setTempDay] = useState<number>(1);
  const [tempMonth, setTempMonth] = useState<number>(1);
  const [tempIsLunar, setTempIsLunar] = useState(false);
  
  const [savingHolidays, setSavingHolidays] = useState(false);

  useEffect(() => {
      if(isOpen) {
          loadHolidays();
          loadUpdateConfig();
      }
  }, [isOpen]);

  const loadHolidays = async () => {
      const data = await fetchHolidays();
      // Nếu data rỗng, hiển thị list mặc định nhưng chưa lưu
      if (data.length === 0) {
          setHolidays([
              { id: '1', name: 'Tết Dương Lịch', day: 1, month: 1, isLunar: false },
              { id: '2', name: 'Giỗ Tổ Hùng Vương', day: 10, month: 3, isLunar: true },
              { id: '3', name: 'Giải phóng Miền Nam', day: 30, month: 4, isLunar: false },
              { id: '4', name: 'Quốc tế Lao động', day: 1, month: 5, isLunar: false },
              { id: '5', name: 'Quốc Khánh', day: 2, month: 9, isLunar: false },
              { id: '6', name: 'Tết Nguyên Đán (Mùng 1)', day: 1, month: 1, isLunar: true },
              { id: '7', name: 'Tết Nguyên Đán (Mùng 2)', day: 2, month: 1, isLunar: true },
              { id: '8', name: 'Tết Nguyên Đán (Mùng 3)', day: 3, month: 1, isLunar: true },
          ]);
      } else {
          setHolidays(data);
      }
  };

  const loadUpdateConfig = async () => {
      const info = await fetchUpdateInfo();
      if (info.version) setManualVersion(info.version);
      else setManualVersion(APP_VERSION); 
      if (info.url) setManualUrl(info.url);
  };

  if (!isOpen) return null;

  const handleConfirmDeleteData = async () => {
      if (await confirmAction("CẢNH BÁO: Bạn đang xóa TOÀN BỘ dữ liệu trên Cloud.\nHành động này KHÔNG THỂ khôi phục.\nBạn có chắc chắn muốn tiếp tục không?")) {
          if (await confirmAction("XÁC NHẬN LẦN CUỐI: Dữ liệu sẽ bị mất vĩnh viễn. Nhấn OK để Xóa ngay.")) {
              setIsDeletingData(true);
              await onDeleteAllData();
              setIsDeletingData(false);
          }
      }
  };

  const handleTestDatabase = async () => {
      setDbTestStatus('testing');
      setDbTestMsg('Đang kết nối...');
      const result = await testDatabaseConnection();
      setDbTestStatus(result.status === 'SUCCESS' ? 'success' : 'error');
      setDbTestMsg(result.message);
  };

  const handleSaveUpdateConfig = async () => {
      if (!manualVersion.trim()) {
          alert("Vui lòng nhập số phiên bản.");
          return;
      }
      setIsSavingUpdate(true);
      const success = await saveUpdateInfo(manualVersion.trim(), manualUrl.trim());
      setIsSavingUpdate(false);
      if (success) {
          alert(`Đã phát hành phiên bản ${manualVersion}!\nTất cả người dùng sẽ nhận được thông báo cập nhật sau vài giây.`);
      } else {
          alert("Lỗi khi lưu cấu hình cập nhật. Vui lòng thử lại.");
      }
  };

  // --- HOLIDAY HANDLERS ---
  const handleAddHoliday = () => {
      if (!tempName.trim()) { alert("Vui lòng nhập tên ngày lễ"); return; }
      if (tempDay < 1 || tempDay > 31 || tempMonth < 1 || tempMonth > 12) { alert("Ngày tháng không hợp lệ"); return; }

      const newId = Math.random().toString(36).substr(2, 9);
      const newHoliday: Holiday = {
          id: newId,
          name: tempName,
          day: tempDay,
          month: tempMonth,
          isLunar: tempIsLunar
      };

      setHolidays(prev => [...prev, newHoliday]);
      // Reset form
      setTempName('');
      setTempDay(1);
      setTempMonth(1);
      setTempIsLunar(false);
  };

  const handleDeleteHoliday = async (id: string) => {
      if(await confirmAction("Xóa ngày lễ này?")) {
          setHolidays(prev => prev.filter(h => h.id !== id));
      }
  };

  const handleSaveHolidays = async () => {
      setSavingHolidays(true);
      const success = await saveHolidays(holidays);
      setSavingHolidays(false);
      if (success) alert('Đã lưu danh sách ngày lễ thành công!');
      else alert('Lỗi khi lưu ngày lễ.');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl animate-fade-in-up transition-all duration-300 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="text-red-600" />
            Cấu hình Hệ thống (Admin)
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
            
            {/* 1. Cloud Database Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                    <h3 className="font-bold text-blue-800 flex items-center gap-2"> <Database size={18} /> Cloud Database </h3>
                    <p className="text-sm text-blue-700">Kiểm tra kết nối Supabase</p>
                </div>
                <div className="flex items-center gap-3">
                    {dbTestStatus === 'success' && <div className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={14} /> Kết nối OK!</div>}
                    {dbTestStatus === 'error' && <div className="text-xs font-bold text-red-700">{dbTestMsg || 'Lỗi!'}</div>}
                    <button onClick={handleTestDatabase} disabled={dbTestStatus === 'testing'} className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 font-medium rounded-md hover:bg-blue-100 transition-colors shadow-sm text-sm"> {dbTestStatus === 'testing' ? <Loader2 className="animate-spin" size={14} /> : 'Kiểm tra'} </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 2. Manual Update Config */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-3">
                        <Cloud size={18} /> Cập nhật phiên bản
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Phiên bản Mới nhất</label>
                            <input type="text" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono" placeholder="VD: 1.6.0" value={manualVersion} onChange={(e) => setManualVersion(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Link tải (Google Drive / Web)</label>
                            <div className="relative">
                                <Globe size={14} className="absolute left-2 top-2 text-gray-400" />
                                <input type="text" className="w-full border border-gray-300 rounded px-2 py-1.5 pl-7 text-sm" placeholder="https://..." value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} />
                            </div>
                        </div>
                        <button onClick={handleSaveUpdateConfig} disabled={isSavingUpdate} className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 text-xs font-bold shadow-sm">
                            {isSavingUpdate ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Phát hành
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Holiday Config */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-orange-800 flex items-center gap-2">
                        <Calendar size={18} /> Cấu hình Ngày nghỉ lễ
                    </h3>
                    <button 
                        onClick={handleSaveHolidays} 
                        disabled={savingHolidays}
                        className="bg-orange-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-orange-700 flex items-center gap-1 shadow-sm"
                    >
                        {savingHolidays ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu cấu hình
                    </button>
                </div>
                
                <p className="text-xs text-orange-700 mb-3 bg-orange-100/50 p-2 rounded">
                    Ngày nghỉ lễ sẽ không được tính vào thời gian hẹn trả kết quả. Hỗ trợ cả lịch Âm và Dương.
                </p>

                {/* Form thêm mới */}
                <div className="flex flex-wrap gap-2 mb-4 items-end bg-white p-3 rounded border border-orange-100">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tên ngày lễ</label>
                        <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="VD: Giỗ tổ" value={tempName} onChange={e => setTempName(e.target.value)} />
                    </div>
                    <div className="w-16">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ngày</label>
                        <input type="number" min="1" max="31" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center" value={tempDay} onChange={e => setTempDay(parseInt(e.target.value))} />
                    </div>
                    <div className="w-16">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tháng</label>
                        <input type="number" min="1" max="12" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center" value={tempMonth} onChange={e => setTempMonth(parseInt(e.target.value))} />
                    </div>
                    <div className="flex items-center pb-2 px-2">
                        <label className="flex items-center cursor-pointer select-none">
                            <input type="checkbox" className="mr-2" checked={tempIsLunar} onChange={e => setTempIsLunar(e.target.checked)} />
                            <span className="text-sm text-gray-700 font-medium">Âm lịch</span>
                        </label>
                    </div>
                    <button onClick={handleAddHoliday} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700 mb-[1px]">
                        <Plus size={16} /> Thêm
                    </button>
                </div>

                {/* Danh sách */}
                <div className="max-h-40 overflow-y-auto border border-orange-200 rounded bg-white">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-orange-100 text-orange-800 text-xs uppercase font-bold sticky top-0">
                            <tr>
                                <th className="p-2">Tên ngày lễ</th>
                                <th className="p-2 text-center">Ngày/Tháng</th>
                                <th className="p-2 text-center">Loại lịch</th>
                                <th className="p-2 text-center w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {holidays.map(h => (
                                <tr key={h.id} className="hover:bg-orange-50">
                                    <td className="p-2">{h.name}</td>
                                    <td className="p-2 text-center font-mono">{h.day}/{h.month}</td>
                                    <td className="p-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] border ${h.isLunar ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                            {h.isLunar ? 'Âm lịch' : 'Dương lịch'}
                                        </span>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                            {holidays.length === 0 && (
                                <tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">Chưa có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Danger Zone */}
            <div className="border-t-2 border-red-100 pt-4">
                <h3 className="text-red-600 font-bold flex items-center gap-2 mb-4 uppercase tracking-wide"> <AlertTriangle size={20} /> Vùng nguy hiểm </h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div> <h4 className="font-bold text-gray-800 flex items-center gap-2"> <Database size={16} /> Xóa sạch dữ liệu </h4> <p className="text-xs text-gray-600 mt-1"> Xóa vĩnh viễn tất cả Hồ sơ, Hợp đồng và Lịch sử. </p> </div>
                    <button onClick={handleConfirmDeleteData} disabled={isDeletingData} className="px-4 py-2 bg-white border border-red-300 text-red-600 font-bold rounded-md hover:bg-red-600 hover:text-white transition-colors shadow-sm disabled:opacity-50 shrink-0 text-sm"> {isDeletingData ? 'Đang xóa...' : 'Xóa dữ liệu ngay'} </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsModal;
