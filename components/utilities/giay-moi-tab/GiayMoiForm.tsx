import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RotateCcw, Sparkles, UserCheck, Calendar, MapPin, FileText, Send, Info, ArrowUp, ArrowDown, Phone, User, Clock, Building } from 'lucide-react';
import { 
    GiayMoiData, 
    GiayMoiInviteTarget, 
    getLastNameWord, 
    formatInviteTargetDisplay, 
    getVietnameseDayOfWeek, 
    formatThoiGianFull, 
    formatNoiDungFull, 
    formatDiaDiemFull 
} from '../../../utils/exportGiayMoiDocx';
import { User as UserType } from '../../../types';

interface GiayMoiFormProps {
    currentUser?: UserType;
    formData: GiayMoiData;
    setFormData: React.Dispatch<React.SetStateAction<GiayMoiData>>;
    handleLoadSampleFilled: () => void;
    handleLoadBlankTemplate: () => void;
    handleSaveRecord: (silent?: boolean) => Promise<boolean | undefined>;
    mode: 'create' | 'list';
    setMode: (m: 'create' | 'list') => void;
    editingId: string | null;
}

const GiayMoiForm: React.FC<GiayMoiFormProps> = ({
    currentUser,
    formData,
    setFormData,
    handleLoadSampleFilled,
    handleLoadBlankTemplate,
    handleSaveRecord,
    mode,
    setMode,
    editingId
}) => {
    // 3 separate inputs for new invitee
    const [newTargetName, setNewTargetName] = useState('');
    const [newTargetAddress, setNewTargetAddress] = useState('');
    const [newTargetPhone, setNewTargetPhone] = useState('');

    // Pre-fill officer name if empty & auto sync Lưu VT line
    useEffect(() => {
        const activeName = formData.canBoTen || currentUser?.name || '';
        const activeToVT = formData.toVietTat || 'TĐĐ';

        if (!formData.canBoTen && currentUser?.name) {
            setFormData(prev => ({
                ...prev,
                canBoTen: currentUser.name
            }));
        }

        if (activeName || activeToVT) {
            handleSyncNoiNhanLuu(activeToVT, activeName);
        }
    }, [currentUser, formData.canBoTen, formData.toVietTat]);

    const handleChange = (field: keyof GiayMoiData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddInviteTarget = () => {
        if (!newTargetName.trim()) return;
        const newTarget: GiayMoiInviteTarget = {
            id: Math.random().toString(36).substr(2, 9),
            name: newTargetName.trim(),
            address: newTargetAddress.trim(),
            phone: newTargetPhone.trim()
        };
        setFormData(prev => ({
            ...prev,
            kinhMoiList: [...prev.kinhMoiList, newTarget]
        }));
        setNewTargetName('');
        setNewTargetAddress('');
        setNewTargetPhone('');
    };

    const handleRemoveInviteTarget = (id: string) => {
        setFormData(prev => ({
            ...prev,
            kinhMoiList: prev.kinhMoiList.filter(item => item.id !== id)
        }));
    };

    const handleUpdateInviteTarget = (id: string, field: 'name' | 'address' | 'phone', value: string) => {
        setFormData(prev => ({
            ...prev,
            kinhMoiList: prev.kinhMoiList.map(item => item.id === id ? { ...item, [field]: value } : item)
        }));
    };

    const handleMoveInviteTarget = (index: number, direction: 'up' | 'down') => {
        const newList = [...formData.kinhMoiList];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newList.length) return;
        const temp = newList[index];
        newList[index] = newList[targetIndex];
        newList[targetIndex] = temp;
        setFormData(prev => ({ ...prev, kinhMoiList: newList }));
    };

    // Handle Time selection and auto day-of-week calculation
    const handleTimeChange = (newGioPhut?: string, newDateIso?: string) => {
        const gioPhutVal = newGioPhut !== undefined ? newGioPhut : (formData.gioPhut || '14 giờ 30 phút');
        const dateIsoVal = newDateIso !== undefined ? newDateIso : (formData.ngayThangNamIso || '2026-07-24');

        const compiledThoiGian = formatThoiGianFull(gioPhutVal, dateIsoVal);

        setFormData(prev => ({
            ...prev,
            gioPhut: gioPhutVal,
            ngayThangNamIso: dateIsoVal,
            thoiGian: compiledThoiGian
        }));
    };

    // Handle Land & Content auto compilation
    const handleLandOrContentChange = (fields: {
        noiDungLamViec?: string;
        soThua?: string;
        soTo?: string;
        chuSuDung?: string;
        diaChiThuaDat?: string;
    }) => {
        setFormData(prev => {
            const noiDungLamViec = fields.noiDungLamViec !== undefined ? fields.noiDungLamViec : (prev.noiDungLamViec || 'Tham gia phối hợp xác minh hiện trạng sử dụng');
            const soThua = fields.soThua !== undefined ? fields.soThua : (prev.soThua || '');
            const soTo = fields.soTo !== undefined ? fields.soTo : (prev.soTo || '');
            const chuSuDung = fields.chuSuDung !== undefined ? fields.chuSuDung : (prev.chuSuDung || '');
            const diaChiThuaDat = fields.diaChiThuaDat !== undefined ? fields.diaChiThuaDat : (prev.diaChiThuaDat || '');

            const newNoiDung = formatNoiDungFull(noiDungLamViec, soThua, soTo, chuSuDung, diaChiThuaDat);
            const newDiaDiem = formatDiaDiemFull(soThua, soTo, diaChiThuaDat);
            const targetName = chuSuDung.trim() || 'chủ sử dụng đất';
            const newTextDeNghiGiapRanh = `(Đề nghị ${targetName} liên hệ với các chủ sử dụng đất giáp ranh cùng tham gia buổi xác minh, để thực hiện xác nhận ranh giới, mốc giới và ký biên bản tại thực địa).`;

            return {
                ...prev,
                noiDungLamViec,
                soThua,
                soTo,
                chuSuDung,
                diaChiThuaDat,
                noiDung: newNoiDung,
                diaDiem: newDiaDiem,
                textDeNghiGiapRanh: newTextDeNghiGiapRanh
            };
        });
    };

    // Auto generate Ghi chú cán bộ
    const handleSyncGhiChuCanBo = (tenVal?: string, sdtVal?: string) => {
        const ten = tenVal !== undefined ? tenVal : (formData.canBoTen || currentUser?.name || '');
        const sdt = sdtVal !== undefined ? sdtVal : (formData.canBoSdt || '');
        if (!ten && !sdt) return;

        const newGhiChu = `Để biết thêm chi tiết, liên hệ ông(bà) ${ten || '...'} – Nhân viên Chi nhánh Chơn Thành, SĐT: ${sdt || '...'}.`;
        setFormData(prev => ({ ...prev, ghiChuCanBo: newGhiChu }));
    };

    // Auto generate Dòng Lưu Nơi nhận: "- Lưu: VT. (TĐĐ Thái)"
    const handleSyncNoiNhanLuu = (toVTVal?: string, tenVal?: string) => {
        const toVT = toVTVal !== undefined ? toVTVal : (formData.toVietTat || 'TĐĐ');
        const ten = tenVal !== undefined ? tenVal : (formData.canBoTen || currentUser?.name || '');
        const lastName = getLastNameWord(ten);

        const luuLine = `- Lưu: VT.${toVT || lastName ? ` (${toVT || 'TĐĐ'}${lastName ? ' ' + lastName : ''})` : ''}`;

        setFormData(prev => {
            const newNoiNhan = [...prev.noiNhan];
            const luuIdx = newNoiNhan.findIndex(line => line.includes('Lưu: VT'));
            if (luuIdx !== -1) {
                newNoiNhan[luuIdx] = luuLine;
            } else {
                newNoiNhan.push(luuLine);
            }
            return {
                ...prev,
                toVietTat: toVT,
                noiNhan: newNoiNhan
            };
        });
    };

    const handleAddNoiNhan = () => {
        setFormData(prev => ({
            ...prev,
            noiNhan: [...prev.noiNhan, '- ']
        }));
    };

    const handleUpdateNoiNhan = (index: number, value: string) => {
        const newNoiNhan = [...formData.noiNhan];
        newNoiNhan[index] = value;
        setFormData(prev => ({ ...prev, noiNhan: newNoiNhan }));
    };

    const handleRemoveNoiNhan = (index: number) => {
        setFormData(prev => ({
            ...prev,
            noiNhan: prev.noiNhan.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50">
            {/* TOP ACTIONS & PRESET LOADER */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold">
                        <FileText size={20} />
                    </span>
                    <div>
                        <h2 className="font-black text-slate-800 text-sm md:text-base">
                            {editingId ? 'Cập nhật Giấy mời' : 'Soạn Giấy mời mới'}
                        </h2>
                        <p className="text-xs text-slate-500">Mẫu chuẩn Chi nhánh Văn phòng Đăng ký đất đai</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleLoadSampleFilled}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        title="Nạp mẫu có sẵn đầy đủ thông tin mẫu"
                    >
                        <Sparkles size={14} className="text-purple-600" />
                        Nạp mẫu có sẵn
                    </button>

                    <button
                        type="button"
                        onClick={handleLoadBlankTemplate}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        title="Tạo mới lại mẫu trắng"
                    >
                        <RotateCcw size={14} />
                        Xóa Trắng
                    </button>
                </div>
            </div>

            {/* FORM SECTION 1: CƠ QUAN & SỐ HIỆU */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                    <Info size={16} className="text-blue-600" /> 1. Cơ quan ban hành & Số hiệu văn bản
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Cơ quan cấp trên:</label>
                        <input
                            type="text"
                            value={formData.donViBanHanhCapTren}
                            onChange={(e) => handleChange('donViBanHanhCapTren', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                            placeholder="VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI THÀNH PHỐ ĐỒNG NAI"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Đơn vị ban hành chính:</label>
                        <input
                            type="text"
                            value={formData.donViBanHanh}
                            onChange={(e) => handleChange('donViBanHanh', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-900"
                            placeholder="CHI NHÁNH CHƠN THÀNH"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Số / Ký hiệu giấy mời:</label>
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={formData.soGiayMoi}
                                onChange={(e) => handleChange('soGiayMoi', e.target.value)}
                                className="w-20 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-center"
                                placeholder="15"
                            />
                            <input
                                type="text"
                                value={formData.soSymbol}
                                onChange={(e) => handleChange('soSymbol', e.target.value)}
                                className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                                placeholder="/GM-VPĐK.CT-TĐĐ"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-3 gap-3 text-xs">
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Ngày ban hành:</label>
                        <input
                            type="text"
                            value={formData.ngayMoi}
                            onChange={(e) => handleChange('ngayMoi', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold"
                            placeholder="24"
                        />
                    </div>
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Tháng ban hành:</label>
                        <input
                            type="text"
                            value={formData.thangMoi}
                            onChange={(e) => handleChange('thangMoi', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold"
                            placeholder="07"
                        />
                    </div>
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Năm ban hành:</label>
                        <input
                            type="text"
                            value={formData.namMoi}
                            onChange={(e) => handleChange('namMoi', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold"
                            placeholder="2026"
                        />
                    </div>
                </div>
            </div>

            {/* FORM SECTION 2: TIÊU ĐỀ, NỘI DUNG CHI TIẾT & LỊCH TRÌNH */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                    <Calendar size={16} className="text-purple-600" /> 2. Trích yếu, Nội dung & Lịch trình làm việc
                </h3>

                <div className="space-y-4 text-xs">
                    {/* Trích yếu Về việc */}
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">
                            Về việc (Trích yếu Giấy mời):
                        </label>
                        <input
                            type="text"
                            value={formData.veViec}
                            onChange={(e) => handleChange('veViec', e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800"
                            placeholder="đo đạc, xác minh hiện trạng sử dụng đất của bà Nguyễn Thị Minh"
                        />
                    </div>

                    {/* NỘI DUNG CHI TIẾT: FORM NHẬP 5 Ô CHI TIẾT */}
                    <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 space-y-3">
                        <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                            <span className="font-extrabold text-xs text-purple-900 flex items-center gap-1.5">
                                <FileText size={15} className="text-purple-600" /> Nhập chi tiết Nội dung & Thửa đất
                            </span>
                            <span className="text-[11px] text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded-md">
                                Tự động ghép thành câu Nội dung & Địa điểm
                            </span>
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Nội dung làm việc:
                            </label>
                            <input
                                type="text"
                                value={formData.noiDungLamViec || ''}
                                onChange={(e) => handleLandOrContentChange({ noiDungLamViec: e.target.value })}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-semibold"
                                placeholder="Tham gia phối hợp xác minh hiện trạng sử dụng"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Thửa đất số:</label>
                                <input
                                    type="text"
                                    value={formData.soThua || ''}
                                    onChange={(e) => handleLandOrContentChange({ soThua: e.target.value })}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold text-purple-900"
                                    placeholder="VD: 503"
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Tờ bản đồ số:</label>
                                <input
                                    type="text"
                                    value={formData.soTo || ''}
                                    onChange={(e) => handleLandOrContentChange({ soTo: e.target.value })}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold text-purple-900"
                                    placeholder="VD: 6"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Chủ sử dụng đất:</label>
                                <input
                                    type="text"
                                    value={formData.chuSuDung || ''}
                                    onChange={(e) => handleLandOrContentChange({ chuSuDung: e.target.value })}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold"
                                    placeholder="VD: bà Nguyễn Thị Minh"
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Địa chỉ thửa đất:</label>
                                <input
                                    type="text"
                                    value={formData.diaChiThuaDat || ''}
                                    onChange={(e) => handleLandOrContentChange({ diaChiThuaDat: e.target.value })}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium"
                                    placeholder="VD: Khu phố 5, phường Minh Hưng, thành phố Đồng Nai"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Câu Nội dung chi tiết hoàn chỉnh:
                            </label>
                            <textarea
                                rows={2}
                                value={formData.noiDung}
                                onChange={(e) => handleChange('noiDung', e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-medium text-slate-800"
                                placeholder="Tham gia phối hợp xác minh hiện trạng sử dụng thửa đất số 503, tờ bản đồ số 6 của bà Nguyễn Thị Minh tại Khu phố 5, phường Minh Hưng, thành phố Đồng Nai."
                            />
                        </div>
                    </div>

                    {/* THỜI GIAN LÀM VIỆC: TÁCH GIỜ VÀ NGÀY THÁNG NĂM (THỨ TỰ ĐỘNG) */}
                    <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100 space-y-3">
                        <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                            <span className="font-extrabold text-xs text-indigo-900 flex items-center gap-1.5">
                                <Clock size={15} className="text-indigo-600" /> Thời gian làm việc (Chọn giờ & ngày)
                            </span>
                            <span className="text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold">
                                Thứ: {getVietnameseDayOfWeek(formData.ngayThangNamIso || '') || 'Tự động tính'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    1. Giờ & phút (nhập hoặc chọn nhanh):
                                </label>
                                <input
                                    type="text"
                                    value={formData.gioPhut || ''}
                                    onChange={(e) => handleTimeChange(e.target.value, formData.ngayThangNamIso)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-950"
                                    placeholder="14 giờ 30 phút"
                                />
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {['08 giờ 00 phút', '08 giờ 30 phút', '14 giờ 00 phút', '14 giờ 30 phút'].map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => handleTimeChange(preset, formData.ngayThangNamIso)}
                                            className="text-[10px] bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-semibold transition-all"
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    2. Ngày, tháng, năm (chọn từ lịch):
                                </label>
                                <input
                                    type="date"
                                    value={formData.ngayThangNamIso || ''}
                                    onChange={(e) => handleTimeChange(formData.gioPhut, e.target.value)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                                />
                                {formData.ngayThangNamIso && (
                                    <div className="text-[11px] text-indigo-700 font-bold mt-1">
                                        Lịch: {getVietnameseDayOfWeek(formData.ngayThangNamIso)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                    Chuỗi Thời gian xuất ra văn bản:
                                </label>
                                <input
                                    type="text"
                                    value={formData.thoiGian}
                                    onChange={(e) => handleChange('thoiGian', e.target.value)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900"
                                    placeholder="14 giờ 30 phút, ngày 24/07/2026 (thứ Sáu)"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Chủ trì (nếu có):
                                </label>
                                <input
                                    type="text"
                                    value={formData.chuTri || ''}
                                    onChange={(e) => handleChange('chuTri', e.target.value)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                                    placeholder="Lãnh đạo Chi nhánh (để trống nếu không có)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ĐỊA ĐIỂM TỔ CHỨC / LÀM VIỆC */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-700">
                                Địa điểm tổ chức / làm việc:
                            </label>
                            <span className="text-[11px] text-slate-500 italic">
                                Ghép tự động từ Thửa, Tờ & Địa chỉ ở trên
                            </span>
                        </div>
                        <input
                            type="text"
                            value={formData.diaDiem}
                            onChange={(e) => handleChange('diaDiem', e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-semibold text-slate-800"
                            placeholder="Tại thực địa thửa đất số 503, tờ bản đồ số 6, Khu phố 5, phường Minh Hưng, thành phố Đồng Nai."
                        />
                    </div>
                </div>
            </div>

            {/* FORM SECTION 3: DANH SÁCH THÀNH PHẦN KÍNH MỜI - TÁCH 3 Ô RIÊNG */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <UserCheck size={16} className="text-emerald-600" /> 3. Thành phần kính mời ({formData.kinhMoiList.length})
                    </h3>
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                    </span>
                </div>

                {/* Adding Inputs with 3 Separate Fields */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                        <Plus size={14} className="text-emerald-600" /> Thêm thành phần kính mời mới:
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                            <label className="block text-[11px] text-slate-500 font-medium mb-1">Tên / Đơn vị kính mời <span className="text-red-500">*</span>:</label>
                            <input
                                type="text"
                                value={newTargetName}
                                onChange={(e) => setNewTargetName(e.target.value)}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                                placeholder="VD: Bà Nguyễn Thị Minh"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] text-slate-500 font-medium mb-1">Địa chỉ (tùy chọn):</label>
                            <input
                                type="text"
                                value={newTargetAddress}
                                onChange={(e) => setNewTargetAddress(e.target.value)}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                                placeholder="VD: phường Minh Hưng, thành phố Đồng Nai"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] text-slate-500 font-medium mb-1">Số điện thoại (tùy chọn):</label>
                            <input
                                type="text"
                                value={newTargetPhone}
                                onChange={(e) => setNewTargetPhone(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInviteTarget())}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                                placeholder="VD: 0886.385.757"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            onClick={handleAddInviteTarget}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs shadow-xs"
                        >
                            <Plus size={14} /> Thêm vào danh sách
                        </button>
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    {formData.kinhMoiList.map((target, idx) => (
                        <div key={target.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="bg-emerald-100 text-emerald-800 font-bold text-[11px] px-2 py-0.5 rounded-md">
                                        Mục {idx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[280px]">
                                        {formatInviteTargetDisplay(target)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleMoveInviteTarget(idx, 'up')}
                                        disabled={idx === 0}
                                        className="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30"
                                        title="Di chuyển lên"
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMoveInviteTarget(idx, 'down')}
                                        disabled={idx === formData.kinhMoiList.length - 1}
                                        className="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30"
                                        title="Di chuyển xuống"
                                    >
                                        <ArrowDown size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveInviteTarget(target.id)}
                                        className="p-1 text-red-500 hover:text-red-700"
                                        title="Xóa thành phần này"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                <div>
                                    <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Tên / Đơn vị:</label>
                                    <input
                                        type="text"
                                        value={target.name}
                                        onChange={(e) => handleUpdateInviteTarget(target.id, 'name', e.target.value)}
                                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Địa chỉ:</label>
                                    <input
                                        type="text"
                                        value={target.address || ''}
                                        onChange={(e) => handleUpdateInviteTarget(target.id, 'address', e.target.value)}
                                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                                        placeholder="Để trống nếu không có"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Số điện thoại:</label>
                                    <input
                                        type="text"
                                        value={target.phone || ''}
                                        onChange={(e) => handleUpdateInviteTarget(target.id, 'phone', e.target.value)}
                                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                                        placeholder="Để trống nếu không có"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    {formData.kinhMoiList.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            Chưa có thành phần kính mời nào. Nhập thông tin ở các ô trên và nhấn "Thêm vào danh sách".
                        </div>
                    )}
                </div>
            </div>

            {/* FORM SECTION 4: LỜI ĐỀ NGHỊ & GHI CHÚ CÁN BỘ LIÊN HỆ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                    <Send size={16} className="text-indigo-600" /> 4. Lời đề nghị & Ghi chú liên hệ
                </h3>

                <div className="space-y-4 text-xs">
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">
                            Lời đề nghị phối hợp chính:
                        </label>
                        <input
                            type="text"
                            value={formData.loiDeNghi}
                            onChange={(e) => handleChange('loiDeNghi', e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                            placeholder="Rất mong ông(bà) đại diện các cơ quan, cá nhân nói trên quan tâm phối hợp thực hiện./."
                        />
                    </div>

                    <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-900">
                            <input
                                type="checkbox"
                                checked={formData.isDeNghiGiapRanh}
                                onChange={(e) => handleChange('isDeNghiGiapRanh', e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            Hiển thị dòng đề nghị chủ đất mời các chủ giáp ranh
                        </label>

                        {formData.isDeNghiGiapRanh && (
                            <textarea
                                rows={2}
                                value={formData.textDeNghiGiapRanh}
                                onChange={(e) => handleChange('textDeNghiGiapRanh', e.target.value)}
                                className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-xs italic font-medium focus:ring-2 focus:ring-indigo-500"
                                placeholder="(Đề nghị bà Nguyễn Thị Minh liên hệ với các chủ sử dụng đất giáp ranh cùng tham gia...)"
                            />
                        )}
                    </div>

                    {/* OFFICER CONTACT DETAILS: 2 SEPARATE INPUTS */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <label className="font-bold text-slate-800 flex items-center gap-1.5">
                                <User size={15} className="text-indigo-600" /> Thông tin cán bộ lập / liên hệ:
                            </label>
                            <button
                                type="button"
                                onClick={() => handleSyncGhiChuCanBo()}
                                className="text-[11px] bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1"
                            >
                                <Sparkles size={12} /> Ghép câu Ghi chú
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Họ và tên cán bộ (mặc định user lập giấy mời):
                                </label>
                                <input
                                    type="text"
                                    value={formData.canBoTen || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleChange('canBoTen', val);
                                        handleSyncGhiChuCanBo(val, formData.canBoSdt);
                                        handleSyncNoiNhanLuu(formData.toVietTat, val);
                                    }}
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                                    placeholder="VD: Nguyễn Quốc Thái"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Số điện thoại cán bộ liên hệ:
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.canBoSdt || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            handleChange('canBoSdt', val);
                                            handleSyncGhiChuCanBo(formData.canBoTen, val);
                                        }}
                                        className="w-full p-2 pl-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                                        placeholder="VD: 0384844113"
                                    />
                                    <Phone size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Dòng Ghi chú hoàn chỉnh xuất ra văn bản:
                            </label>
                            <input
                                type="text"
                                value={formData.ghiChuCanBo}
                                onChange={(e) => handleChange('ghiChuCanBo', e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium italic text-slate-800"
                                placeholder="Để biết thêm chi tiết, liên hệ ông Nguyễn Quốc Thái – Nhân viên Chi nhánh Chơn Thành, SĐT: 0384844113."
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* FORM SECTION 5: NƠI NHẬN & NGƯỜI KÝ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                    <MapPin size={16} className="text-rose-600" /> 5. Nơi nhận & Thẩm quyền ký ban hành
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Nơi nhận */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pt-1">
                            <label className="font-bold text-slate-700">Các dòng trong mục Nơi nhận:</label>
                            <button
                                type="button"
                                onClick={handleAddNoiNhan}
                                className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1"
                            >
                                <Plus size={14} /> Thêm dòng
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            {formData.noiNhan.map((nn, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={nn}
                                        onChange={(e) => handleUpdateNoiNhan(idx, e.target.value)}
                                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveNoiNhan(idx)}
                                        className="text-slate-400 hover:text-red-600 p-1"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chức danh người ký */}
                    <div className="space-y-3">
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Chức danh ký (Dòng 1):</label>
                            <input
                                type="text"
                                value={formData.nguoiKyChucVu1}
                                onChange={(e) => handleChange('nguoiKyChucVu1', e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-800 uppercase"
                                placeholder="KT. GIÁM ĐỐC"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Chức danh ký (Dòng 2):</label>
                            <input
                                type="text"
                                value={formData.nguoiKyChucVu2}
                                onChange={(e) => handleChange('nguoiKyChucVu2', e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-800 uppercase"
                                placeholder="PHÓ GIÁM ĐỐC"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Họ và tên người ký (tùy chọn):</label>
                            <input
                                type="text"
                                value={formData.nguoiKyTen}
                                onChange={(e) => handleChange('nguoiKyTen', e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                                placeholder="Để trống nếu không in tên bên dưới"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GiayMoiForm;
