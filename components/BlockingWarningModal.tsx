import React from 'react';
import { X, ShieldAlert, AlertTriangle, CheckCircle2, FileText, User, ArrowRight, BookOpen } from 'lucide-react';
import { LandRecord, RecordFile } from '../types';

interface BlockingMatch {
  record: LandRecord;
  source: 'active' | 'archive';
}

interface BlockingWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  matches: BlockingMatch[];
  recordFile: RecordFile | null;
}

const BlockingWarningModal: React.FC<BlockingWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  matches,
  recordFile
}) => {
  if (!isOpen || !recordFile) return null;

  // Phân loại trận: có trận nào đang bị ngăn chặn (chưa giải tỏa) không?
  const activeBlockings = matches.filter(m => !m.record.isUnblocked);
  const resolvedBlockings = matches.filter(m => m.record.isUnblocked);

  const hasActiveBlocking = activeBlockings.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className={`flex justify-between items-center p-4 border-b ${hasActiveBlocking ? 'bg-red-50 text-red-800 border-red-100' : 'bg-amber-50 text-amber-800 border-amber-100'}`}>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert size={24} className={hasActiveBlocking ? 'text-red-600' : 'text-amber-600'} />
            {hasActiveBlocking ? 'CẢNH BÁO: PHÁT HIỆN THỬA ĐẤT ĐANG BỊ NGĂN CHẶN!' : 'CẢNH BÁO: THỬA ĐẤT TRÙNG LỊCH SỬ NGĂN CHẶN (ĐÃ GIẢI TỎA)'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Hồ sơ hiện tại */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Thông tin hồ sơ đang thực hiện</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-500 block">Mã hồ sơ:</span>
                <span className="font-bold text-gray-800">{recordFile.code}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Chủ sử dụng:</span>
                <span className="font-semibold text-gray-800">{recordFile.customerName}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Số tờ / Thửa:</span>
                <span className="font-bold text-blue-600">
                  Tờ {recordFile.mapSheet || '---'} / Thửa {recordFile.landPlot || '---'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Xã / Phường:</span>
                <span className="font-semibold text-gray-800">{recordFile.ward || '---'}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">
            Hệ thống tự động phát hiện thông tin tờ bản đồ và thửa đất của hồ sơ trên trùng khớp với các bản ghi ngăn chặn trong cơ sở dữ liệu:
          </p>

          {/* List of matches */}
          <div className="space-y-4">
            {activeBlockings.map((match, idx) => (
              <div key={`active-${idx}`} className="border border-red-200 rounded-lg overflow-hidden shadow-xs">
                <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-red-700 uppercase flex items-center gap-1.5">
                    <AlertTriangle size={14} /> NGĂN CHẶN ĐANG CÓ HIỆU LỰC ({match.source === 'archive' ? 'TRONG LƯU TRỮ' : 'HIỆN HÀNH'})
                  </span>
                  <span className="text-xs text-red-600 font-medium">Bản ghi #{match.record.id?.substring(0, 8)}</span>
                </div>
                <div className="p-4 bg-white text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <p><strong className="text-gray-700">Chủ ngăn chặn:</strong> {match.record.owners?.join(', ') || 'Chưa rõ'}</p>
                    <p><strong className="text-gray-700">Số GCN / Vào sổ:</strong> {match.record.issueNumber || '---'} / {match.record.certNumber || '---'}</p>
                  </div>
                  <div className="bg-red-50/40 p-2.5 rounded text-xs text-red-900 border border-red-50">
                    <p className="font-bold mb-1">Văn bản ngăn chặn:</p>
                    {match.record.blockingDocuments && match.record.blockingDocuments.length > 0 ? (
                      match.record.blockingDocuments.map((doc, dIdx) => (
                        <div key={dIdx} className="pl-2 border-l-2 border-red-400 mb-1.5 last:mb-0">
                          <p>• Số: <span className="font-semibold">{doc.docNumber || '---'}</span> {doc.date ? `ngày ${doc.date}` : ''} ({doc.agency || 'Cơ quan chưa rõ'})</p>
                          <p className="italic text-gray-700">Nội dung: {doc.note || 'Không có ghi chú'}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 italic">Không có chi tiết văn bản</p>
                    )}
                  </div>
                  {match.record.notes && (
                    <p className="text-xs text-gray-500 italic mt-1"><strong className="text-gray-700 not-italic">Ghi chú bổ sung:</strong> {match.record.notes}</p>
                  )}
                </div>
              </div>
            ))}

            {resolvedBlockings.map((match, idx) => (
              <div key={`resolved-${idx}`} className="border border-amber-200 rounded-lg overflow-hidden shadow-xs">
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-green-600" /> THỬA ĐẤT ĐÃ CÓ VĂN BẢN GIẢI TỎA ({match.source === 'archive' ? 'TRONG LƯU TRỮ' : 'HIỆN HÀNH'})
                  </span>
                  <span className="text-xs text-amber-600 font-medium">Bản ghi #{match.record.id?.substring(0, 8)}</span>
                </div>
                <div className="p-4 bg-white text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <p><strong className="text-gray-700">Chủ sở hữu:</strong> {match.record.owners?.join(', ') || 'Chưa rõ'}</p>
                    <p><strong className="text-gray-700">Số GCN / Vào sổ:</strong> {match.record.issueNumber || '---'} / {match.record.certNumber || '---'}</p>
                  </div>
                  <div className="bg-amber-50/40 p-2.5 rounded text-xs text-amber-900 border border-amber-50">
                    <p className="font-bold mb-1">Chi tiết Giải tỏa ngăn chặn:</p>
                    <p className="text-green-800 font-medium flex items-center gap-1">
                      <CheckCircle2 size={12} /> Số văn bản giải tỏa: {match.record.unblockDoc || 'Chưa cập nhật số'} {match.record.unblockDate ? `ngày ${match.record.unblockDate}` : ''}
                    </p>
                    <p className="text-gray-600 mt-1 italic font-medium text-[11px] bg-amber-100/50 p-1.5 rounded border border-amber-200 flex items-start gap-1">
                      <BookOpen size={12} className="mt-0.5 shrink-0 text-amber-700" />
                      <span>Để an toàn, đề nghị quý cán bộ kiểm tra kỹ hồ sơ lưu hoặc văn bản giải tỏa gốc trước khi thực hiện chuyển tiếp!</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Lời khuyên an toàn */}
          <div className={`p-4 rounded-lg flex gap-3 text-sm border ${hasActiveBlocking ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <AlertTriangle className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold">Lưu ý quan trọng cho cán bộ ký duyệt:</p>
              <p className="mt-1 text-xs opacity-90 leading-relaxed">
                {hasActiveBlocking 
                  ? 'Thửa đất đang bị ngăn chặn CHƯA ĐƯỢC GIẢI TỎA. Việc tiếp tục trình ký duyệt có thể vi phạm các quyết định ngăn chặn hiện hành của cơ quan tư pháp/thanh tra.' 
                  : 'Mặc dù hệ thống ghi nhận đã có thông tin giải tỏa, nhưng việc rà soát kỹ lưỡng hồ sơ giấy tờ lưu trữ vật lý vẫn cực kỳ cần thiết để loại trừ các rủi ro phát sinh hoặc sai lệch ngày ban hành.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white text-sm font-bold transition-colors"
          >
            Hủy bỏ (Kiểm tra lại)
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex items-center gap-1 px-5 py-2 text-white rounded-lg text-sm font-bold shadow-sm transition-colors ${
              hasActiveBlocking 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            Tôi đã kiểm tra kỹ, tiếp tục trình ký
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockingWarningModal;
