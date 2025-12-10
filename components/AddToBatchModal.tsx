
import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { X, Calendar, Plus, History, CheckCircle2 } from 'lucide-react';

interface AddToBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batch: number, date: string) => void;
  records: RecordFile[];
  selectedCount: number;
}

const AddToBatchModal: React.FC<AddToBatchModalProps> = ({ isOpen, onClose, onConfirm, records, selectedCount }) => {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');
  
  // Ngày hiện tại cho đợt mới
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Tính toán Đợt tiếp theo cho ngày hôm nay
  const nextBatchInfo = useMemo(() => {
      let maxBatch = 0;
      records.forEach(r => {
          if (r.exportBatch && r.exportDate && r.exportDate.startsWith(todayStr)) {
              if (r.exportBatch > maxBatch) maxBatch = r.exportBatch;
          }
      });
      return {
          batch: maxBatch + 1,
          date: new Date().toISOString() // Dùng ISO đầy đủ cho chính xác
      };
  }, [records, todayStr]);

  // 2. Tổng hợp danh sách các đợt cũ
  const historyBatches = useMemo(() => {
      const batches: Record<string, { date: string, batch: number, count: number, fullDate: string }> = {};
      
      records.forEach(r => {
          // Chỉ lấy những hồ sơ đã chốt (có exportBatch và exportDate)
          if ((r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED) && r.exportBatch && r.exportDate) {
              const datePart = r.exportDate.split('T')[0];
              const key = `${datePart}_${r.exportBatch}`;
              
              if (!batches[key]) {
                  batches[key] = { 
                      date: datePart, 
                      batch: r.exportBatch, 
                      count: 0,
                      fullDate: r.exportDate 
                  };
              }
              batches[key].count++;
          }
      });

      // Chuyển về mảng và sắp xếp (Mới nhất lên đầu)
      return Object.values(batches).sort((a, b) => {
          // So sánh ngày trước
          const dateDiff = b.date.localeCompare(a.date);
          if (dateDiff !== 0) return dateDiff;
          // Nếu cùng ngày, so sánh số đợt (lớn lên đầu)
          return b.batch - a.batch;
      });
  }, [records]);

  // Tự động chọn đợt cũ đầu tiên nếu có
  useEffect(() => {
      if (mode === 'existing' && historyBatches.length > 0 && !selectedExistingBatch) {
          const first = historyBatches[0];
          setSelectedExistingBatch(`${first.date}_${first.batch}`);
      }
  }, [mode, historyBatches]);

  if (!isOpen) return null;

  const handleConfirm = () => {
      if (mode === 'new') {
          onConfirm(nextBatchInfo.batch, nextBatchInfo.date);
      } else {
          if (!selectedExistingBatch) {
              alert('Vui lòng chọn một đợt cũ.');
              return;
          }
          // Tìm lại thông tin đợt đã chọn
          const [datePart, batchNumStr] = selectedExistingBatch.split('_');
          const batchNum = parseInt(batchNumStr);
          const found = historyBatches.find(h => h.date === datePart && h.batch === batchNum);
          
          if (found) {
              // Sử dụng lại đúng ngày giờ cũ của đợt đó để đồng bộ
              onConfirm(found.batch, found.fullDate);
          }
      }
      onClose();
  };

  const formatDate = (d: string) => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">Chốt Danh Sách Giao 1 Cửa</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 mb-2">
                Bạn đang thực hiện chốt <strong>{selectedCount > 0 ? selectedCount : 'toàn bộ'}</strong> hồ sơ sang trạng thái "Đã giao".
            </p>

            {/* Option 1: New Batch */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'new' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'new'} 
                    onChange={() => setMode('new')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                        <Plus size={16} className="text-blue-600" /> Tạo đợt mới (Hôm nay)
                    </div>
                    <div className="text-sm text-gray-600 mt-1 pl-6">
                        Đợt tiếp theo: <span className="font-bold text-blue-700">Đợt {nextBatchInfo.batch}</span>
                        <br/>
                        <span className="text-xs text-gray-500">Ngày: {formatDate(todayStr)}</span>
                    </div>
                </div>
            </label>

            {/* Option 2: Existing Batch */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'existing' ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'existing'} 
                    onChange={() => setMode('existing')}
                    className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                        <History size={16} className="text-green-600" /> Thêm vào đợt cũ
                    </div>
                    
                    <div className="mt-2 pl-6">
                        <select 
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={mode !== 'existing'}
                            value={selectedExistingBatch}
                            onChange={(e) => setSelectedExistingBatch(e.target.value)}
                        >
                            {historyBatches.length > 0 ? (
                                historyBatches.map(h => (
                                    <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                        Đợt {h.batch} - Ngày {formatDate(h.date)} (Đã có {h.count} HS)
                                    </option>
                                ))
                            ) : (
                                <option value="">Chưa có đợt nào</option>
                            )}
                        </select>
                    </div>
                </div>
            </label>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                Hủy bỏ
            </button>
            <button onClick={handleConfirm} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm transition-transform active:scale-95">
                <CheckCircle2 size={16} /> Xác nhận chốt
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddToBatchModal;
