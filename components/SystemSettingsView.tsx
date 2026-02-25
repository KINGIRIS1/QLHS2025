
import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, Cloud, Loader2, CheckCircle, Save, Globe, Calendar, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { Holiday } from '../types';
import { fetchHolidays, saveHolidays, testDatabaseConnection, saveUpdateInfo, fetchUpdateInfo } from '../services/api';
import { APP_VERSION } from '../constants';
import { confirmAction } from '../utils/appHelpers';

interface SystemSettingsViewProps {
  onDeleteAllData: () => Promise<boolean>;
  onHolidaysChanged?: () => void;
}

const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ 
  onDeleteAllData,
  onHolidaysChanged
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'holidays' | 'data'>('general');
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
      loadHolidays();
      loadUpdateConfig();
  }, []);

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
      if (success) {
          alert('Đã lưu danh sách ngày lễ thành công!');
          // Trigger refresh data ở App cha
          if (onHolidaysChanged) onHolidaysChanged();
      }
      else alert('Lỗi khi lưu ngày lễ.');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ShieldAlert className="text-red-600" size={20} />
                Cấu hình Hệ thống (Admin)
            </h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4">
            <button 
                onClick={() => setActiveTab('general')}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'general' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <Database size={16} /> Chung
            </button>
            <button 
                onClick={() => setActiveTab('holidays')}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'holidays' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <Calendar size={16} /> Ngày nghỉ lễ
            </button>
            <button 
                onClick={() => setActiveTab('data')}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'data' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <AlertTriangle size={16} /> Dữ liệu
            </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            {activeTab === 'general' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Cloud Database Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div>
                            <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-1"> <Database size={18} /> Cloud Database </h3>
                            <p className="text-sm text-blue-700">Kiểm tra kết nối đến cơ sở dữ liệu Supabase.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {dbTestStatus === 'success' && <div className="text-sm font-bold text-green-700 flex items-center gap-1"><CheckCircle size={16} /> Kết nối OK!</div>}
                            {dbTestStatus === 'error' && <div className="text-sm font-bold text-red-700">{dbTestMsg || 'Lỗi!'}</div>}
                            <button onClick={handleTestDatabase} disabled={dbTestStatus === 'testing'} className="px-4 py-2 bg-white border border-blue-300 text-blue-700 font-medium rounded-md hover:bg-blue-100 transition-colors shadow-sm text-sm flex items-center gap-2"> 
                                {dbTestStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : 'Kiểm tra kết nối'} 
                            </button>
                        </div>
                    </div>

                    {/* Manual Update Config */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
                            <Cloud size={18} /> Cập nhật phiên bản
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Phiên bản Mới nhất</label>
                                <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono" placeholder="VD: 1.6.0" value={manualVersion} onChange={(e) => setManualVersion(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Link tải (Google Drive / Web)</label>
                                <div className="relative">
                                    <Globe size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                    <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 pl-9 text-sm" placeholder="https://..." value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button onClick={handleSaveUpdateConfig} disabled={isSavingUpdate} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 text-sm font-bold shadow-sm">
                                {isSavingUpdate ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Phát hành phiên bản
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'holidays' && (
                <div className="max-w-4xl mx-auto">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-bold text-orange-800 flex items-center gap-2">
                                    <Calendar size={18} /> Cấu hình Ngày nghỉ lễ
                                </h3>
                                <p className="text-xs text-orange-700 mt-1">
                                    Ngày nghỉ lễ sẽ không được tính vào thời gian hẹn trả kết quả.
                                </p>
                            </div>
                            <button 
                                onClick={handleSaveHolidays} 
                                disabled={savingHolidays}
                                className="bg-orange-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-orange-700 flex items-center gap-2 shadow-sm"
                            >
                                {savingHolidays ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu cấu hình
                            </button>
                        </div>

                        {/* Form thêm mới */}
                        <div className="flex flex-wrap gap-3 mb-4 items-end bg-white p-4 rounded border border-orange-100 shadow-sm">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên ngày lễ</label>
                                <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="VD: Giỗ tổ" value={tempName} onChange={e => setTempName(e.target.value)} />
                            </div>
                            <div className="w-20">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày</label>
                                <input type="number" min="1" max="31" className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-center" value={tempDay} onChange={e => setTempDay(parseInt(e.target.value))} />
                            </div>
                            <div className="w-20">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tháng</label>
                                <input type="number" min="1" max="12" className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-center" value={tempMonth} onChange={e => setTempMonth(parseInt(e.target.value))} />
                            </div>
                            <div className="flex items-center pb-3 px-2">
                                <label className="flex items-center cursor-pointer select-none">
                                    <input type="checkbox" className="mr-2 w-4 h-4 text-orange-600 rounded focus:ring-orange-500" checked={tempIsLunar} onChange={e => setTempIsLunar(e.target.checked)} />
                                    <span className="text-sm text-gray-700 font-medium">Âm lịch</span>
                                </label>
                            </div>
                            <button onClick={handleAddHoliday} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 mb-[1px] flex items-center gap-1">
                                <Plus size={16} /> Thêm
                            </button>
                        </div>

                        {/* Danh sách */}
                        <div className="border border-orange-200 rounded bg-white overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-orange-100 text-orange-800 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="p-3">Tên ngày lễ</th>
                                        <th className="p-3 text-center">Ngày/Tháng</th>
                                        <th className="p-3 text-center">Loại lịch</th>
                                        <th className="p-3 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {holidays.map(h => (
                                        <tr key={h.id} className="hover:bg-orange-50 transition-colors">
                                            <td className="p-3 font-medium text-gray-700">{h.name}</td>
                                            <td className="p-3 text-center font-mono text-gray-600">{h.day}/{h.month}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${h.isLunar ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                    {h.isLunar ? 'Âm lịch' : 'Dương lịch'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {holidays.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Chưa có dữ liệu ngày lễ</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'data' && (
                <div className="max-w-4xl mx-auto">
                    <div className="border-2 border-red-100 rounded-xl overflow-hidden">
                        <div className="bg-red-50 p-4 border-b border-red-100">
                            <h3 className="text-red-700 font-bold flex items-center gap-2 uppercase tracking-wide"> <AlertTriangle size={20} /> Vùng nguy hiểm </h3>
                        </div>
                        <div className="p-6 bg-white">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div> 
                                    <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-2"> <Database size={20} className="text-red-500" /> Xóa sạch dữ liệu hệ thống </h4> 
                                    <p className="text-gray-600"> 
                                        Hành động này sẽ xóa vĩnh viễn tất cả <strong>Hồ sơ</strong>, <strong>Hợp đồng</strong>, và <strong>Lịch sử hoạt động</strong> khỏi cơ sở dữ liệu. 
                                        <br/>
                                        <span className="text-red-600 font-medium">Lưu ý: Không thể khôi phục dữ liệu sau khi xóa.</span>
                                    </p> 
                                </div>
                                <button onClick={handleConfirmDeleteData} disabled={isDeletingData} className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md disabled:opacity-50 shrink-0 flex items-center gap-2"> 
                                    {isDeletingData ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                    {isDeletingData ? 'Đang xóa...' : 'Xóa dữ liệu ngay'} 
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default SystemSettingsView;
