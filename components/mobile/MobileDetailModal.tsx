
import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, SplitItem, RecordStatus } from '../../types';
import { getNormalizedWard, getFullWard } from '../../constants';
import StatusBadge from '../StatusBadge';
import { 
  X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, 
  CheckCircle2, Circle, Send, FileSignature, CheckSquare, 
  CalendarClock, FileCheck, Calculator, Loader2, StickyNote, 
  Save, Bell, Printer, Pencil, Trash2, Info, ChevronLeft,
  Phone, Calendar, Hash
} from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../../services/docxService';
import DocxPreviewModal from '../DocxPreviewModal';
import SystemReceiptTemplate from '../SystemReceiptTemplate';
import { updateRecordApi, fetchContracts } from '../../services/api';

interface MobileDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees: Employee[];
  currentUser: User | null;
  onEdit?: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void; 
}

export const MobileDetailModal: React.FC<MobileDetailModalProps> = ({ 
  isOpen, onClose, record, employees, currentUser, onEdit, onDelete, onCreateLiquidation 
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showSystemReceipt, setShowSystemReceipt] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [personalNote, setPersonalNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [contractPrice, setContractPrice] = useState<number | null>(null);
  const [contractSplitItems, setContractSplitItems] = useState<SplitItem[] | null>(null);
  const [liquidationInfo, setLiquidationInfo] = useState<{ amount: number, content: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'notes'>('info');

  useEffect(() => {
    if (record) {
      setPersonalNote(record.personalNotes || '');
      if (record.reminderDate) {
        const d = new Date(record.reminderDate);
        const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setReminderDate(localIso);
      } else {
        setReminderDate('');
      }

      const fetchPrice = async () => {
        const contracts = await fetchContracts();
        const match = contracts.find(c => c.code && record.code && c.code.trim().toLowerCase() === record.code.trim().toLowerCase());
        
        if (match) {
          setContractPrice(match.totalAmount ?? null);
          setContractSplitItems(match.splitItems || null);
          if (match.liquidationAmount !== null && match.liquidationAmount !== undefined) {
            let liquidationLabel = 'Thanh lý hợp đồng';
            const cType = (match.contractType || '').toLowerCase();
            const sType = (match.serviceType || '').toLowerCase();
            if (cType.includes('trích lục') || sType.includes('trích lục')) liquidationLabel = 'Thanh lý trích lục';
            else if (cType.includes('cắm mốc') || sType.includes('cắm mốc')) liquidationLabel = 'Thanh lý cắm mốc';
            else if (cType.includes('tách thửa') || sType.includes('tách thửa')) liquidationLabel = 'Thanh lý tách thửa';
            else if (cType.includes('đo đạc') || sType.includes('đo đạc')) liquidationLabel = 'Thanh lý đo đạc';
            setLiquidationInfo({ amount: match.liquidationAmount, content: liquidationLabel });
          } else {
            setLiquidationInfo(null);
          }
        } else {
          const type = (record.recordType || '').toLowerCase();
          if (type.includes('trích lục')) setContractPrice(53163);
          else setContractPrice(null);
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
  const canPerformAction = isAdmin || isSubadmin || isOneDoor;
  const canPrintReceipt = isAdmin || isOneDoor;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  const getEmployeeName = (id?: string | null) => {
    if (!id) return 'Chưa giao';
    const emp = employees.find(e => e.id === id);
    return emp ? emp.name : 'Không xác định';
  };

  const handleSavePersonalNote = async () => {
    setIsSavingNote(true);
    const result = await updateRecordApi({ ...record, personalNotes: personalNote });
    setIsSavingNote(false);
    alert(result ? 'Đã lưu ghi chú!' : 'Lỗi khi lưu.');
  };

  const handleSaveReminder = async () => {
    setIsSavingReminder(true);
    const newReminderDate = reminderDate ? new Date(reminderDate).toISOString() : null;
    const result = await updateRecordApi({ ...record, reminderDate: newReminderDate as string, lastRemindedAt: null as any });
    setIsSavingReminder(false);
    alert(result ? 'Đã lưu nhắc nhở!' : 'Lỗi khi lưu.');
  };

  const handlePrintReceipt = async () => {
    if (!currentUser) {
      return;
    }
    setIsProcessing(true);
    const rDate = record.receivedDate ? new Date(record.receivedDate) : new Date();
    const dDate = record.deadline ? new Date(record.deadline) : new Date();
    
    let standardDays = "30"; 
    const type = (record.recordType || '').toLowerCase();
    if (type.includes('trích lục')) standardDays = "10";
    else if (type.includes('trích đo chỉnh lý')) standardDays = "15"; 
    else if (type.includes('trích đo') || type.includes('đo đạc') || type.includes('cắm mốc')) standardDays = "30";

    let tp1Value = 'Phiếu yêu cầu';
    if (type.includes('chỉnh lý') || type.includes('trích đo') || type.includes('trích lục')) tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    else if (type.includes('đo đạc') || type.includes('cắm mốc')) tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    
    let sdtLienHe = "";
    const wRaw = (record.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";

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
        code: val(record.code),
        customerName: val(record.customerName),
        landPlot: val(record.landPlot),
        mapSheet: val(record.mapSheet),
        XAPHUONG: val(getNormalizedWard(record.ward)),
        NGAYNHAN: dateFullString,
        NGAY_NHAN: dateShortString, 
        LOAI_GIAY_TO_UY_QUYEN: val(record.authDocType),
        DIA_CHI_CHI_TIET: val(record.address),
        MA: val(record.code), 
        SO_HS: val(record.code), 
        MA_HO_SO: val(record.code),
        CODE: val(record.code),
        TEN: val(record.customerName).toUpperCase(), 
        HO_TEN: val(record.customerName).toUpperCase(),
        CHU_SU_DUNG: val(record.customerName).toUpperCase(),
        KHACH_HANG: val(record.customerName).toUpperCase(),
        ONG_BA: val(record.customerName).toUpperCase(),
        SDT: val(record.phoneNumber), 
        DIEN_THOAI: val(record.phoneNumber),
        PHONE: val(record.phoneNumber),
        CCCD: val(record.cccd), 
        CMND: val(record.cccd),
        DIA_CHI: val(record.address || getFullWard(record.ward)),
        DC: val(record.address || getFullWard(record.ward)),
        ADDRESS: val(record.address || getFullWard(record.ward)),
        XA: val(getFullWard(record.ward)).toUpperCase(), 
        PHUONG: val(getFullWard(record.ward)).toUpperCase(),
        WARD: val(getFullWard(record.ward)).toUpperCase(),
        TO: val(record.mapSheet), 
        SO_TO: val(record.mapSheet),
        THUA: val(record.landPlot), 
        SO_THUA: val(record.landPlot),
        DT: val(record.area), 
        DIEN_TICH: val(record.area),
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
        NGUOI_NHAN: val(currentUser?.name), 
        CAN_BO: val(currentUser?.name),
        USER: val(currentUser?.name),
        NOI_DUNG: val(record.content),
        CONTENT: val(record.content),
        LOAI_HS: val(record.recordType), 
        RECORD_TYPE: val(record.recordType),
        GIAY_TO_KHAC: val(record.otherDocs),
        NGUOI_UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        LOAI_UY_QUYEN: val(record.authDocType),
        TGTRA: standardDays, 
        SO_NGAY: standardDays,
        TP1: tp1Value, 
        TIEU_DE: tp1Value,
        SDTLH: sdtLienHe, 
        TINH: "Bình Phước", 
        HUYEN: "thị xã Chơn Thành",
        NHAN_KET_QUA_TAI: `Trung tâm dịch vụ hành chính công ${getFullWard(record.ward).replace(/^Phường /i, 'phường ').replace(/^Xã /i, 'xã ')}`
    };

    if (hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
        const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
        setIsProcessing(false);
        if (blob) {
            setPreviewBlob(blob);
            setPreviewFileName(`BienNhan_${record.code}`);
            setIsPreviewOpen(true);
        }
    } else {
        setIsProcessing(false);
        setShowSystemReceipt(true);
    }
  };

  const TimelineItem = ({ date, label, icon: Icon, isLast, colorClass, forceActive }: any) => {
    const isActive = !!date || !!forceActive;
    return (
      <div className="relative flex gap-4">
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isActive ? colorClass.border : 'border-gray-200'}`}>
            {isActive ? <CheckCircle2 size={16} className={colorClass.text} /> : <Circle size={16} className="text-gray-300" />}
          </div>
          {!isLast && <div className={`w-0.5 grow ${isActive ? colorClass.bg : 'bg-gray-100'} my-1`}></div>}
        </div>
        <div className="pb-6 flex-1">
          <p className={`text-[10px] font-bold uppercase mb-0.5 ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
          <div className="flex items-center gap-2">
            <Icon size={14} className={isActive ? 'text-gray-500' : 'text-gray-300'} />
            <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
              {date ? formatDate(date) : (forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const isWorkDone = [
    RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, 
    RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status);

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 -ml-1 text-slate-500 active:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="font-bold text-slate-800 text-sm truncate max-w-[180px]">{record.customerName}</h2>
            <p className="text-[10px] text-slate-400 font-mono">{record.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canPerformAction && onEdit && (
            <button onClick={() => { onClose(); onEdit(record); }} className="p-2 text-slate-400 active:text-blue-600">
              <Pencil size={20} />
            </button>
          )}
          {canPerformAction && onDelete && (
            <button onClick={() => { onClose(); onDelete(record); }} className="p-2 text-slate-400 active:text-red-600">
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-white sticky top-[53px] z-10">
        <button 
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'info' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
        >
          Thông tin
        </button>
        <button 
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'timeline' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
        >
          Tiến độ
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'notes' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
        >
          Ghi chú
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 pb-24">
        {activeTab === 'info' && (
          <div className="p-4 space-y-4">
            {/* Status & Type */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</span>
                <StatusBadge status={record.status} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Loại hồ sơ</p>
                  <p className="text-sm font-bold text-slate-800">{record.recordType}</p>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                <UserIcon size={16} /> Thông tin khách hàng
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <UserIcon size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Họ và tên</p>
                    <p className="text-sm font-bold text-slate-800">{record.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Số điện thoại</p>
                    <p className="text-sm font-bold text-slate-800">{record.phoneNumber || '---'}</p>
                  </div>
                </div>
                {record.cccd && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                      <Hash size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">CCCD/CMND</p>
                      <p className="text-sm font-bold text-slate-800">{record.cccd}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Land Info */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-green-600 uppercase flex items-center gap-2">
                <MapPin size={16} /> Thông tin thửa đất
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Xã/Phường</p>
                    <p className="text-sm font-bold text-slate-800">{getNormalizedWard(record.ward)}</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Tờ bản đồ</p>
                  <p className="text-base font-bold text-slate-800">{record.mapSheet || '-'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Thửa đất</p>
                  <p className="text-base font-bold text-slate-800">{record.landPlot || '-'}</p>
                </div>
              </div>
              {record.address && (
                <div className="pt-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Địa chỉ chi tiết</p>
                  <p className="text-sm font-medium text-slate-700">{record.address}</p>
                </div>
              )}
            </div>

            {/* Financial Info */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-orange-600 uppercase flex items-center gap-2">
                <DollarSign size={16} /> Tài chính & Biên lai
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-blue-600" />
                    <span className="text-xs font-bold text-blue-700">Số biên lai</span>
                  </div>
                  <span className="text-sm font-bold text-blue-800">{record.receiptNumber || '---'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-green-600" />
                    <span className="text-xs font-bold text-green-700">Giá trị HĐ</span>
                  </div>
                  <span className="text-sm font-bold text-green-800">
                    {contractPrice !== null ? contractPrice.toLocaleString('vi-VN') + ' đ' : '---'}
                  </span>
                </div>
                {liquidationInfo && (
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-2">
                      <Calculator size={16} className="text-orange-600" />
                      <span className="text-xs font-bold text-orange-700">{liquidationInfo.content}</span>
                    </div>
                    <span className="text-sm font-bold text-orange-800">{liquidationInfo.amount.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="p-4 space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex flex-col items-center text-center mb-8 pb-6 border-b border-slate-50">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Hạn trả kết quả</p>
                <p className="text-3xl font-black text-slate-800">{formatDate(record.deadline)}</p>
                <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full">
                  <Calendar size={12} /> Ngày nhận: {formatDate(record.receivedDate)}
                </div>
              </div>

              <div className="space-y-0">
                <TimelineItem 
                  date={record.assignedDate} 
                  label="GIAO NHÂN VIÊN" 
                  icon={UserIcon}
                  colorClass={{text: 'text-blue-600', border: 'border-blue-600', bg: 'bg-blue-600'}}
                />
                <TimelineItem 
                  date={null} 
                  forceActive={isWorkDone}
                  label="ĐÃ THỰC HIỆN" 
                  icon={CheckSquare}
                  colorClass={{text: 'text-cyan-600', border: 'border-cyan-600', bg: 'bg-cyan-600'}}
                />
                <TimelineItem 
                  date={record.submissionDate} 
                  label="TRÌNH KÝ" 
                  icon={Send}
                  colorClass={{text: 'text-purple-600', border: 'border-purple-600', bg: 'bg-purple-600'}}
                />
                <TimelineItem 
                  date={record.approvalDate} 
                  label="KÝ DUYỆT" 
                  icon={FileSignature}
                  colorClass={{text: 'text-indigo-600', border: 'border-indigo-600', bg: 'bg-indigo-600'}}
                />
                <TimelineItem 
                  date={record.completedDate} 
                  label="HOÀN THÀNH" 
                  icon={CheckSquare}
                  colorClass={{text: 'text-green-600', border: 'border-green-600', bg: 'bg-green-600'}}
                />
                <TimelineItem 
                  date={record.resultReturnedDate} 
                  label="TRẢ KẾT QUẢ" 
                  icon={FileCheck}
                  isLast={true}
                  colorClass={{text: 'text-emerald-600', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <UserIcon size={24} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Nhân viên xử lý</p>
                <p className="text-sm font-bold text-slate-800">{getEmployeeName(record.assignedTo)}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="p-4 space-y-4">
            {/* Reminder */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                  <Bell size={16} /> Nhắc nhở công việc
                </h3>
                <button 
                  onClick={handleSaveReminder} 
                  disabled={isSavingReminder}
                  className="text-[10px] bg-blue-600 text-white px-4 py-2 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingReminder ? <Loader2 size={12} className="animate-spin" /> : 'Lưu'}
                </button>
              </div>
              <input 
                type="datetime-local" 
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
              />
            </div>

            {/* Personal Note */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                  <StickyNote size={16} /> Ghi chú cá nhân
                </h3>
                <button 
                  onClick={handleSavePersonalNote} 
                  disabled={isSavingNote}
                  className="text-[10px] bg-blue-600 text-white px-4 py-2 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingNote ? <Loader2 size={12} className="animate-spin" /> : 'Lưu'}
                </button>
              </div>
              <textarea
                rows={5}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Nhập ghi chú riêng của bạn..."
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
              />
            </div>

            {/* Private Notes (Read only) */}
            {record.privateNotes && (
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
                <div className="flex items-center gap-2 mb-2 text-yellow-800 font-bold text-xs uppercase">
                  <Info size={14} />
                  <span>Ghi chú nội bộ</span>
                </div>
                <p className="text-yellow-900 text-xs italic leading-relaxed">"{record.privateNotes}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-slate-100 p-4 sticky bottom-0 z-10 flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        {canPrintReceipt && (
          <button 
            onClick={handlePrintReceipt}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
            In biên nhận
          </button>
        )}
        {onCreateLiquidation && (
          <button
            onClick={() => { onClose(); onCreateLiquidation(record); }}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm active:scale-95 transition-all"
          >
            <FileCheck size={18} /> Thanh lý
          </button>
        )}
      </div>

      <DocxPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        docxBlob={previewBlob}
        fileName={previewFileName}
      />
      {showSystemReceipt && (
          <SystemReceiptTemplate
              data={record}
              receivingWard={record.ward || ''}
              onClose={() => setShowSystemReceipt(false)}
          />
      )}
    </div>
  );
};
