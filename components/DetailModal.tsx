
import React, { useState, useRef } from 'react';
import { RecordFile, Employee, User, UserRole } from '../types';
import { STATUS_LABELS, getNormalizedWard } from '../constants';
import StatusBadge from './StatusBadge';
import { X, MapPin, Calendar, FileText, User as UserIcon, Info, Phone, Lock, ShieldAlert, Printer, Trash2, Pencil, Loader2 } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees: Employee[];
  currentUser: User | null;
  onEdit?: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, record, employees, currentUser, onEdit, onDelete }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !record) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser?.role === UserRole.ONEDOOR;

  const canPerformAction = isAdmin || isSubadmin; // Điều kiện để Sửa/Xóa
  
  // Điều kiện để In biên nhận: Chỉ Admin hoặc Một cửa mới được thấy nút này
  const canPrintReceipt = isAdmin || isOneDoor;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const getEmployeeName = (id?: string) => {
    if (!id) return 'Chưa giao';
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.name} (${emp.department})` : 'Không xác định';
  };

  const handlePrintReceipt = async () => {
    if (!currentUser) return;
    
    if (!hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
        alert('Chưa có mẫu biên nhận. Vui lòng vào mục "Tiếp nhận hồ sơ" để cấu hình mẫu in trước.');
        return;
    }

    setIsProcessing(true);

    const rDate = record.receivedDate ? new Date(record.receivedDate) : new Date();
    const dDate = record.deadline ? new Date(record.deadline) : new Date();
    
    // --- CẬP NHẬT LOGIC IN BIÊN NHẬN (SỬ DỤNG SỐ NGÀY CỐ ĐỊNH) ---
    // Để tránh lỗi sai lệch khi in lại hồ sơ cũ, ta gán cứng số ngày theo loại hồ sơ
    let standardDays = "30"; // Mặc định
    const type = (record.recordType || '').toLowerCase();

    // Logic tính số ngày
    if (type.includes('trích lục')) {
        standardDays = "10";
    } else if (type.includes('trích đo chỉnh lý')) {
        standardDays = "15"; 
    } else if (type.includes('trích đo') || type.includes('đo đạc') || type.includes('cắm mốc')) {
        standardDays = "30";
    }

    // --- LOGIC XÁC ĐỊNH TP1 (TIÊU ĐỀ PHIẾU) VỚI ĐỊA ĐIỂM ---
    let tp1Value = 'Phiếu yêu cầu';
    // Logic gộp nhóm theo yêu cầu:
    if (type.includes('chỉnh lý') || type.includes('trích đo') || type.includes('trích lục')) {
        tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    } 
    else if (type.includes('đo đạc') || type.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }

    // Thêm tên Xã/Phường vào tiêu đề
    if (record.ward) {
        tp1Value += ` tại ${getNormalizedWard(record.ward)}`;
    }
    
    // --- LOGIC TỰ ĐỘNG SDTLH (SỐ ĐIỆN THOẠI LIÊN HỆ) ---
    let sdtLienHe = "";
    const wRaw = (record.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) {
        sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    } else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) {
        sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    } else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) {
        sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
    }

    const day = rDate.getDate().toString().padStart(2, '0');
    const month = (rDate.getMonth() + 1).toString().padStart(2, '0');
    const year = rDate.getFullYear();
    const dateFullString = `ngày ${day} tháng ${month} năm ${year}`;

    const val = (v: any) => (v === undefined || v === null) ? "" : String(v);

    const printData = {
        code: val(record.code),
        customerName: val(record.customerName),
        receivedDate: rDate.toLocaleDateString('vi-VN'),
        deadline: dDate.toLocaleDateString('vi-VN'),
        currentUser: val(currentUser.name),
        phoneNumber: val(record.phoneNumber),
        cccd: val(record.cccd),
        content: val(record.content),
        address: val(record.address || getNormalizedWard(record.ward)),
        ward: val(getNormalizedWard(record.ward)),
        landPlot: val(record.landPlot),
        mapSheet: val(record.mapSheet),
        area: val(record.area),
        recordType: val(record.recordType),
        otherDocs: val(record.otherDocs),
        authorizedBy: val(record.authorizedBy),
        authDocType: val(record.authDocType),
        
        // Aliases cho template
        MA: val(record.code),
        SO_HS: val(record.code),
        
        // TỰ ĐỘNG VIẾT HOA TÊN NGƯỜI
        TEN: val(record.customerName).toUpperCase(),
        HO_TEN: val(record.customerName).toUpperCase(),
        KHACH_HANG: val(record.customerName).toUpperCase(),
        TEN_CHU_SU_DUNG: val(record.customerName).toUpperCase(),
        
        NGAY_NHAN: rDate.toLocaleDateString('vi-VN'),
        HEN_TRA: dDate.toLocaleDateString('vi-VN'),
        NGAY_HEN: dDate.toLocaleDateString('vi-VN'),
        NGUOI_NHAN: val(currentUser.name),
        CAN_BO: val(currentUser.name),
        SDT: val(record.phoneNumber),
        DIEN_THOAI: val(record.phoneNumber),
        CCCD: val(record.cccd),
        CMND: val(record.cccd),
        NOI_DUNG: val(record.content),
        DIA_CHI: val(record.address || getNormalizedWard(record.ward)),
        DC: val(record.address || getNormalizedWard(record.ward)),
        DIA_CHI_CHI_TIET: val(record.address),
        DC_CT: val(record.address),
        XA: val(getNormalizedWard(record.ward)),
        PHUONG: val(getNormalizedWard(record.ward)),
        XAPHUONG: val(getNormalizedWard(record.ward)),
        TO: val(record.mapSheet),
        THUA: val(record.landPlot),
        DT: val(record.area),
        DIEN_TICH: val(record.area),
        LOAI_HS: val(record.recordType),
        GIAY_TO_KHAC: val(record.otherDocs),
        
        NGUOI_UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        NGUOI_DUOC_UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        LOAI_UY_QUYEN: val(record.authDocType),
        LOAI_GIAY_TO_UY_QUYEN: val(record.authDocType),
        GIAY_UY_QUYEN: val(record.authDocType),
        NGAYNHAN: dateFullString,
        NGAY_THANG_NAM: dateFullString,
        
        // SỐ NGÀY TRẢ KẾT QUẢ
        TGTRA: standardDays, 
        SO_NGAY: standardDays, 

        // TIÊU ĐỀ PHIẾU (MỚI)
        TP1: tp1Value,

        // SỐ ĐIỆN THOẠI LIÊN HỆ THEO XÃ (MỚI)
        SDTLH: sdtLienHe,

        // ĐỊA DANH HÀNH CHÍNH
        TINH: "Bình Phước",
        HUYEN: "thị xã Chơn Thành"
    };

    // Sử dụng hàm async mới
    const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
    
    setIsProcessing(false);

    if (blob) {
        setPreviewBlob(blob);
        setPreviewFileName(`BienNhan_${record.code}`);
        setIsPreviewOpen(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in-up">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                {record.code}
              </span>
              <StatusBadge status={record.status} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">{record.recordType}</h2>
          </div>
          <div className="flex items-center gap-2">
              {canPrintReceipt && (
                  <button 
                    onClick={handlePrintReceipt}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
                    title="In biên nhận cho hồ sơ này"
                  >
                      {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                      {isProcessing ? 'Đang tạo...' : 'In biên nhận'}
                  </button>
              )}
              
              {canPerformAction && onEdit && (
                  <button 
                    onClick={() => { onClose(); onEdit(record); }}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                    title="Chỉnh sửa hồ sơ"
                  >
                    <Pencil size={20} />
                  </button>
              )}
              
              {canPerformAction && onDelete && (
                  <button 
                    onClick={() => { onClose(); onDelete(record); }}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="Xóa hồ sơ"
                  >
                    <Trash2 size={20} />
                  </button>
              )}

              <div className="w-px h-6 bg-gray-300 mx-1"></div>

              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* 1. Thông tin khách hàng */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-l-4 border-blue-500 pl-2">
              <UserIcon size={18} className="text-blue-500" />
              Thông tin chủ hồ sơ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Chủ sử dụng</label>
                <p className="text-base font-medium text-gray-900 mt-1">{record.customerName}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Số điện thoại</label>
                <div className="flex items-center gap-2 mt-1">
                  <Phone size={14} className="text-gray-400" />
                  <p className="text-base font-medium text-gray-900">{record.phoneNumber || '---'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Thông tin địa chính */}
          <section>
             <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-l-4 border-green-500 pl-2">
              <MapPin size={18} className="text-green-500" />
              Thông tin địa chính
            </h3>
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-500 mb-1 block">Xã / Phường</label>
                <div className="font-semibold text-gray-800">{getNormalizedWard(record.ward) || '---'}</div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-500 mb-1 block">Khu vực (Nhóm)</label>
                <div className="font-semibold text-gray-800">{record.group || '---'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tờ bản đồ</label>
                <div className="font-mono font-bold text-gray-800 bg-white inline-block px-2 py-0.5 rounded border">{record.mapSheet || '-'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Thửa đất</label>
                <div className="font-mono font-bold text-gray-800 bg-white inline-block px-2 py-0.5 rounded border">{record.landPlot || '-'}</div>
              </div>
            </div>
          </section>

           {/* 3. Thông tin kỹ thuật & Nội dung */}
           <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-l-4 border-purple-500 pl-2">
                            <FileText size={18} className="text-purple-500" />
                            Nội dung chi tiết
                        </h3>
                        <div className="bg-white p-4 rounded-lg border border-gray-200 min-h-[100px]">
                            <p className="text-gray-700 whitespace-pre-wrap">{record.content || 'Không có ghi chú chi tiết.'}</p>
                            
                            <div className="mt-4 pt-4 border-t flex gap-6">
                                <div>
                                    <span className="text-xs text-gray-500 block">Số trích đo</span>
                                    <span className="font-medium">{record.measurementNumber || '---'}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 block">Số trích lục</span>
                                    <span className="font-medium">{record.excerptNumber || '---'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ghi chú riêng tư (Chỉ hiển thị nếu có) */}
                    {record.privateNotes && (
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-inner">
                        <div className="flex items-center gap-2 mb-2 text-yellow-800 font-bold text-sm">
                            <Lock size={16} />
                            <span>Ghi chú nội bộ</span>
                            <span className="text-[10px] font-normal px-1.5 py-0.5 bg-yellow-200 rounded-full border border-yellow-300">Chỉ quản trị viên</span>
                        </div>
                        <p className="text-yellow-900 text-sm whitespace-pre-wrap italic">
                            "{record.privateNotes}"
                        </p>
                      </div>
                    )}
                </div>

                <div className="md:col-span-1">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-l-4 border-orange-500 pl-2">
                        <Calendar size={18} className="text-orange-500" />
                        Tiến độ & Thời gian
                    </h3>
                    <div className="space-y-4 bg-orange-50 p-4 rounded-lg border border-orange-100">
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                            <span className="text-sm text-gray-600">Ngày tiếp nhận</span>
                            <span className="font-medium text-gray-900">{formatDate(record.receivedDate)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                            <span className="text-sm text-gray-600">Hẹn trả kết quả</span>
                            <span className="font-bold text-blue-700">{formatDate(record.deadline)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                            <span className="text-sm text-gray-600">Ngày giao NV</span>
                            <span className="font-medium text-gray-900">{formatDate(record.assignedDate)}</span>
                        </div>
                        {/* THÊM HIỂN THỊ NGÀY TRÌNH KÝ VÀ NGÀY KÝ DUYỆT */}
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                            <span className="text-sm text-gray-600">Ngày trình ký</span>
                            <span className="font-medium text-purple-700">{formatDate(record.submissionDate)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                            <span className="text-sm text-gray-600">Ngày ký duyệt</span>
                            <span className="font-medium text-indigo-700">{formatDate(record.approvalDate)}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Ngày hoàn thành</span>
                            <span className="font-medium text-green-700">{formatDate(record.completedDate)}</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Người xử lý</h4>
                        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded text-sm font-medium text-gray-700">
                            <UserIcon size={14} />
                            {getEmployeeName(record.assignedTo)}
                        </div>
                    </div>
                </div>
            </div>
           </section>

           {/* Footer Info */}
           {record.exportBatch && (
             <div className="bg-green-50 p-3 rounded text-center text-sm text-green-800 border border-green-200 flex items-center justify-center gap-2">
                <Info size={16} />
                Hồ sơ đã được xuất danh sách <strong>Đợt {record.exportBatch}</strong> vào ngày {formatDate(record.exportDate)}
             </div>
           )}
        </div>
      </div>

      <DocxPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        docxBlob={previewBlob}
        fileName={previewFileName}
      />
    </div>
  );
};

export default DetailModal;
