
import React, { useState, useRef, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, Contract, SplitItem } from '../types';
import { STATUS_LABELS, getNormalizedWard } from '../constants';
import StatusBadge from './StatusBadge';
import { X, MapPin, Calendar, FileText, User as UserIcon, Info, Phone, Lock, ShieldAlert, Printer, Trash2, Pencil, Loader2, StickyNote, Save, Bell, Receipt, DollarSign, CheckCircle2, Circle, Clock, ArrowDown, Send, FileSignature, CheckSquare, CalendarClock, FileCheck, Calculator } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';
import { updateRecordApi, fetchContracts } from '../services/api';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees: Employee[];
  currentUser: User | null;
  onEdit?: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void; 
}

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, record, employees, currentUser, onEdit, onDelete, onCreateLiquidation }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State cho Ghi chú cá nhân
  const [personalNote, setPersonalNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // State cho Nhắc nhở
  const [reminderDate, setReminderDate] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  // State cho giá hợp đồng
  const [contractPrice, setContractPrice] = useState<number | null>(null);
  const [contractSplitItems, setContractSplitItems] = useState<SplitItem[] | null>(null);
  
  // State cho Thanh lý
  const [liquidationInfo, setLiquidationInfo] = useState<{ amount: number, content: string } | null>(null);

  useEffect(() => {
      if (record) {
          setPersonalNote(record.personalNotes || '');
          // Chuyển ISO string sang format datetime-local (yyyy-MM-ddTHH:mm) để hiển thị trong input
          if (record.reminderDate) {
              const d = new Date(record.reminderDate);
              const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
              setReminderDate(localIso);
          } else {
              setReminderDate('');
          }

          // Fetch Contract Price & Details
          const fetchPrice = async () => {
              const contracts = await fetchContracts();
              // Tìm hợp đồng có cùng mã hồ sơ (Case insensitive)
              const match = contracts.find(c => c.code && record.code && c.code.trim().toLowerCase() === record.code.trim().toLowerCase());
              
              if (match) {
                  // FIX: Đảm bảo undefined chuyển thành null để tránh lỗi render
                  setContractPrice(match.totalAmount ?? null);
                  setContractSplitItems(match.splitItems || null);

                  // Kiểm tra và set thông tin thanh lý
                  // Nếu có diện tích thanh lý (đã nhập form thanh lý) hoặc trạng thái completed
                  if (match.liquidationArea || (match.status === 'COMPLETED' && match.totalAmount)) {
                      // LOGIC MỚI: Ưu tiên hiển thị tên dịch vụ cụ thể (serviceType) 
                      // Vì khi thanh lý, người dùng có thể đổi từ Trích lục -> Trích đo (serviceType thay đổi)
                      // Nếu không có serviceType thì mới fallback về contractType
                      let contentLabel = match.serviceType || match.contractType || 'Hồ sơ';
                      
                      // Làm đẹp text hiển thị
                      if (contentLabel === 'Đo đạc tách thửa') contentLabel = 'Tách thửa';

                      setLiquidationInfo({
                          amount: match.totalAmount, // Lấy giá trị tổng (thường là giá sau khi thanh lý)
                          content: `Thanh lý: ${contentLabel}`
                      });
                  } else {
                      setLiquidationInfo(null);
                  }

              } else {
                  // LOGIC MỚI: Nếu không có hợp đồng nhưng là hồ sơ Trích lục -> Hiển thị 53.163
                  const type = (record.recordType || '').toLowerCase();
                  if (type.includes('trích lục')) {
                      setContractPrice(53163);
                  } else {
                      setContractPrice(null);
                  }
                  setContractSplitItems(null);
                  setLiquidationInfo(null);
              }
          };
          fetchPrice();
      }
  }, [record]);

  if (!isOpen || !record) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser?.role === UserRole.ONEDOOR;

  const canPerformAction = isAdmin || isSubadmin || isOneDoor; // Điều kiện để Sửa, Xóa
  
  // Điều kiện để In biên nhận: Chỉ Admin hoặc Một cửa mới được thấy nút này
  const canPrintReceipt = isAdmin || isOneDoor;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const getEmployeeName = (id?: string | null) => {
    if (!id) return 'Chưa giao';
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.name} (${emp.department})` : 'Không xác định';
  };

  const handleSavePersonalNote = async () => {
      setIsSavingNote(true);
      const updatedRecord = { ...record, personalNotes: personalNote };
      const result = await updateRecordApi(updatedRecord);
      setIsSavingNote(false);
      
      if (result) {
          alert('Đã lưu ghi chú cá nhân thành công!');
      } else {
          alert('Lỗi khi lưu ghi chú.');
      }
  };

  const handleSaveReminder = async () => {
      setIsSavingReminder(true);
      
      // Nếu user xóa trắng input -> xóa nhắc nhở
      const newReminderDate = reminderDate ? new Date(reminderDate).toISOString() : null;
      
      // Reset lastRemindedAt khi đặt lịch mới để hệ thống nhắc lại từ đầu
      const updatedRecord = { 
          ...record, 
          reminderDate: newReminderDate as string, 
          lastRemindedAt: null as any 
      };
      
      const result = await updateRecordApi(updatedRecord);
      setIsSavingReminder(false);
      
      if (result) {
          alert('Đã lưu lịch nhắc nhở!');
          // Cập nhật lại record local nếu cần thiết (thường App sẽ auto refresh)
      } else {
          alert('Lỗi khi lưu nhắc nhở.');
      }
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
    
    let standardDays = "30"; 
    const type = (record.recordType || '').toLowerCase();

    // Logic tính số ngày
    if (type.includes('trích lục')) {
        standardDays = "10";
    } else if (type.includes('trích đo chỉnh lý')) {
        standardDays = "15"; 
    } else if (type.includes('trích đo') || type.includes('đo đạc') || type.includes('cắm mốc')) {
        standardDays = "30";
    }

    // Logic Tiêu đề phiếu
    let tp1Value = 'Phiếu yêu cầu';
    if (type.includes('chỉnh lý') || type.includes('trích đo') || type.includes('trích lục')) {
        tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    } 
    else if (type.includes('đo đạc') || type.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }
    if (record.ward) {
        tp1Value += ` tại ${getNormalizedWard(record.ward)}`;
    }
    
    // Logic SĐT Liên hệ tự động
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
    const dateShortString = `${day}/${month}/${year}`;
    
    const dayDead = dDate.getDate().toString().padStart(2, '0');
    const monthDead = (dDate.getMonth() + 1).toString().padStart(2, '0');
    const yearDead = dDate.getFullYear();
    const deadlineFullString = `ngày ${dayDead} tháng ${monthDead} năm ${yearDead}`;
    const deadlineShortString = `${dayDead}/${monthDead}/${yearDead}`;

    const val = (v: any) => (v === undefined || v === null) ? "" : String(v);

    const printData = {
        // --- ENGLISH RAW KEYS (Requested) ---
        code: val(record.code),
        customerName: val(record.customerName),
        landPlot: val(record.landPlot),
        mapSheet: val(record.mapSheet),
        
        // --- VIETNAMESE KEYS (Formatted per request) ---
        XAPHUONG: val(getNormalizedWard(record.ward)),
        
        // NGAYNHAN: ngày tháng năm
        NGAYNHAN: dateFullString,
        
        // NGAY_NHAN: dd/mm/yyyy
        NGAY_NHAN: dateShortString, 
        
        LOAI_GIAY_TO_UY_QUYEN: val(record.authDocType),
        DIA_CHI_CHI_TIET: val(record.address),

        // --- NHÓM THÔNG TIN CƠ BẢN ---
        MA: val(record.code), 
        SO_HS: val(record.code), 
        MA_HO_SO: val(record.code),
        CODE: val(record.code),

        // --- NHÓM CHỦ SỬ DỤNG ---
        TEN: val(record.customerName).toUpperCase(), 
        HO_TEN: val(record.customerName).toUpperCase(),
        CHU_SU_DUNG: val(record.customerName).toUpperCase(),
        KHACH_HANG: val(record.customerName).toUpperCase(),
        ONG_BA: val(record.customerName).toUpperCase(),

        // --- NHÓM LIÊN HỆ ---
        SDT: val(record.phoneNumber), 
        DIEN_THOAI: val(record.phoneNumber),
        PHONE: val(record.phoneNumber),
        CCCD: val(record.cccd), 
        CMND: val(record.cccd),

        // --- NHÓM ĐỊA CHỈ ---
        DIA_CHI: val(record.address || getNormalizedWard(record.ward)),
        DC: val(record.address || getNormalizedWard(record.ward)),
        ADDRESS: val(record.address || getNormalizedWard(record.ward)),
        XA: val(getNormalizedWard(record.ward)), 
        PHUONG: val(getNormalizedWard(record.ward)),
        WARD: val(getNormalizedWard(record.ward)),
        
        // --- NHÓM THỬA ĐẤT ---
        TO: val(record.mapSheet), 
        SO_TO: val(record.mapSheet),
        THUA: val(record.landPlot), 
        SO_THUA: val(record.landPlot),
        DT: val(record.area), 
        DIEN_TICH: val(record.area),
        
        // --- NHÓM NGÀY THÁNG (ALIASES) ---
        NGAY_NHAN_FULL: dateFullString,
        NGAY: day, 
        THANG: month, 
        NAM: year,
        RECEIVED_DATE: dateShortString,
        
        HEN_TRA: deadlineShortString, 
        NGAY_HEN: deadlineShortString,
        DEADLINE: deadlineShortString,
        HEN_TRA_FULL: deadlineFullString,
        NGAY_HEN_FULL: deadlineFullString,
        
        // --- NHÓM CÁN BỘ ---
        NGUOI_NHAN: val(currentUser?.name), 
        CAN_BO: val(currentUser?.name),
        USER: val(currentUser?.name),
        
        // --- NHÓM NỘI DUNG ---
        NOI_DUNG: val(record.content),
        CONTENT: val(record.content),
        LOAI_HS: val(record.recordType), 
        RECORD_TYPE: val(record.recordType),
        GIAY_TO_KHAC: val(record.otherDocs),
        
        // --- NHÓM ỦY QUYỀN ---
        NGUOI_UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        LOAI_UY_QUYEN: val(record.authDocType),
        
        // --- CẤU HÌNH ---
        TGTRA: standardDays, 
        SO_NGAY: standardDays,
        TP1: tp1Value, 
        TIEU_DE: tp1Value,
        SDTLH: sdtLienHe, 
        TINH: "Bình Phước", 
        HUYEN: "thị xã Chơn Thành"
    };

    const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
    
    setIsProcessing(false);

    if (blob) {
        setPreviewBlob(blob);
        setPreviewFileName(`BienNhan_${record.code}`);
        setIsPreviewOpen(true);
    }
  };

  // Helper cho Timeline
  const TimelineItem = ({ date, label, icon: Icon, isLast, colorClass }: any) => (
      <div className="relative flex gap-4">
          <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white ${date ? colorClass.border : 'border-gray-200'}`}>
                  {date ? <CheckCircle2 size={16} className={colorClass.text} /> : <Circle size={16} className="text-gray-300" />}
              </div>
              {!isLast && <div className={`w-0.5 grow ${date ? colorClass.bg : 'bg-gray-100'} my-1`}></div>}
          </div>
          <div className={`pb-6 ${!isLast ? '' : ''}`}>
              <p className={`text-xs font-bold uppercase mb-0.5 ${date ? colorClass.text : 'text-gray-400'}`}>{label}</p>
              <div className="flex items-center gap-2">
                  <Icon size={14} className={date ? 'text-gray-500' : 'text-gray-300'} />
                  <span className={`text-sm font-medium ${date ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                      {formatDate(date) || 'Chưa thực hiện'}
                  </span>
              </div>
          </div>
      </div>
  );

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
              {/* Nút Thanh lý Hợp đồng */}
              {onCreateLiquidation && (
                  <button
                      onClick={() => { onClose(); onCreateLiquidation(record); }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors shadow-sm text-sm font-medium"
                      title="Chuyển sang thanh lý hợp đồng"
                  >
                      <FileCheck size={16} /> Thanh lý HĐ
                  </button>
              )}

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
          {/* ... Phần hiển thị chi tiết (Giữ nguyên) ... */}
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

                            {/* Cập nhật: Số biên lai và Giá tiền */}
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200 grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <Receipt size={16} className="text-blue-500" />
                                    <div>
                                        <span className="text-xs text-gray-500 block">Số biên lai</span>
                                        <span className="font-mono font-bold text-blue-700">{record.receiptNumber || '---'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DollarSign size={16} className="text-green-600" />
                                    <div>
                                        {/* SỬA NHÃN THEO YÊU CẦU */}
                                        <span className="text-xs text-gray-500 block">Giá trị hợp đồng</span>
                                        {/* FIX: Check !== null && !== undefined explicitly */}
                                        <span className="font-mono font-bold text-green-700">
                                            {contractPrice !== null && contractPrice !== undefined ? contractPrice.toLocaleString('vi-VN') + ' đ' : '---'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* MỚI: PHẦN HIỂN THỊ GIÁ TRỊ THANH LÝ */}
                            {liquidationInfo && (
                                <div className="mt-3 pt-3 border-t border-dashed border-gray-200 bg-orange-50/50 p-2 rounded-lg border border-orange-100">
                                    <div className="flex items-center gap-2">
                                        <Calculator size={16} className="text-orange-600" />
                                        <div>
                                            <span className="text-xs text-orange-600 font-bold uppercase block">Giá trị thanh lý</span>
                                            <span className="font-mono font-bold text-orange-800 text-lg">
                                                {liquidationInfo.amount.toLocaleString('vi-VN')} đ
                                            </span>
                                            <span className="text-[10px] text-orange-500 block italic font-medium mt-0.5">
                                                ({liquidationInfo.content})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Chi tiết tách thửa nếu có */}
                            {contractSplitItems && contractSplitItems.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                                    <span className="text-xs font-bold text-gray-500 block mb-2 uppercase">Chi tiết tách thửa:</span>
                                    <div className="space-y-1.5">
                                        {contractSplitItems.map((item, idx) => (
                                            <div key={idx} className="text-xs flex justify-between bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="text-gray-700">
                                                    <span className="font-bold text-blue-600 mr-1">Thửa {idx + 1}:</span> 
                                                    Diện tích: <span className="font-bold">{item.area || 0} m²</span>
                                                    {item.serviceName ? <span className="text-gray-500 ml-1 italic">- {item.serviceName}</span> : ''}
                                                </span>
                                                <span className="font-mono font-bold text-green-700">
                                                    {/* FIX: Thêm fallback 0 cho phép nhân */}
                                                    Thành tiền: {((item.price || 0) * (item.quantity || 0)).toLocaleString('vi-VN')} đ
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ghi chú cá nhân */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-inner">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                                <StickyNote size={16} />
                                <span>Ghi chú cá nhân (Của bạn)</span>
                            </div>
                            <button 
                                onClick={handleSavePersonalNote} 
                                disabled={isSavingNote}
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSavingNote ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Lưu ghi chú
                            </button>
                        </div>
                        <textarea
                            rows={3}
                            className="w-full bg-white border border-blue-300 rounded p-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="Nhập ghi chú riêng của bạn về hồ sơ này..."
                            value={personalNote}
                            onChange={(e) => setPersonalNote(e.target.value)}
                        />
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

                <div className="md:col-span-1 space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Header Timeline */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                            <h3 className="font-bold flex items-center gap-2 text-sm">
                                <CalendarClock size={18} /> Tiến độ & Thời gian
                            </h3>
                        </div>
                        
                        {/* Highlight Card: Deadline */}
                        <div className="p-4 bg-blue-50 border-b border-blue-100 flex flex-col items-center justify-center gap-1 text-center">
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Hạn trả kết quả</span>
                            <span className="text-lg font-black text-blue-800">{formatDate(record.deadline)}</span>
                            <div className="text-[10px] text-blue-500 font-medium">
                                Ngày nhận: {formatDate(record.receivedDate)}
                            </div>
                        </div>

                        {/* Timeline Body */}
                        <div className="p-5 pl-6">
                            <TimelineItem 
                                date={record.assignedDate} 
                                label="Giao nhân viên" 
                                icon={UserIcon}
                                colorClass={{text: 'text-blue-700', border: 'border-blue-600', bg: 'bg-blue-600'}}
                            />
                            <TimelineItem 
                                date={record.submissionDate} 
                                label="Trình ký" 
                                icon={Send}
                                colorClass={{text: 'text-purple-700', border: 'border-purple-600', bg: 'bg-purple-600'}}
                            />
                            <TimelineItem 
                                date={record.approvalDate} 
                                label="Ký duyệt" 
                                icon={FileSignature}
                                colorClass={{text: 'text-indigo-700', border: 'border-indigo-600', bg: 'bg-indigo-600'}}
                            />
                            <TimelineItem 
                                date={record.completedDate} 
                                label="Hoàn thành" 
                                icon={CheckSquare}
                                colorClass={{text: 'text-green-700', border: 'border-green-600', bg: 'bg-green-600'}}
                            />
                            <TimelineItem 
                                date={record.resultReturnedDate} 
                                label="Trả kết quả" 
                                icon={FileCheck}
                                isLast={true}
                                colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                            />
                        </div>
                    </div>

                    {/* PHẦN HẸN GIỜ NHẮC VIỆC */}
                    <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold text-pink-700 uppercase flex items-center gap-2">
                                <Bell size={14} /> Hẹn giờ nhắc việc
                            </h4>
                            <button 
                                onClick={handleSaveReminder} 
                                disabled={isSavingReminder}
                                className="text-[10px] bg-pink-600 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-pink-700 disabled:opacity-50"
                            >
                                {isSavingReminder ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Lưu
                            </button>
                        </div>
                        <input 
                            type="datetime-local" 
                            className="w-full border border-pink-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-pink-500"
                            value={reminderDate}
                            onChange={(e) => setReminderDate(e.target.value)}
                        />
                        <p className="text-[10px] text-pink-600 mt-2 italic leading-tight">
                            * Hệ thống sẽ gửi thông báo khi đến giờ hẹn. Sẽ nhắc lại mỗi 2 giờ nếu hồ sơ chưa được xử lý xong.
                        </p>
                    </div>

                    <div className="mt-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Người xử lý</h4>
                        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded text-sm font-medium text-gray-700">
                            <UserIcon size={14} />
                            {getEmployeeName(record.assignedTo)}
                        </div>
                    </div>
                </div>
            </div>
           </section>

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
