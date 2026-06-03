import React, { useState, useEffect } from 'react';
import { RecordFile } from '../types';
import { Ruler, Layers, AlertCircle } from 'lucide-react';

interface PlotCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (plotCount: number) => void;
  record: RecordFile | null;
}

export const PlotCountModal: React.FC<PlotCountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  record,
}) => {
  const [plotCount, setPlotCount] = useState<number>(1);

  // Cập nhật lại số lượng thửa mặc định từ hồ sơ nếu có sẵn dã lưu
  useEffect(() => {
    if (isOpen && record) {
      setPlotCount(record.plotCount || 1);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (plotCount < 1) {
      alert('Vui lòng nhập số lượng thửa đất hợp lệ (tối thiểu là 1).');
      return;
    }
    onConfirm(plotCount);
  };

  const isOther = ['CMD', 'Tòa án', 'Thi hành án', 'Thuế chính quy'].includes(record.recordType || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-5 text-white flex items-center gap-3">
          {isOther ? <Layers className="h-6 w-6" /> : <Ruler className="h-6 w-6" />}
          <div>
            <h3 className="font-bold text-lg">Trình ký duyệt hồ sơ</h3>
            <p className="text-xs text-orange-100">Cập nhật số lượng thửa đất trước khi trình ký</p>
          </div>
        </div>

        {/* Nội dung */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-orange-50/50 rounded-lg p-3 border border-orange-100 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Mã hồ sơ:</span>
              <span className="font-bold text-slate-800">{record.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Khách hàng:</span>
              <span className="font-semibold text-slate-800">{record.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Loại hồ sơ:</span>
              <span className="text-orange-700 font-medium">{record.recordType || 'Đo đạc theo yêu cầu'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              Nhập số lượng thửa đất <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                onClick={() => setPlotCount(prev => Math.max(1, prev - 1))}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                required
                className="flex-1 text-center h-10 border border-gray-300 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                value={plotCount}
                onChange={(e) => setPlotCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button
                type="button"
                className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                onClick={() => setPlotCount(prev => prev + 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="text-[11px] text-gray-500 flex items-start gap-1.5 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
            <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p>Số lượng thửa đất này sẽ được lưu trữ đồng bộ lên hệ thống Supabase và phục vụ trực tiếp cho các biểu đồ, báo cáo thống kê chuyên sâu.</p>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              onClick={onClose}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-lg shadow-md transition-all"
            >
              Xác nhận trình ký
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
