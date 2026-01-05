
import React from 'react';
import { User, Settings2, CheckSquare, Square, Plus, Trash2, MoveHorizontal, Quote, LandPlot, ClipboardList, User as UserIcon, AlertTriangle } from 'lucide-react';

interface BoundaryChange {
  id: string;
  direction: 'Bắc' | 'Đông' | 'Nam' | 'Tây';
  type: 'tăng' | 'giảm';
  area: string;
  adjacentPlot: string;
  mapSheet: string;
  objectName: string;
  roadNumber?: string; 
}

const DIRECTIONS = ['Bắc', 'Đông', 'Nam', 'Tây'];
const WARDS_QUICK = [
    { label: 'xã Nha Bích', value: 'xã Nha Bích' },
    { label: 'phường Chơn Thành', value: 'phường Chơn Thành' },
    { label: 'phường Minh Hưng', value: 'phường Minh Hưng' }
];

const ADJACENT_OBJECTS = ["Thửa đất số", "Đường", "Đường nhựa", "Đường bê tông", "Đường đất", "Sông", "Suối", "Mương nước", "Cống"];
const PRESETS = {
    ROAD: "Do mép đường theo hiện trạng có thay đổi so với GCN đã cấp (hiện trạng là đường đất và được công nhận theo kết quả đo đạc bản đồ địa chính năm 2024)",
    // EDIT: Sửa lỗi chính tả gcnqsd -> GCNQSD
    ERROR: "Ranh giới thửa đất có biến động so với GCNQSD đất do khi đo đạc cấp GCNQSD đất chưa chính xác"
};

// EDIT: Nội dung mặc định cho BĐĐC
const PRESET_BDDC = "Khi đo đạc lập bản đồ địa chính không có sự chỉ ranh của chủ sử dụng đất và các chủ sử dụng giáp ranh dẫn đến ranh giới mốc giới chưa được các bên xác định chính xác";

interface BienBanFormProps {
    formData: any;
    setFormData: (data: any) => void;
    boundaryChanges: BoundaryChange[];
    setBoundaryChanges: (data: BoundaryChange[]) => void;
    
    // Props mới cho BĐĐC
    boundaryChangesBDDC: BoundaryChange[];
    setBoundaryChangesBDDC: (data: BoundaryChange[]) => void;
    
    onResetFile: () => void;
}

