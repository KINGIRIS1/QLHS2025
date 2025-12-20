
import React, { useState, useEffect } from 'react';
import { PhieuInfoData, generatePreviewData, PLANNING_PRESETS, PlanningConfig, parseNumber } from '../../services/phieuInfoService';
import { FileText, Settings, Download, RefreshCw, CheckCircle, AlertCircle, Map as MapIcon, User, MapPin, Calendar, Hash, FileDigit, Briefcase, UserCog, Building2, Eye, FileOutput, X, Trash2, Plus, Edit, RotateCcw } from 'lucide-react';
import saveAs from 'file-saver';
import { User as UserType } from '../../types';

interface ProviderConfig {
    name: string;
    title: string;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
    { name: 'Đỗ Tiến Dũng', title: 'Tổ trưởng tổ đo đạc' },
    { name: 'Phạm Ngọc Tân', title: 'Tổ phó tổ đo đạc' }
];

interface CungCapThongTinTabProps {
    currentUser?: UserType;
}

const CungCapThongTinTab: React.FC<CungCapThongTinTabProps> = ({ currentUser }) => {
    // Load Provider Config from LocalStorage
    const [providers, setProviders] = useState<ProviderConfig[]>(() => {
        const saved = localStorage.getItem('phieu_info_providers');
        return saved ? JSON.parse(saved) : DEFAULT_PROVIDERS;
    });

    // --- CONFIG PLANNING STATE ---
    const [planningConfigs, setPlanningConfigs] = useState<PlanningConfig[]>(() => {
        const saved = localStorage.getItem('planning_settings_v2');
        return saved ? JSON.parse(saved) : PLANNING_PRESETS;
    });
    
    // Modal state for Planning Settings
    const [isPlanningSettingsOpen, setIsPlanningSettingsOpen] = useState(false);
    const [tempPlanningConfigs, setTempPlanningConfigs] = useState<PlanningConfig[]>([]);

    const [formData, setFormData] = useState<PhieuInfoData>({
        Ten_Nguoi_Yeu_Cau: '', UQ: '', Dia_Chi: '', Ngay_Nop: new Date().toISOString().split('T')[0],
        
        // Ủy quyền chi tiết
        UQ_Loai: '', UQ_So: '', UQ_Ngay: '', UQ_VPCC: '',

        Ten_CSD: '', Dia_Chi_Thua_Dat: '', Phuong: 'phường Chơn Thành',
        Thua_Cu: '', To_Cu: '', 
        DT_Cu: '0', DT_ODT: '0', DT_CLN: '0', // Diện tích chi tiết
        To_2024: '', Thua_2024: '', DT_Moi: '', To_106: '',
        TBTH: '', QDTH: '',
        
        // Dynamic Planning Values will be stored here like QH_Value, KH_Value...
        // Initialize common ones to avoid undefined if needed, though render handles it
        QH_Value: '', KH_Value: '', QHC_Value: '', QHC_DC_Value: '', QHC_DC_Moi_Value: '', QHPK_Value: '',

        Nguoi_1: providers[0]?.name || '', 
        CV_1: providers[0]?.title || '', 
        Nguoi_2: currentUser?.name || '...',
    });

    // Update Nguoi_2 when currentUser changes
    useEffect(() => {
        if (currentUser) {
            setFormData(prev => ({ ...prev, Nguoi_2: currentUser.name }));
        }
    }, [currentUser]);

    const [previewData, setPreviewData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    
    // Setting Modal State (Providers)
    const [isConfigProviders, setIsConfigProviders] = useState(false);
    const [tempProviders, setTempProviders] = useState<ProviderConfig[]>([]);

    // Tự động tính DT_CLN khi DT_Cu hoặc DT_ODT thay đổi
    useEffect(() => {
        const total = parseNumber(formData.DT_Cu);
        const odt = parseNumber(formData.DT_ODT);
        const cln = Math.max(0, total - odt).toFixed(1); // Làm tròn 1 số lẻ
        setFormData(prev => ({ ...prev, DT_CLN: cln }));
    }, [formData.DT_Cu, formData.DT_ODT]);

    // Auto Preview Data Calculation
    useEffect(() => {
        // Pass the dynamic planningConfigs to the generator
        const data = generatePreviewData(formData, planningConfigs);
        setPreviewData(data);
    }, [formData, planningConfigs]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // --- Provider Config Handlers ---
    const handleProvider1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedName = e.target.value;
        const provider = providers.find(p => p.name === selectedName);
        if (provider) {
            setFormData(prev => ({ ...prev, Nguoi_1: provider.name, CV_1: provider.title }));
        } else {
            setFormData(prev => ({ ...prev, Nguoi_1: selectedName, CV_1: '' }));
        }
    };

    const openProviderConfig = () => {
        setTempProviders([...providers]);
        setIsConfigProviders(true);
    };

    const saveProviderConfig = () => {
        setProviders(tempProviders);
        localStorage.setItem('phieu_info_providers', JSON.stringify(tempProviders));
        setIsConfigProviders(false);
        if (tempProviders.length > 0 && !tempProviders.find(p => p.name === formData.Nguoi_1)) {
             setFormData(prev => ({ ...prev, Nguoi_1: tempProviders[0].name, CV_1: tempProviders[0].title }));
        }
    };

    const updateTempProvider = (index: number, field: keyof ProviderConfig, value: string) => {
        const newArr = [...tempProviders];
        newArr[index] = { ...newArr[index], [field]: value };
        setTempProviders(newArr);
    };

    const addTempProvider = () => {
        setTempProviders([...tempProviders, { name: '', title: '' }]);
    };

    const removeTempProvider = (index: number) => {
        setTempProviders(tempProviders.filter((_, i) => i !== index));
    };

    // --- Planning Config Handlers ---
    const openPlanningConfig = () => {
        setTempPlanningConfigs([...planningConfigs]);
        setIsPlanningSettingsOpen(true);
    };

    const savePlanningConfig = () => {
        setPlanningConfigs(tempPlanningConfigs);
        localStorage.setItem('planning_settings_v2', JSON.stringify(tempPlanningConfigs));
        setIsPlanningSettingsOpen(false);
    };

    const updateTempPlanning = (index: number, field: keyof PlanningConfig, value: string) => {
        const newArr = [...tempPlanningConfigs];
        newArr[index] = { ...newArr[index], [field]: value };
        setTempPlanningConfigs(newArr);
    };

    const addTempPlanning = () => {
        const newKey = `CUSTOM_${Math.floor(Math.random() * 1000)}`;
        setTempPlanningConfigs([...tempPlanningConfigs, {
            key: newKey,
            Label: 'Quy hoạch mới',
            TenDoAn: '',
            SoQuyetDinh: '',
            NgayQuyetDinh: '',
            CoQuanBanHanh: ''
        }]);
    };

    const removeTempPlanning = (index: number) => {
        if (confirm("Bạn có chắc muốn xóa loại quy hoạch này?")) {
            setTempPlanningConfigs(tempPlanningConfigs.filter((_, i) => i !== index));
        }
    };

    const resetPlanningToDefault = () => {
        if (confirm("Khôi phục danh sách mặc định? Các cấu hình tùy chỉnh sẽ bị mất.")) {
            setTempPlanningConfigs(PLANNING_PRESETS);
        }
    };

    // Hàm chuẩn hóa tên file (Loại bỏ dấu tiếng Việt và ký tự đặc biệt)
    const sanitizeFilename = (str: string) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d").replace(/Đ/g, "D")
            .replace(/[^a-zA-Z0-9]/g, "_");
    };

    const handleExport = async () => {
        setLoading(true);
        try {
            // 1. Lấy nội dung HTML
            const content = renderPreviewHTML(); 
            
            // 2. Tạo tên file
            const namePart = sanitizeFilename(formData.Ten_CSD || 'Khach');
            const toPart = sanitizeFilename(formData.To_2024 || formData.To_Cu || '0');
            const thuaPart = sanitizeFilename(formData.Thua_2024 || formData.Thua_Cu || '0');
            const fileName = `Phieu_TT_${namePart}_To${toPart}_Thua${thuaPart}.doc`;

            // 3. Tạo khung HTML chuẩn Word
            const header = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                      xmlns:w='urn:schemas-microsoft-com:office:word' 
                      xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                    <meta charset='utf-8'>
                    <style>
                        @page Section1 {
                            size: 595.3pt 841.9pt; /* A4 Portrait */
                            margin: 2.0cm 2.0cm 2.0cm 3.0cm; /* Top Right Bottom Left */
                        }
                        div.Section1 { page: Section1; }
                        body { 
                            font-family: "Times New Roman", serif; 
                            font-size: 13pt; 
                            line-height: 1.3; 
                        }
                        p { margin: 0; margin-bottom: 2px; }
                        table { border-collapse: collapse; }
                    </style>
                </head>
                <body>
                    <div class="Section1">
                        ${content}
                    </div>
                </body>
                </html>
            `;

            // 4. Lưu và Mở
            if (window.electronAPI && window.electronAPI.saveAndOpenFile) {
                const base64Data = btoa(unescape(encodeURIComponent(header)));
                const result = await window.electronAPI.saveAndOpenFile({
                    fileName: fileName,
                    base64Data: base64Data
                });
                
                if (result.success) {
                    if (result.path && window.electronAPI.openFilePath) {
                        await window.electronAPI.openFilePath(result.path);
                    }
                } else {
                    if (typeof result.message === 'string' && result.message.includes('EBUSY')) {
                        alert("Lỗi: File đang mở hoặc trùng tên file.\nVui lòng đóng file Word cũ trước khi xuất lại.");
                    } else {
                        alert("Lỗi khi lưu file: " + result.message);
                    }
                }
            } else {
                const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
                saveAs(blob, fileName);
            }
        } catch (error: any) {
            console.error(error);
            alert("Lỗi xuất file: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- GENERATE PREVIEW HTML (A4 STYLE) ---
    const renderPreviewHTML = () => {
        if (!previewData) return '';

        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear();

        const uqText = previewData.UQ_FULL_TEXT ? previewData.UQ_FULL_TEXT : '';
        
        // CHUẨN HÓA: Tách từng dòng quy hoạch thành thẻ <p>.
        // Dùng text-align: justify nhưng nhờ tách thẻ <p> nên Word sẽ hiểu
        // các dòng ngắn là kết thúc đoạn văn và không kéo giãn.
        const quyHoachHtml = previewData.QUY_HOACH_VANBAN 
            ? previewData.QUY_HOACH_VANBAN.split('\n').map((line: string) => `<p style="margin: 0; margin-bottom: 5px;">${line}</p>`).join('') 
            : '';

        // Helper chuyển Title Case (Viết hoa chữ cái đầu)
        const toTitleCase = (str: string) => {
            if (!str) return '';
            return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        };

        // --- NEW: Sử dụng Table để tạo gạch chân (Word compatible) ---
        // Word render Table border rất chuẩn. Ta dùng 1 table nhỏ, căn giữa, border-bottom.
        
        // Bên trái (Tên cơ quan): Ngắn (~85px) vừa đủ "CHI NHÁNH CHƠN THÀNH"
        const lineLeftHtml = `
            <table style="width: 85px; margin: 0 auto; border-collapse: collapse; border: none;">
                <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
            </table>
        `;

        // Bên phải (Quốc hiệu): Vừa đủ chữ "Độc lập - Tự do - Hạnh phúc" (~185px)
        const lineRightHtml = `
            <table style="width: 185px; margin: 0 auto; border-collapse: collapse; border: none;">
                <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
            </table>
        `;

        return `
            <div style="font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; color: black; text-align: justify;">
                
                <!-- HEADER CHUẨN HÓA CHO WORD (Sử dụng Table border-bottom thay vì div border-top) -->
                <table style="width: 100%; text-align: center; font-weight: bold; border-collapse: collapse; margin-bottom: 0px; font-size: 11pt; border: none;">
                    <tr style="vertical-align: top;">
                        <td style="width: 45%; padding: 0;">
                            <p style="margin: 0;">VĂN PHÒNG ĐKĐĐ TỈNH ĐỒNG NAI</p>
                            <p style="margin: 0;">CHI NHÁNH CHƠN THÀNH</p>
                            ${lineLeftHtml}
                        </td>
                        <td style="width: 55%; padding: 0;">
                            <p style="margin: 0;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                            <p style="margin: 0;">Độc lập - Tự do - Hạnh phúc</p>
                            ${lineRightHtml}
                        </td>
                    </tr>
                </table>

                <div style="text-align: right; font-style: italic; margin-bottom: 45px; margin-top: 25px;">
                    Chơn Thành, ngày ${day} tháng ${month} năm ${year}
                </div>

                <div style="text-align: center; font-weight: bold; font-size: 15pt; margin-bottom: 20px;">
                    PHIẾU CUNG CẤP THÔNG TIN
                </div>

                <!-- I. NGƯỜI YÊU CẦU -->
                <div style="margin-bottom: 5px;"><b>I. Người yêu cầu cung cấp thông tin:</b></div>
                <div style="margin-left: 20px; margin-bottom: 5px;">Ông (bà): <b>${toTitleCase(formData.Ten_Nguoi_Yeu_Cau)}</b></div>
                <div style="margin-left: 20px; margin-bottom: 10px;">Địa chỉ: ${formData.Dia_Chi}</div>

                <!-- II. NGƯỜI CUNG CẤP -->
                <div style="margin-bottom: 5px;"><b>II. Người cung cấp thông tin:</b></div>
                <table style="width: 100%; margin-left: 20px; margin-bottom: 10px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 50%;">1. Ông (bà): <b>${formData.Nguoi_1}</b></td>
                        <td>Chức vụ: ${formData.CV_1}</td>
                    </tr>
                    <tr>
                        <td style="width: 50%;">2. Ông (bà): <b>${formData.Nguoi_2}</b></td>
                        <td>Chức vụ: Nhân viên</td>
                    </tr>
                </table>

                <!-- III. NỘI DUNG -->
                <div style="margin-bottom: 5px;"><b>III. Nội dung cần cung cấp:</b></div>
                <p style="text-indent: 30px; margin-bottom: 5px;">
                    Ông (bà): <b>${toTitleCase(formData.Ten_Nguoi_Yeu_Cau)}</b> ${uqText} nộp phiếu yêu cầu cung cấp thông tin tại Trung tâm phục vụ hành chính công ${formData.Phuong} ${previewData.Ngay_Nop_Fmt}.
                </p>
                <p style="text-indent: 30px; margin-bottom: 5px;">
                    Nội dung yêu cầu cung cấp thông tin quy hoạch thửa đất số <b>${formData.Thua_Cu}</b>, tờ bản đồ số <b>${formData.To_Cu}</b>, diện tích <b>${formData.DT_Cu}m²</b> ${previewData.Loai_Dat_Fmt} tọa lạc tại ${formData.Dia_Chi_Thua_Dat}, ${formData.Phuong}, tỉnh Bình Phước của ông (bà) <b>${formData.Ten_CSD}</b>.
                </p>
                <p style="text-indent: 30px; margin-bottom: 5px;">
                    Căn cứ chức năng, nhiệm vụ Văn phòng Đăng ký Đất đai tỉnh Bình Phước – chi nhánh Chơn Thành cung cấp thông tin cho ông (bà) ${formData.Ten_Nguoi_Yeu_Cau} với các nội dung như sau:
                </p>

                <div style="margin-top: 10px; font-weight: bold; font-style: italic;">* Thông tin về thửa đất:</div>
                <div style="margin-left: 10px;">
                    <p style="margin-bottom: 5px; text-align: justify;">
                        - Thửa đất số <b>${formData.Thua_Cu}</b>, tờ bản đồ số <b>${formData.To_Cu}</b>, diện tích <b>${formData.DT_Cu}m²</b> ${previewData.Loai_Dat_Fmt} ${previewData.DIEU_CHINH_THUA_DAT}
                    </p>
                    ${previewData.CHENH_LECH_VANBAN ? `<p style="margin-bottom: 5px;">${previewData.CHENH_LECH_VANBAN}</p>` : ''}
                </div>

                <div style="margin-top: 10px; font-weight: bold; font-style: italic;">* Về quy hoạch, kế hoạch sử dụng đất:</div>
                <!-- Vẫn giữ Justify cho đúng chuẩn, nhưng các thẻ <p> con sẽ tự ngắt dòng đúng -->
                <div style="margin-left: 10px; text-align: justify;">
                    ${quyHoachHtml}
                    ${previewData.TBTH_VANBAN ? `<p style="margin-top: 5px;">${previewData.TBTH_VANBAN}</p>` : ''}
                    ${previewData.QDTH_VANBAN ? `<p style="margin-top: 5px;">${previewData.QDTH_VANBAN}</p>` : ''}
                </div>

                <p style="text-indent: 30px; margin-top: 15px;">
                    Vậy Văn phòng Đăng ký Đất đai tỉnh Bình Phước – chi nhánh Chơn Thành cung cấp thông tin cho ông (bà) được biết.
                </p>

                <!-- SIGNATURE (SPLIT COLUMNS) -->
                <table style="width: 100%; margin-top: 30px; text-align: center; border-collapse: collapse;">
                    <tr style="vertical-align: top;">
                        <td style="width: 50%;">
                            <b>Người cung cấp</b><br><br><br><br><br>
                        </td>
                        <td style="width: 50%;">
                            <b>${previewData.CHUC_VU_GIAM_DOC.replace(/\n/g, '<br>')}</b><br><br><br><br><br>
                        </td>
                    </tr>
                </table>
            </div>
        `;
    };

    // Styling constants - FIXED ICON POSITION
    const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1";
    const inputClass = "w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all";
    const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full p-4 overflow-hidden bg-[#f1f5f9]">
            {/* LEFT: FORM INPUT */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                
                {/* 1. Thông tin người yêu cầu */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                        <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><FileText size={16}/></span> 
                        Người yêu cầu cung cấp
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-1">
                            <label className={labelClass}>Họ tên người yêu cầu *</label>
                            <div className="relative">
                                <User size={16} className={iconClass} />
                                <input className={`${inputClass} font-bold text-blue-700 capitalize`} value={formData.Ten_Nguoi_Yeu_Cau} onChange={e => handleChange('Ten_Nguoi_Yeu_Cau', e.target.value)} />
                            </div>
                        </div>
                        <div className="md:col-span-1">
                            <label className={labelClass}>Ngày nộp phiếu *</label>
                            <div className="relative">
                                <Calendar size={16} className={iconClass} />
                                <input type="date" className={inputClass} value={formData.Ngay_Nop} onChange={e => handleChange('Ngay_Nop', e.target.value)} />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClass}>Địa chỉ liên hệ</label>
                            <div className="relative">
                                <MapPin size={16} className={iconClass} />
                                <input className={inputClass} value={formData.Dia_Chi} onChange={e => handleChange('Dia_Chi', e.target.value)} />
                            </div>
                        </div>
                        
                        {/* PHẦN ỦY QUYỀN MỚI */}
                        <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-3 border-b border-slate-200 pb-2">
                                <UserCog size={14} /> Thông tin Ủy quyền (Nếu có)
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Loại ủy quyền</label>
                                    <div className="relative">
                                        <FileText size={14} className={iconClass} />
                                        <select className={`${inputClass} appearance-none bg-white`} value={formData.UQ_Loai} onChange={e => handleChange('UQ_Loai', e.target.value)}>
                                            <option value="">-- Không ủy quyền --</option>
                                            <option value="Giấy ủy quyền">Giấy ủy quyền</option>
                                            <option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Số công chứng (Kèm quyển số)</label>
                                    <div className="relative">
                                        <Hash size={14} className={iconClass} />
                                        <input className={inputClass} placeholder="VD: 003305 quyển số 01/2025..." value={formData.UQ_So} onChange={e => handleChange('UQ_So', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Ngày công chứng</label>
                                    <div className="relative">
                                        <Calendar size={14} className={iconClass} />
                                        <input type="date" className={inputClass} value={formData.UQ_Ngay} onChange={e => handleChange('UQ_Ngay', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Văn phòng công chứng</label>
                                    <div className="relative">
                                        <Building2 size={14} className={iconClass} />
                                        <input className={inputClass} placeholder="VD: VPCC Nguyễn Cảnh" value={formData.UQ_VPCC} onChange={e => handleChange('UQ_VPCC', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Cấu hình người ký */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                            <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><User size={16}/></span>
                            Người cung cấp thông tin
                        </h3>
                        <button onClick={openProviderConfig} className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 hover:bg-white hover:shadow-sm transition-all">
                            <Settings size={12}/> Cấu hình DS
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Người thứ 1 (Tổ trưởng/Phó)</label>
                            <div className="relative">
                                <User size={16} className={iconClass} />
                                <select className={`${inputClass} appearance-none bg-white cursor-pointer`} value={formData.Nguoi_1} onChange={handleProvider1Change}>
                                    {providers.map((p, idx) => (
                                        <option key={idx} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-[10px] text-orange-600 mt-1 italic pl-1 font-medium">{formData.CV_1}</div>
                        </div>
                        <div>
                            <label className={labelClass}>Người thứ 2 (Nhân viên)</label>
                            <div className="relative">
                                <User size={16} className={iconClass} />
                                <input className={`${inputClass} bg-gray-50 text-gray-500 font-medium cursor-not-allowed`} value={formData.Nguoi_2} readOnly />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Thông tin Thửa đất */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><MapIcon size={16}/></span> 
                        Thông tin Thửa đất
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Tên Chủ Sử Dụng (trên GCN)</label>
                            <div className="relative">
                                <Briefcase size={16} className={iconClass} />
                                <input className={`${inputClass} font-bold uppercase`} value={formData.Ten_CSD} onChange={e => handleChange('Ten_CSD', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Xã / Phường *</label>
                            <div className="relative">
                                <MapPin size={16} className={iconClass} />
                                <select className={`${inputClass} appearance-none bg-white cursor-pointer`} value={formData.Phuong} onChange={e => handleChange('Phuong', e.target.value)}>
                                    <option value="phường Chơn Thành">Chơn Thành</option>
                                    <option value="phường Minh Hưng">Minh Hưng</option>
                                    <option value="xã Nha Bích">Nha Bích</option>
                                </select>
                            </div>
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelClass}>Địa chỉ thửa đất</label>
                            <div className="relative">
                                <MapPin size={16} className={iconClass} />
                                <input className={inputClass} value={formData.Dia_Chi_Thua_Dat} onChange={e => handleChange('Dia_Chi_Thua_Dat', e.target.value)} />
                            </div>
                        </div>
                        
                        {/* Block: GCN Cũ */}
                        <div className="md:col-span-3 rounded-xl border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                                <FileDigit size={14}/> Theo Giấy Chứng Nhận (Cũ)
                            </div>
                            <div className="p-3 grid grid-cols-12 gap-3 bg-white">
                                <div className="col-span-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tờ cũ</label>
                                    <input className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-blue-500" value={formData.To_Cu} onChange={e => handleChange('To_Cu', e.target.value)} />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Thửa cũ</label>
                                    <input className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-blue-500" value={formData.Thua_Cu} onChange={e => handleChange('Thua_Cu', e.target.value)} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tổng DT</label>
                                    <input className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-blue-500" value={formData.DT_Cu} onChange={e => handleChange('DT_Cu', e.target.value)} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Đất Ở</label>
                                    <input className="w-full border border-blue-200 rounded-lg p-2 text-sm font-bold text-center text-blue-700 outline-none focus:border-blue-500" value={formData.DT_ODT} onChange={e => handleChange('DT_ODT', e.target.value)} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-emerald-500 uppercase mb-1 block">Đất NN</label>
                                    <div className="w-full border border-emerald-200 bg-emerald-50 rounded-lg p-2 text-sm font-bold text-center text-emerald-700 h-[38px] flex items-center justify-center cursor-not-allowed">
                                        {formData.DT_CLN}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Block: Hiện trạng mới */}
                        <div className="md:col-span-3 rounded-xl border border-indigo-200 overflow-hidden">
                            <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-200 text-xs font-bold text-indigo-700 uppercase flex items-center gap-2">
                                <Hash size={14}/> Theo Hiện trạng mới (2024)
                            </div>
                            <div className="p-3 grid grid-cols-4 gap-3 bg-white">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tờ 2024</label><input className="w-full border border-slate-200 rounded-lg p-2 text-sm text-center outline-none focus:border-indigo-500" value={formData.To_2024} onChange={e => handleChange('To_2024', e.target.value)} /></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Thửa 2024</label><input className="w-full border border-slate-200 rounded-lg p-2 text-sm text-center outline-none focus:border-indigo-500" value={formData.Thua_2024} onChange={e => handleChange('Thua_2024', e.target.value)} /></div>
                                <div><label className="text-[10px] font-bold text-purple-600 uppercase mb-1 block">Tờ 106</label><input className="w-full border border-purple-200 bg-purple-50 rounded-lg p-2 text-sm text-center font-bold text-purple-700 outline-none focus:border-purple-500" value={formData.To_106} onChange={e => handleChange('To_106', e.target.value)} placeholder="(Nếu có)"/></div>
                                <div><label className="text-[10px] font-bold text-blue-600 uppercase mb-1 block">DT Mới</label><input className="w-full border border-blue-200 bg-blue-50 rounded-lg p-2 text-sm text-center font-bold text-blue-700 outline-none focus:border-blue-500" value={formData.DT_Moi} onChange={e => handleChange('DT_Moi', e.target.value)} /></div>
                            </div>
                        </div>

                        {/* Block: Thu hồi */}
                        <div className="md:col-span-3 flex gap-4">
                            <div className="flex-1">
                                <label className={labelClass}>Số Thông báo Thu hồi (TBTH)</label>
                                <div className="relative">
                                    <AlertCircle size={16} className={iconClass} />
                                    <input className={inputClass} value={formData.TBTH} onChange={e => handleChange('TBTH', e.target.value)} placeholder="Nhập số TB..." />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className={labelClass}>Số Quyết định Thu hồi (QĐTH)</label>
                                <div className="relative">
                                    <CheckCircle size={16} className={iconClass} />
                                    <input className={inputClass} value={formData.QDTH} onChange={e => handleChange('QDTH', e.target.value)} placeholder="Nhập số QĐ..." />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Quy hoạch (DYNAMIC RENDERING) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                            <span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Eye size={16}/></span> 
                            Thông tin Quy hoạch
                        </h3>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={openPlanningConfig} className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-md bg-white text-purple-700 shadow-sm border border-purple-100 hover:bg-purple-50 transition-all">
                                <Settings size={12}/> Cài đặt
                            </button>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        {/* Map over dynamic planningConfigs */}
                        {planningConfigs.map((cfg) => (
                            <div key={cfg.key} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 hover:border-purple-200 transition-colors">
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{cfg.Label}</span>
                                    <span className="text-[10px] text-slate-400 italic truncate max-w-[250px]" title={cfg.TenDoAn}>{cfg.TenDoAn}</span>
                                </div>
                                <input 
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none bg-white transition-all" 
                                    placeholder={`Nhập nội dung quy hoạch...`}
                                    value={(formData as any)[`${cfg.key}_Value`] || ''}
                                    onChange={e => handleChange(`${cfg.key}_Value`, e.target.value)}
                                />
                            </div>
                        ))}
                        {planningConfigs.length === 0 && (
                            <div className="text-center p-4 text-xs text-gray-400 italic bg-gray-50 rounded-lg">
                                Chưa có cấu hình quy hoạch. Bấm "Cài đặt" để thêm.
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Export Options - Mobile only fallback */}
                <div className="lg:hidden">
                    <button onClick={handleExport} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                        {loading ? <RefreshCw className="animate-spin" size={18}/> : <Download size={18}/>}
                        Xuất File Word
                    </button>
                </div>
            </div>

            {/* RIGHT: A4 PREVIEW (FULL SIZE) */}
            <div className="hidden lg:flex flex-col flex-1 bg-slate-300 overflow-y-auto overflow-x-auto p-10 items-center custom-scrollbar shadow-inner relative min-w-0">
                <div className="fixed top-[120px] right-8 z-30 flex flex-col gap-2">
                    <button onClick={handleExport} disabled={loading} className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center" title="Xuất Word & Mở">
                        {loading ? <RefreshCw className="animate-spin" size={20}/> : <FileOutput size={20}/>}
                    </button>
                </div>

                <div className="bg-white w-[210mm] min-h-[297mm] h-auto shadow-[0_0_80px_rgba(0,0,0,0.25)] p-[20mm_15mm_20mm_25mm] transition-all animate-fade-in-up relative ring-1 ring-slate-400 mb-24 flex flex-col shrink-0">
                    <div className="absolute top-0 left-0 w-[25mm] h-full bg-slate-50/40 pointer-events-none border-r border-slate-100 flex items-center justify-center z-0">
                        <div className="rotate-90 text-[10px] font-black text-slate-300 uppercase tracking-[1.5em] whitespace-nowrap">LỀ TRÁI ĐÓNG GHIM 25MM</div>
                    </div>
                    <div className="relative z-10 w-full h-auto overflow-visible select-none pointer-events-none" dangerouslySetInnerHTML={{ __html: renderPreviewHTML() }} />
                </div>

                <div className="fixed bottom-8 bg-white/95 backdrop-blur px-10 py-4 rounded-full border border-slate-400 shadow-2xl flex items-center gap-8 text-[11px] font-black text-slate-700 uppercase tracking-widest z-30 pointer-events-auto border-b-4 border-b-blue-600">
                    <div className="flex items-center gap-2.5"><MapIcon size={18} className="text-blue-500" /> Tự động dàn trang</div>
                    <div className="w-px h-5 bg-slate-300"></div>
                    <div className="flex items-center gap-2.5"><CheckCircle size={18} className="text-emerald-500" /> Lề chuẩn A4</div>
                    <div className="w-px h-5 bg-slate-300"></div>
                    <div className="flex items-center gap-2.5 text-blue-600 animate-pulse"><AlertCircle size={18} /> Chế độ xem trước</div>
                </div>
            </div>

            {/* MODAL CẤU HÌNH NGƯỜI CUNG CẤP */}
            {isConfigProviders && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-xl animate-fade-in-up">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Danh sách người cung cấp (Mục 1)</h3>
                            <button onClick={() => setIsConfigProviders(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
                        </div>
                        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                            {tempProviders.map((p, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <div className="flex-1 space-y-1">
                                        <input className="w-full border rounded px-2 py-1 text-sm" placeholder="Họ tên" value={p.name} onChange={e => updateTempProvider(idx, 'name', e.target.value)} />
                                        <input className="w-full border rounded px-2 py-1 text-xs text-gray-500" placeholder="Chức vụ" value={p.title} onChange={e => updateTempProvider(idx, 'title', e.target.value)} />
                                    </div>
                                    <button onClick={() => removeTempProvider(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                </div>
                            ))}
                            <button onClick={addTempProvider} className="w-full border border-dashed border-blue-300 text-blue-600 py-2 rounded text-sm font-bold hover:bg-blue-50">+ Thêm người</button>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button onClick={() => setIsConfigProviders(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                            <button onClick={saveProviderConfig} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Lưu thay đổi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CẤU HÌNH QUY HOẠCH */}
            {isPlanningSettingsOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                <Settings className="text-purple-600" /> Cấu hình Loại Quy Hoạch
                            </h3>
                            <button onClick={() => setIsPlanningSettingsOpen(false)}><X size={24} className="text-gray-400 hover:text-red-500"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-gray-50 flex-1 space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-sm text-gray-600">Quản lý các thông tin quy hoạch (Tên đồ án, Quyết định...).</p>
                                <button onClick={addTempPlanning} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700">
                                    <Plus size={14} /> Thêm loại mới
                                </button>
                            </div>

                            <div className="space-y-4">
                                {tempPlanningConfigs.map((cfg, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => removeTempPlanning(idx)} className="text-red-400 hover:text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100" title="Xóa">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Mã (Key)</label>
                                                <input className="w-full border bg-gray-50 rounded px-2 py-1.5 text-xs font-mono text-gray-500" value={cfg.key} readOnly disabled />
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Tên hiển thị (Label)</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-blue-800" value={cfg.Label || ''} onChange={e => updateTempPlanning(idx, 'Label', e.target.value)} placeholder="VD: QH Sử dụng đất" />
                                            </div>
                                            <div className="md:col-span-7">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tên đồ án quy hoạch</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={cfg.TenDoAn} onChange={e => updateTempPlanning(idx, 'TenDoAn', e.target.value)} placeholder="Tên đầy đủ của đồ án..." />
                                            </div>
                                            
                                            <div className="md:col-span-3">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Số Quyết định</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={cfg.SoQuyetDinh} onChange={e => updateTempPlanning(idx, 'SoQuyetDinh', e.target.value)} />
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ngày QĐ</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={cfg.NgayQuyetDinh} onChange={e => updateTempPlanning(idx, 'NgayQuyetDinh', e.target.value)} />
                                            </div>
                                            <div className="md:col-span-6">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cơ quan ban hành</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={cfg.CoQuanBanHanh} onChange={e => updateTempPlanning(idx, 'CoQuanBanHanh', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 border-t bg-white flex justify-between items-center rounded-b-xl shrink-0">
                            <button onClick={resetPlanningToDefault} className="text-xs text-orange-600 hover:text-orange-800 underline flex items-center gap-1">
                                <RotateCcw size={12} /> Khôi phục mặc định
                            </button>
                            <div className="flex gap-2">
                                <button onClick={() => setIsPlanningSettingsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Hủy</button>
                                <button onClick={savePlanningConfig} className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-bold shadow-md">Lưu Cấu Hình</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CungCapThongTinTab;
