import React, { useState, useEffect } from 'react';
import { RecordFile, User } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { X, AlertTriangle, User as UserIcon, Clock, FileText, Ban } from 'lucide-react';

interface CancelRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  currentUser: User;
  onConfirmCancel: (record: RecordFile, reason: string, cancelledBy: string, cancelledAt: string) => Promise<void>;
}

const CancelRecordModal: React.FC<CancelRecordModalProps> = ({
  isOpen,
  onClose,
  record,
  currentUser,
  onConfirmCancel
}) => {
  const [reason, setReason] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setErrorMsg('');
      setIsSubmitting(false);
      
      const now = new Date();
      const formatted = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCurrentTime(formatted);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const cancellerName = currentUser?.name || currentUser?.username || 'Cán bộ tiếp nhận';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setErrorMsg('Vui lòng nhập lý do hủy hồ sơ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      await onConfirmCancel(record, cleanReason, cancellerName, nowIso);
      onClose();
    } catch (err) {
      console.error("Lỗi khi hủy hồ sơ:", err);
      setErrorMsg('Có lỗi xảy ra khi hủy hồ sơ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-red-100 w-full max-w-lg overflow-hidden flex flex-col transform transition-all animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex items-center justify-between text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Ban size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Xác nhận Hủy hồ sơ</h3>
              <p className="text-xs text-red-100">Hồ sơ sẽ được chuyển vào danh sách Đã hủy</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/90 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Thông tin tóm tắt hồ sơ */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mã hồ sơ</span>
              <span className="font-mono font-bold text-blue-600 text-sm bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                {record.code}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chủ sử dụng</span>
              <span className="font-semibold text-slate-800 text-sm">{record.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Xã / Phường</span>
              <span className="text-slate-700 text-sm">{getNormalizedWard(record.ward)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loại hồ sơ</span>
              <span className="text-xs font-medium text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                {getShortRecordType(record.recordType)}
              </span>
            </div>
          </div>

          {/* Người hủy & Thời gian hủy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-red-50/50 p-3.5 rounded-xl border border-red-100 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <UserIcon size={16} className="text-red-500 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">Người thực hiện hủy:</div>
                <div className="font-bold text-slate-800">{cancellerName}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Clock size={16} className="text-red-500 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">Thời gian hủy:</div>
                <div className="font-bold text-slate-800 font-mono">{currentTime}</div>
              </div>
            </div>
          </div>

          {/* Nhập lý do hủy */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText size={16} className="text-red-600" />
                Lý do hủy hồ sơ <span className="text-red-500">*</span>
              </span>
              <span className="text-xs font-normal text-slate-400">Bắt buộc</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              rows={3}
              placeholder="Nhập chi tiết lý do hủy (VD: Khách hàng xin rút hồ sơ, sai thông tin đo đạc, tạo nhầm mã hồ sơ...)"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400"
              autoFocus
            />
            {errorMsg && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-medium animate-shake">
                <AlertTriangle size={13} className="shrink-0" />
                {errorMsg}
              </p>
            )}
          </div>

          {/* Nút thao tác */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 rounded-xl shadow-md shadow-red-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Ban size={16} />
              {isSubmitting ? 'Đang xử lý...' : 'Xác nhận hủy hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CancelRecordModal;