const BienBanForm: React.FC<BienBanFormProps> = ({ 
    formData, setFormData, 
    boundaryChanges, setBoundaryChanges, 
    boundaryChangesBDDC, setBoundaryChangesBDDC,
    onResetFile 
}) => {
    
    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
        onResetFile();
    };

    // Helper cho biến động GCN (Existing)
    const addBoundaryRow = () => {
        const newRow: BoundaryChange = {
          id: Math.random().toString(36).substr(2, 9),
          direction: 'Bắc',
          type: 'tăng',
          area: '',
          adjacentPlot: '',
          mapSheet: '',
          objectName: 'Thửa đất số',
          roadNumber: ''
        };
        setBoundaryChanges([...boundaryChanges, newRow]);
        onResetFile();
    };
    
    const removeBoundaryRow = (id: string) => {
        setBoundaryChanges(boundaryChanges.filter(row => row.id !== id));
        onResetFile();
    };
    
    const updateBoundaryRow = (id: string, field: keyof BoundaryChange, value: any) => {
        setBoundaryChanges(boundaryChanges.map(row => 
          row.id === id ? { ...row, [field]: value } : row
        ));
        onResetFile();
    };

    // Helper cho biến động BĐĐC (New)
    const addBoundaryRowBDDC = () => {
        const newRow: BoundaryChange = {
          id: Math.random().toString(36).substr(2, 9),
          direction: 'Bắc',
          type: 'tăng',
          area: '',
          adjacentPlot: '',
          mapSheet: '',
          objectName: 'Thửa đất số',
          roadNumber: ''
        };
        setBoundaryChangesBDDC([...boundaryChangesBDDC, newRow]);
        onResetFile();
    };
    
    const removeBoundaryRowBDDC = (id: string) => {
        setBoundaryChangesBDDC(boundaryChangesBDDC.filter(row => row.id !== id));
        onResetFile();
    };
    
    const updateBoundaryRowBDDC = (id: string, field: keyof BoundaryChange, value: any) => {
        setBoundaryChangesBDDC(boundaryChangesBDDC.map(row => 
          row.id === id ? { ...row, [field]: value } : row
        ));
        onResetFile();
    };

    const applyPreset = (text: string) => {
        setFormData((prev: any) => ({
            ...prev,
            NGUYEN_NHAN_TEXT: prev.NGUYEN_NHAN_TEXT ? prev.NGUYEN_NHAN_TEXT + " và " + text.toLowerCase() : text
        }));
        onResetFile();
    };

    // Helper render vùng nhập nguyên nhân GCN để tái sử dụng
    const renderGCNCauseInput = (isEmbedded: boolean) => (
        <div className={isEmbedded ? "mt-4 pt-4 border-t border-purple-100" : "space-y-3"}>
            {isEmbedded && (
                <label className="text-[12px] font-bold text-indigo-600 block mb-2 uppercase flex items-center gap-1">
                    <Quote size={14} /> Nguyên nhân (GCN)
                </label>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
                <button onClick={() => applyPreset(PRESETS.ROAD)} className="text-[11px] font-bold p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all">Do ranh đường</button>
                <button onClick={() => applyPreset(PRESETS.ERROR)} className="text-[11px] font-bold p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all">Do đo đạc cũ sai</button>
                <button onClick={() => { handleChange('NGUYEN_NHAN_TEXT', ''); }} className="text-[11px] font-bold p-2 text-rose-500 hover:bg-rose-50 rounded-lg ml-auto">Xóa sạch</button>
            </div>
            <textarea 
                className="w-full border border-indigo-200 rounded-xl p-3 text-[13px] font-medium focus:ring-2 focus:ring-indigo-500/10 outline-none min-h-[80px] bg-white leading-relaxed"
                placeholder="Nhập nội dung nguyên nhân..."
                value={formData.NGUYEN_NHAN_TEXT}
                onChange={e => handleChange('NGUYEN_NHAN_TEXT', e.target.value)}
            />
        </div>
    );

    return (
        <div className="w-[500px] bg-[#f8fafc] border-r border-slate-300 overflow-y-auto p-5 custom-scrollbar shadow-inner z-10">
            <div className="space-y-6 pb-32">
            
            {/* PHẦN TÍCH CHỌN CẤU HÌNH */}
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-wide mb-5 flex items-center gap-2.5">
                    <Settings2 size={18} className="text-blue-500" /> 
                    Cấu hình biểu mẫu
                </h3>
                <div className="grid grid-cols-1 gap-3">
                    <div className={`rounded-2xl border-2 transition-all duration-200 group ${formData.HIEN_THI_PHONG_KT ? 'bg-purple-50 border-purple-500 shadow-purple-100 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                        <button 
                            onClick={() => handleChange('HIEN_THI_PHONG_KT', !formData.HIEN_THI_PHONG_KT)}
                            className="w-full flex items-center justify-between p-4"
                        >
                            <div className="flex flex-col items-start">
                                <span className={`text-[13px] font-black uppercase ${formData.HIEN_THI_PHONG_KT ? 'text-purple-800' : 'text-slate-600'}`}>Mục II (P. Kinh tế / Dẫn đạc)</span>
                                <span className="text-[11px] text-slate-400 font-medium">Bật/Tắt thành phần & ý kiến</span>
                            </div>
                            <div className={`p-1 rounded-lg ${formData.HIEN_THI_PHONG_KT ? 'bg-purple-600 text-white' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                {formData.HIEN_THI_PHONG_KT ? <CheckSquare size={24} /> : <Square size={24} />}
                            </div>
                        </button>
                        
                        {/* Sub-options for Section II */}
                        {formData.HIEN_THI_PHONG_KT && (
                            <div className="px-4 pb-4 pt-0 animate-fade-in">
                                <div className="bg-white/50 rounded-lg p-2 flex flex-col gap-2 border border-purple-200">
                                    <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-purple-100/50 rounded transition-colors">
                                        <input 
                                            type="radio" 
                                            name="LOAI_DAI_DIEN" 
                                            value="PHONG_KT" 
                                            checked={formData.LOAI_DAI_DIEN !== 'NGUOI_DAN_DAC'} 
                                            onChange={() => handleChange('LOAI_DAI_DIEN', 'PHONG_KT')}
                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                                        />
                                        <span className="text-sm text-purple-900 font-medium">1. Phòng kinh tế</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-purple-100/50 rounded transition-colors">
                                        <input 
                                            type="radio" 
                                            name="LOAI_DAI_DIEN" 
                                            value="NGUOI_DAN_DAC" 
                                            checked={formData.LOAI_DAI_DIEN === 'NGUOI_DAN_DAC'} 
                                            onChange={() => handleChange('LOAI_DAI_DIEN', 'NGUOI_DAN_DAC')}
                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                                        />
                                        <span className="text-sm text-purple-900 font-medium">2. Người dẫn đạc</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => handleChange('HIEN_THI_Y_KIEN_GIAP_RANH', !formData.HIEN_THI_Y_KIEN_GIAP_RANH)}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 group ${formData.HIEN_THI_Y_KIEN_GIAP_RANH ? 'bg-blue-50 border-blue-500 shadow-blue-100 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                    >
                        <div className="flex flex-col items-start">
                            <span className={`text-[13px] font-black uppercase ${formData.HIEN_THI_Y_KIEN_GIAP_RANH ? 'text-blue-800' : 'text-slate-600'}`}>Ý kiến hộ giáp ranh</span>
                            <span className="text-[11px] text-slate-400 font-medium">Xác nhận ranh mốc & cam kết</span>
                        </div>
                        <div className={`p-1 rounded-lg ${formData.HIEN_THI_Y_KIEN_GIAP_RANH ? 'bg-blue-600 text-white' : 'text-slate-300 group-hover:text-slate-400'}`}>
                            {formData.HIEN_THI_Y_KIEN_GIAP_RANH ? <CheckSquare size={24} /> : <Square size={24} />}
                        </div>
                    </button>

                    <button 
                        onClick={() => handleChange('HIEN_THI_CAU_LUU_Y', !formData.HIEN_THI_CAU_LUU_Y)}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 group ${formData.HIEN_THI_CAU_LUU_Y ? 'bg-amber-50 border-amber-500 shadow-amber-100 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                    >
                        <div className="flex flex-col items-start">
                            <span className={`text-[13px] font-black uppercase ${formData.HIEN_THI_CAU_LUU_Y ? 'text-amber-900' : 'text-slate-600'}`}>Lưu ý trong Sơ họa</span>
                            <span className="text-[11px] text-slate-400 font-medium">Hiện văn bản lưu ý bên trong khung vẽ</span>
                        </div>
                        <div className={`p-1 rounded-lg ${formData.HIEN_THI_CAU_LUU_Y ? 'bg-amber-600 text-white' : 'text-slate-300 group-hover:text-slate-400'}`}>
                            {formData.HIEN_THI_CAU_LUU_Y ? <CheckSquare size={24} /> : <Square size={24} />}
                        </div>
                    </button>

                    <button 
                        onClick={() => handleChange('HIEN_THI_BIEN_DONG_BDDC', !formData.HIEN_THI_BIEN_DONG_BDDC)}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 group ${formData.HIEN_THI_BIEN_DONG_BDDC ? 'bg-rose-50 border-rose-500 shadow-rose-100 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                    >
                        <div className="flex flex-col items-start">
                            <span className={`text-[13px] font-black uppercase ${formData.HIEN_THI_BIEN_DONG_BDDC ? 'text-rose-800' : 'text-slate-600'}`}>Biến động bản đồ địa chính</span>
                            <span className="text-[11px] text-slate-400 font-medium">Thêm mục biến động, nguyên nhân BĐĐC</span>
                        </div>
                        <div className={`p-1 rounded-lg ${formData.HIEN_THI_BIEN_DONG_BDDC ? 'bg-rose-600 text-white' : 'text-slate-300 group-hover:text-slate-400'}`}>
                            {formData.HIEN_THI_BIEN_DONG_BDDC ? <CheckSquare size={24} /> : <Square size={24} />}
                        </div>
                    </button>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 mt-2">
                        <div>
                            <label className="text-[11px] font-black text-slate-400 block mb-1.5 uppercase tracking-wider">Giờ lập</label>
                            <input 
                                type="time" 
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-black bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                value={(formData.GIO_LAP && formData.PHUT_LAP) ? `${formData.GIO_LAP}:${formData.PHUT_LAP}` : ''}
                                onChange={e => { 
                                    if(e.target.value) {
                                        const [h, m] = e.target.value.split(':'); 
                                        setFormData((prev:any) => ({...prev, GIO_LAP: h, PHUT_LAP: m})); 
                                    } else {
                                        setFormData((prev:any) => ({...prev, GIO_LAP: '', PHUT_LAP: ''})); 
                                    }
                                    onResetFile(); 
                                }} 
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-400 block mb-1.5 uppercase tracking-wider">Ngày lập</label>
                            <input 
                                type="date" 
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-black bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                value={(formData.NAM_LAP && formData.THANG_LAP && formData.NGAY_LAP) ? `${formData.NAM_LAP}-${formData.THANG_LAP}-${formData.NGAY_LAP}` : ''} 
                                onChange={e => { 
                                    if (e.target.value) {
                                        const [y, m, d] = e.target.value.split('-'); 
                                        setFormData((prev:any) => ({...prev, NAM_LAP: y, THANG_LAP: m, NGAY_LAP: d})); 
                                    } else {
                                        setFormData((prev:any) => ({...prev, NAM_LAP: '', THANG_LAP: '', NGAY_LAP: ''})); 
                                    }
                                    onResetFile(); 
                                }} 
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Chủ đất */}
            <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-[13px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2.5 border-b border-blue-50 pb-2"><UserIcon size={16} /> 1. Chủ sử dụng</h3>
                <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                    <label className="text-[12px] font-bold text-slate-400 block mb-1 uppercase">Xưng hô</label>
                    <select value={formData.HO} onChange={e => handleChange('HO', e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] font-bold bg-slate-50 outline-none">
                        <option value="Ông">Ông</option><option value="Bà">Bà</option><option value="Hộ ông">Hộ ông</option><option value="Hộ bà">Hộ bà</option>
                    </select>
                </div>
                <div className="col-span-8">
                    <label className="text-[12px] font-bold text-slate-400 block mb-1 uppercase">Họ và tên</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-black uppercase bg-white outline-none" value={formData.TEN_CHU} onChange={e => handleChange('TEN_CHU', e.target.value)} />
                </div>
                <div className="col-span-12">
                    <label className="text-[12px] font-bold text-slate-400 block mb-1 uppercase">Địa chỉ thường trú</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-white outline-none" value={formData.DIA_CHI_CHU} onChange={e => handleChange('DIA_CHI_CHU', e.target.value)} />
                </div>
                </div>
            </section>

            {/* Giấy chứng nhận cũ */}
            <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-[13px] font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2.5 border-b border-amber-50 pb-2"><ClipboardList size={16} /> 2. Thông tin GCN</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                    <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Số phát hành</label>
                    <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-medium bg-white outline-none" value={formData.SO_GCN} onChange={e => handleChange('SO_GCN', e.target.value)} />
                    </div>
                    <div>
                    <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Số vào sổ</label>
                    <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-medium bg-white outline-none" value={formData.SO_VAO_SO} onChange={e => handleChange('SO_VAO_SO', e.target.value)} />
                    </div>
                    
                    <div>
                    <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Ngày cấp GCN</label>
                    <input type="date" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-medium bg-white outline-none" value={formData.NGAY_CAP} onChange={e => handleChange('NGAY_CAP', e.target.value)} />
                    </div>
                    <div>
                    <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Cơ quan cấp</label>
                    <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-medium bg-white outline-none" value={formData.DV_CAP_GCN} onChange={e => handleChange('DV_CAP_GCN', e.target.value)} />
                    </div>

                    <div>
                    <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Thửa (GCN)</label>
                    <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-bold text-center outline-none" value={formData.SO_THUA_CU} onChange={e => handleChange('SO_THUA_CU', e.target.value)} />
                    </div>
                    <div>
                    <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Tờ (GCN)</label>
                    <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-bold text-center outline-none" value={formData.SO_TO_CU} onChange={e => handleChange('SO_TO_CU', e.target.value)} />
                    </div>
                    
                    <div className="col-span-2 grid grid-cols-3 gap-3 pt-3 border-t border-amber-50 mt-2">
                    <div>
                        <label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Tổng DT</label>
                        <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] font-black" value={formData.DT_CU} onChange={e => handleChange('DT_CU', e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[12px] font-bold text-blue-500 block mb-1 uppercase">Đất Ở</label>
                        <input type="number" className="w-full border border-blue-200 rounded-lg px-2 py-2 text-[13px] font-black text-blue-700" value={formData.DT_ODT} onChange={e => handleChange('DT_ODT', e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[12px] font-bold text-green-500 block mb-1 uppercase">Đất NN</label>
                        <div className="text-[13px] font-black text-green-700 pt-2">{formData.DT_CLN}</div>
                    </div>
                    </div>
                </div>
            </section>

            {/* Hiện trạng mới */}
            <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-[13px] font-black text-green-600 uppercase tracking-widest mb-4 flex items-center gap-2.5 border-b border-green-50 pb-2"><LandPlot size={16} /> 3. Hiện trạng mới</h3>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        {WARDS_QUICK.map(w => (
                            <button 
                            key={w.value}
                            onClick={() => handleChange('PHUONG', w.value)}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-black border transition-all ${formData.PHUONG === w.value ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-200'}`}
                            >
                                {w.label}
                            </button>
                        ))}
                    </div>
                    <div>
                    <label className="text-[12px] font-bold text-green-800 block uppercase mb-1">Địa chỉ đất tại</label>
                    <input className="w-full border border-green-200 rounded-lg px-3 py-2 text-[13px] bg-white outline-none" value={formData.DIA_CHI_THUA} onChange={e => handleChange('DIA_CHI_THUA', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <div><label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Thửa mới</label><input className="w-full border border-slate-200 rounded-lg px-1 py-2 text-[13px] font-black text-center" value={formData.SO_THUA_MOI} onChange={e => handleChange('SO_THUA_MOI', e.target.value)} /></div>
                        <div><label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Tờ mới</label><input className="w-full border border-slate-200 rounded-lg px-1 py-2 text-[13px] font-black text-center" value={formData.SO_TO_MOI} onChange={e => handleChange('SO_TO_MOI', e.target.value)} /></div>
                        <div><label className="text-[12px] font-bold text-purple-600 block mb-1 uppercase">Tờ 106</label><input className="w-full border border-purple-200 rounded-lg px-1 py-2 text-[13px] font-black text-purple-700 text-center" value={formData.SO_TO_106} onChange={e => handleChange('SO_TO_106', e.target.value)} /></div>
                        <div><label className="text-[12px] font-bold text-emerald-600 block mb-1 uppercase">DT đo đạc</label><input type="number" className="w-full border border-emerald-300 rounded-lg px-1 py-2 text-[13px] font-black bg-emerald-50 text-emerald-900 text-center" value={formData.DT_MOI} onChange={e => handleChange('DT_MOI', e.target.value)} /></div>
                    </div>

                    {/* INPUT CHO DT BĐĐC (NẾU CÓ) */}
                    {formData.HIEN_THI_BIEN_DONG_BDDC && (
                        <div className="bg-rose-50 p-2 rounded-lg border border-rose-100 mt-2">
                            <label className="text-[12px] font-bold text-rose-600 block mb-1 uppercase">DT Bản đồ ĐC 2024</label>
                            <input type="number" className="w-full border border-rose-300 rounded-lg px-2 py-2 text-[13px] font-black bg-white text-rose-900 text-center" value={formData.DT_BDDC_2024} onChange={e => handleChange('DT_BDDC_2024', e.target.value)} />
                        </div>
                    )}

                    <div className="col-span-4 mt-2 pt-3 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Hiện trạng sử dụng</label>
                                <input 
                                    className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all" 
                                    value={formData.HIEN_TRANG} 
                                    onChange={e => handleChange('HIEN_TRANG', e.target.value)} 
                                />
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                    {['Đất trống', 'Cao su', 'Điều', 'Nhà ở'].map(t => (
                                        <button key={t} onClick={() => handleChange('HIEN_TRANG', t)} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-200 transition-colors">
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Loại mốc giới</label>
                                <input 
                                    className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all" 
                                    value={formData.LOAI_COC} 
                                    onChange={e => handleChange('LOAI_COC', e.target.value)} 
                                />
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                    {['Cọc bê tông', 'Cọc sắt', 'Đinh sắt', 'Sơn đỏ'].map(t => (
                                        <button key={t} onClick={() => handleChange('LOAI_COC', t)} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-200 transition-colors">
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Biến động ranh giới BĐĐC (MỚI) */}
            {formData.HIEN_THI_BIEN_DONG_BDDC && (
                <section className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4 border-b border-rose-100 pb-2">
                    <h3 className="text-[13px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2"><MoveHorizontal size={16} /> 4a. Biến động so với BĐĐC</h3>
                    <button type="button" onClick={addBoundaryRowBDDC} className="text-[11px] font-black bg-rose-600 text-white px-3 py-1 rounded-full"><Plus size={12} className="inline mr-1" /> THÊM</button>
                    </div>

                    <div className="space-y-3">
                    {boundaryChangesBDDC.map((row) => (
                        <div key={row.id} className="p-3 bg-rose-50 border border-rose-200 rounded-xl relative group">
                        <button onClick={() => removeBoundaryRowBDDC(row.id)} className="absolute -top-1 -right-1 bg-white text-rose-500 p-1 rounded-full border border-rose-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] font-bold bg-white outline-none" value={row.direction} onChange={e => updateBoundaryRowBDDC(row.id, 'direction', e.target.value as any)}>
                                {DIRECTIONS.map(d => <option key={d} value={d}>Phía {d}</option>)}
                            </select>
                            <select className={`border rounded-lg px-2 py-1.5 text-[13px] font-black uppercase outline-none ${row.type === 'tăng' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-rose-600 border-rose-200 bg-rose-50'}`} value={row.type} onChange={e => updateBoundaryRowBDDC(row.id, 'type', e.target.value as any)}>
                                <option value="tăng">Tăng (+)</option>
                                <option value="giảm">Giảm (-)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                            <div className={row.objectName === 'Đường' ? 'col-span-4' : 'col-span-4'}>
                            <select className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] bg-white outline-none" value={row.objectName} onChange={e => updateBoundaryRowBDDC(row.id, 'objectName', e.target.value)}>
                                {ADJACENT_OBJECTS.map(obj => <option key={obj} value={obj}>{obj}</option>)}
                            </select>
                            </div>
                            
                            {row.objectName === 'Đường' && (
                                <div className="col-span-3">
                                <div className="relative">
                                    <input className="w-full border border-blue-300 rounded-lg px-1 py-1 text-[12px] text-center font-bold text-blue-600 bg-blue-50" value={row.roadNumber} onChange={e => updateBoundaryRowBDDC(row.id, 'roadNumber', e.target.value)} placeholder="Tên/Số..." />
                                    <div className="absolute -top-3 left-1 text-[9px] font-black text-blue-500 bg-white px-0.5 whitespace-nowrap">TÊN ĐƯỜNG/SỐ</div>
                                </div>
                                </div>
                            )}

                            <div className={row.objectName === 'Đường' ? 'col-span-2' : 'col-span-3'}>
                            <input className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] text-center outline-none" value={row.adjacentPlot} onChange={e => updateBoundaryRowBDDC(row.id, 'adjacentPlot', e.target.value)} placeholder="Thửa" />
                            </div>
                            <div className="col-span-2">
                            <input className="w-full border border-purple-200 rounded-lg px-1 py-1 text-[12px] text-center outline-none bg-white font-bold text-purple-700" value={row.mapSheet} onChange={e => updateBoundaryRowBDDC(row.id, 'mapSheet', e.target.value)} placeholder="Tờ" />
                            </div>
                            <div className={row.objectName === 'Đường' ? 'col-span-3' : 'col-span-3'}>
                            <input className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] font-bold text-blue-600 text-center outline-none" value={row.area} onChange={e => updateBoundaryRowBDDC(row.id, 'area', e.target.value)} placeholder="DT" />
                            </div>
                        </div>
                        </div>
                    ))}
                    
                    {/* EDIT: Phần Nguyên nhân BĐĐC */}
                    <div className="mt-4 pt-4 border-t border-rose-100">
                        <label className="text-[12px] font-bold text-rose-700 block mb-2 uppercase flex items-center gap-1">
                            <Quote size={14} /> Nguyên nhân (BĐĐC 2024)
                        </label>
                        <div className="flex gap-2 mb-2">
                            <button 
                                onClick={() => handleChange('NGUYEN_NHAN_BDDC', PRESET_BDDC)}
                                className="text-[10px] bg-rose-50 border border-rose-100 text-rose-700 px-2 py-1 rounded hover:bg-rose-100 transition-colors"
                            >
                                Mặc định (Đo đạc sai)
                            </button>
                        </div>
                        <textarea 
                            className="w-full border border-rose-200 rounded-xl p-3 text-[13px] font-medium focus:ring-2 focus:ring-rose-500/10 outline-none min-h-[80px] bg-white leading-relaxed text-rose-900"
                            placeholder="Nhập nguyên nhân biến động so với BĐĐC..."
                            value={formData.NGUYEN_NHAN_BDDC || ''}
                            onChange={e => handleChange('NGUYEN_NHAN_BDDC', e.target.value)}
                        />
                    </div>

                    </div>
                </section>
            )}

            {/* Biến động ranh giới GCN (Cũ) */}
            <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b border-purple-100 pb-2">
                <h3 className="text-[13px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-2"><MoveHorizontal size={16} /> {formData.HIEN_THI_BIEN_DONG_BDDC ? '4b. Biến động so với GCN' : '4. Biến động'}</h3>
                <button type="button" onClick={addBoundaryRow} className="text-[11px] font-black bg-purple-600 text-white px-3 py-1 rounded-full"><Plus size={12} className="inline mr-1" /> THÊM</button>
                </div>

                <div className="space-y-3">
                {boundaryChanges.map((row) => (
                    <div key={row.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
                    <button onClick={() => removeBoundaryRow(row.id)} className="absolute -top-1 -right-1 bg-white text-red-500 p-1 rounded-full border border-red-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] font-bold bg-white outline-none" value={row.direction} onChange={e => updateBoundaryRow(row.id, 'direction', e.target.value as any)}>
                            {DIRECTIONS.map(d => <option key={d} value={d}>Phía {d}</option>)}
                        </select>
                        <select className={`border rounded-lg px-2 py-1.5 text-[13px] font-black uppercase outline-none ${row.type === 'tăng' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-rose-600 border-rose-200 bg-rose-50'}`} value={row.type} onChange={e => updateBoundaryRow(row.id, 'type', e.target.value as any)}>
                            <option value="tăng">Tăng (+)</option>
                            <option value="giảm">Giảm (-)</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                        <div className={row.objectName === 'Đường' ? 'col-span-4' : 'col-span-4'}>
                        <select className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] bg-white outline-none" value={row.objectName} onChange={e => updateBoundaryRow(row.id, 'objectName', e.target.value)}>
                            {ADJACENT_OBJECTS.map(obj => <option key={obj} value={obj}>{obj}</option>)}
                        </select>
                        </div>
                        
                        {row.objectName === 'Đường' && (
                            <div className="col-span-3">
                            <div className="relative">
                                <input className="w-full border border-blue-300 rounded-lg px-1 py-1 text-[12px] text-center font-bold text-blue-600 bg-blue-50" value={row.roadNumber} onChange={e => updateBoundaryRow(row.id, 'roadNumber', e.target.value)} placeholder="Tên/Số..." />
                                <div className="absolute -top-3 left-1 text-[9px] font-black text-blue-500 bg-white px-0.5 whitespace-nowrap">TÊN ĐƯỜNG/SỐ</div>
                            </div>
                            </div>
                        )}

                        <div className={row.objectName === 'Đường' ? 'col-span-2' : 'col-span-3'}>
                        <input className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] text-center outline-none" value={row.adjacentPlot} onChange={e => updateBoundaryRow(row.id, 'adjacentPlot', e.target.value)} placeholder="Thửa" />
                        </div>
                        <div className="col-span-2">
                        <input className="w-full border border-purple-200 rounded-lg px-1 py-1 text-[12px] text-center outline-none bg-white font-bold text-purple-700" value={row.mapSheet} onChange={e => updateBoundaryRow(row.id, 'mapSheet', e.target.value)} placeholder="Tờ" />
                        </div>
                        <div className={row.objectName === 'Đường' ? 'col-span-3' : 'col-span-3'}>
                        <input className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] font-bold text-blue-600 text-center outline-none" value={row.area} onChange={e => updateBoundaryRow(row.id, 'area', e.target.value)} placeholder="DT" />
                        </div>
                    </div>
                    </div>
                ))}
                </div>

                {/* LOGIC MỚI: Nếu tích vào BĐĐC 2024 thì hiển thị Nguyên nhân GCN ngay tại đây (Ghép phần 4b và 5) */}
                {formData.HIEN_THI_BIEN_DONG_BDDC && renderGCNCauseInput(true)}
            </section>

            {/* Nguyên nhân (Hiển thị tách riêng nếu KHÔNG tích BĐĐC) */}
            {!formData.HIEN_THI_BIEN_DONG_BDDC && (
                <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-[13px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-indigo-100 pb-2"><Quote size={16} /> 5. Nguyên nhân (GCN)</h3>
                    {renderGCNCauseInput(false)}
                </section>
            )}
            </div>
        </div>
    );
};

export default BienBanForm;
