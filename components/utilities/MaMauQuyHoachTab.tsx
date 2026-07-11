import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, Trash2, FileSpreadsheet, Loader2, Search, Download, 
  Plus, Edit2, X, RotateCcw, Check, Copy, Palette, Info 
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { NotifyFunction } from '../../types';
import { 
  fetchPlanningColors, savePlanningColor, deletePlanningColor, 
  savePlanningColorsBulk, deleteAllPlanningColors, resetPlanningColorsToDefault, PlanningColor 
} from '../../services/apiUtilities';

interface Props {
  notify: NotifyFunction;
}

const MaMauQuyHoachTab: React.FC<Props> = ({ notify }) => {
  const [data, setData] = useState<PlanningColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<PlanningColor | null>(null);
  const [formLoaiDat, setFormLoaiDat] = useState('');
  const [formKyHieu, setFormKyHieu] = useState('');
  const [formSoMauSac, setFormSoMauSac] = useState('');
  const [formMauSac, setFormMauSac] = useState('');
  const [formR, setFormR] = useState(128);
  const [formG, setFormG] = useState(128);
  const [formB, setFormB] = useState(128);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchPlanningColors();
      setData(result);
    } catch (error) {
      notify('Lỗi khi tải bảng mã màu quy hoạch', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const headers = ["Loại đất", "Ký hiệu", "Số màu sắc", "Màu sắc", "R", "G", "B"];
      const sampleData = [
        ["Đất ở tại đô thị", "ODT", "85", "Hồng sẫm", 242, 63, 153],
        ["Đất ở tại nông thôn", "ONT", "15", "Hồng nhạt", 254, 181, 181],
        ["Đất trồng lúa", "LUA", "3", "Vàng chanh", 255, 255, 0],
        ["Đất trồng cây lâu năm", "CLN", "5", "Vàng cam", 248, 181, 110],
        ["Đất trồng cây hàng năm khác", "BHK", "4", "Vàng nhạt", 255, 255, 173]
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      ws['!cols'] = [{wch: 30}, {wch: 12}, {wch: 12}, {wch: 15}, {wch: 8}, {wch: 8}, {wch: 8}];
      XLSX.utils.book_append_sheet(wb, ws, "MaMauQuyHoach");
      XLSX.writeFile(wb, "Mau_Ma_Mau_Quy_Hoach.xlsx");
      notify('Đã tải xuống file mẫu thành công', 'success');
    } catch (e) {
      notify('Lỗi khi xuất file mẫu', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          notify('File Excel trống hoặc không đúng định dạng', 'error');
          return;
        }

        // Detect headers and row index
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
          const row = jsonData[i];
          if (row && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('ký hiệu'))) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = jsonData[headerRowIdx] || [];
        const colIndices = {
          loai_dat: headerRow.findIndex(h => h?.toString().toLowerCase().includes('loại đất')),
          ky_hieu: headerRow.findIndex(h => h?.toString().toLowerCase().includes('ký hiệu')),
          so_mau_sac: headerRow.findIndex(h => h?.toString().toLowerCase().includes('số màu') || h?.toString().toLowerCase().includes('index') || h?.toString().toLowerCase().includes('số hiệu màu')),
          mau_sac: headerRow.findIndex(h => h?.toString().toLowerCase().includes('màu sắc') && !h?.toString().toLowerCase().includes('số màu')),
          r: headerRow.findIndex(h => h?.toString().toLowerCase() === 'r' || h?.toString().toLowerCase().includes('red')),
          g: headerRow.findIndex(h => h?.toString().toLowerCase() === 'g' || h?.toString().toLowerCase().includes('green')),
          b: headerRow.findIndex(h => h?.toString().toLowerCase() === 'b' || h?.toString().toLowerCase().includes('blue'))
        };

        const idxLoaiDat = colIndices.loai_dat !== -1 ? colIndices.loai_dat : 0;
        const idxKyHieu = colIndices.ky_hieu !== -1 ? colIndices.ky_hieu : 1;
        const idxSoMauSac = colIndices.so_mau_sac !== -1 ? colIndices.so_mau_sac : (colIndices.mau_sac === 2 ? -1 : 2);
        const idxMauSac = colIndices.mau_sac !== -1 ? colIndices.mau_sac : (idxSoMauSac === 2 ? 3 : 2);
        const idxR = colIndices.r !== -1 ? colIndices.r : (idxMauSac + 1);
        const idxG = colIndices.g !== -1 ? colIndices.g : (idxR + 1);
        const idxB = colIndices.b !== -1 ? colIndices.b : (idxG + 1);

        const newColors: Partial<PlanningColor>[] = [];
        for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 2) continue;

          const loai_dat = row[idxLoaiDat]?.toString().trim() || 'Chưa phân loại';
          const ky_hieu = row[idxKyHieu]?.toString().trim() || '';
          const so_mau_sac = idxSoMauSac !== -1 ? row[idxSoMauSac]?.toString().trim() || '' : '';
          const mau_sac = row[idxMauSac]?.toString().trim() || 'Không rõ';
          
          // Parse R, G, B with defaults
          const r = isNaN(Number(row[idxR])) ? 128 : Math.min(255, Math.max(0, Number(row[idxR])));
          const g = isNaN(Number(row[idxG])) ? 128 : Math.min(255, Math.max(0, Number(row[idxG])));
          const b = isNaN(Number(row[idxB])) ? 128 : Math.min(255, Math.max(0, Number(row[idxB])));

          if (ky_hieu) {
            newColors.push({
              loai_dat,
              ky_hieu: ky_hieu.toUpperCase(),
              so_mau_sac,
              mau_sac,
              r,
              g,
              b
            });
          }
        }

        if (newColors.length > 0) {
          setSaving(true);
          const success = await savePlanningColorsBulk(newColors);
          if (success) {
            notify(`Đã nhập thành công ${newColors.length} mã màu quy hoạch`, 'success');
            loadData();
          } else {
            notify('Không thể lưu mã màu quy hoạch mới', 'error');
          }
        } else {
          notify('Không tìm thấy bản ghi mã màu hợp lệ trong file Excel', 'error');
        }
      } catch (error) {
        console.error(error);
        notify('Lỗi định dạng hoặc không đọc được file Excel', 'error');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn KHÔI PHỤC bảng mã màu quy hoạch về mặc định ban đầu? Các thay đổi hoặc file đã nhập trước đó sẽ bị ghi đè.')) return;
    
    setSaving(true);
    try {
      const success = await resetPlanningColorsToDefault();
      if (success) {
        notify('Đã khôi phục bảng mã màu quy hoạch về mặc định thành công', 'success');
        loadData();
      } else {
        notify('Lỗi khi khôi phục dữ liệu', 'error');
      }
    } catch (e) {
      notify('Có lỗi xảy ra', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu mã màu? Bạn có thể khôi phục lại mặc định sau.')) return;

    setSaving(true);
    try {
      const success = await deleteAllPlanningColors();
      if (success) {
        notify('Đã xóa sạch bảng dữ liệu mã màu quy hoạch', 'success');
        setData([]);
      } else {
        notify('Lỗi khi xóa bảng dữ liệu', 'error');
      }
    } catch (e) {
      notify('Có lỗi xảy ra', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingColor(null);
    setFormLoaiDat('');
    setFormKyHieu('');
    setFormSoMauSac('');
    setFormMauSac('');
    setFormR(128);
    setFormG(128);
    setFormB(128);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (color: PlanningColor) => {
    setEditingColor(color);
    setFormLoaiDat(color.loai_dat);
    setFormKyHieu(color.ky_hieu);
    setFormSoMauSac(color.so_mau_sac || '');
    setFormMauSac(color.mau_sac);
    setFormR(color.r);
    setFormG(color.g);
    setFormB(color.b);
    setIsModalOpen(true);
  };

  const handleSaveColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLoaiDat.trim() || !formKyHieu.trim()) {
      notify('Vui lòng nhập đầy đủ Loại đất và Ký hiệu', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<PlanningColor> = {
        loai_dat: formLoaiDat.trim(),
        ky_hieu: formKyHieu.trim().toUpperCase(),
        so_mau_sac: formSoMauSac.trim(),
        mau_sac: formMauSac.trim() || 'Chưa đặt tên màu',
        r: Math.min(255, Math.max(0, Number(formR))),
        g: Math.min(255, Math.max(0, Number(formG))),
        b: Math.min(255, Math.max(0, Number(formB)))
      };

      if (editingColor) {
        payload.id = editingColor.id;
      }

      const success = await savePlanningColor(payload);
      if (success) {
        notify(editingColor ? 'Cập nhật mã màu thành công' : 'Thêm mã màu mới thành công', 'success');
        setIsModalOpen(false);
        loadData();
      } else {
        notify('Không thể lưu thông tin mã màu', 'error');
      }
    } catch (e) {
      notify('Có lỗi xảy ra', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteColor = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mã màu quy hoạch này?')) return;

    try {
      const success = await deletePlanningColor(id);
      if (success) {
        notify('Đã xóa mã màu thành công', 'success');
        loadData();
      } else {
        notify('Lỗi khi xóa mã màu', 'error');
      }
    } catch (e) {
      notify('Có lỗi xảy ra', 'error');
    }
  };

  const handleCopyColorCode = (color: PlanningColor, type: 'rgb' | 'hex') => {
    const hex = rgbToHex(color.r, color.g, color.b);
    const text = type === 'rgb' ? `rgb(${color.r}, ${color.g}, ${color.b})` : hex;
    
    navigator.clipboard.writeText(text);
    setCopiedId(`${color.id}-${type}`);
    setTimeout(() => setCopiedId(null), 2000);
    notify(`Đã sao chép mã ${type.toUpperCase()}: ${text}`, 'success');
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (c: number) => {
      const hex = c.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  };

  // Filter logic
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.loai_dat.toLowerCase().includes(term) ||
      item.ky_hieu.toLowerCase().includes(term) ||
      item.mau_sac.toLowerCase().includes(term) ||
      (item.so_mau_sac && item.so_mau_sac.toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Control Panel */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-tr from-pink-500 to-rose-600 text-white p-2.5 rounded-xl shadow-md shrink-0">
            <Palette size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wider">Mã màu quy hoạch sử dụng đất</h2>
            <p className="text-slate-500 text-xs font-semibold mt-0.5">Tham chiếu ký hiệu, thông số màu sắc RGB và mã Hex của từng loại đất</p>
          </div>
        </div>

        {/* Action Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* File Excel Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            title="Nhập file Excel chứa bảng mã màu"
          >
            <Upload size={14} className="text-blue-500" /> Nhập Excel
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            title="Tải file Excel mẫu"
          >
            <Download size={14} className="text-emerald-500" /> File mẫu
          </button>

          <button
            onClick={handleResetToDefault}
            disabled={saving}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Khôi phục dữ liệu bảng mã màu về mặc định"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} className="text-amber-500" />} Khôi phục mẫu
          </button>

          <button
            onClick={handleDeleteAll}
            disabled={saving}
            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Xóa toàn bộ mã màu quy hoạch hiện tại"
          >
            <Trash2 size={14} /> Xóa hết
          </button>

          <button
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md hover:shadow-blue-200 active:scale-95 ml-auto md:ml-0"
          >
            <Plus size={14} /> Thêm mã màu
          </button>
        </div>
      </div>

      {/* Info Section / Alert */}
      <div className="bg-amber-50/70 border-b border-amber-100 px-4 py-2.5 shrink-0 flex items-start gap-2 text-[11px] font-semibold text-amber-800">
        <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Màu sắc RGB và ký hiệu loại đất được ban hành theo <span className="font-extrabold text-amber-900">Thông tư 21/2021/TT-BTNMT</span> của Bộ Tài nguyên và Môi trường. Bạn có thể rê chuột hoặc chạm vào ô màu để xem / sao chép nhanh mã Hex hoặc mã RGB để thiết kế bản vẽ bản đồ quy hoạch sử dụng đất chính xác.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-100 px-4 py-3 shrink-0 border-b border-slate-200">
        <div className="relative max-w-md w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo Loại đất, Ký hiệu hoặc Màu sắc..."
            className="w-full bg-white pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đang tải bảng dữ liệu...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-10 text-center max-w-lg mx-auto mt-8 shadow-sm">
            <Palette size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-slate-700 font-bold text-sm uppercase">Không tìm thấy mã màu quy hoạch</h3>
            <p className="text-slate-400 text-xs mt-1.5 font-semibold">Thử nhập từ khóa khác, hoặc nhấn nút "Khôi phục mẫu" để tải dữ liệu tiêu chuẩn.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bento Grid layout of Color Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedData.map((item) => {
                const hex = rgbToHex(item.r, item.g, item.b);
                const rgbString = `rgb(${item.r}, ${item.g}, ${item.b})`;

                return (
                  <div 
                    key={item.id} 
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Visual Color Block Background Accent (Subtle) */}
                    <div 
                      className="absolute right-0 top-0 w-24 h-24 rounded-full opacity-[0.03] blur-xl pointer-events-none" 
                      style={{ backgroundColor: rgbString }} 
                    />

                    <div>
                      {/* Header Line */}
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="bg-slate-100 text-slate-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider border border-slate-200">
                          {item.ky_hieu}
                        </span>
                        
                        {/* Options */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Chỉnh sửa mã màu"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteColor(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa mã màu"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Land Use Type name */}
                      <h4 className="text-xs font-extrabold text-slate-800 line-clamp-2 min-h-[2rem] leading-snug">
                        {item.loai_dat}
                      </h4>

                      {/* Color Preview Block */}
                      <div className="my-3.5 flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-xl shadow-inner border border-black/10 shrink-0 relative group-hover:scale-105 transition-transform flex items-center justify-center" 
                          style={{ backgroundColor: rgbString }}
                          title={`Tên màu: ${item.mau_sac}, Số màu: ${item.so_mau_sac || 'N/A'}`}
                        >
                          {item.so_mau_sac && (
                            <span 
                              className="text-[11px] font-mono font-extrabold text-white tracking-tighter"
                              style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8), 0px 0px 1px rgba(0,0,0,0.9)' }}
                            >
                              {item.so_mau_sac}
                            </span>
                          )}
                          {/* Inner circle reflection */}
                          <div className="absolute inset-0.5 bg-gradient-to-tr from-transparent to-white/20 rounded-lg pointer-events-none" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Màu sắc</span>
                            {item.so_mau_sac && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100/50">
                                Số: {item.so_mau_sac}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-extrabold text-slate-700 truncate block mt-0.5">{item.mau_sac}</span>
                        </div>
                      </div>

                      {/* RGB & Hex details */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                        {/* RGB Display */}
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="text-slate-400 font-bold uppercase">RGB:</span>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            <span className="text-red-500">R:{item.r}</span>
                            <span className="text-emerald-500">G:{item.g}</span>
                            <span className="text-blue-500">B:{item.b}</span>
                          </div>
                          <button
                            onClick={() => handleCopyColorCode(item, 'rgb')}
                            className="text-slate-400 hover:text-slate-600 ml-1.5 transition-colors"
                            title="Sao chép chuỗi RGB"
                          >
                            {copiedId === `${item.id}-rgb` ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                          </button>
                        </div>

                        {/* Hex Display */}
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="text-slate-400 font-bold uppercase">HEX:</span>
                          <span className="font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 ml-auto">
                            {hex}
                          </span>
                          <button
                            onClick={() => handleCopyColorCode(item, 'hex')}
                            className="text-slate-400 hover:text-slate-600 ml-1.5 transition-colors"
                            title="Sao chép mã HEX"
                          >
                            {copiedId === `${item.id}-hex` ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between shrink-0 shadow-sm">
                <span className="text-xs font-extrabold text-slate-400 uppercase">
                  Hiển thị {paginatedData.length} / {filteredData.length} kết quả (Trang {currentPage} / {totalPages})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      currentPage === 1
                        ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95'
                    }`}
                  >
                    Trước
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pNum = idx + 1;
                    if (totalPages > 5 && Math.abs(pNum - currentPage) > 1 && pNum !== 1 && pNum !== totalPages) {
                      if (pNum === 2 || pNum === totalPages - 1) {
                        return <span key={idx} className="text-slate-300 px-1 text-xs">...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(pNum)}
                        className={`w-8 h-8 text-xs font-bold rounded-xl transition-all ${
                          currentPage === pNum
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      currentPage === totalPages
                        ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95'
                    }`}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Color Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-blue-600" />
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                  {editingColor ? 'Chỉnh sửa mã màu' : 'Thêm mã màu mới'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveColor} className="p-5 space-y-4">
              {/* Type of Land */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Loại đất *</label>
                <input
                  type="text"
                  required
                  value={formLoaiDat}
                  onChange={(e) => setFormLoaiDat(e.target.value)}
                  placeholder="Ví dụ: Đất ở tại đô thị, Đất trồng cây..."
                  className="w-full bg-slate-50 px-3 py-2 rounded-xl text-xs border border-slate-200 font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>

              {/* Code */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Ký hiệu *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formKyHieu}
                    onChange={(e) => setFormKyHieu(e.target.value)}
                    placeholder="ODT, ONT"
                    className="w-full bg-slate-50 px-2 py-2 rounded-xl text-xs border border-slate-200 font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm uppercase"
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Số màu sắc</label>
                  <input
                    type="text"
                    value={formSoMauSac}
                    onChange={(e) => setFormSoMauSac(e.target.value)}
                    placeholder="Ví dụ: 85"
                    className="w-full bg-slate-50 px-2 py-2 rounded-xl text-xs border border-slate-200 font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Tên màu</label>
                  <input
                    type="text"
                    value={formMauSac}
                    onChange={(e) => setFormMauSac(e.target.value)}
                    placeholder="Hồng sẫm..."
                    className="w-full bg-slate-50 px-2 py-2 rounded-xl text-xs border border-slate-200 font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* R, G, B Component Sliders */}
              <div className="space-y-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Thông số RGB & Bản xem trước</span>
                
                {/* R Slider */}
                <div className="flex items-center gap-3">
                  <span className="w-8 text-[11px] font-extrabold text-red-500">R: {formR}</span>
                  <input 
                    type="range" 
                    min={0} 
                    max={255} 
                    value={formR} 
                    onChange={(e) => setFormR(Number(e.target.value))}
                    className="flex-1 accent-red-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <input 
                    type="number" 
                    min={0} 
                    max={255} 
                    value={formR} 
                    onChange={(e) => setFormR(Math.min(255, Math.max(0, Number(e.target.value))))}
                    className="w-12 bg-white text-center border border-slate-200 rounded text-[11px] font-mono py-0.5"
                  />
                </div>

                {/* G Slider */}
                <div className="flex items-center gap-3">
                  <span className="w-8 text-[11px] font-extrabold text-emerald-500">G: {formG}</span>
                  <input 
                    type="range" 
                    min={0} 
                    max={255} 
                    value={formG} 
                    onChange={(e) => setFormG(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <input 
                    type="number" 
                    min={0} 
                    max={255} 
                    value={formG} 
                    onChange={(e) => setFormG(Math.min(255, Math.max(0, Number(e.target.value))))}
                    className="w-12 bg-white text-center border border-slate-200 rounded text-[11px] font-mono py-0.5"
                  />
                </div>

                {/* B Slider */}
                <div className="flex items-center gap-3">
                  <span className="w-8 text-[11px] font-extrabold text-blue-500">B: {formB}</span>
                  <input 
                    type="range" 
                    min={0} 
                    max={255} 
                    value={formB} 
                    onChange={(e) => setFormB(Number(e.target.value))}
                    className="flex-1 accent-blue-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <input 
                    type="number" 
                    min={0} 
                    max={255} 
                    value={formB} 
                    onChange={(e) => setFormB(Math.min(255, Math.max(0, Number(e.target.value))))}
                    className="w-12 bg-white text-center border border-slate-200 rounded text-[11px] font-mono py-0.5"
                  />
                </div>

                {/* Live Preview Box */}
                <div className="flex items-center gap-3 pt-2">
                  <div 
                    className="w-10 h-10 rounded-xl border border-black/10 shadow-inner shrink-0" 
                    style={{ backgroundColor: `rgb(${formR}, ${formG}, ${formB})` }} 
                  />
                  <div className="text-[10px]">
                    <span className="text-slate-400 font-bold uppercase block">Chuỗi mã hex:</span>
                    <span className="font-mono font-extrabold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded mt-0.5 block">
                      {rgbToHex(formR, formG, formB)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-blue-100 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaMauQuyHoachTab;
