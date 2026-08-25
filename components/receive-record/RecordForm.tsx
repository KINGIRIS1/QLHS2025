
import React, { useState, useEffect, useRef } from 'react';
import { RecordFile, Holiday, RecordStatus, User, Employee } from '../../types';
import { RECORD_TYPES } from '../../constants';
import { resolveUniqueRecordCode, getWardShortCode } from '../../utils/codeGenerator';
import { Save, User as UserIcon, Calendar, MapPin, FileCheck, Loader2, Printer, RotateCcw, XCircle, CheckCircle, AlertCircle, X, Phone, FileText, BookOpen, Clock, Hash, Map, AlertTriangle, RefreshCw, Building } from 'lucide-react';

interface RecordFormProps {
  onSave: (record: RecordFile) => Promise<boolean>;
  wards: string[];
  records: RecordFile[];
  holidays: Holiday[];
  calculateDeadline: (type: string, date: string) => string;
  generateCode: (ward: string, date: string, existingCodes?: string[], recordType?: string) => string;
  onPrint?: (data: Partial<RecordFile>) => void;
  initialData?: RecordFile | null;
  onCancelEdit?: () => void;
  currentUser: User;
  employees: Employee[];
}

const RecordForm: React.FC<RecordFormProps> = ({ onSave, wards, records, holidays, calculateDeadline, generateCode, onPrint, initialData, onCancelEdit, currentUser, employees }) => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const linkedEmp = employees.find(e => e.id === currentUser.employeeId);
  const userReceivingWard = linkedEmp?.managedWards?.[0] || 'Chơn Thành';

  const [formData, setFormData] = useState<Partial<RecordFile>>({
    code: '', customerName: '', phoneNumber: '', cccd: '', authorizedBy: '', authDocType: '', otherDocs: '', content: '',
    receivedDate: new Date().toISOString().split('T')[0], deadline: '', 
    receivingWard: userReceivingWard,
    ward: '', landPlot: '', mapSheet: '', area: 0,
    address: '', recordType: '', status: RecordStatus.RECEIVED, isPriority: false, priorityNote: ''
  });

  const effectiveReceivingWard = formData.receivingWard || userReceivingWard;

  useEffect(() => {
      if (initialData) {
          setFormData({
              ...initialData,
              receivingWard: initialData.receivingWard || userReceivingWard
          });
          setNotification(null);
      } else {
          handleReset(false);
      }
  }, [initialData]);

  useEffect(() => {
      if (notification && topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (notification.type === 'success') {
              const timer = setTimeout(() => setNotification(null), 5000);
              return () => clearTimeout(timer);
          }
      }
  }, [notification]);

  useEffect(() => {
    if (!initialData) {
        const newCode = generateCode(effectiveReceivingWard, formData.receivedDate || '', [], formData.recordType || '');
        if (newCode && formData.code !== newCode) {
            setFormData(prev => ({ ...prev, code: newCode, receivingWard: effectiveReceivingWard }));
        }
    }
  }, [effectiveReceivingWard, formData.receivedDate, formData.recordType, records, initialData]);

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
        const newData = { ...prev, [field]: value };
        if (field === 'recordType' || field === 'receivedDate' || field === 'receivingWard') {
            const rType = field === 'recordType' ? value : prev.recordType;
            const rDate = field === 'receivedDate' ? value : prev.receivedDate;
            const rReceivingWard = field === 'receivingWard' ? value : (prev.receivingWard || userReceivingWard);
            if (rType && rDate) {
                newData.deadline = calculateDeadline(rType, rDate);
            }
            if (!initialData || (initialData && rType !== initialData.recordType) || field === 'receivingWard') {
                newData.code = generateCode(rReceivingWard, rDate || '', [], rType || '');
            }
        }
        return newData;
    });
  };

  const handleRefreshCode = () => {
      const refreshed = generateCode(effectiveReceivingWard, formData.receivedDate || '', [], formData.recordType || '');
      if (refreshed) {
          setFormData(prev => ({ ...prev, code: refreshed }));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    if (!formData.customerName || !formData.deadline || !formData.recordType) { 
        setNotification({ type: 'error', message: "Vui lòng điền các trường bắt buộc (*) và chọn Loại hồ sơ." });
        return; 
    }
    setLoading(true);
    
    // Tự động kiểm tra và đảm bảo mã chống trùng tuyệt đối theo Đơn vị tiếp nhận
    const candidateCode = formData.code || generateCode(effectiveReceivingWard, formData.receivedDate || '', [], formData.recordType || '');
    const finalCode = resolveUniqueRecordCode(
        candidateCode,
        effectiveReceivingWard,
        formData.receivedDate || '',
        formData.recordType || '',
        records
    );

    const isTypeChanged = Boolean(initialData && formData.recordType !== initialData.recordType);
    const recordToSave: RecordFile = { 
        ...formData, 
        receivingWard: effectiveReceivingWard,
        ward: formData.ward || effectiveReceivingWard,
        code: finalCode,
        id: formData.id || initialData?.id || Math.random().toString(36).substr(2, 9), 
        status: isTypeChanged ? RecordStatus.RECEIVED : (formData.status || RecordStatus.RECEIVED),
        createdBy: formData.createdBy || currentUser.name,
        _oldId: initialData?.id,
        _oldCode: initialData?.code,
        _oldRecordType: initialData?.recordType,
        _oldIsArchive: (initialData as any)?._isArchive,
        _oldArchiveType: (initialData as any)?._archiveType,
    } as any;

    if (isTypeChanged) {
        delete (recordToSave as any)._isArchive;
        delete (recordToSave as any)._archiveType;
    }

    const success = await onSave(recordToSave);
    setLoading(false);
    if (success) {
        setNotification({ 
            type: 'success', 
            message: isTypeChanged 
                ? `Đã chuyển đổi hoàn toàn sang ${recordToSave.recordType} (Mã mới: ${recordToSave.code})` 
                : (initialData ? `Cập nhật thành công: ${recordToSave.code}` : `Đã tiếp nhận mới: ${recordToSave.code}`) 
        });
        if (initialData && onCancelEdit) onCancelEdit(); else handleReset(true);
    } else {
        setNotification({ type: 'error', message: "Lỗi khi lưu hồ sơ." });
    }
  };

  const handleReset = (keepNotification = false) => {
      setFormData({ 
          code: '', customerName: '', phoneNumber: '', cccd: '', authorizedBy: '', authDocType: '', otherDocs: '', 
          content: '', receivedDate: new Date().toISOString().split('T')[0], deadline: '', 
          receivingWard: userReceivingWard,
          ward: '', landPlot: '', mapSheet: '', area: 0, 
          address: '', recordType: '', status: RecordStatus.RECEIVED, isPriority: false, priorityNote: '' 
      });
      if (!keepNotification) setNotification(null);
      if (onCancelEdit && initialData) onCancelEdit();
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white hover:border-slate-300";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1";
  const iconWrapperClass = "absolute left-3 top-[34px] text-slate-400 pointer-events-none";

  return (
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-6 animate-fade-in relative pb-10">
        <div ref={topRef} />
        {notification && (
            <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-fade-in-up ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {notification.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                <div className="flex-1"><h4 className="font-bold text-sm uppercase">{notification.type === 'success' ? 'Thành công' : 'Có lỗi xảy ra'}</h4><p className="text-sm">{notification.message}</p></div>
                <button type="button" onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
        )}
        {initialData && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center justify-between mb-4 shadow-sm">
                <span className="font-bold flex items-center gap-2"><Loader2 className="animate-spin text-amber-600" size={18}/> Đang sửa: <span className="bg-white px-2 py-0.5 rounded border border-amber-200">{initialData.code}</span></span>
                <button type="button" onClick={() => handleReset(false)} className="text-sm font-bold underline hover:text-amber-900 bg-white/50 px-3 py-1.5 rounded">Hủy</button>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CỘT 1 */}
            <div className="col-span-1 lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2"><span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><UserIcon size={16} /></span> Người nộp hồ sơ</h3>
                    <div className="space-y-4">
                        <div className="relative"><label className={labelClass}>Chủ sử dụng <span className="text-red-500">*</span></label><UserIcon size={16} className={iconWrapperClass} /><input type="text" required className={inputClass} placeholder="Nguyễn Văn A..." value={formData.customerName || ''} onChange={(e) => handleChange('customerName', e.target.value)} /></div>
                        <div className="relative"><label className={labelClass}>Số điện thoại</label><Phone size={16} className={iconWrapperClass} /><input type="text" className={inputClass} placeholder="09xxxxxxxx" value={formData.phoneNumber || ''} onChange={(e) => handleChange('phoneNumber', e.target.value)} /></div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-3 border-b border-slate-200 pb-2"><FileText size={14} /> Ủy quyền</label>
                            <div className="space-y-3">
                                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none" value={formData.authDocType || ''} onChange={(e) => handleChange('authDocType', e.target.value)}><option value="">-- Chọn loại giấy tờ --</option><option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option><option value="Giấy ủy quyền">Giấy ủy quyền</option><option value="Văn bản ủy quyền">Văn bản ủy quyền</option></select>
                                <input type="text" placeholder="Họ tên người được ủy quyền..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" value={formData.authorizedBy || ''} onChange={(e) => handleChange('authorizedBy', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2"><span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Calendar size={16} /></span> Thời gian & Mã</h3>
                    <div className="space-y-4">
                        {/* ĐƠN VỊ TIẾP NHẬN (PHI ĐỊA GIỚI) */}
                        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100">
                            <label className="flex items-center justify-between text-[11px] font-bold text-blue-900 uppercase tracking-wide mb-2">
                                <span className="flex items-center gap-1.5"><Building size={14} className="text-blue-600" /> Đơn vị tiếp nhận (Nơi nhận HS)</span>
                                <span className="font-mono bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">Mã: {getWardShortCode(effectiveReceivingWard)}</span>
                            </label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {wards.map(w => {
                                    const isSelected = effectiveReceivingWard.toLowerCase() === w.toLowerCase();
                                    return (
                                        <button
                                            type="button"
                                            key={w}
                                            onClick={() => handleChange('receivingWard', w)}
                                            className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center truncate ${
                                                isSelected 
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-100/50'
                                            }`}
                                        >
                                            {w}
                                        </button>
                                    );
                                })}
                            </div>
                            <span className="text-[10px] text-blue-700/80 mt-1.5 block">
                                Căn cứ cán bộ nhận: <strong className="font-semibold text-blue-900">{userReceivingWard}</strong>
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative"><label className={labelClass}>Ngày nhận</label><Calendar size={16} className={iconWrapperClass} /><input type="date" required className={inputClass} value={formData.receivedDate || ''} onChange={(e) => handleChange('receivedDate', e.target.value)} /></div>
                            <div className="relative"><label className={`${labelClass} text-purple-600`}>Hẹn trả <span className="text-red-500">*</span></label><Clock size={16} className={`${iconWrapperClass} text-purple-400`} /><input type="date" required className={`${inputClass} bg-purple-50 border-purple-200 text-purple-700 font-bold`} value={formData.deadline || ''} onChange={(e) => handleChange('deadline', e.target.value)} /></div>
                        </div>
                        <div className="relative">
                            <div className="flex items-center justify-between mb-1.5 ml-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Mã hồ sơ</label>
                                <button
                                    type="button"
                                    onClick={handleRefreshCode}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer"
                                    title="Lấy số thứ tự mới nhất theo đơn vị tiếp nhận"
                                >
                                    <RefreshCw size={12} /> Cấp lại mã
                                </button>
                            </div>
                            <Hash size={16} className="absolute left-3 top-[34px] text-slate-400 pointer-events-none" />
                            <input 
                                type="text" 
                                readOnly={!initialData} 
                                className={`${inputClass} font-mono font-bold text-blue-700 tracking-wide ${initialData ? 'bg-white border-blue-300' : 'bg-slate-50'}`} 
                                value={formData.code || ''} 
                                onChange={(e) => initialData && handleChange('code', e.target.value)} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* CỘT 2 */}
            <div className="col-span-1 lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden h-full flex flex-col">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2"><span className="p-1.5 bg-green-100 text-green-600 rounded-lg"><MapPin size={16} /></span> Vị trí & Thửa đất</h3>
                    <div className="space-y-5 flex-1">
                        <div><label className={labelClass}>Chọn Xã / Phường <span className="text-red-500">*</span></label>
                            <div className="flex flex-col gap-2">{wards.map(w => (<button type="button" key={w} onClick={() => handleChange('ward', w)} className={`py-3 px-4 text-sm font-bold rounded-xl border transition-all flex items-center justify-between ${formData.ward === w ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-green-50'}`}><span>{w}</span>{formData.ward === w && <CheckCircle size={16} />}</button>))}</div>
                        </div>
                        <div className="relative"><label className={labelClass}>Địa chỉ chi tiết</label><MapPin size={16} className={iconWrapperClass} /><input type="text" className={inputClass} placeholder="Ấp/Khu phố..." value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} /></div>
                        <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 grid grid-cols-3 gap-4">
                            <div className="relative"><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Tờ bản đồ</label><input type="text" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white outline-none" placeholder="0" value={formData.mapSheet || ''} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>
                            <div className="relative"><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Thửa đất</label><input type="text" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white outline-none" placeholder="0" value={formData.landPlot || ''} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                            <div className="relative"><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Diện tích</label><input type="number" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white outline-none" placeholder="0" value={formData.area || ''} onChange={(e) => handleChange('area', e.target.value)} /></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CỘT 3 */}
            <div className="col-span-1 lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden h-full flex flex-col">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2"><span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><FileCheck size={16} /></span> Nội dung yêu cầu</h3>
                    <div className="space-y-5 flex-1">
                        <div className="relative"><label className={labelClass}>Loại hồ sơ <span className="text-red-500">*</span></label><BookOpen size={16} className={iconWrapperClass} /><select className={`${inputClass} appearance-none bg-white cursor-pointer`} value={formData.recordType || ''} onChange={(e) => handleChange('recordType', e.target.value)}><option value="">-- Chọn loại hồ sơ --</option>{RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        <div className="relative"><label className={labelClass}>Nội dung chi tiết</label><textarea rows={6} className="w-full p-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white resize-none" value={formData.content || ''} onChange={(e) => handleChange('content', e.target.value)} placeholder="Nhập ghi chú..." /></div>
                        <div className="relative"><label className={labelClass}>Giấy tờ kèm theo</label><Map size={16} className={iconWrapperClass} /><input type="text" className={inputClass} value={formData.otherDocs || ''} onChange={(e) => handleChange('otherDocs', e.target.value)} placeholder="Sổ đỏ, CMND..." /></div>
                        
                        {/* HỒ SƠ CHÚ Ý / CẦN BÁO CÁO GẤP */}
                        <div className={`p-4 rounded-xl border transition-all ${formData.isPriority ? 'bg-red-50/80 border-red-300 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase text-slate-800">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500" 
                                    checked={!!formData.isPriority} 
                                    onChange={(e) => handleChange('isPriority', e.target.checked)} 
                                
                                />
                                <span className="flex items-center gap-1.5 text-amber-700">
                                    <AlertTriangle size={16} className="text-amber-500 fill-yellow-400" /> Hồ sơ cần chú ý / Báo cáo ngay khi ký
                                </span>
                            </label>
                            {formData.isPriority && (
                                <div className="mt-2.5 space-y-1.5 animate-fade-in">
                                    <label className="block text-[10px] font-bold text-red-700 uppercase">Ghi chú lý do chú ý (Hồ sơ khiếu nại cần xử lý ngay...)</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-xs p-2 bg-white border border-red-200 rounded-lg outline-none focus:ring-2 focus:ring-red-400 font-medium text-slate-800" 
                                        placeholder="Ví dụ: Hồ sơ khiếu nại cần xử lý ngay..." 
                                        value={formData.priorityNote || ''} 
                                        onChange={(e) => handleChange('priorityNote', e.target.value)} 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <button type="submit" disabled={loading} className="col-span-2 flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg font-bold transition-all active:scale-95 disabled:opacity-70"><Save size={20} /> {loading ? 'Đang xử lý...' : (initialData ? 'CẬP NHẬT' : 'LƯU HỒ SƠ')}</button>
                        {onPrint && <button type="button" onClick={() => onPrint(formData)} className="px-4 py-3 bg-white text-purple-700 rounded-xl hover:bg-purple-50 transition-colors shadow-sm font-bold border border-purple-200 flex items-center justify-center gap-2"><Printer size={18} /> In Phiếu</button>}
                        <button type="button" onClick={() => handleReset(false)} className="px-4 py-3 bg-white text-slate-600 rounded-xl hover:bg-slate-100 transition-colors shadow-sm font-bold border border-slate-200 flex items-center justify-center gap-2">{initialData ? <><XCircle size={18} className="text-red-500" /> Hủy</> : <><RotateCcw size={18} /> Làm mới</>}</button>
                    </div>
                </div>
            </div>
        </div>
    </form>
  );
};

export default RecordForm;

