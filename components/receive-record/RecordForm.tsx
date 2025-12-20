
import React, { useState, useEffect, useRef } from 'react';
import { RecordFile, Holiday, RecordStatus } from '../../types';
import { RECORD_TYPES } from '../../constants';
import { Save, User as UserIcon, Calendar, MapPin, FileCheck, Loader2, Printer, RotateCcw, XCircle, CheckCircle, AlertCircle, X, Phone, FileText, BookOpen, Clock, Hash, Map } from 'lucide-react';

interface RecordFormProps {
  onSave: (record: RecordFile) => Promise<boolean>;
  wards: string[];
  records: RecordFile[];
  holidays: Holiday[];
  calculateDeadline: (type: string, date: string) => string;
  generateCode: (ward: string, date: string) => string;
  onPrint?: (data: Partial<RecordFile>) => void;
  initialData?: RecordFile | null; // Dữ liệu khi sửa
  onCancelEdit?: () => void; // Hủy sửa
}

const RecordForm: React.FC<RecordFormProps> = ({ onSave, wards, records, holidays, calculateDeadline, generateCode, onPrint, initialData, onCancelEdit }) => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<RecordFile>>({
    code: '', customerName: '', phoneNumber: '', cccd: '', authorizedBy: '', authDocType: '', otherDocs: '', content: '',
    receivedDate: new Date().toISOString().split('T')[0], deadline: '', ward: '', landPlot: '', mapSheet: '', area: 0,
    address: '', recordType: '', status: RecordStatus.RECEIVED 
  });

  // Load data khi initialData thay đổi (chế độ sửa)
  useEffect(() => {
      if (initialData) {
          setFormData(initialData);
          setNotification(null); // Reset thông báo khi chuyển chế độ
      } else {
          // Reset nếu không có initialData (chế độ thêm mới)
          handleReset(false); // False để không xóa thông báo nếu vừa thêm mới thành công
      }
  }, [initialData]);

  // Scroll lên đầu khi có thông báo
  useEffect(() => {
      if (notification && topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Tự động tắt sau 5 giây nếu là success
          if (notification.type === 'success') {
              const timer = setTimeout(() => setNotification(null), 5000);
              return () => clearTimeout(timer);
          }
      }
  }, [notification]);

  // Tự động tạo mã khi Xã hoặc Ngày thay đổi (CHỈ KHI THÊM MỚI)
  useEffect(() => {
    if (!initialData && formData.ward) {
        const newCode = generateCode(formData.ward, formData.receivedDate || '');
        setFormData(prev => ({ ...prev, code: newCode }));
    }
  }, [formData.ward, formData.receivedDate, records, initialData]);

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
        const newData = { ...prev, [field]: value };
        if (field === 'recordType' || field === 'receivedDate') {
            const rType = field === 'recordType' ? value : prev.recordType;
            const rDate = field === 'receivedDate' ? value : prev.receivedDate;
            if (rType && rDate) newData.deadline = calculateDeadline(rType, rDate);
        }
        return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (!formData.code || !formData.customerName || !formData.deadline || !formData.recordType) { 
        setNotification({ type: 'error', message: "Vui lòng điền các trường bắt buộc (*) và chọn Loại hồ sơ." });
        return; 
    }
    setLoading(true);
    
    // Nếu có ID (đang sửa) thì giữ nguyên ID, nếu không thì tạo mới
    const recordToSave: RecordFile = { 
        ...formData, 
        id: formData.id || Math.random().toString(36).substr(2, 9), 
        status: formData.status || RecordStatus.RECEIVED 
    } as RecordFile;

    const success = await onSave(recordToSave);
    setLoading(false);
    
    if (success) {
        const msg = initialData 
            ? `Cập nhật thành công hồ sơ: ${recordToSave.code}`
            : `Đã tiếp nhận mới hồ sơ: ${recordToSave.code}`;
            
        setNotification({ type: 'success', message: msg });

        if (initialData && onCancelEdit) {
            onCancelEdit(); // Quay về mode thêm mới sau khi sửa xong
        } else {
            handleReset(true); // Reset form nhưng giữ thông báo
        }
    } else {
        setNotification({ type: 'error', message: "Lỗi khi lưu hồ sơ. Vui lòng thử lại hoặc kiểm tra kết nối." });
    }
  };

  const handleReset = (keepNotification = false) => {
      const today = new Date().toISOString().split('T')[0];
      setFormData({ code: '', customerName: '', phoneNumber: '', cccd: '', authorizedBy: '', authDocType: '', otherDocs: '', content: '', receivedDate: today, deadline: '', ward: '', landPlot: '', mapSheet: '', area: 0, address: '', recordType: '', status: RecordStatus.RECEIVED });
      if (!keepNotification) setNotification(null);
      if (onCancelEdit && initialData) onCancelEdit();
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white hover:border-slate-300";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1";
  const iconWrapperClass = "absolute left-3 top-[34px] text-slate-400 pointer-events-none";

  return (
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-6 animate-fade-in relative pb-10">
        <div ref={topRef} />
        
        {/* NOTIFICATION BANNER */}
        {notification && (
            <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-fade-in-up ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {notification.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                <div className="flex-1">
                    <h4 className="font-bold text-sm uppercase">{notification.type === 'success' ? 'Thành công' : 'Có lỗi xảy ra'}</h4>
                    <p className="text-sm">{notification.message}</p>
                </div>
                <button type="button" onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
        )}

        {initialData && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center justify-between mb-4 shadow-sm">
                <span className="font-bold flex items-center gap-2"><Loader2 className="animate-spin text-amber-600" size={18}/> Đang chỉnh sửa hồ sơ: <span className="bg-white px-2 py-0.5 rounded border border-amber-200">{initialData.code}</span></span>
                <button type="button" onClick={() => handleReset(false)} className="text-sm font-bold underline hover:text-amber-900 bg-white/50 px-3 py-1.5 rounded hover:bg-white transition-colors">Hủy sửa & Nhập mới</button>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* CỘT 1: THÔNG TIN KHÁCH HÀNG & THỜI GIAN (4 Phần) */}
            <div className="lg:col-span-4 space-y-6">
                
                {/* Block 1: Khách hàng */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                        <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><UserIcon size={16} /></span> 
                        Người nộp hồ sơ
                    </h3>
                    
                    <div className="space-y-4">
                        <div className="relative"> 
                            <label className={labelClass}>Chủ sử dụng <span className="text-red-500">*</span></label>
                            <UserIcon size={16} className={iconWrapperClass} />
                            <input type="text" required className={inputClass} placeholder="Nguyễn Văn A..." value={formData.customerName} onChange={(e) => handleChange('customerName', e.target.value)} /> 
                        </div>
                        <div className="relative"> 
                            <label className={labelClass}>Số điện thoại</label> 
                            <Phone size={16} className={iconWrapperClass} />
                            <input type="text" className={inputClass} placeholder="09xxxxxxxx" value={formData.phoneNumber || ''} onChange={(e) => handleChange('phoneNumber', e.target.value)} /> 
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-3 border-b border-slate-200 pb-2">
                                <FileText size={14} /> Ủy quyền (Nếu có)
                            </label>
                            <div className="space-y-3">
                                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-slate-200 outline-none" value={formData.authDocType || ''} onChange={(e) => handleChange('authDocType', e.target.value)}> 
                                    <option value="">-- Chọn loại giấy tờ --</option> 
                                    <option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option> 
                                    <option value="Giấy ủy quyền">Giấy ủy quyền</option> 
                                    <option value="Văn bản ủy quyền">Văn bản ủy quyền</option>
                                </select>
                                <input type="text" placeholder="Họ tên người được ủy quyền..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-200 outline-none" value={formData.authorizedBy || ''} onChange={(e) => handleChange('authorizedBy', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Block 2: Thời gian */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                        <span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Calendar size={16} /></span>
                        Thời gian & Mã
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative"> 
                                <label className={labelClass}>Ngày nhận</label> 
                                <Calendar size={16} className={iconWrapperClass} />
                                <input type="date" required className={inputClass} value={formData.receivedDate} onChange={(e) => handleChange('receivedDate', e.target.value)} /> 
                            </div>
                            <div className="relative"> 
                                <label className={`${labelClass} text-purple-600`}>Hẹn trả <span className="text-red-500">*</span></label> 
                                <Clock size={16} className={`${iconWrapperClass} text-purple-400`} />
                                <input type="date" required className={`${inputClass} bg-purple-50 border-purple-200 text-purple-700 font-bold focus:border-purple-500 focus:ring-purple-500/20`} value={formData.deadline} onChange={(e) => handleChange('deadline', e.target.value)} /> 
                            </div>
                        </div>
                        <div className="relative"> 
                            <label className={labelClass}>Mã hồ sơ {initialData ? '' : '(Tự động)'}</label> 
                            <Hash size={16} className={iconWrapperClass} />
                            <input type="text" readOnly={!initialData} className={`${inputClass} font-mono ${initialData ? 'bg-white font-bold text-blue-700 border-blue-300' : 'bg-slate-100 text-slate-500 cursor-not-allowed'}`} value={formData.code} onChange={(e) => initialData && handleChange('code', e.target.value)} /> 
                        </div>
                    </div>
                </div>
            </div>

            {/* CỘT 2: VỊ TRÍ ĐẤT (4 Phần) */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden h-full flex flex-col">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                        <span className="p-1.5 bg-green-100 text-green-600 rounded-lg"><MapPin size={16} /></span>
                        Vị trí & Thửa đất
                    </h3>
                    
                    <div className="space-y-5 flex-1">
                        <div> 
                            <label className={labelClass}>Chọn Xã / Phường <span className="text-red-500">*</span></label>
                            <div className="flex flex-col gap-2">
                                {wards.map(w => (
                                    <button
                                        type="button"
                                        key={w}
                                        onClick={() => handleChange('ward', w)}
                                        className={`py-3 px-4 text-sm font-bold rounded-xl border transition-all duration-200 flex items-center justify-between group ${formData.ward === w ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-[1.02]' : 'bg-white text-slate-600 border-slate-200 hover:border-green-400 hover:bg-green-50'}`}
                                    >
                                        <span>{w}</span>
                                        {formData.ward === w && <CheckCircle size={16} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="relative"> 
                            <label className={labelClass}>Địa chỉ đất chi tiết</label> 
                            <MapPin size={16} className={iconWrapperClass} />
                            <input type="text" className={inputClass} placeholder="Ấp/Khu phố, đường..." value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} /> 
                        </div>
                        
                        <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 grid grid-cols-3 gap-4">
                            <div className="relative"> 
                                <label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Tờ bản đồ</label> 
                                <input type="text" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white focus:ring-2 focus:ring-green-500/20 outline-none" placeholder="0" value={formData.mapSheet} onChange={(e) => handleChange('mapSheet', e.target.value)} /> 
                            </div>
                            <div className="relative"> 
                                <label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Thửa đất</label> 
                                <input type="text" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white focus:ring-2 focus:ring-green-500/20 outline-none" placeholder="0" value={formData.landPlot} onChange={(e) => handleChange('landPlot', e.target.value)} /> 
                            </div>
                            <div className="relative"> 
                                <label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Diện tích</label> 
                                <input type="number" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white focus:ring-2 focus:ring-green-500/20 outline-none" placeholder="0" value={formData.area} onChange={(e) => handleChange('area', e.target.value)} /> 
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CỘT 3: NỘI DUNG YÊU CẦU (4 Phần) */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden h-full flex flex-col">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                        <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><FileCheck size={16} /></span>
                        Nội dung yêu cầu
                    </h3>
                    
                    <div className="space-y-5 flex-1">
                        <div className="relative"> 
                            <label className={labelClass}>Loại hồ sơ <span className="text-red-500">*</span></label> 
                            <BookOpen size={16} className={iconWrapperClass} />
                            <select className={`${inputClass} appearance-none bg-white cursor-pointer`} value={formData.recordType} onChange={(e) => handleChange('recordType', e.target.value)}> 
                                <option value="">-- Chọn loại hồ sơ --</option>
                                {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)} 
                            </select> 
                        </div>
                        
                        <div className="relative"> 
                            <label className={labelClass}>Nội dung chi tiết</label> 
                            <textarea rows={6} className="w-full p-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white resize-none" value={formData.content} onChange={(e) => handleChange('content', e.target.value)} placeholder="Nhập ghi chú hoặc nội dung công việc..." /> 
                        </div>
                        
                        <div className="relative"> 
                            <label className={labelClass}>Giấy tờ kèm theo</label> 
                            <Map size={16} className={iconWrapperClass} />
                            <input type="text" className={inputClass} value={formData.otherDocs || ''} onChange={(e) => handleChange('otherDocs', e.target.value)} placeholder="Sổ đỏ, CMND, ..." /> 
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <button type="submit" disabled={loading} className="col-span-2 flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 font-bold transition-all active:scale-95 disabled:opacity-70 disabled:shadow-none"> 
                            <Save size={20} /> {loading ? 'Đang xử lý...' : (initialData ? 'CẬP NHẬT HỒ SƠ' : 'LƯU HỒ SƠ')} 
                        </button>
                        
                        {onPrint && (
                            <button type="button" onClick={() => onPrint(formData)} className="px-4 py-3 bg-white text-purple-700 rounded-xl hover:bg-purple-50 transition-colors shadow-sm font-bold border border-purple-200 flex items-center justify-center gap-2">
                                <Printer size={18} /> In Biên Nhận
                            </button>
                        )}
                        <button type="button" onClick={() => handleReset(false)} className="px-4 py-3 bg-white text-slate-600 rounded-xl hover:bg-slate-100 transition-colors shadow-sm font-bold border border-slate-200 flex items-center justify-center gap-2" title="Làm mới form">
                            {initialData ? <><XCircle size={18} className="text-red-500" /> Hủy</> : <><RotateCcw size={18} /> Làm mới</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>
  );
};

export default RecordForm;
