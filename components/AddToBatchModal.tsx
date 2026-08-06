
import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { X, Plus, History, CheckCircle2, AlertTriangle, Map, MapPin, FileText, ArrowRight } from 'lucide-react';
import { fetchChinhLyRecords } from '../services/apiUtilities';
import { getReceivingWard } from '../utils/appHelpers';
import { getNormalizedWard } from '../constants';

interface AddToBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batch: number, date: string, customWardsMap?: Record<string, string> | string) => void;
  records: RecordFile[];
  selectedCount: number;
  targetRecords?: RecordFile[]; // Danh sách hồ sơ được chọn hoặc lọc
  wards?: string[];
}

const AddToBatchModal: React.FC<AddToBatchModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  records, 
  selectedCount,
  targetRecords = [], 
  wards = []
}) => {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');
  
  // Map lưu địa bàn giao riêng cho từng hồ sơ { [recordId]: wardName }
  const [recordWards, setRecordWards] = useState<Record<string, string>>({});

  // State xác nhận danh sách chỉnh lý
  const [needsCorrectionConfirm, setNeedsCorrectionConfirm] = useState(false);
  
  // State danh sách cảnh báo thực tế
  const [filteredWarningList, setFilteredWarningList] = useState<RecordFile[]>([]);

  // Ngày hiện tại cho đợt mới
  const todayStr = new Date().toISOString().split('T')[0];

  const wardOptions = useMemo(() => {
    return wards && wards.length > 0 ? wards : [
      'Minh Hưng', 'Chơn Thành', 'Nha Bích', 'Minh Lập', 'Minh Thắng', 'Quang Minh', 'Thành Tâm', 'Minh Long'
    ];
  }, [wards]);

  // Lọc danh sách hồ sơ thực sự đủ điều kiện chốt đợt (Ký duyệt hoặc Rút hồ sơ chưa có đợt)
  const exportableRecords = useMemo(() => {
    return targetRecords.filter(r => r.status === RecordStatus.SIGNED || (r.status === RecordStatus.WITHDRAWN && !r.exportBatch));
  }, [targetRecords]);

  // Khởi tạo địa bàn nhận mặc định cho từng hồ sơ khi mở modal
  useEffect(() => {
    if (isOpen && exportableRecords.length > 0) {
      const initialMap: Record<string, string> = {};
      exportableRecords.forEach(r => {
        initialMap[r.id] = r.receivingWard || getReceivingWard(r) || r.ward || '';
      });
      setRecordWards(initialMap);
    }
  }, [isOpen, exportableRecords]);

  // Đổi địa bàn riêng của 1 hồ sơ
  const handleIndividualWardChange = (recordId: string, newWard: string) => {
    setRecordWards(prev => ({
      ...prev,
      [recordId]: newWard
    }));
  };

  // Đổi hàng loạt tất cả hồ sơ trong đợt sang 1 địa bàn
  const handleApplyAllWards = (ward: string) => {
    if (!ward) return;
    const updatedMap: Record<string, string> = {};
    exportableRecords.forEach(r => {
      updatedMap[r.id] = ward;
    });
    setRecordWards(updatedMap);
  };

  useEffect(() => {
      // Logic kiểm tra xem hồ sơ nào cần chỉnh lý NHƯNG chưa có trong danh sách đã chuyển ('sent')
      const checkWarnings = async () => {
          if (!isOpen || exportableRecords.length === 0) {
              setFilteredWarningList([]);
              return;
          }

          const potentialWarnings = exportableRecords.filter(r => r.needsMapCorrection);
          
          if (potentialWarnings.length === 0) {
              setFilteredWarningList([]);
              return;
          }

          const chinhLyRecords = await fetchChinhLyRecords();
          
          const realWarnings = potentialWarnings.filter(r => {
              const correctionEntry = chinhLyRecords.find(c => c.data.SO_HD === r.code);
              if (correctionEntry && correctionEntry.data.STATUS === 'sent') {
                  return false;
              }
              return true;
          });

          setFilteredWarningList(realWarnings);
      };

      checkWarnings();
  }, [isOpen, exportableRecords]);

  const nextBatchInfo = useMemo(() => {
      let maxBatch = 0;
      records.forEach(r => {
          if (r.exportBatch && r.exportDate && r.exportDate.startsWith(todayStr)) {
              if (r.exportBatch > maxBatch) maxBatch = r.exportBatch;
          }
      });
      return {
          batch: maxBatch + 1,
          date: new Date().toISOString()
      };
  }, [records, todayStr]);

  const historyBatches = useMemo(() => {
      const batches: Record<string, { date: string, batch: number, count: number, fullDate: string }> = {};
      
      records.forEach(r => {
          if ((r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.RETURNED || !!r.exportBatch) && r.exportBatch && r.exportDate) {
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

      const sorted = Object.values(batches).sort((a, b) => {
          const dateDiff = b.date.localeCompare(a.date);
          if (dateDiff !== 0) return dateDiff;
          return b.batch - a.batch;
      });

      // Chỉ cho phép bổ sung vào 1 đợt gần nhất duy nhất trước đó (đợt gần nhất hôm nay hoặc đợt cuối cùng ngày trước)
      return sorted.slice(0, 1);
  }, [records]);

  useEffect(() => {
      if (historyBatches.length > 0) {
          const first = historyBatches[0];
          setSelectedExistingBatch(`${first.date}_${first.batch}`);
      } else {
          setSelectedExistingBatch('');
      }
  }, [historyBatches]);

  if (!isOpen) return null;

  const handleConfirm = () => {
      if (filteredWarningList.length > 0 && !needsCorrectionConfirm) {
          alert("Vui lòng xác nhận bạn đã lập danh sách chỉnh lý cho các hồ sơ được cảnh báo.");
          return;
      }

      if (mode === 'new') {
          onConfirm(nextBatchInfo.batch, nextBatchInfo.date, recordWards);
      } else {
          if (!selectedExistingBatch) {
              alert('Vui lòng chọn một đợt cũ.');
              return;
          }
          const [datePart, batchNumStr] = selectedExistingBatch.split('_');
          const batchNum = parseInt(batchNumStr);
          const found = historyBatches.find(h => h.date === datePart && h.batch === batchNum);
          
          if (found) {
              onConfirm(found.batch, found.fullDate, recordWards);
          }
      }
      setNeedsCorrectionConfirm(false);
      onClose();
  };

  const formatDate = (d: string) => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-3 md:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl animate-fade-in-up flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="p-4 border-b bg-slate-800 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg text-white">Chốt Danh Sách Giao 1 Cửa</h3>
                <p className="text-xs text-slate-300">Chọn đợt bàn giao và kiểm tra địa bàn giao cho từng hồ sơ</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors">
              <X size={20}/>
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 md:p-5 space-y-4 overflow-y-auto flex-1">

            {/* Section 1: Chọn đợt */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: New Batch */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${mode === 'new' ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500' : 'bg-slate-50 border-slate-200 hover:border-blue-300'}`}>
                  <input 
                      type="radio" 
                      name="batchMode" 
                      checked={mode === 'new'} 
                      onChange={() => setMode('new')}
                      className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                          <Plus size={16} className="text-blue-600" /> Tạo đợt mới (Hôm nay)
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                          Đợt tiếp theo: <span className="font-bold text-blue-700">Đợt {nextBatchInfo.batch}</span>
                          <span className="mx-1 text-slate-400">•</span>
                          <span>Ngày {formatDate(todayStr)}</span>
                      </div>
                  </div>
              </label>

              {/* Option 2: Existing Batch */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${mode === 'existing' ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-1 ring-emerald-500' : 'bg-slate-50 border-slate-200 hover:border-emerald-300'} ${historyBatches.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input 
                      type="radio" 
                      name="batchMode" 
                      checked={mode === 'existing'} 
                      disabled={historyBatches.length === 0}
                      onChange={() => setMode('existing')}
                      className="mt-0.5 w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                          <History size={16} className="text-emerald-600" /> Bổ sung vào đợt liền kề (Gần nhất)
                      </div>
                      <div className="mt-1.5">
                          {historyBatches.length > 0 ? (
                              <div className="text-xs font-semibold text-emerald-900 bg-emerald-100/70 border border-emerald-200 rounded-lg p-2 flex items-center justify-between">
                                  <span>Đợt {historyBatches[0].batch} - Ngày {formatDate(historyBatches[0].date)}</span>
                                  <span className="text-[11px] font-medium text-emerald-700 bg-white px-2 py-0.5 rounded shadow-2xs">
                                      Đã có {historyBatches[0].count} HS
                                  </span>
                              </div>
                          ) : (
                              <div className="text-xs text-slate-400 italic">Chưa có đợt nào trước đó</div>
                          )}
                      </div>
                  </div>
              </label>
            </div>

            {/* Section 2: Danh sách hồ sơ & Chọn địa bàn giao */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-indigo-600" />
                  <span className="font-bold text-xs md:text-sm text-slate-800 uppercase tracking-wide">
                    Danh sách bàn giao ({exportableRecords.length} hồ sơ)
                  </span>
                </div>

                {/* Batch Ward Setter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium hidden sm:inline">Chọn nhanh cho tất cả:</span>
                  <select 
                    className="border border-indigo-200 rounded-md px-2 py-1 text-xs bg-indigo-50/80 font-semibold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    onChange={(e) => {
                      handleApplyAllWards(e.target.value);
                      e.target.value = '';
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>-- Áp dụng tất cả --</option>
                    {wardOptions.map(w => (
                      <option key={w} value={w}>
                        {getNormalizedWard(w)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table Records */}
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {exportableRecords.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Không có hồ sơ nào đủ điều kiện bàn giao (Cần ở trạng thái đã Ký duyệt hoặc Rút hồ sơ).
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0">
                        <th className="py-2 px-3 w-10 text-center">STT</th>
                        <th className="py-2 px-3">Mã Hồ Sơ</th>
                        <th className="py-2 px-3">Tên Khách Hàng</th>
                        <th className="py-2 px-3">Địa bàn tiếp nhận</th>
                        <th className="py-2 px-3 w-48 text-indigo-900">Địa bàn giao (1 Cửa)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {exportableRecords.map((r, idx) => {
                        const defaultWard = getReceivingWard(r) || r.ward || '';
                        const currentWard = recordWards[r.id] || defaultWard;
                        const isCustomized = currentWard && defaultWard && getNormalizedWard(currentWard) !== getNormalizedWard(defaultWard);

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800 font-mono">{r.code}</td>
                            <td className="py-2 px-3 text-slate-700 font-medium max-w-[160px] truncate" title={r.customerName}>
                              {r.customerName}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                                {getNormalizedWard(defaultWard) || '—'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              <select 
                                className={`w-full border rounded-md px-2 py-1 text-xs font-semibold outline-none cursor-pointer transition-colors ${
                                  isCustomized 
                                    ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-2 focus:ring-amber-500' 
                                    : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500'
                                }`}
                                value={currentWard}
                                onChange={(e) => handleIndividualWardChange(r.id, e.target.value)}
                              >
                                {wardOptions.map(w => (
                                  <option key={w} value={w}>
                                    {getNormalizedWard(w)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* CẢNH BÁO CHỈNH LÝ BẢN ĐỒ */}
            {filteredWarningList.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wide">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" /> Cảnh báo chỉnh lý bản đồ ({filteredWarningList.length} hồ sơ)
                    </div>
                    <p className="text-xs text-amber-800">
                        Các hồ sơ sau chưa có trong danh sách "Đã chuyển" chỉnh lý bản đồ:
                    </p>
                    <div className="max-h-24 overflow-y-auto bg-white/80 p-2 rounded-lg border border-amber-200 text-xs font-mono text-amber-900 space-y-1">
                        {filteredWarningList.map(r => (
                            <div key={r.id} className="flex items-center gap-2">
                                <Map size={12} className="text-amber-600 shrink-0" />
                                <span><strong>{r.code}</strong> - {r.customerName}</span>
                            </div>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border border-amber-300 hover:bg-amber-50/50 transition-colors">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 text-amber-600 focus:ring-amber-500 rounded"
                            checked={needsCorrectionConfirm}
                            onChange={(e) => setNeedsCorrectionConfirm(e.target.checked)}
                        />
                        <span className="text-xs font-bold text-slate-700">Tôi xác nhận đã kiểm tra / lập danh sách chỉnh lý.</span>
                    </label>
                </div>
            )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs md:text-sm">
                Hủy bỏ
            </button>
            <button 
                onClick={handleConfirm} 
                disabled={filteredWarningList.length > 0 && !needsCorrectionConfirm}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-xs md:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <CheckCircle2 size={16} /> Xác nhận chốt đợt ({exportableRecords.length})
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddToBatchModal;

