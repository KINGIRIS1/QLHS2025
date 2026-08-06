
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { RECORD_TYPES } from '../constants';
import { fetchHolidays, createRecordsBatchApi, forceUpdateRecordsBatchApi } from '../services/api';
import { calculateDeadlineHelper } from '../utils/appHelpers';
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

  // States cho tiến trình nhập dữ liệu chia lô (batch)
  const [isSaving, setIsSaving] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    if (isOpen) {
        fetchHolidays().then(setHolidays);
        setPreviewData([]);
        setFileName('');
        if(fileInputRef.current) fileInputRef.current.value = '';
        setIsSaving(false);
        setHasFinished(false);
        setImportedCount(0);
        setFailedCount(0);
        setTotalCount(0);
        setImportStatus('');
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
      return calculateDeadlineHelper(type, receivedDateStr, holidays);
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
            'TĐTĐ': 'Thẩm định Trích đo', 'THẨM ĐỊNH': 'Thẩm định Trích đo', 'THẨM ĐỊNH TRÍCH ĐO': 'Thẩm định Trích đo',
            'TĐ': 'Trích đo bản đồ địa chính', 'TRÍCH ĐO': 'Trích đo bản đồ địa chính',
            'ĐĐ': 'Đo đạc theo yêu cầu', 'ĐO ĐẠC': 'Đo đạc theo yêu cầu', 'CM': 'Cắm mốc', 'CẮM MỐC': 'Cắm mốc',
            'CL': 'Trích đo chỉnh lý bản đồ địa chính', 'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính',
            'XST': 'Xin số thửa', 'XIN SỐ THỬA': 'Xin số thửa'
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

            // 4. THÔNG TIN XUẤT (QUAN TRỌNG CHO VIỆC TỰ ĐỘNG HANDOVER)
            const exportBatchRaw = getVal(['ĐỢT', 'BATCH']);
            if (exportBatchRaw !== undefined) {
                const numStr = String(exportBatchRaw).replace(/[^0-9]/g, '');
                if (numStr) record.exportBatch = parseInt(numStr, 10);
            }

            const exportDateRaw = getVal(['NGÀY XUẤT', 'EXPORT DATE', 'NGÀY TRẢ']);
            if (exportDateRaw !== undefined) {
                record.exportDate = parseExcelDate(exportDateRaw);
            }

            // 5. TRẠNG THÁI & NGƯỜI XỬ LÝ
            // Logic ưu tiên: Nếu có ngày xuất/đợt -> HANDOVER. Ngược lại mới xét cột Trạng Thái.
            let explicitStatus: RecordStatus | undefined = undefined;

            // Kiểm tra cột trạng thái từ Excel trước
            const statusRaw = getVal(['TRẠNG THÁI', 'STATUS']);
            if (statusRaw !== undefined) {
                let sStr = String(statusRaw).toUpperCase();
                if (sStr.includes('GIAO') || sStr.includes('ASSIGNED')) explicitStatus = RecordStatus.ASSIGNED;
                else if (sStr.includes('ĐANG') || sStr.includes('PROGRESS')) explicitStatus = RecordStatus.IN_PROGRESS;
                else if (sStr.includes('CHỜ KÝ') || sStr.includes('PENDING')) explicitStatus = RecordStatus.PENDING_SIGN;
                else if (sStr.includes('ĐÃ KÝ') || sStr.includes('SIGNED')) explicitStatus = RecordStatus.SIGNED;
                else if (sStr.includes('XONG') || sStr.includes('HOÀN THÀNH') || sStr.includes('HANDOVER')) explicitStatus = RecordStatus.HANDOVER;
            }

            // LOGIC TỰ ĐỘNG CHUYỂN TRẠNG THÁI (Override)
            if (record.exportBatch || record.exportDate) {
                // Nếu có thông tin xuất -> Chắc chắn là Đã Giao
                record.status = RecordStatus.HANDOVER;
                
                // Nếu chưa có ngày hoàn thành, lấy ngày xuất làm ngày hoàn thành
                if (!record.completedDate && record.exportDate) {
                    record.completedDate = record.exportDate.split('T')[0];
                }
            } else if (explicitStatus) {
                // Nếu không có thông tin xuất, dùng trạng thái từ Excel
                record.status = explicitStatus;
            } else if (mode === 'create') {
                // Mặc định cho tạo mới
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

  const handleSave = async () => {
      if (previewData.length === 0) return;
      setIsSaving(true);
      setHasFinished(false);
      setTotalCount(previewData.length);
      setImportedCount(0);
      setFailedCount(0);

      const CHUNK_SIZE = 500;
      let successTotal = 0;
      let failTotal = 0;

      for (let i = 0; i < previewData.length; i += CHUNK_SIZE) {
          const chunk = previewData.slice(i, i + CHUNK_SIZE);
          const currentBatch = Math.floor(i / CHUNK_SIZE) + 1;
          const totalBatches = Math.ceil(previewData.length / CHUNK_SIZE);
          
          setImportStatus(`Đang xử lý gói ${currentBatch}/${totalBatches} (dòng ${i + 1} - ${Math.min(i + CHUNK_SIZE, previewData.length)})...`);

          try {
              if (mode === 'create') {
                  const success = await createRecordsBatchApi(chunk);
                  if (success) {
                      successTotal += chunk.length;
                      setImportedCount(successTotal);
                  } else {
                      failTotal += chunk.length;
                      setFailedCount(failTotal);
                  }
              } else {
                  const result = await forceUpdateRecordsBatchApi(chunk);
                  if (result.success) {
                      successTotal += result.count;
                      setImportedCount(successTotal);
                      const uncompleted = chunk.length - result.count;
                      if (uncompleted > 0) {
                          failTotal += uncompleted;
                          setFailedCount(failTotal);
                      }
                  } else {
                      failTotal += chunk.length;
                      setFailedCount(failTotal);
                  }
              }
          } catch (err) {
              console.error("Lỗi khi import lô:", err);
              failTotal += chunk.length;
              setFailedCount(failTotal);
          }

          // Tránh chặn UI thread và tạo hiệu ứng mượt
          await new Promise(resolve => setTimeout(resolve, 50));
      }

      setIsSaving(false);
      setHasFinished(true);
      setImportStatus('Đã hoàn thành nhập dữ liệu!');
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
          <button onClick={onClose} disabled={isSaving} className="text-gray-500 hover:text-red-600 disabled:opacity-35">
            <X size={24} />
          </button>
        </div>

        {/* BODY */}
        {(isSaving || hasFinished) ? (
          <div className="flex-1 overflow-auto p-8 flex flex-col items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-xl shadow-md border border-gray-150 w-full max-w-lg text-center space-y-6 animate-fade-in">
              {isSaving ? (
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center mb-3">
                    <img src="./logo.png" alt="Logo" className="w-10 h-10 object-contain animate-pulse" />
                    <Loader2 className="w-16 h-16 animate-spin text-blue-600 absolute inset-0" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Đang nhập dữ liệu vào hệ thống...</h3>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
                    <Check className="w-8 h-8 text-green-600 stroke-[3]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Đã hoàn thành nhập dữ liệu!</h3>
                </div>
              )}

              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{importStatus}</p>

              <div className="space-y-2">
                <div className="w-full bg-gray-150 h-4 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-300 ${hasFinished ? 'bg-green-500' : 'bg-blue-600'}`}
                    style={{ width: `${totalCount > 0 ? Math.round(((importedCount + failedCount) / totalCount) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-bold px-1">
                  <span>Tiến trình: {totalCount > 0 ? Math.round(((importedCount + failedCount) / totalCount) * 100) : 0}%</span>
                  <span>{importedCount + failedCount} / {totalCount} dòng</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm">
                <div className="text-center p-2">
                  <div className="text-xs text-gray-500 font-bold uppercase mb-1">Thành công</div>
                  <div className="text-2xl font-black text-green-600">{importedCount}</div>
                </div>
                <div className="text-center p-2 border-l border-gray-200">
                  <div className="text-xs text-gray-500 font-bold uppercase mb-1">Thất bại / Không đổi</div>
                  <div className="text-2xl font-black text-red-500">{failedCount}</div>
                </div>
              </div>

              {hasFinished && (
                <div className="text-xs text-gray-400 italic font-medium">
                  Hệ thống đã tự động lưu thông tin đồng bộ trên máy chủ Supabase.
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
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
                                    <li><strong>QUAN TRỌNG:</strong> Nếu có cột "Đợt" hoặc "Ngày xuất/Ngày trả", hệ thống sẽ tự động chuyển trạng thái sang "Đã giao 1 cửa" để không bị báo trễ hạn.</li>
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
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                        <div className="relative w-14 h-14 flex items-center justify-center mb-3">
                            <img src="./logo.png" alt="Logo" className="w-8 h-8 object-contain animate-pulse" />
                            <Loader2 className="w-14 h-14 animate-spin text-blue-500 absolute inset-0" />
                        </div>
                        <p>Đang xử lý dữ liệu...</p>
                    </div>
                ) : previewData.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 sticky top-0 shadow-sm z-10 text-xs uppercase font-bold text-gray-600">
                            <tr>
                                <th className="p-3 border-b">#</th>
                                <th className="p-3 border-b">Mã HS</th>
                                <th className="p-3 border-b">Chủ Sử Dụng</th>
                                <th className="p-3 border-b">Trạng Thái (Dự kiến)</th>
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
                                    <td className="p-3">{record.status ? <span className={`text-xs px-2 py-1 rounded-full font-bold ${record.status === RecordStatus.HANDOVER ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{record.status}</span> : <span className="text-gray-300 italic">(Giữ nguyên)</span>}</td>
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
          </>
        )}

        {/* FOOTER */}
        <div className="p-5 border-t bg-white flex justify-end gap-3 shrink-0 rounded-b-lg">
          {(isSaving || hasFinished) ? (
            hasFinished && (
              <button 
                onClick={async () => {
                  onImport([], mode); // Để trigger loadData ở parent
                  onClose();
                }} 
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-md font-bold shadow-md hover:bg-green-700 active:scale-95 transition-all text-sm"
              >
                <Check size={18} /> Đóng & Tải lại danh sách
              </button>
            )
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium">Hủy bỏ</button>
              <button onClick={handleSave} disabled={previewData.length === 0} className={`flex items-center gap-2 px-6 py-2 text-white rounded-md disabled:opacity-50 font-medium shadow-sm active:scale-95 hover:opacity-90 ${mode === 'create' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                <Save size={18} /> {mode === 'create' ? 'Lưu vào hệ thống' : 'Tiến hành cập nhật'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
