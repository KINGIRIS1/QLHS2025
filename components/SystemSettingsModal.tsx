import React, { useState, useEffect } from 'react';
import { X, Database, AlertTriangle, ShieldAlert, Cloud, Sparkles, Loader2, CheckCircle, AlertCircle, Terminal, Copy, Calendar, Plus, Trash2, Save, Key, Eye, EyeOff, GitBranch, Link, Activity, RefreshCw, DownloadCloud, Power } from 'lucide-react';
import { testApiConnection, LS_API_KEY } from '../services/geminiService';
import { Holiday } from '../types';
import { fetchHolidays, saveHolidays, testDatabaseConnection } from '../services/api';
import { APP_VERSION, API_BASE_URL } from '../constants';

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
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMsg, setDbTestMsg] = useState('');
  
  const [showSql, setShowSql] = useState(false);
  
  // Gemini Key State
  const [customApiKey, setCustomApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  
  // Update State
  const [updateStatus, setUpdateStatus] = useState<{
      state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
      progress?: number;
      version?: string;
      message?: string;
  }>({ state: 'idle' });

  // Holiday States
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState<Partial<Holiday>>({ name: '', day: 1, month: 1, isLunar: false });
  const [savingHolidays, setSavingHolidays] = useState(false);

  // Helper an toàn để lấy API Key mặc định (env)
  const envApiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : '';

  useEffect(() => {
      if(isOpen) {
          loadHolidays();
          const storedKey = localStorage.getItem(LS_API_KEY);
          if (storedKey) setCustomApiKey(storedKey);
          else setCustomApiKey('');
      }
  }, [isOpen]);

  // Listener cho sự kiện update từ Electron
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onUpdateStatus) {
          window.electronAPI.onUpdateStatus((data: any) => {
              if (data.status === 'available') {
                  setUpdateStatus({ state: 'available', version: data.info.version });
              } else if (data.status === 'not-available') {
                  setUpdateStatus({ state: 'not-available' });
              } else if (data.status === 'downloading') {
                  setUpdateStatus({ state: 'downloading', progress: Math.round(data.progress || 0) });
              } else if (data.status === 'downloaded') {
                  setUpdateStatus({ state: 'downloaded', version: data.info.version });
              } else if (data.status === 'error') {
                  setUpdateStatus({ state: 'error', message: data.message });
              }
          });
      }
      return () => {
          if (window.electronAPI && window.electronAPI.removeUpdateListener) {
              window.electronAPI.removeUpdateListener();
          }
      }
  }, []);

  const loadHolidays = async () => {
      const data = await fetchHolidays();
      if (data.length === 0) {
          setHolidays([
              { id: '1', name: 'Tết Dương Lịch', day: 1, month: 1, isLunar: false },
              { id: '2', name: 'Giỗ Tổ Hùng Vương', day: 10, month: 3, isLunar: true },
              { id: '3', name: 'Giải phóng Miền Nam', day: 30, month: 4, isLunar: false },
              { id: '4', name: 'Quốc tế Lao động', day: 1, month: 5, isLunar: false },
              { id: '5', name: 'Quốc Khánh', day: 2, month: 9, isLunar: false },
              { id: '6', name: 'Tết Nguyên Đán (Mùng 1)', day: 1, month: 1, isLunar: true },
          ]);
      } else {
          setHolidays(data);
      }
  };

  if (!isOpen) return null;

  const handleConfirmDeleteData = async () => {
      if (confirm("CẢNH BÁO: Bạn đang xóa TOÀN BỘ dữ liệu trên Cloud.\nHành động này KHÔNG THỂ khôi phục.\nBạn có chắc chắn muốn tiếp tục không?")) {
          if (confirm("XÁC NHẬN LẦN CUỐI: Dữ liệu sẽ bị mất vĩnh viễn. Nhấn OK để Xóa ngay.")) {
              setIsDeletingData(true);
              await onDeleteAllData();
              setIsDeletingData(false);
          }
      }
  };

  const handleSaveApiKey = () => {
      if (customApiKey.trim()) {
          localStorage.setItem(LS_API_KEY, customApiKey.trim());
          alert('Đã lưu API Key thành công!');
      } else {
          localStorage.removeItem(LS_API_KEY);
          alert('Đã xóa API Key tùy chỉnh.');
      }
      setTestStatus('idle'); 
  };

  const handleTestAi = async () => {
    setTestStatus('testing');
    const result = await testApiConnection();
    setTestStatus(result ? 'success' : 'error');
  };

  const handleTestDatabase = async () => {
      setDbTestStatus('testing');
      setDbTestMsg('Đang kết nối...');
      const result = await testDatabaseConnection();
      setDbTestStatus(result.status === 'SUCCESS' ? 'success' : 'error');
      setDbTestMsg(result.message);
  };

  // --- AUTO UPDATE HANDLERS ---
  const handleCheckUpdate = async () => {
      if (!window.electronAPI || !window.electronAPI.checkForUpdate) {
          alert("Chức năng này chỉ khả dụng trên App Desktop.");
          return;
      }
      setUpdateStatus({ state: 'checking' });
      // Lấy Base URL từ API_BASE_URL (ví dụ: http://192.168.1.5:3000)
      // Loại bỏ phần /custom/... nếu có
      let serverUrl = API_BASE_URL;
      if (serverUrl.endsWith('/')) serverUrl = serverUrl.slice(0, -1);
      
      const result = await window.electronAPI.checkForUpdate(serverUrl);
      if (result.status === 'error') {
          setUpdateStatus({ state: 'error', message: result.message });
      } else if (result.status === 'not-available') {
          setUpdateStatus({ state: 'not-available' });
      }
      // Nếu available, event listener sẽ bắt
  };

  const handleDownloadUpdate = async () => {
      if (window.electronAPI && window.electronAPI.downloadUpdate) {
          window.electronAPI.downloadUpdate();
      }
  };

  const handleInstallUpdate = async () => {
      if (window.electronAPI && window.electronAPI.quitAndInstall) {
          window.electronAPI.quitAndInstall();
      }
  };

  const handleAddHoliday = () => {
      if (!newHoliday.name) { alert('Vui lòng nhập tên ngày lễ'); return; }
      const newItem: Holiday = {
          id: Math.random().toString(36).substr(2, 9),
          name: newHoliday.name,
          day: Number(newHoliday.day),
          month: Number(newHoliday.month),
          isLunar: !!newHoliday.isLunar
      };
      setHolidays([...holidays, newItem]);
      setNewHoliday({ name: '', day: 1, month: 1, isLunar: false });
  };

  const handleRemoveHoliday = (id: string) => {
      setHolidays(holidays.filter(h => h.id !== id));
  };

  const handleSaveHolidays = async () => {
      setSavingHolidays(true);
      await saveHolidays(holidays);
      setSavingHolidays(false);
      alert('Đã lưu cấu hình ngày nghỉ!');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${showSql ? 'max-w-4xl' : 'max-w-2xl'} animate-fade-in-up transition-all duration-300`}>
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="text-red-600" />
            Cấu hình Hệ thống (Admin)
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            
            {/* Auto Update Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3">
                    <GitBranch size={18} /> Cập nhật phần mềm (Auto Update)
                </h3>
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center bg-white p-3 rounded border border-blue-100">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">Phiên bản hiện tại: <span className="text-blue-600">{APP_VERSION}</span></p>
                            <p className="text-xs text-gray-500 mt-1">Kết nối tới máy chủ: {API_BASE_URL}</p>
                        </div>
                        <div>
                            {updateStatus.state === 'idle' && (
                                <button onClick={handleCheckUpdate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-bold shadow-sm">
                                    <RefreshCw size={16} /> Kiểm tra bản mới
                                </button>
                            )}
                            {updateStatus.state === 'checking' && (
                                <button disabled className="flex items-center gap-2 bg-gray-300 text-gray-600 px-4 py-2 rounded-md text-sm font-bold">
                                    <Loader2 size={16} className="animate-spin" /> Đang kiểm tra...
                                </button>
                            )}
                            {updateStatus.state === 'available' && (
                                <button onClick={handleDownloadUpdate} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-bold shadow-sm animate-pulse">
                                    <DownloadCloud size={16} /> Tải bản mới ({updateStatus.version})
                                </button>
                            )}
                            {updateStatus.state === 'downloading' && (
                                <div className="text-right">
                                    <p className="text-sm font-bold text-blue-600 mb-1">Đang tải: {updateStatus.progress}%</p>
                                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${updateStatus.progress}%` }}></div>
                                    </div>
                                </div>
                            )}
                            {updateStatus.state === 'downloaded' && (
                                <button onClick={handleInstallUpdate} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm font-bold shadow-sm">
                                    <Power size={16} /> Khởi động lại để cập nhật
                                </button>
                            )}
                            {updateStatus.state === 'not-available' && (
                                <span className="text-green-600 text-sm font-bold flex items-center gap-1"><CheckCircle size={16} /> Bạn đang dùng bản mới nhất</span>
                            )}
                        </div>
                    </div>
                    {updateStatus.state === 'error' && (
                        <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-center gap-1">
                            <AlertCircle size={14} /> Lỗi: {updateStatus.message}
                        </p>
                    )}
                    <p className="text-xs text-blue-600 italic">
                        * Hệ thống sử dụng công nghệ <strong>Differential Update</strong>: Chỉ tải về phần thay đổi giúp cập nhật nhanh chóng (yêu cầu cấu hình Server đúng).
                    </p>
                </div>
            </div>

            {/* Supabase Database Setup */}
            {/* ... Giữ nguyên phần Database SQL cũ ... */}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Settings */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    {/* ... Giữ nguyên phần AI Settings ... */}
                    <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-2"> <Sparkles size={18} /> Gemini AI </h3>
                    <div className="space-y-3">
                        <div className="flex flex-col gap-2">
                            <div className="relative">
                                <Key size={14} className="absolute left-2.5 top-2.5 text-purple-400" />
                                <input type={showKey ? "text" : "password"} placeholder="Nhập API Key..." className="w-full border border-purple-300 rounded-md py-2 pl-8 pr-8 text-sm outline-none focus:ring-1 focus:ring-purple-500" value={customApiKey} onChange={(e) => setCustomApiKey(e.target.value)} />
                                <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-2 text-gray-400 hover:text-purple-600"> {showKey ? <EyeOff size={14} /> : <Eye size={14} />} </button>
                            </div>
                            <button onClick={handleSaveApiKey} className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-purple-700 w-fit ml-auto"> Lưu Key </button>
                        </div>
                        <button onClick={handleTestAi} disabled={testStatus === 'testing'} className="w-full px-3 py-2 bg-white border border-purple-300 text-purple-700 font-medium rounded-md hover:bg-purple-100 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"> {testStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : 'Kiểm tra kết nối AI'} </button>
                        {testStatus === 'success' && <div className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={14}/> Kết nối OK!</div>}
                    </div>
                </div>

                {/* Cloud Database Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2"> <Cloud size={18} /> Cloud Database </h3>
                    <p className="text-sm text-blue-700 mb-3">Kiểm tra kết nối Supabase</p>
                    <button onClick={handleTestDatabase} disabled={dbTestStatus === 'testing'} className="w-full px-3 py-2 bg-white border border-blue-300 text-blue-700 font-medium rounded-md hover:bg-blue-100 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"> {dbTestStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : <Activity size={16} />} Kiểm tra </button>
                    {dbTestStatus === 'success' && <div className="mt-2 text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={14} /> Kết nối thành công!</div>}
                    {dbTestStatus === 'error' && <div className="mt-2 text-xs font-bold text-red-700 flex flex-col gap-1"><span>Lỗi kết nối!</span><span className="font-normal opacity-80">{dbTestMsg}</span></div>}
                </div>
            </div>

            {/* DANGER ZONE */}
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