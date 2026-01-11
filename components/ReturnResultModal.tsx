
import React, { useState, useEffect } from 'react';
import { RecordFile } from '../types';
import { X, CheckCircle2, FileCheck, User, Receipt } from 'lucide-react';

interface ReturnResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  onConfirm: (receiptNumber: string, receiverName: string) => void;
}

const ReturnResultModal: React.FC<ReturnResultModalProps> = ({ 
  isOpen, onClose, record, onConfirm 
}) => {
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiverName, setReceiverName] = useState('');
  
  useEffect(() => {
    if (isOpen && record) {
        setReceiptNumber(record.receiptNumber || '');
        // Gợi ý tên chủ hồ sơ, nhưng cho phép sửa
        setReceiverName(record.receiverName || record.customerName || ''); 
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!receiverName.trim()) {
          alert("Vui lòng nhập tên người nhận kết quả.");
          return;
      }
      onConfirm(receiptNumber, receiverName);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="p-5 border-b bg-emerald-50 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-emerald-800 text-lg flex items-center gap-2">
                    <FileCheck size={20} /> Trả Kết Quả Hồ Sơ
                </h3>
                <p className="text-xs text-emerald-600 mt-1 font-mono font-bold">{record.code}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 bg-white/50 p-1 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Receipt size={16} className="text-blue-600"/> Số Biên Lai
                    </label>
                    <input 
                        type="text"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium"
                        placeholder="Nhập số biên lai..."
                        value={receiptNumber}
                        onChange={(e) => setReceiptNumber(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <User size={16} className="text-purple-600"/> Người nhận kết quả <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        required
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        placeholder="Họ tên người đến nhận..."
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 italic border border-gray-200">
                Lưu ý: Hệ thống sẽ tự động cập nhật trạng thái hồ sơ thành <strong>Đã trả kết quả</strong> và ghi nhận ngày trả là hôm nay.
            </div>

            <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors">
                    Hủy bỏ
                </button>
                <button 
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold text-sm shadow-md transition-all active:scale-95"
                >
                    <CheckCircle2 size={18} /> Xác nhận trả
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnResultModal;
