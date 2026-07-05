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
              <div key={`active-${idx}`} className="border border-red-200 rounded-lg overflow-hidden shadow-sm bg-white animate-fade-in">
                <div className="bg-red-50 px-4 py-2.5 border-b border-red-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-red-700 uppercase flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-red-600 animate-pulse" /> NGĂN CHẶN ĐANG CÓ HIỆU LỰC ({match.source === 'archive' ? 'TRONG LƯU TRỮ' : 'HIỆN HÀNH'})
                  </span>
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-mono font-medium">Bản ghi #{match.record.id?.substring(0, 8)}</span>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* 1. CHỦ SỬ DỤNG */}
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1.5 border-b border-slate-100 pb-1.5">
                      <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                        <User size={16} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">1. Chủ sử dụng</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 pl-8">
                      {match.record.owners?.join(', ') || 'Chưa rõ / Không có thông tin'}
                    </p>
                  </div>

                  {/* 2. GIẤY CHỨNG NHẬN */}
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1.5 border-b border-slate-100 pb-1.5">
                      <div className="p-1 rounded-md bg-amber-50 text-amber-600">
                        <FileText size={16} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">2. Giấy chứng nhận</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8 text-sm text-slate-700">
                      <div>
                        <span className="text-slate-400 font-medium">Số GCN:</span>{' '}
                        <span className="font-bold text-slate-800">{match.record.issueNumber || '---'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Số vào sổ:</span>{' '}
                        <span className="font-bold text-slate-800">{match.record.certNumber || '---'}</span>
                      </div>
                      {match.record.issueDate && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 font-medium">Ngày cấp:</span>{' '}
                          <span className="font-semibold text-slate-800">{match.record.issueDate}</span>
                        </div>
                      )}
                      {match.record.plots && match.record.plots.length > 0 && (
                        <div className="sm:col-span-2 mt-1">
                          <span className="text-slate-400 font-medium block mb-1">Thông tin thửa đất ngăn chặn:</span>
                          <div className="space-y-1">
                            {match.record.plots.map((p, pIdx) => (
                              <div key={pIdx} className="bg-slate-100/70 p-1.5 rounded text-xs font-medium text-slate-700">
                                • Tờ bản đồ:{' '}
                                <span className="font-bold text-blue-700">{p.oldMapSheetNumber || p.newMapSheetNumber || '---'}</span>
                                {' '}/{' '}
                                Thửa số:{' '}
                                <span className="font-bold text-blue-700">{p.oldPlotNumber || p.newPlotNumber || '---'}</span>
                                {p.oldArea || p.newArea ? ` (${p.oldArea || p.newArea} m²)` : ''}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. THÔNG TIN NGĂN CHẶN */}
                  <div className="border border-red-100 rounded-lg p-3 bg-red-50/20">
                    <div className="flex items-center gap-2 mb-2 border-b border-red-100 pb-1.5">
                      <div className="p-1 rounded-md bg-red-50 text-red-600">
                        <ShieldAlert size={16} />
                      </div>
                      <span className="text-xs font-bold text-red-700 uppercase tracking-wider">3. Thông tin ngăn chặn</span>
                    </div>
                    <div className="pl-8 space-y-2">
                      {match.record.blockingDocuments && match.record.blockingDocuments.length > 0 ? (
                        match.record.blockingDocuments.map((doc, dIdx) => (
                          <div key={dIdx} className="bg-red-50/50 border border-red-100 p-2.5 rounded text-xs text-red-900">
                            <p className="font-bold text-red-800 flex items-center gap-1">
                              📄 Văn bản số: {doc.docNumber || '---'}
                            </p>
                            <p className="mt-1"><strong className="text-red-700">Ngày ban hành:</strong> {doc.date || '---'}</p>
                            <p><strong className="text-red-700">Cơ quan ngăn chặn:</strong> {doc.agency || '---'}</p>
                            <p className="mt-1.5 pt-1.5 border-t border-red-100/50 italic text-slate-700 font-medium">
                              Nội dung ngăn chặn: {doc.note || 'Không có chi tiết'}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic">Không có chi tiết văn bản ngăn chặn chính thức</p>
                      )}
                      
                      {match.record.notes && (
                        <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                          <strong className="text-slate-600 block mb-0.5">Ghi chú bổ sung hệ thống:</strong>
                          <p className="text-slate-700 italic">{match.record.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {resolvedBlockings.map((match, idx) => (
              <div key={`resolved-${idx}`} className="border border-amber-200 rounded-lg overflow-hidden shadow-sm bg-white animate-fade-in">
                <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-green-600" /> THỬA ĐẤT ĐÃ CÓ VĂN BẢN GIẢI TỎA ({match.source === 'archive' ? 'TRONG LƯU TRỮ' : 'HIỆN HÀNH'})
                  </span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono font-medium">Bản ghi #{match.record.id?.substring(0, 8)}</span>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* 1. CHỦ SỬ DỤNG */}
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1.5 border-b border-slate-100 pb-1.5">
                      <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                        <User size={16} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">1. Chủ sử dụng</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 pl-8">
                      {match.record.owners?.join(', ') || 'Chưa rõ / Không có thông tin'}
                    </p>
                  </div>

                  {/* 2. GIẤY CHỨNG NHẬN */}
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1.5 border-b border-slate-100 pb-1.5">
                      <div className="p-1 rounded-md bg-amber-50 text-amber-600">
                        <FileText size={16} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">2. Giấy chứng nhận</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8 text-sm text-slate-700">
                      <div>
                        <span className="text-slate-400 font-medium">Số GCN:</span>{' '}
                        <span className="font-bold text-slate-800">{match.record.issueNumber || '---'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Số vào sổ:</span>{' '}
                        <span className="font-bold text-slate-800">{match.record.certNumber || '---'}</span>
                      </div>
                      {match.record.issueDate && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 font-medium">Ngày cấp:</span>{' '}
                          <span className="font-semibold text-slate-800">{match.record.issueDate}</span>
                        </div>
                      )}
                      {match.record.plots && match.record.plots.length > 0 && (
                        <div className="sm:col-span-2 mt-1">
                          <span className="text-slate-400 font-medium block mb-1">Thông tin thửa đất ngăn chặn:</span>
                          <div className="space-y-1">
                            {match.record.plots.map((p, pIdx) => (
                              <div key={pIdx} className="bg-slate-100/70 p-1.5 rounded text-xs font-medium text-slate-700">
                                • Tờ bản đồ:{' '}
                                <span className="font-bold text-blue-700">{p.oldMapSheetNumber || p.newMapSheetNumber || '---'}</span>
                                {' '}/{' '}
                                Thửa số:{' '}
                                <span className="font-bold text-blue-700">{p.oldPlotNumber || p.newPlotNumber || '---'}</span>
                                {p.oldArea || p.newArea ? ` (${p.oldArea || p.newArea} m²)` : ''}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. THÔNG TIN NGĂN CHẶN & GIẢI TỎA */}
                  <div className="border border-green-100 rounded-lg p-3 bg-green-50/10">
                    <div className="flex items-center gap-2 mb-2 border-b border-green-100 pb-1.5">
                      <div className="p-1 rounded-md bg-green-50 text-green-600">
                        <CheckCircle2 size={16} />
                      </div>
                      <span className="text-xs font-bold text-green-700 uppercase tracking-wider">3. Thông tin ngăn chặn & Giải tỏa</span>
                    </div>
                    
                    <div className="pl-8 space-y-3">
                      {/* Quyết định giải tỏa */}
                      <div className="bg-green-50 border border-green-100 p-2.5 rounded text-xs text-green-900">
                        <p className="font-bold text-green-800 flex items-center gap-1.5">
                          ✅ ĐÃ GIẢI TỎA THEO VĂN BẢN
                        </p>
                        <p className="mt-1"><strong className="text-green-700">Văn bản giải tỏa:</strong> {match.record.unblockDoc || '---'}</p>
                        {match.record.unblockDate && <p><strong className="text-green-700">Ngày giải tỏa:</strong> {match.record.unblockDate}</p>}
                        {match.record.unblockContent && (
                          <p className="mt-1.5 pt-1.5 border-t border-green-100 italic text-slate-700 font-medium">
                            Nội dung giải tỏa: {match.record.unblockContent}
                          </p>
                        )}
                      </div>

                      {/* Lịch sử ngăn chặn trước đó */}
                      <div className="bg-slate-50 border border-slate-100 p-2.5 rounded text-xs text-slate-600">
                        <p className="font-semibold text-slate-700 mb-1.5">Lịch sử văn bản ngăn chặn gốc:</p>
                        {match.record.blockingDocuments && match.record.blockingDocuments.length > 0 ? (
                          match.record.blockingDocuments.map((doc, dIdx) => (
                            <div key={dIdx} className="pl-2 border-l border-slate-300 mb-1 last:mb-0">
                              <p>• Văn bản số: <span className="font-semibold text-slate-800">{doc.docNumber || '---'}</span> {doc.date ? `ngày ${doc.date}` : ''} ({doc.agency || 'Cơ quan chưa rõ'})</p>
                              {doc.note && <p className="italic text-slate-500">Nội dung: {doc.note}</p>}
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 italic">Không có chi tiết văn bản ngăn chặn gốc</p>
                        )}
                      </div>
                      
                      {match.record.notes && (
                        <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                          <strong className="text-slate-600 block mb-0.5">Ghi chú bổ sung hệ thống:</strong>
                          <p className="text-slate-700 italic">{match.record.notes}</p>
                        </div>
                      )}
                    </div>
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
