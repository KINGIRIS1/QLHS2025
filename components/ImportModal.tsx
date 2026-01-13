
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { RECORD_TYPES } from '../constants';
import { fetchHolidays } from '../services/api';
import { X, Upload, FileSpreadsheet, Save, Loader2, AlertCircle, Check, RefreshCw, PlusCircle, AlertTriangle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: RecordFile[], mode: 'create' | 'update') => void;
  employees: Employee[];
}

// Helper: Solar date from Lunar (Giống ReceiveRecord)
const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
    const lunarMapping: Record<number, Record<string, string>> = {
        2024: { "1/1": "2024-02-10", "2/1": "2024-02-11", "3/1": "2024-02-12", "10/3": "2024-04-18" },
        2025: { "1/1": "2025-01-29", "2/1": "2025-01-30", "3/1": "2025-01-31", "10/3": "2025-04-07" },
        2026: { "1/1": "2026-02-17", "2/1": "2026-02-18", "3/1": "2026-02-19", "10/3": "2026-04-26" }
    };
    const key = `${lunarDay}/${lunarMonth}`;
    return lunarMapping[year] && lunarMapping[year][key] ? new Date(lunarMapping[year][key]) : null;
};

// Helper: Format YYYY-MM-DD
const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, employees }) => {
  const [previewData, setPreviewData] = useState<RecordFile[]>([]);
  const [fileName, setFileName] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'update'>('create');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        fetchHolidays().then(setHolidays);
        setPreviewData([]);
        setFileName('');
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  const parseExcelDate = (input: any): string | undefined => {
      if (input === undefined || input === null || input === '') return undefined;
      
      const num = parseFloat(input);
      if (!isNaN(num) && num > 20000) {
          const excelEpoch = new Date(1899, 11, 30);
          const totalMilliseconds = Math.round(num * 86400 * 1000); 
          const date = new Date(excelEpoch.getTime() + totalMilliseconds);
          return formatDateKey(date);
      }

      if (typeof input === 'string') {
          const cleanStr = input.trim();
          if (cleanStr.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/)) {
              const parts = cleanStr.split(/[\/-]/);
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          if (cleanStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return cleanStr;
          }
      }
      return '';
  };

  const calculateDeadline = (type: string, receivedDateStr: string) => {
      if(!receivedDateStr) return '';
      let daysToAdd = 30; 
      const lowerType = (type || '').toLowerCase();
      if (lowerType.includes('trích lục')) daysToAdd = 10; 
      else if (lowerType.includes('trích đo chỉnh lý')) daysToAdd = 15; 
      else if (lowerType.includes('trích đo') || lowerType.includes('đo đạc') || lowerType.includes('cắm mốc')) daysToAdd = 30; 
      
      const startDate = new Date(receivedDateStr);
      let count = 0;
      let currentDate = new Date(startDate);
      
      // Build Holiday Set
      const holidaySet = new Set<string>();
      const currentYear = startDate.getFullYear();
      [currentYear, currentYear + 1].forEach(year => {
          holidays.forEach(h => {
              if (h.isLunar) {
                  const solar = getSolarDateFromLunar(h.day, h.month, year);
                  if (solar) holidaySet.add(formatDateKey(solar));
              } else {
                  const solar = new Date(year, h.month - 1, h.day);
                  holidaySet.add(formatDateKey(solar));
              }
          });
      });

      while (count < daysToAdd) {
          currentDate.setDate(currentDate.getDate() + 1);
          const dateStr = formatDateKey(currentDate);
          const day = currentDate.getDay();
          
          const isWeekend = day === 0 || day === 6; // Sat + Sun
          const isHoliday = holidaySet.has(dateStr);

          if (!isWeekend && !isHoliday) {
              count++;
          }
      }
      return formatDateKey(currentDate);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(data.length, 20); i++) {
            const row = data[i] as any[];
            if (row && row.some(cell => String(cell).toLowerCase().includes('mã') || String(cell).toLowerCase().includes('chủ sử dụng'))) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = (data[headerRowIndex] as string[]).map(h => String(h).toUpperCase().trim());
        const mappedRecords: any[] = []; // Dùng any để linh hoạt cho Update object

        const typeMapping: Record<string, string> = {
            'TL': 'Trích lục bản đồ địa chính', 'TRÍCH LỤC': 'Trích lục bản đồ địa chính',
            'TĐ': 'Trích đo bản đồ địa chính', 'TRÍCH ĐO': 'Trích đo bản đồ địa chính',
            'ĐĐ': 'Đo đạc', 'ĐO ĐẠC': 'Đo đạc', 'CM': 'Cắm mốc', 'CẮM MỐC': 'Cắm mốc',
            'CL': 'Trích đo chỉnh lý bản đồ địa chính', 'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính'
        };

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i] as any[];
            if (!row || row.length === 0) continue;

            // Hàm helper: Trả về undefined nếu cột không tồn tại, trả về giá trị nếu có
            const getVal = (possibleHeaders: string[]) => {
                const idx = headers.findIndex(h => possibleHeaders.some(ph => h.includes(ph)));
                return idx !== -1 ? row[idx] : undefined;
            };

            const codeRaw = getVal(['MÃ HỒ SƠ', 'MÃ HS', 'CODE']);
            const code = codeRaw ? String(codeRaw).trim() : undefined;
            
            if (mode === 'update' && !code) continue; // Update bắt buộc phải có mã
            
            // Xây dựng object record. Với Update, chỉ điền field nào có trong Excel.
            const record: any = {};
            
            // 1. CÁC TRƯỜNG CƠ BẢN
            if (code) record.code = code;
            else if (mode === 'create') record.code = `AUTO-${Math.floor(Math.random()*10000)}`;

            const nameRaw = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN', 'CUSTOMER']);
            if (nameRaw !== undefined) record.customerName = String(nameRaw);
            else if (mode === 'create') record.customerName = 'Chưa cập nhật';

            const phoneRaw = getVal(['SĐT', 'ĐIỆN THOẠI']);
            if (phoneRaw !== undefined) record.phoneNumber = String(phoneRaw);

            const addressRaw = getVal(['ĐỊA CHỈ', 'ADDRESS']);
            if (addressRaw !== undefined) record.address = String(addressRaw);

            const wardRaw = getVal(['XÃ', 'PHƯỜNG', 'WARD']);
            if (wardRaw !== undefined) record.ward = String(wardRaw);

            const mapSheetRaw = getVal(['TỜ', 'BẢN ĐỒ SỐ']);
            if (mapSheetRaw !== undefined) record.mapSheet = String(mapSheetRaw);

            const landPlotRaw = getVal(['THỬA', 'THỬA ĐẤT SỐ']);
            if (landPlotRaw !== undefined) record.landPlot = String(landPlotRaw);

            const areaRaw = getVal(['DIỆN TÍCH', 'AREA']);
            if (areaRaw !== undefined) record.area = parseFloat(String(areaRaw)) || 0;

            const contentRaw = getVal(['NỘI DUNG', 'GHI CHÚ']);
            if (contentRaw !== undefined) record.content = String(contentRaw);

            // 2. NGÀY THÁNG
            const receivedRaw = getVal(['NGÀY NHẬN', 'NGÀY NỘP']);
            if (receivedRaw !== undefined) record.receivedDate = parseExcelDate(receivedRaw);
            else if (mode === 'create') record.receivedDate = new Date().toISOString().split('T')[0];

            const deadlineRaw = getVal(['HẸN TRẢ', 'DEADLINE']);
            if (deadlineRaw !== undefined) record.deadline = parseExcelDate(deadlineRaw);

            // 3. LOẠI HỒ SƠ
            const typeRaw = getVal(['LOẠI', 'LOẠI HỒ SƠ']);
            if (typeRaw !== undefined) {
                const rawTypeStr = String(typeRaw).trim();
                record.recordType = typeMapping[rawTypeStr.toUpperCase()] || rawTypeStr;
            } else if (mode === 'create') {
                record.recordType = RECORD_TYPES[0];
            }

            if (mode === 'create' && !record.deadline && record.recordType && record.receivedDate) {
                record.deadline = calculateDeadline(record.recordType, record.receivedDate);
            }

            // 4. TRẠNG THÁI & NGƯỜI XỬ LÝ
            const statusRaw = getVal(['TRẠNG THÁI', 'STATUS']);
            if (statusRaw !== undefined) {
                let sStr = String(statusRaw).toUpperCase();
                let st = RecordStatus.RECEIVED;
                if (sStr.includes('GIAO') || sStr.includes('ASSIGNED')) st = RecordStatus.ASSIGNED;
                else if (sStr.includes('ĐANG') || sStr.includes('PROGRESS')) st = RecordStatus.IN_PROGRESS;
                else if (sStr.includes('CHỜ KÝ') || sStr.includes('PENDING')) st = RecordStatus.PENDING_SIGN;
                else if (sStr.includes('ĐÃ KÝ') || sStr.includes('SIGNED')) st = RecordStatus.SIGNED;
                else if (sStr.includes('XONG') || sStr.includes('HOÀN THÀNH') || sStr.includes('HANDOVER')) st = RecordStatus.HANDOVER;
                record.status = st;
            } else if (mode === 'create') {
                record.status = RecordStatus.RECEIVED;
            }

            const assigneeRaw = getVal(['NGƯỜI XỬ LÝ', 'NHÂN VIÊN']);
            if (assigneeRaw !== undefined) {
                const emp = employees.find(e => e.name.toLowerCase().includes(String(assigneeRaw).toLowerCase()));
                if (emp) {
                    record.assignedTo = emp.id;
                    if (mode === 'create') record.assignedDate = record.receivedDate;
                }
            }

            // 5. THÔNG TIN XUẤT (QUAN TRỌNG CHO CÂU HỎI CỦA BẠN)
            const exportBatchRaw = getVal(['ĐỢT', 'BATCH']);
            if (exportBatchRaw !== undefined) {
                const numStr = String(exportBatchRaw).replace(/[^0-9]/g, '');
                if (numStr) record.exportBatch = parseInt(numStr, 10);
            }

            const exportDateRaw = getVal(['NGÀY XUẤT', 'EXPORT DATE']);
            if (exportDateRaw !== undefined) {
                record.exportDate = parseExcelDate(exportDateRaw);
            }

            // LOGIC TỰ ĐỘNG CHUYỂN TRẠNG THÁI
            // Nếu có Ngày Xuất hoặc Đợt Xuất -> Tự động coi là Đã Xong (HANDOVER)
            if ((record.exportBatch || record.exportDate) && (!record.status || record.status !== RecordStatus.HANDOVER)) {
                record.status = RecordStatus.HANDOVER;
                // Nếu chưa có ngày hoàn thành thì lấy luôn ngày xuất làm ngày hoàn thành
                if (!record.completedDate && record.exportDate) {
                    record.completedDate = record.exportDate.split('T')[0];
                }
            }

            // ID giả lập cho preview
            record.id = Math.random().toString(36).substr(2, 9);
            
            mappedRecords.push(record);
        }

        setPreviewData(mappedRecords as RecordFile[]);
        setLoading(false);

      } catch (error) {
        console.error("Lỗi đọc Excel:", error);
        alert("Có lỗi khi đọc file Excel.");
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = () => {
      onImport(previewData, mode);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-green-600" />
            Xử Lý Dữ Liệu Excel
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <X size={24} />
          </button>
        </div>

        {/* MODE SWITCHER */}
        <div className="p-5 border-b bg-gray-50 shrink-0 space-y-4">
            <div className="flex justify-center">
                <div className="bg-white border border-gray-300 rounded-lg p-1 flex shadow-sm">
                    <button 
                        onClick={() => { setMode('create'); setPreviewData([]); setFileName(''); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${mode === 'create' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <PlusCircle size={16} /> Nhập hồ sơ mới
                    </button>
                    <button 
                        onClick={() => { setMode('update'); setPreviewData([]); setFileName(''); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${mode === 'update' ? 'bg-orange-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <RefreshCw size={16} /> Cập nhật thông tin
                    </button>
                </div>
            </div>

            <div className={`p-3 rounded border text-sm flex items-start gap-2 ${mode === 'create' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                {mode === 'create' ? (
                    <>
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <span>Chế độ này sẽ <strong>thêm mới</strong> toàn bộ dòng trong file Excel vào hệ thống.</span>
                    </>
                ) : (
                    <>
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <strong>Chế độ Cập Nhật Thông Minh:</strong>
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                <li>Hệ thống tìm hồ sơ theo <strong>Mã Hồ Sơ</strong>.</li>
                                <li>Chỉ cập nhật các cột <strong>CÓ</strong> trong file Excel (VD: chỉ có cột Ngày Xuất thì chỉ cập nhật Ngày Xuất).</li>
                                <li>Các cột <strong>KHÔNG CÓ</strong> trong file Excel sẽ được <strong>GIỮ NGUYÊN</strong> (không bị xóa trắng).</li>
                            </ul>
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium ${mode === 'create' ? 'bg-green-600' : 'bg-orange-600'}`}>
                        <Upload size={18} /> Chọn File Excel
                    </button>
                </div>
                {fileName && <span className="text-sm text-gray-600 font-medium">{fileName}</span>}
                {previewData.length > 0 && <div className="ml-auto flex items-center gap-2 text-sm text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full"><Check size={16} /> Đã đọc <strong>{previewData.length}</strong> dòng hợp lệ</div>}
            </div>
        </div>

        {/* PREVIEW TABLE */}
        <div className="flex-1 overflow-auto p-0">
            {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin mb-2 text-blue-500" />
                    <p>Đang xử lý dữ liệu...</p>
                </div>
            ) : previewData.length > 0 ? (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0 shadow-sm z-10 text-xs uppercase font-bold text-gray-600">
                        <tr>
                            <th className="p-3 border-b">#</th>
                            <th className="p-3 border-b">Mã HS</th>
                            <th className="p-3 border-b">Chủ Sử Dụng</th>
                            <th className="p-3 border-b">Trạng Thái (Mới)</th>
                            <th className="p-3 border-b">Ngày Xuất</th>
                            <th className="p-3 border-b">Đợt</th>
                            <th className="p-3 border-b">Ghi Chú</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                        {previewData.map((record, idx) => (
                            <tr key={idx} className="hover:bg-blue-50">
                                <td className="p-3">{idx + 1}</td>
                                <td className="p-3 font-medium text-blue-600">{record.code}</td>
                                <td className="p-3 font-medium text-gray-500">{record.customerName || <span className="text-gray-300 italic">(Giữ nguyên)</span>}</td>
                                <td className="p-3">{record.status ? <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold">{record.status}</span> : <span className="text-gray-300 italic">(Giữ nguyên)</span>}</td>
                                <td className="p-3 font-mono text-green-700">{record.exportDate ? record.exportDate.split('T')[0] : '-'}</td>
                                <td className="p-3 font-bold">{record.exportBatch || '-'}</td>
                                <td className="p-3 text-gray-500 italic truncate max-w-[200px]">{record.content}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <FileSpreadsheet size={48} className="mb-2 opacity-50" />
                    <p>Chưa có dữ liệu. Vui lòng chọn file Excel.</p>
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t bg-white flex justify-end gap-3 shrink-0 rounded-b-lg">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium">Hủy bỏ</button>
            <button onClick={handleSave} disabled={previewData.length === 0} className={`flex items-center gap-2 px-6 py-2 text-white rounded-md disabled:opacity-50 font-medium shadow-sm active:scale-95 hover:opacity-90 ${mode === 'create' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                <Save size={18} /> {mode === 'create' ? 'Lưu vào hệ thống' : 'Tiến hành cập nhật'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
