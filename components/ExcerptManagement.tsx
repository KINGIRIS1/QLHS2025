
import React, { useState, useEffect } from 'react';
import { Search, PlusCircle, History, AlertCircle, CheckCircle, MapPin, Hash, BookOpen, Loader2, Settings, X, Save, Trash2, Plus, RotateCcw, LayoutGrid } from 'lucide-react';
import { User, UserRole, RecordFile } from '../types';
import { fetchExcerptHistory, saveExcerptRecord, fetchExcerptCounters, saveExcerptCounters } from '../services/api';

interface ExcerptRecord {
  id: string;
  ward: string;
  mapSheet: string;
  landPlot: string;
  excerptNumber: number;
  createdAt: string;
  createdBy: string;
  linkedRecordCode?: string; // Mã hồ sơ liên kết (nếu có)
}

interface ExcerptManagementProps {
  currentUser: User;
  records: RecordFile[];
  onUpdateRecord: (recordId: string, excerptNumber: string) => void;
  wards: string[];
  onAddWard: (ward: string) => void;
  onDeleteWard: (ward: string) => void;
  onResetWards: () => void;
}

// Khởi tạo dữ liệu mẫu cho cấu hình số đếm (Simulation CONFIG sheet)
const INITIAL_CONFIG: Record<string, number> = {
  'Chơn Thành': 0,
  'Minh Hưng': 0,
  'Nha Bích': 0
};

