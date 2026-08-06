import React, { useState, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { AlertTriangle, Bell, CheckCircle2, Phone, User, Calendar, MapPin, X, ExternalLink, ShieldAlert, Sparkles, Volume2 } from 'lucide-react';
import { playPriorityAlertSound, getReceivingWard } from '../utils/appHelpers';

interface PrioritySignedModalAlertProps {
  onViewRecordDetail?: (record: RecordFile) => void;
  records?: RecordFile[];
}

export const PrioritySignedModalAlert: React.FC<PrioritySignedModalAlertProps> = ({
  onViewRecordDetail,
  records = []
}) => {
  const [activeAlertRecord, setActiveAlertRecord] = useState<RecordFile | null>(null);
  const [alertStatus, setAlertStatus] = useState<RecordStatus | null>(null);
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState<RecordFile[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handlePriorityAlert = (event: CustomEvent<{ record: RecordFile; newStatus: RecordStatus }>) => {
      const { record, newStatus } = event.detail;
      setActiveAlertRecord(record);
      setAlertStatus(newStatus);
      setUnacknowledgedAlerts(prev => {
        if (prev.some(r => r.id === record.id)) return prev;
        return [record, ...prev];
      });
    };

    window.addEventListener('priority_signed_alert', handlePriorityAlert as EventListener);
    return () => {
      window.removeEventListener('priority_signed_alert', handlePriorityAlert as EventListener);
    };
  }, []);

  // Filter all signed priority records from props
  const signedPriorityRecords = records.filter(r => 
    r.isPriority && (
      r.status === RecordStatus.SIGNED || 
      r.status === RecordStatus.HANDOVER || 
      r.status === RecordStatus.RETURNED
    )
  );

  const handleAcknowledge = () => {
    setActiveAlertRecord(null);
  };

  const handleOpenDetail = (record: RecordFile) => {
    setActiveAlertRecord(null);
    setDrawerOpen(false);
    if (onViewRecordDetail) {
      onViewRecordDetail(record);
    }
  };

  return (
    <>
      {/* FLOATING TOP BANNER OR MODAL WHEN TRIGGERED */}
      {activeAlertRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-500 max-w-lg w-full overflow-hidden animate-scale-up">
            {/* ALERT HEADER */}
            <div className="bg-gradient-to-r from-red-600 via-amber-600 to-red-700 text-white p-5 text-center relative">
              <button 
                onClick={handleAcknowledge}
                className="absolute top-3 right-3 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
              <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-full mb-2 animate-bounce">
                <AlertTriangle size={32} className="text-yellow-300" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-wider">
                🚨 HỒ SƠ CẦN CHÚ Ý ĐÃ KÝ DUYỆT!
              </h2>
              <p className="text-xs text-red-100 mt-1 font-semibold">
                Cần thông báo ngay cho Tổ trưởng / Lãnh đạo hoặc bộ phận 1 cửa!
              </p>
            </div>

            {/* CONTENT BODY */}
            <div className="p-6 space-y-4 bg-red-50/30">
              <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Mã Hồ Sơ:</span>
                  <span className="text-base font-black text-red-600 font-mono bg-red-50 px-2.5 py-0.5 rounded border border-red-200">
                    {activeAlertRecord.code}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Chủ Sử Dụng:</span>
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <User size={14} className="text-slate-400" /> {activeAlertRecord.customerName}
                  </span>
                </div>

                {activeAlertRecord.phoneNumber && (
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Số Điện Thoại:</span>
                    <span className="text-sm font-bold text-blue-600 font-mono flex items-center gap-1.5">
                      <Phone size={14} className="text-blue-500" /> {activeAlertRecord.phoneNumber}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Địa Bàn / Xã Phường:</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <MapPin size={14} className="text-emerald-600" /> {activeAlertRecord.ward || getReceivingWard(activeAlertRecord)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Trạng Thái Mới:</span>
                  <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {alertStatus === RecordStatus.SIGNED ? 'Đã ký duyệt' : alertStatus === RecordStatus.HANDOVER ? 'Đã giao 1 cửa' : 'Đã trả kết quả'}
                  </span>
                </div>
              </div>

              {/* PRIORITY REASON NOTE */}
              <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl text-amber-900 text-xs">
                <div className="font-bold uppercase tracking-wide flex items-center gap-1.5 text-amber-800 mb-1">
                  <Sparkles size={14} className="text-amber-600" /> Ghi Chú Cần Chú Ý:
                </div>
                <p className="font-semibold text-slate-800 leading-relaxed italic">
                  "{activeAlertRecord.priorityNote || 'Hồ sơ này đã được đánh dấu CẦN CHÚ Ý & BÁO CÁO NGAY khi ký xong.'}"
                </p>
              </div>

              <div className="p-3 bg-red-100/70 border border-red-200 rounded-xl text-red-800 text-xs font-bold text-center flex items-center justify-center gap-2">
                <ShieldAlert size={16} /> 
                Nhân viên 1 Cửa / Xử lý hồ sơ hãy chuyển thông tin ngay tới lãnh đạo!
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="p-4 bg-slate-50 border-t flex items-center justify-between gap-3">
              <button
                onClick={() => playPriorityAlertSound()}
                className="p-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl border border-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                title="Phát lại chuông cảnh báo"
              >
                <Volume2 size={16} /> Phát Chuông
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenDetail(activeAlertRecord)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                >
                  <ExternalLink size={14} /> Chi Tiết
                </button>
                <button
                  onClick={handleAcknowledge}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <CheckCircle2 size={16} /> Đã báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrioritySignedModalAlert;
