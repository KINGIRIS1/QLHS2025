
import React, { useState, useEffect } from 'react';
import { X, Database, AlertTriangle, ShieldAlert, Cloud, Sparkles, Loader2, CheckCircle, AlertCircle, Terminal, Copy, Calendar, Plus, Trash2, Save, Key, Eye, EyeOff } from 'lucide-react';
import { testApiConnection, LS_API_KEY } from '../services/geminiService';
import { Holiday } from '../types';
import { fetchHolidays, saveHolidays } from '../services/api';

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
  const [showSql, setShowSql] = useState(false);
  
  // Gemini Key State
  const [customApiKey, setCustomApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  
  // Holiday States
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState<Partial<Holiday>>({ name: '', day: 1, month: 1, isLunar: false });
  const [savingHolidays, setSavingHolidays] = useState(false);

  // Helper an toàn để lấy API Key mặc định (env)
  const envApiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : '';

  useEffect(() => {
      if(isOpen) {
          loadHolidays();
          // Load API Key từ LocalStorage
          const storedKey = localStorage.getItem(LS_API_KEY);
          if (storedKey) setCustomApiKey(storedKey);
          else setCustomApiKey('');
      }
  }, [isOpen]);

  const loadHolidays = async () => {
      const data = await fetchHolidays();
      // Nếu chưa có dữ liệu, thêm mặc định
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

  const handleSaveApiKey = () => {
      if (customApiKey.trim()) {
          localStorage.setItem(LS_API_KEY, customApiKey.trim());
          alert('Đã lưu API Key thành công!');
      } else {
          localStorage.removeItem(LS_API_KEY);
          alert('Đã xóa API Key tùy chỉnh. Hệ thống sẽ dùng Key mặc định (nếu có).');
      }
      setTestStatus('idle'); // Reset trạng thái test
  };

  const handleTestAi = async () => {
    setTestStatus('testing');
    const result = await testApiConnection();
    setTestStatus(result ? 'success' : 'error');
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

  // SQL Script để tạo bảng
  const sqlScript = `
-- 1. Bảng Records (Hồ sơ)
CREATE TABLE IF NOT EXISTS public.records (
    id text PRIMARY KEY,
    code text,
    "customerName" text,
    "phoneNumber" text,
    cccd text,
    ward text,
    "landPlot" text,
    "mapSheet" text,
    area numeric,
    address text,
    "group" text,
    content text,
    "recordType" text,
    "receivedDate" date,
    deadline date,
    "assignedDate" date,
    "completedDate" date,
    status text,
    "assignedTo" text,
    notes text,
    "privateNotes" text,
    "authorizedBy" text,
    "authDocType" text,
    "otherDocs" text,
    "exportBatch" integer,
    "exportDate" text,
    "measurementNumber" text,
    "excerptNumber" text
);

-- 2. Bảng Employees (Nhân viên)
CREATE TABLE IF NOT EXISTS public.employees (
    id text PRIMARY KEY,
    name text,
    department text,
    "managedWards" text[] -- Mảng text
);

-- 3. Bảng Users (Tài khoản)
CREATE TABLE IF NOT EXISTS public.users (
    username text PRIMARY KEY,
    password text,
    name text,
    role text,
    "employeeId" text
);

-- 4. Bảng Contracts (Hợp đồng)
CREATE TABLE IF NOT EXISTS public.contracts (
    id text PRIMARY KEY,
    code text,
    "customerName" text,
    "phoneNumber" text,
    ward text,
    address text,
    "landPlot" text,
    "mapSheet" text,
    area numeric,
    
    "contractType" text,  -- Loại tab: Đo đạc/Tách thửa/Cắm mốc
    "serviceType" text,   -- Tên dịch vụ
    "areaType" text,      -- Khu vực
    
    "plotCount" integer,  -- Số thửa
    "markerCount" integer,-- Số mốc
    "splitItems" jsonb,   -- Danh sách tách thửa (JSON)

    quantity integer,
    "unitPrice" numeric,
    "vatRate" numeric,
    "vatAmount" numeric,
    "totalAmount" numeric,
    deposit numeric,
    content text,
    "createdDate" date,
    status text
);

-- 5. Bảng Price List (Bảng giá)
CREATE TABLE IF NOT EXISTS public.price_list (
    id text PRIMARY KEY,
    service_group text,
    area_type text,
    service_name text,
    min_area numeric,
    max_area numeric,
    unit text,
    price numeric,
    vat_rate numeric,
    vat_is_percent boolean DEFAULT true
);

-- 6. Bảng Excerpt History (Lịch sử cấp trích lục)
CREATE TABLE IF NOT EXISTS public.excerpt_history (
    id text PRIMARY KEY,
    ward text,
    "mapSheet" text,
    "landPlot" text,
    "excerptNumber" integer,
    "createdAt" text,
    "createdBy" text,
    "linkedRecordCode" text
);

-- 7. Bảng Excerpt Counters (Bộ đếm số trích lục)
CREATE TABLE IF NOT EXISTS public.excerpt_counters (
    ward text PRIMARY KEY,
    count integer
);

-- 8. Bảng Chat Groups (Nhóm chat tùy chỉnh)
CREATE TABLE IF NOT EXISTS public.chat_groups (
    id text PRIMARY KEY,
    name text,
    type text DEFAULT 'CUSTOM', 
    created_by text,
    created_at timestamptz DEFAULT now(),
    members text[] DEFAULT NULL
);

-- 9. Bảng Messages (Chat nội bộ)
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id text DEFAULT 'GENERAL',
    sender_username text,
    sender_name text,
    content text,
    file_url text,
    file_name text,
    file_type text,
    created_at timestamptz DEFAULT now()
);

-- 10. Bảng Holidays (Ngày nghỉ lễ)
CREATE TABLE IF NOT EXISTS public.holidays (
    id text PRIMARY KEY,
    name text,
    day integer,
    month integer,
    is_lunar boolean DEFAULT false
);

-- Cập nhật tin nhắn cũ nếu chưa có group_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='group_id') THEN
        ALTER TABLE public.messages ADD COLUMN group_id text DEFAULT 'GENERAL';
    END IF;
END $$;
UPDATE public.messages SET group_id = 'GENERAL' WHERE group_id IS NULL;

-- Cập nhật bảng chat_groups nếu chưa có cột members
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_groups' AND column_name='members') THEN
        ALTER TABLE public.chat_groups ADD COLUMN members text[] DEFAULT NULL;
    END IF;
END $$;

-- 11. CẤU HÌNH STORAGE (Sửa lỗi RLS Policy)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access Select" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Insert" ON storage.objects;

CREATE POLICY "Public Access Select"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chat-files' );

CREATE POLICY "Public Access Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'chat-files' );

-- Kích hoạt Realtime cho các bảng (QUAN TRỌNG)
ALTER PUBLICATION supabase_realtime ADD TABLE records, employees, users, contracts, price_list, excerpt_history, excerpt_counters, messages, chat_groups, holidays;
  `;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    alert("Đã sao chép mã SQL! Hãy dán vào 'SQL Editor' trên Supabase Dashboard và nhấn Run.");
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
            
            {/* Supabase Database Setup Section */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-green-800 flex items-center gap-2 mb-2">
                            <Database size={18} />
                            Khởi tạo Database (Supabase)
                        </h3>
                        <p className="text-sm text-green-700 max-w-lg">
                            Nếu bạn gặp lỗi khi lưu hồ sơ hoặc lỗi bảng biểu.
                            Hãy chạy mã SQL dưới đây trong <strong>SQL Editor</strong> của Supabase.
                        </p>
                    </div>
                    <button 
                        onClick={() => setShowSql(!showSql)}
                        className="px-4 py-2 bg-white border border-green-300 text-green-700 font-bold rounded-md hover:bg-green-100 transition-colors shadow-sm flex items-center gap-2 text-sm"
                    >
                        <Terminal size={16} />
                        {showSql ? 'Ẩn mã SQL' : 'Xem mã SQL tạo bảng'}
                    </button>
                </div>

                {showSql && (
                    <div className="mt-4 animate-fade-in">
                        <div className="bg-gray-800 rounded-lg p-4 overflow-hidden relative group">
                            <button 
                                onClick={copySqlToClipboard}
                                className="absolute top-2 right-2 bg-gray-700 text-gray-200 p-2 rounded hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="Sao chép SQL"
                            >
                                <Copy size={16} />
                            </button>
                            <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                                {sqlScript}
                            </pre>
                        </div>
                        <p className="text-xs text-green-600 mt-2 italic flex items-center gap-1">
                            <AlertCircle size={12} /> Hướng dẫn: Copy mã trên &rarr; Vào Supabase &rarr; SQL Editor &rarr; New Query &rarr; Paste &rarr; Run.
                        </p>
                    </div>
                )}
            </div>

            {/* Holiday Settings */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                <h3 className="font-bold text-orange-800 flex items-center gap-2 mb-3">
                    <Calendar size={18} /> Cấu hình Ngày nghỉ lễ
                </h3>
                <p className="text-xs text-orange-700 mb-3">
                    Các ngày này sẽ được trừ ra khi tính thời hạn hồ sơ. Ngày âm lịch sẽ tự động chuyển đổi sang dương lịch theo từng năm.
                </p>
                
                <div className="flex gap-2 mb-3 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tên ngày lễ</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            placeholder="Ví dụ: Tết Nguyên Đán"
                            value={newHoliday.name}
                            onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
                        />
                    </div>
                    <div className="w-16">
                        <label className="block text-xs font-bold text-gray-600 mb-1">Ngày</label>
                        <input 
                            type="number" min="1" max="31"
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-center"
                            value={newHoliday.day}
                            onChange={e => setNewHoliday({...newHoliday, day: parseInt(e.target.value)})}
                        />
                    </div>
                    <div className="w-16">
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tháng</label>
                        <input 
                            type="number" min="1" max="12"
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-center"
                            value={newHoliday.month}
                            onChange={e => setNewHoliday({...newHoliday, month: parseInt(e.target.value)})}
                        />
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                        <input 
                            type="checkbox" 
                            id="isLunar"
                            checked={newHoliday.isLunar}
                            onChange={e => setNewHoliday({...newHoliday, isLunar: e.target.checked})}
                            className="w-4 h-4 text-orange-600"
                        />
                        <label htmlFor="isLunar" className="text-sm text-gray-700">Âm lịch</label>
                    </div>
                    <button 
                        onClick={handleAddHoliday}
                        className="bg-orange-600 text-white p-2 rounded hover:bg-orange-700"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div className="bg-white border border-gray-200 rounded max-h-40 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
                            <tr>
                                <th className="p-2">Tên ngày lễ</th>
                                <th className="p-2 text-center">Ngày/Tháng</th>
                                <th className="p-2 text-center">Loại lịch</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {holidays.map(h => (
                                <tr key={h.id} className="border-t border-gray-100">
                                    <td className="p-2">{h.name}</td>
                                    <td className="p-2 text-center font-mono">{h.day}/{h.month}</td>
                                    <td className="p-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs ${h.isLunar ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {h.isLunar ? 'Âm lịch' : 'Dương lịch'}
                                        </span>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => handleRemoveHoliday(h.id)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 flex justify-end">
                    <button 
                        onClick={handleSaveHolidays}
                        disabled={savingHolidays}
                        className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded shadow-sm hover:bg-orange-700 disabled:opacity-50 text-sm font-bold"
                    >
                        {savingHolidays ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Lưu ngày nghỉ
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Settings */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-2">
                        <Sparkles size={18} />
                        Gemini AI
                    </h3>
                    <div className="space-y-3">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-purple-700">API Key (Google Gemini)</label>
                            <div className="relative">
                                <Key size={14} className="absolute left-2.5 top-2.5 text-purple-400" />
                                <input 
                                    type={showKey ? "text" : "password"}
                                    placeholder="Nhập API Key của bạn..."
                                    className="w-full border border-purple-300 rounded-md py-2 pl-8 pr-8 text-sm outline-none focus:ring-1 focus:ring-purple-500"
                                    value={customApiKey}
                                    onChange={(e) => setCustomApiKey(e.target.value)}
                                />
                                <button 
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-2 top-2 text-gray-400 hover:text-purple-600"
                                >
                                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            <button 
                                onClick={handleSaveApiKey}
                                className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-purple-700 w-fit ml-auto"
                            >
                                Lưu Key
                            </button>
                        </div>

                        <div className="text-xs text-purple-600 italic border-t border-purple-200 pt-2">
                            {customApiKey ? (
                                <span className="flex items-center gap-1 text-green-700 font-bold"><CheckCircle size={12}/> Đang sử dụng Key tùy chỉnh.</span>
                            ) : (
                                <span>{envApiKey ? "Đang sử dụng Key mặc định của hệ thống." : "Chưa có Key nào được cấu hình."}</span>
                            )}
                        </div>

                        <button 
                            onClick={handleTestAi}
                            disabled={testStatus === 'testing'}
                            className="w-full px-3 py-2 bg-white border border-purple-300 text-purple-700 font-medium rounded-md hover:bg-purple-100 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
                        >
                            {testStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                            {testStatus === 'testing' ? 'Đang test...' : 'Kiểm tra kết nối'}
                        </button>
                    </div>
                    {testStatus === 'success' && (
                        <div className="mt-2 text-xs font-bold text-green-700 flex items-center gap-1 animate-fade-in">
                            <CheckCircle size={14} /> Kết nối OK!
                        </div>
                    )}
                    {testStatus === 'error' && (
                        <div className="mt-2 text-xs font-bold text-red-700 flex items-center gap-1 animate-fade-in">
                            <AlertCircle size={14} /> Lỗi kết nối AI. Vui lòng kiểm tra Key.
                        </div>
                    )}
                </div>

                {/* Database Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                        <Cloud size={18} />
                        Cloud Database
                    </h3>
                    <p className="text-sm text-blue-700 mb-2">
                        Nền tảng: <span className="font-bold">Supabase</span>
                    </p>
                    <p className="text-xs text-blue-600">
                        Dữ liệu được đồng bộ realtime. Đảm bảo bạn đã chạy SQL tạo bảng ở mục trên.
                    </p>
                </div>
            </div>

            {/* DANGER ZONE */}
            <div className="border-t-2 border-red-100 pt-4">
                <h3 className="text-red-600 font-bold flex items-center gap-2 mb-4 uppercase tracking-wide">
                    <AlertTriangle size={20} /> Vùng nguy hiểm
                </h3>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            <Database size={16} /> Xóa sạch dữ liệu Cloud
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                            Xóa vĩnh viễn tất cả Hồ sơ, Hợp đồng và Lịch sử.
                        </p>
                    </div>
                    <button 
                        onClick={handleConfirmDeleteData}
                        disabled={isDeletingData}
                        className="px-4 py-2 bg-white border border-red-300 text-red-600 font-bold rounded-md hover:bg-red-600 hover:text-white transition-colors shadow-sm disabled:opacity-50 shrink-0 text-sm"
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
