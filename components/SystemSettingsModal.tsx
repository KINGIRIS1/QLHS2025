
import React, { useState } from 'react';
import { X, Database, AlertTriangle, ShieldAlert, Cloud, Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { testApiConnection } from '../services/geminiService';

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

  if (!isOpen) return null;

  const handleConfirmDeleteData = async () => {
      if (confirm("CẢNH BÁO: Bạn đang thực hiện hành động xóa TOÀN BỘ dữ liệu hồ sơ và lịch sử trích lục trên Cloud.\n\nHành động này KHÔNG THỂ khôi phục.\n\nBạn có chắc chắn muốn tiếp tục không?")) {
          if (confirm("XÁC NHẬN LẦN CUỐI: Dữ liệu sẽ bị mất vĩnh viễn. Nhấn OK để Xóa ngay.")) {
              setIsDeletingData(true);
              await onDeleteAllData();
              setIsDeletingData(false);
          }
      }
  };

  const handleTestAi = async () => {
    setTestStatus('testing');
    const result = await testApiConnection();
    setTestStatus(result ? 'success' : 'error');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl animate-fade-in-up">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="text-red-600" />
            Cấu hình Hệ thống (Admin)
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
            {/* Server Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                    <Cloud size={18} />
                    Trạng thái Database
                </h3>
                <p className="text-sm text-blue-700">
                    Hệ thống đang chạy trên nền tảng: <span className="font-bold">Supabase Cloud (PostgreSQL)</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">Dữ liệu được đồng bộ hóa thời gian thực và an toàn trên đám mây.</p>
            </div>

            {/* AI Settings */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-2">
                    <Sparkles size={18} />
                    Trạng thái Gemini AI
                </h3>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-purple-700">
                            API Key: <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${process.env.API_KEY ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                {process.env.API_KEY ? 'Đã cấu hình (Env)' : 'Chưa tìm thấy'}
                            </span>
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                            Dùng để tạo báo cáo tự động và phân tích dữ liệu.
                        </p>
                    </div>
                    <button 
                        onClick={handleTestAi}
                        disabled={testStatus === 'testing'}
                        className="px-4 py-2 bg-white border border-purple-300 text-purple-700 font-medium rounded-md hover:bg-purple-100 transition-colors shadow-sm flex items-center gap-2 text-sm"
                    >
                        {testStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        {testStatus === 'testing' ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                    </button>
                </div>
                {testStatus === 'success' && (
                    <div className="mt-3 text-xs font-bold text-green-700 flex items-center gap-1 animate-fade-in">
                        <CheckCircle size={14} /> Kết nối thành công! AI đang hoạt động bình thường.
                    </div>
                )}
                {testStatus === 'error' && (
                    <div className="mt-3 text-xs font-bold text-red-700 flex items-center gap-1 animate-fade-in">
                        <AlertCircle size={14} /> Kết nối thất bại. Vui lòng kiểm tra API Key trong biến môi trường.
                    </div>
                )}
            </div>

            {/* DANGER ZONE */}
            <div className="border-t-2 border-red-100 pt-4">
                <h3 className="text-red-600 font-bold flex items-center gap-2 mb-4 uppercase tracking-wide">
                    <AlertTriangle size={20} /> Vùng nguy hiểm
                </h3>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            <Database size={16} /> Reset dữ liệu Cloud
                        </h4>
                        <p className="text-sm text-gray-600 mt-2 max-w-md">
                            Hành động này sẽ xóa vĩnh viễn tất cả <b>Hồ sơ</b> và <b>Lịch sử cấp trích lục</b> trên Database Supabase. 
                        </p>
                    </div>
                    <button 
                        onClick={handleConfirmDeleteData}
                        disabled={isDeletingData}
                        className="px-4 py-2 bg-white border border-red-300 text-red-600 font-bold rounded-md hover:bg-red-600 hover:text-white transition-colors shadow-sm disabled:opacity-50 shrink-0"
                    >
                        {isDeletingData ? 'Đang xóa...' : 'Xóa dữ liệu ngay'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsModal;