const ExcerptManagement: React.FC<ExcerptManagementProps> = ({ currentUser, records, onUpdateRecord, wards, onAddWard, onDeleteWard, onResetWards }) => {
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [mapSheet, setMapSheet] = useState<string>('');
  const [landPlot, setLandPlot] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<ExcerptRecord[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>(INITIAL_CONFIG);

  // States cho tính năng tìm kiếm hồ sơ
  const [searchCode, setSearchCode] = useState('');
  const [linkedRecord, setLinkedRecord] = useState<RecordFile | null>(null);
  const [missingWard, setMissingWard] = useState<string | null>(null);
  
  // States cho Admin Config
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingCounters, setEditingCounters] = useState<Record<string, number>>({});
  const [newWardName, setNewWardName] = useState('');

  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;

  // Load data from SERVER on mount
  useEffect(() => {
    const loadServerData = async () => {
        // 1. Load History
        const serverHistory = await fetchExcerptHistory();
        setHistory(serverHistory);

        // 2. Load Counters
        const serverCounters = await fetchExcerptCounters();
        // Merge với INITIAL_CONFIG để đảm bảo không bị lỗi undefined
        setCounters(prev => ({ ...prev, ...serverCounters }));
    };
    loadServerData();
  }, []);

  const handleSearchRecord = () => {
    if (!searchCode.trim()) return;
    const record = records.find(r => r.code.toLowerCase() === searchCode.toLowerCase());
    
    setMissingWard(null);
    if (record) {
        setLinkedRecord(record);
        // Kiểm tra xem xã trong hồ sơ có trong danh sách wards không
        if (record.ward && wards.includes(record.ward)) {
             setSelectedWard(record.ward);
        } else if (record.ward) {
             // Phát hiện xã chưa có trong danh sách
             setMissingWard(record.ward);
        }

        if (record.mapSheet) setMapSheet(record.mapSheet);
        if (record.landPlot) setLandPlot(record.landPlot);
        setResultNumber(null);
    } else {
        alert('Không tìm thấy hồ sơ với mã này.');
        setLinkedRecord(null);
    }
  };

  const handleQuickAddWard = () => {
      if (missingWard) {
          onAddWard(missingWard);
          setSelectedWard(missingWard);
          setMissingWard(null);
          // Tự động khởi tạo counter nếu chưa có
          if (counters[missingWard] === undefined) {
              setCounters(prev => {
                  const newState = { ...prev, [missingWard]: 0 };
                  saveExcerptCounters(newState); // Lưu ngay lên server
                  return newState;
              });
          }
      }
  };

  const handleGetNumber = async () => {
    if (!selectedWard || !mapSheet || !landPlot) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    setLoading(true);
    setResultNumber(null);

    // 1. Lấy số hiện tại của xã đó
    const currentCount = counters[selectedWard] || 0;
    const nextCount = currentCount + 1;

    // 2. Tạo bản ghi mới
    const newRecord: ExcerptRecord = {
      id: Math.random().toString(36).substr(2, 9),
      ward: selectedWard,
      mapSheet,
      landPlot,
      excerptNumber: nextCount,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      linkedRecordCode: linkedRecord?.code
    };

    // 3. Cập nhật Server
    await saveExcerptRecord(newRecord);
    
    const newCounters = { ...counters, [selectedWard]: nextCount };
    await saveExcerptCounters(newCounters);

    // 4. Cập nhật State UI
    setCounters(newCounters);
    setHistory(prev => [newRecord, ...prev]);
    setResultNumber(nextCount);
    setLoading(false);

    // 5. Nếu có hồ sơ liên kết, cập nhật lại hồ sơ gốc
    if (linkedRecord) {
        onUpdateRecord(linkedRecord.id, nextCount.toString());
        // alert(`Đã cấp số ${nextCount} và cập nhật vào hồ sơ ${linkedRecord.code}`);
        setLinkedRecord(null);
        setSearchCode('');
        setMissingWard(null);
    }

    // Reset input tờ/thửa
    setMapSheet('');
    setLandPlot('');
  };

  const openConfig = () => {
      setEditingCounters({...counters});
      setNewWardName('');
      setIsConfigOpen(true);
  };

  const saveConfig = async () => {
      await saveExcerptCounters(editingCounters);
      setCounters(editingCounters);
      setIsConfigOpen(false);
  };

  const handleAddNewWard = () => {
      const name = newWardName.trim();
      if(name) {
          if (wards.includes(name)) {
              alert(`Xã/Phường "${name}" đã tồn tại!`);
              return;
          }
          onAddWard(name);
          setEditingCounters(prev => ({ ...prev, [name]: 0 }));
          setNewWardName('');
      }
  };

  const filteredHistory = selectedWard 
    ? history.filter(h => h.ward === selectedWard) 
    : history;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm} - ${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* DASHBOARD TỔNG QUAN */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
         <div className="flex items-center gap-2 mb-4 text-gray-700 font-bold border-b pb-2">
             <LayoutGrid size={20} className="text-blue-600" />
             <h2>Theo dõi Số Trích Lục hiện tại (Theo Xã/Phường)</h2>
         </div>
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {wards.map(ward => (
                 <div 
                    key={ward} 
                    onClick={() => setSelectedWard(ward)}
                    className={`cursor-pointer rounded-lg p-4 border transition-all hover:shadow-md flex flex-col items-center justify-center gap-1 ${selectedWard === ward ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' : 'bg-gray-50 border-gray-200 hover:border-blue-300'}`}
                 >
                     <div className="text-xs text-gray-500 font-bold uppercase text-center">{ward}</div>
                     <div className="text-3xl font-black text-gray-800 font-mono">
                         {counters[ward] || 0}
                     </div>
                     <div className="text-[10px] text-gray-400">Số hiện tại</div>
                 </div>
             ))}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: INPUT FORM */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative">
            {hasAdminRights && (
                <button 
                    onClick={openConfig}
                    className="absolute top-6 right-6 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Cấu hình số hiện tại (Admin)"
                >
                    <Settings size={20} />
                </button>
            )}

            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-2">
              <PlusCircle className="text-blue-600" />
              Cấp Số Mới
            </h2>
            
            <div className="space-y-4">
              {/* Tìm kiếm hồ sơ */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <label className="block text-xs font-bold text-blue-800 mb-1 uppercase">Lấy thông tin từ Hồ Sơ</label>
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Nhập mã hồ sơ..."
                        className="flex-1 text-sm border border-blue-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchRecord()}
                      />
                      <button 
                        onClick={handleSearchRecord}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                      >
                          Tìm
                      </button>
                  </div>
                  {linkedRecord && (
                      <div className="mt-2 space-y-2">
                          <div className="text-xs text-green-700 flex items-center gap-1 bg-green-50 p-1.5 rounded border border-green-200">
                              <CheckCircle size={12} />
                              <span>{linkedRecord.customerName}</span>
                              <button onClick={() => { setLinkedRecord(null); setSearchCode(''); setMissingWard(null); }} className="ml-auto text-gray-500 hover:text-red-500"><X size={12} /></button>
                          </div>
                          
                          {missingWard && (
                              <div className="text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-200 flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                      <AlertCircle size={12} />
                                      <span>Xã <b>{missingWard}</b> chưa có trong danh sách.</span>
                                  </div>
                                  <button 
                                      onClick={handleQuickAddWard}
                                      className="w-full bg-orange-200 text-orange-800 px-2 py-1 rounded text-xs font-bold hover:bg-orange-300"
                                  >
                                      + Thêm ngay vào danh sách
                                  </button>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Xã / Phường <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white font-medium text-gray-800"
                    value={selectedWard}
                    onChange={(e) => { setSelectedWard(e.target.value); setResultNumber(null); }}
                  >
                    <option value="">-- Chọn địa bàn để cấp số --</option>
                    {wards.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                  <MapPin className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số Tờ <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ví dụ: 10"
                    value={mapSheet}
                    onChange={(e) => setMapSheet(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số Thửa <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ví dụ: 155"
                    value={landPlot}
                    onChange={(e) => setLandPlot(e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={handleGetNumber}
                disabled={loading || !selectedWard || !mapSheet || !landPlot}
                className="w-full mt-2 bg-blue-600 text-white py-3 rounded-lg font-semibold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <BookOpen size={20} />}
                Cấp số tiếp theo: {selectedWard ? (counters[selectedWard] || 0) + 1 : '?'}
              </button>
            </div>
            
            {/* Hướng dẫn nhỏ */}
            <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
               <p className="flex items-start gap-2">
                 <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
                 <span>Hệ thống sẽ tự động tìm số thứ tự lớn nhất hiện tại của xã <strong>{selectedWard || '...'}</strong> và cộng thêm 1.</span>
               </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RESULT & HISTORY */}
        <div className="lg:col-span-2 space-y-6">
            {/* RESULT BOX */}
            <div className={`bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl shadow-sm border border-orange-100 p-8 text-center transition-all duration-500 ${resultNumber ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
                <h3 className="text-gray-500 font-medium uppercase tracking-wider text-sm mb-2">Số trích lục vừa cấp</h3>
                <div className="flex items-center justify-center gap-4">
                     <div className="text-6xl font-black text-orange-600 drop-shadow-sm font-mono">
                        {resultNumber ? resultNumber : '---'}
                     </div>
                     {resultNumber && <CheckCircle className="text-green-500 w-10 h-10 animate-bounce" />}
                </div>
                {resultNumber && (
                    <p className="mt-4 text-orange-800 font-medium animate-pulse">
                        Đã lưu cho xã {selectedWard} - Tờ {history[0]?.mapSheet} / Thửa {history[0]?.landPlot}
                    </p>
                )}
            </div>

            {/* HISTORY TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <History className="text-gray-500" />
                        {selectedWard ? `Lịch sử cấp số xã: ${selectedWard}` : 'Lịch sử cấp số (Toàn bộ)'}
                    </h3>
                    <div className="flex items-center gap-3">
                         {selectedWard && (
                             <button 
                                onClick={() => setSelectedWard('')} 
                                className="text-xs text-blue-600 hover:underline"
                             >
                                 Xem tất cả
                             </button>
                         )}
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="Tìm tờ/thửa..." 
                                className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-white sticky top-0 shadow-sm z-10 text-xs font-semibold text-gray-500 uppercase">
                            <tr>
                                <th className="p-3 border-b text-center w-20">STL</th>
                                <th className="p-3 border-b w-[200px]">Xã / Phường</th>
                                <th className="p-3 border-b text-center w-16">Tờ</th>
                                <th className="p-3 border-b text-center w-16">Thửa</th>
                                <th className="p-3 border-b w-[150px]">Hồ sơ liên kết</th>
                                <th className="p-3 border-b w-[150px]">Thời gian</th>
                                <th className="p-3 border-b w-[150px]">Người cấp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3 text-center font-bold text-orange-600 bg-orange-50/50 align-middle">
                                            {item.excerptNumber}
                                        </td>
                                        <td className="p-3 font-medium truncate align-middle" title={item.ward}>{item.ward}</td>
                                        <td className="p-3 text-center font-mono align-middle">{item.mapSheet}</td>
                                        <td className="p-3 text-center font-mono align-middle">{item.landPlot}</td>
                                        <td className="p-3 truncate align-middle" title={item.linkedRecordCode}>
                                            {item.linkedRecordCode ? (
                                                <span className="text-blue-600 font-medium text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                    {item.linkedRecordCode}
                                                </span>
                                            ) : <span className="text-gray-400 text-xs italic">--</span>}
                                        </td>
                                        <td className="p-3 text-gray-500 text-xs align-middle">{formatDate(item.createdAt)}</td>
                                        <td className="p-3 text-xs text-blue-600 font-medium align-middle">
                                            <div className="truncate w-full" title={item.createdBy}>{item.createdBy}</div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-gray-400 italic">
                                        Chưa có dữ liệu lịch sử cho khu vực này.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>

      {/* ADMIN CONFIG MODAL */}
      {isConfigOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-5 border-b">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <Settings className="text-blue-600" />
                          Cấu hình Xã Phường & Số trích lục
                      </h3>
                      <button onClick={() => setIsConfigOpen(false)} className="text-gray-500 hover:text-red-600">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                      <p className="text-sm text-gray-600 mb-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                          <AlertCircle size={14} className="inline mr-1 text-yellow-600" />
                          Quản lý danh sách các Xã/Phường và thiết lập số thứ tự hiện tại. Số cấp tiếp theo sẽ là <strong>Số hiện tại + 1</strong>.
                      </p>

                      {/* Add New Ward */}
                      <div className="flex gap-2 mb-4">
                         <input 
                            type="text" 
                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Nhập tên xã/phường mới..."
                            value={newWardName}
                            onChange={(e) => setNewWardName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNewWard()}
                         />
                         <button 
                            onClick={handleAddNewWard}
                            disabled={!newWardName.trim()}
                            className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                         >
                             <Plus size={18} />
                         </button>
                      </div>

                      {/* Nút khôi phục mặc định */}
                       <button 
                          onClick={onResetWards}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-4 ml-auto w-fit"
                       >
                          <RotateCcw size={12} /> Khôi phục danh sách xã/phường mặc định
                       </button>
                      
                      <div className="space-y-3">
                          {wards.map(ward => (
                              <div key={ward} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center gap-2">
                                     <button 
                                        onClick={() => { if(confirm(`Xóa xã "${ward}" khỏi danh sách?`)) onDeleteWard(ward); }}
                                        className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded"
                                        title="Xóa xã này"
                                     >
                                         <Trash2 size={14} />
                                     </button>
                                     <span className="text-sm font-medium text-gray-700">{ward}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">Hiện tại:</span>
                                      <input 
                                          type="number" 
                                          className="w-20 border border-gray-300 rounded px-2 py-1 text-right font-mono font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          value={editingCounters[ward] ?? 0}
                                          onChange={(e) => setEditingCounters({...editingCounters, [ward]: parseInt(e.target.value) || 0})}
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-lg">
                      <button 
                          onClick={() => setIsConfigOpen(false)}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                      >
                          Hủy bỏ
                      </button>
                      <button 
                          onClick={saveConfig}
                          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
                      >
                          <Save size={18} /> Lưu cấu hình
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExcerptManagement;
