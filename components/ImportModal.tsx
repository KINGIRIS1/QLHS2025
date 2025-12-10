
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee } from '../types';
import { STATUS_LABELS } from '../constants';
import { updateMissingFieldsBatchApi, forceUpdateRecordsBatchApi } from '../services/api';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, RefreshCw, Save } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: RecordFile[]) => void;
  employees: Employee[]; // Thêm danh sách nhân viên để map tên -> ID
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, employees }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QUAN TRỌNG: Nếu modal không mở, không hiển thị gì cả
  if (!isOpen) return null;

  // Hàm chuyển đổi ngày từ Excel an toàn hơn
  const parseDate = (dateVal: any): string | undefined => {
    if (!dateVal) return undefined;

    try {
        let date: Date | null = null;

        // Trường hợp 1: Excel Serial Number (VD: 45321)
        if (typeof dateVal === 'number') {
            date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        }
        // Trường hợp 2: Chuỗi ký tự
        else if (typeof dateVal === 'string') {
            const cleanStr = dateVal.trim();
            if (!/^[\d\-\/\.]+$/.test(cleanStr)) return undefined;

            if (cleanStr.includes('/')) {
                const parts = cleanStr.split('/');
                if (parts.length === 3) {
                    const d = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const y = parseInt(parts[2], 10);
                    if (m > 12 || d > 31) return undefined;
                    date = new Date(y, m - 1, d);
                }
            } 
            else if (cleanStr.includes('-')) {
                const parts = cleanStr.split('-');
                if (parts.length === 3) {
                     const p1 = parseInt(parts[0], 10);
                     if (p1 > 1900) {
                         date = new Date(cleanStr); 
                     } else {
                         const d = parseInt(parts[0], 10);
                         const m = parseInt(parts[1], 10);
                         const y = parseInt(parts[2], 10);
                         if (m > 12 || d > 31) return undefined;
                         date = new Date(y, m - 1, d);
                     }
                }
            }
        }

        if (date && !isNaN(date.getTime())) {
             const y = date.getFullYear();
             const m = String(date.getMonth() + 1).padStart(2, '0');
             const d = String(date.getDate()).padStart(2, '0');
             
             if (y < 1990 || y > 2100) return undefined;

             return `${y}-${m}-${d}`;
        }
    } catch (e) {
        return undefined;
    }
    return undefined;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError('');
    setSuccessMsg('');
    setPreviewData([]);

    if (selectedFile) {
      const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileType !== 'xlsx' && fileType !== 'xls') {
        setError('Vui lòng chỉ chọn file Excel (.xlsx hoặc .xls)');
        return;
      }
      setFile(selectedFile);
      readExcel(selectedFile);
    }
  };

  const readExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0]; 
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        setPreviewData(jsonData);
      } catch (err) {
        setError('Không thể đọc file. Vui lòng kiểm tra định dạng.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadSample = () => {
      const headers = [
          "MÃ HỒ SƠ", "CHỦ SỬ DỤNG", "SỐ ĐIỆN THOẠI", "CCCD", 
          "ĐỊA CHỈ", "XÃ PHƯỜNG", "NHÓM", "TỜ", "THỬA", "DIỆN TÍCH",
          "LOẠI HỒ SƠ", "NỘI DUNG", 
          "NGÀY TIẾP NHẬN", "NGÀY HẸN TRẢ", "NGÀY GIAO NV", "NGÀY HOÀN THÀNH",
          "TRẠNG THÁI", "NGƯỜI XỬ LÝ", 
          "SỐ TRÍCH ĐO", "SỐ TRÍCH LỤC", 
          "NGƯỜI ỦY QUYỀN", "LOẠI ỦY QUYỀN", "DANH SÁCH XUẤT"
      ];
      
      const sampleData = [
          [
            "HS-2024-001", "Nguyễn Văn A", "0909123456", "070090001234",
            "Ấp 1", "Minh Hưng", "Minh Hưng", "10", "123", 150.5,
            "Trích lục bản đồ địa chính", "Xin trích lục thửa đất", 
            "2024-01-01", "2024-01-10", "2024-01-02", "",
            "Đang thực hiện", "Nguyễn Văn B",
            "", "TL-001", "", "", ""
          ],
          [
            "HS-2024-002", "Trần Thị C", "0918777888", "070090005678",
            "Khu phố 3", "Chơn Thành", "Chơn Thành", "5", "50", 1000,
            "Đo đạc tách thửa", "Tách thành 2 thửa", 
            "2023-12-01", "2023-12-30", "2023-12-02", "2023-12-28",
            "Đã giao 1 cửa", "Lê Văn D",
            "TĐ-99", "", "Phạm Văn E", "Giấy ủy quyền", "1"
          ]
      ];

      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      
      // Auto-fit column width basic
      const wscols = headers.map(h => ({ wch: h.length + 5 }));
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Day_Du");
      XLSX.writeFile(wb, "Mau_Nhap_Lieu_Day_Du.xlsx");
  };

  // Logic chung để parse dữ liệu Excel
  const processExcelData = (rawData: any[]): RecordFile[] => {
      const mappedRecords: RecordFile[] = [];
      
      rawData.forEach((row: any) => {
        try {
            const normalizedRow: Record<string, any> = {};
            Object.keys(row).forEach(key => {
                if (key) {
                    normalizedRow[key.toString().trim().toUpperCase()] = row[key];
                }
            });

            const getVal = (possibleKeys: string[]) => {
                for (const key of possibleKeys) {
                    const val = normalizedRow[key.trim().toUpperCase()];
                    if (val !== undefined && val !== '') return val;
                }
                return '';
            };

            const codeVal = getVal(['MÃ HỒ SƠ', 'MÃ HS', 'SỐ HỒ SƠ', 'CODE', 'MA HO SO']);
            // Làm sạch mã hồ sơ kỹ hơn (remove invisible chars)
            // eslint-disable-next-line no-control-regex
            const code = String(codeVal || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); 
            
            // Nếu không có Code thì coi như dòng không hợp lệ cho cả Import và Update
            if (!code && !getVal(['CHỦ SỬ DỤNG', 'TÊN'])) return;

            const customerName = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN', 'KHÁCH HÀNG', 'CHỦ HỘ', 'TEN', 'CHU SU DUNG']);
            const deadline = parseDate(getVal(['NGÀY HẸN TRẢ', 'HẸN TRẢ', 'DEADLINE', 'NGAY HEN TRA']));
            const receivedDate = parseDate(getVal(['NGÀY TIẾP NHẬN', 'NGÀY NHẬN', 'NGÀY NỘP', 'NGAY TIEP NHAN']));
            const assignedDate = parseDate(getVal(['NGÀY GIAO NHÂN VIÊN', 'NGÀY GIAO NV', 'NGÀY GIAO']));
            const completedDateRaw = getVal(['NGÀY GIAO MỘT CỬA', 'NGÀY TRẢ', 'NGÀY HOÀN THÀNH', 'NGAY TRA KQ', 'NGAY HOAN THANH']);
            const completedDate = parseDate(completedDateRaw);

            const rawPhone = getVal(['SỐ ĐIỆN THOẠI', 'SĐT', 'ĐIỆN THOẠI', 'PHONE', 'SDT', 'DIEN THOAI']);
            let phoneNumber = '';
            if (rawPhone) {
                if (typeof rawPhone === 'number') {
                    phoneNumber = '0' + rawPhone.toString();
                } else {
                    phoneNumber = String(rawPhone);
                }
            }
            
            const cccd = String(getVal(['CCCD', 'CMND', 'CĂN CƯỚC', 'CHỨNG MINH']));
            const address = String(getVal(['ĐỊA CHỈ', 'DIA CHI', 'ADDRESS', 'ĐỊA CHỈ ĐẤT', 'ĐỊA CHỈ CHI TIẾT']));
            const areaRaw = getVal(['DIỆN TÍCH', 'DT', 'AREA', 'S', 'DIEN TICH']);
            const area = parseFloat(String(areaRaw).replace(',', '.')); 

            const employeeNameRaw = String(getVal(['NGƯỜI XỬ LÝ', 'NHÂN VIÊN', 'CÁN BỘ', 'NGUOI XU LY', 'ASSIGNED TO', 'NHAN VIEN'])).trim();
            let assignedToId = '';
            if (employeeNameRaw) {
                const foundEmp = employees.find(e => e.name.toLowerCase() === employeeNameRaw.toLowerCase());
                if (foundEmp) assignedToId = foundEmp.id;
                else {
                     const foundById = employees.find(e => e.id === employeeNameRaw);
                     if (foundById) assignedToId = foundById.id;
                }
            }

            const statusInput = String(getVal(['TRẠNG THÁI', 'STATUS', 'TÌNH TRẠNG', 'TRANG THAI'])).trim();
            let status = RecordStatus.RECEIVED; 

            const matchedStatusEntry = Object.entries(STATUS_LABELS).find(
                ([_, label]) => label.toLowerCase() === statusInput.toLowerCase()
            );

            if (matchedStatusEntry) {
                status = matchedStatusEntry[0] as RecordStatus;
            } else {
                if (completedDateRaw) {
                    status = RecordStatus.HANDOVER;
                } else if (assignedToId || assignedDate) {
                    status = RecordStatus.ASSIGNED;
                }
            }

            const exportBatchRaw = String(getVal(['DANH SÁCH XUẤT', 'DS XUẤT', 'DANH SÁCH', 'ĐỢT', 'BATCH', 'EXPORT BATCH']) || '').trim();
            let exportBatch: number | undefined;
            let exportDate: string | undefined;

            const batchMatch = exportBatchRaw.match(/\d+/);
            if (batchMatch) {
                exportBatch = parseInt(batchMatch[0], 10);
                if (completedDate) {
                    try {
                        exportDate = new Date(completedDate).toISOString();
                    } catch (e) {
                        exportDate = completedDate;
                    }
                }
                if (status !== RecordStatus.HANDOVER) {
                    status = RecordStatus.HANDOVER;
                }
            }

            let recordTypeRaw = String(getVal(['LOẠI HỒ SƠ', 'LOẠI', 'LOAI HO SO']) || '').trim();
            const recordTypeMapping: Record<string, string> = {
                'TL': 'Trích lục bản đồ địa chính',
                'TĐ': 'Trích đo bản đồ địa chính', 
                'TD': 'Trích đo bản đồ địa chính',
                'ĐĐ': 'Đo đạc',   
                'DD': 'Đo đạc',
                'CM': 'Cắm mốc',
                'CL': 'Trích đo chỉnh lý bản đồ địa chính', 
                'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính', 
                'HIẾN ĐƯỜNG': 'Trích đo chỉnh lý bản đồ địa chính',
                'CCTT': 'Cung cấp thông tin',
                'TA': 'Tòa án',
                'THA': 'Thi hành án'
            };

            const typeKey = recordTypeRaw.toUpperCase();
            let finalRecordType = recordTypeMapping[typeKey] || recordTypeRaw;
            
            const typeLower = finalRecordType.toLowerCase();
            if (typeLower.includes('trích lục') && !typeLower.includes('bản đồ')) finalRecordType = 'Trích lục bản đồ địa chính';
            else if ((typeLower.includes('chỉnh lý') || typeLower.includes('hiến đường')) && !typeLower.includes('bản đồ')) finalRecordType = 'Trích đo chỉnh lý bản đồ địa chính';
            else if (typeLower.includes('trích đo') && !typeLower.includes('chỉnh lý') && !typeLower.includes('bản đồ')) finalRecordType = 'Trích đo bản đồ địa chính';

            const ward = String(getVal(['XÃ PHƯỜNG', 'XÃ/PHƯỜNG', 'XÃ', 'PHƯỜNG', 'ĐỊA BÀN', 'XA PHUONG', 'XA', 'PHUONG']));
            const group = String(getVal(['NHÓM', 'KHU VỰC', 'TỔ', 'GROUP', 'KHU VUC']));
            const landPlot = String(getVal(['THỬA', 'SỐ THỬA', 'THUA']));
            const mapSheet = String(getVal(['TỜ', 'TỜ BẢN ĐỒ', 'SỐ TỜ', 'TO']));

            // --- XỬ LÝ NỘI DUNG (CẬP NHẬT MỚI) ---
            const content = String(getVal(['NỘI DUNG', 'NOI DUNG', 'CONTENT', 'GHI CHÚ', 'NỘI DUNG CHI TIẾT']) || '');

            // --- XỬ LÝ ỦY QUYỀN ---
            const authorizedBy = String(getVal(['NGƯỜI ỦY QUYỀN', 'NGƯỜI ĐƯỢC ỦY QUYỀN', 'ỦY QUYỀN', 'UY QUYEN', 'AUTHORIZED BY']));
            const authDocType = String(getVal(['LOẠI ỦY QUYỀN', 'GIẤY ỦY QUYỀN', 'LOẠI GIẤY TỜ', 'LOAI UY QUYEN', 'AUTH DOC']));

            const newRecord: RecordFile = {
                id: Math.random().toString(36).substr(2, 9),
                code: code || `AUTO-${Math.floor(Math.random()*10000)}`, // Sử dụng biến code đã được trim ở trên
                customerName: String(customerName || 'Chưa cập nhật'), 
                phoneNumber: phoneNumber, 
                cccd: cccd,
                address: address,
                area: isNaN(area) ? 0 : area,
                receivedDate: receivedDate || new Date().toISOString().split('T')[0],
                deadline: deadline || '',
                ward: ward,
                group: group,
                landPlot: landPlot,
                mapSheet: mapSheet,
                assignedTo: assignedToId,
                assignedDate: assignedDate || (assignedToId ? new Date().toISOString().split('T')[0] : undefined),
                completedDate: completedDate,
                recordType: finalRecordType,
                measurementNumber: String(getVal(['SỐ TRÍCH ĐO', 'TRÍCH ĐO', 'SO TRICH DO']) || ''),
                excerptNumber: String(getVal(['SỐ TRÍCH LỤC', 'TRÍCH LỤC', 'SO TRICH LUC']) || ''),
                status: status,
                exportBatch: exportBatch,
                exportDate: exportDate,
                content: content || 'Nhập từ Excel', // Ưu tiên nội dung từ Excel
                // Map fields ủy quyền
                authorizedBy: authorizedBy,
                authDocType: authDocType
            };

            mappedRecords.push(newRecord);
        } catch (err) {
            // Skip error rows
        }
      });
      return mappedRecords;
  }

  const handleImport = () => {
    if (previewData.length === 0) {
      setError('File không có dữ liệu hợp lệ.');
      return;
    }

    const mappedRecords = processExcelData(previewData);

    if (mappedRecords.length > 0) {
        onImport(mappedRecords);
        setSuccessMsg(`Đang nhập ${mappedRecords.length} hồ sơ... Vui lòng đợi.`);
        setTimeout(() => {
            onClose();
            setFile(null);
            setPreviewData([]);
            setSuccessMsg('');
        }, 1500);
    } else {
        setError('Không tìm thấy dữ liệu phù hợp.');
    }
  };

  const handleUpdateMissing = async () => {
      if (previewData.length === 0) {
          setError('File không có dữ liệu hợp lệ.');
          return;
      }
      setIsUpdating(true);
      
      const mappedRecords = processExcelData(previewData);
      
      if (mappedRecords.length > 0) {
          // Gọi API cập nhật thông minh
          const result = await updateMissingFieldsBatchApi(mappedRecords);
          setIsUpdating(false);
          
          if (result.success) {
              setSuccessMsg(`Đã cập nhật thành công ${result.count} hồ sơ.`);
              setTimeout(() => {
                  setSuccessMsg('');
              }, 3000);
          } else {
              setError("Có lỗi xảy ra khi cập nhật. Vui lòng thử lại.");
          }
      } else {
          setIsUpdating(false);
          setError('Không tìm thấy dữ liệu hợp lệ (Cần có cột MÃ HỒ SƠ).');
      }
  };

  // --- HÀM FORCE UPDATE MỚI ---
  const handleForceUpdate = async () => {
      if (previewData.length === 0) {
          setError('File không có dữ liệu hợp lệ.');
          return;
      }
      if (!confirm("CẢNH BÁO: Bạn đang thực hiện GHI ĐÈ dữ liệu. Hệ thống sẽ thay thế toàn bộ thông tin của các hồ sơ trùng mã bằng dữ liệu từ Excel.\n\nBạn có chắc chắn muốn tiếp tục?")) {
          return;
      }

      setIsUpdating(true);
      
      const mappedRecords = processExcelData(previewData);
      
      if (mappedRecords.length > 0) {
          // Gọi API cập nhật ghi đè (Force Update)
          const result = await forceUpdateRecordsBatchApi(mappedRecords);
          setIsUpdating(false);
          
          if (result.success) {
              if (result.count === 0) {
                  setError(`Hệ thống tìm thấy ${mappedRecords.length} dòng trong Excel nhưng KHÔNG cập nhật được hồ sơ nào. Nguyên nhân có thể do MÃ HỒ SƠ trong Excel và Database không khớp nhau (Ví dụ: "HS 001" khác "HS-001").`);
              } else {
                  setSuccessMsg(`Đã ghi đè thành công ${result.count} / ${mappedRecords.length} hồ sơ.`);
                  setTimeout(() => {
                      setSuccessMsg('');
                  }, 4000);
              }
          } else {
              setError("Có lỗi xảy ra khi cập nhật. Vui lòng thử lại.");
          }
      } else {
          setIsUpdating(false);
          setError('Không tìm thấy dữ liệu hợp lệ (Cần có cột MÃ HỒ SƠ).');
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-green-600" />
            Nhập dữ liệu từ Excel
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
            {!successMsg ? (
                <>
                    <div className="flex justify-end">
                        <button 
                            onClick={handleDownloadSample}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-2"
                        >
                            <Download size={14} /> Tải file mẫu chuẩn (.xlsx)
                        </button>
                    </div>

                    <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                        />
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-600 font-medium">
                            {file ? file.name : "Nhấn để chọn file Excel hoặc kéo thả vào đây"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Hỗ trợ định dạng .xlsx, .xls</p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {previewData.length > 0 && (
                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                            Tìm thấy <span className="font-bold">{previewData.length}</span> dòng dữ liệu.
                            <br/>
                            <span className="text-xs text-gray-500 italic block mt-1">
                                * Hệ thống sẽ tự động nhận diện cột MÃ HỒ SƠ để đối chiếu.
                            </span>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 mt-4">
                        <div className="flex justify-end gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">
                                Hủy
                            </button>
                            
                            <button 
                                onClick={handleUpdateMissing}
                                disabled={!file || previewData.length === 0 || isUpdating}
                                className="px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 disabled:opacity-50 flex items-center gap-2 font-bold text-sm"
                                title="Chỉ điền vào các ô trống, không thay đổi dữ liệu đang có"
                            >
                                <RefreshCw size={16} className={isUpdating ? "animate-spin" : ""} /> 
                                {isUpdating ? '...' : 'Chỉ điền ô trống'}
                            </button>

                            <button 
                                onClick={handleImport}
                                disabled={!file || previewData.length === 0 || isUpdating}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-bold text-sm"
                                title="Thêm mới toàn bộ danh sách vào hệ thống (Bỏ qua trùng)"
                            >
                                <Upload size={16} /> Nhập mới
                            </button>
                        </div>
                        
                        {/* Nút Cập nhật Ghi đè (Tách riêng dòng dưới) */}
                        <div className="pt-2 border-t border-gray-100 flex justify-end">
                             <button 
                                onClick={handleForceUpdate}
                                disabled={!file || previewData.length === 0 || isUpdating}
                                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 flex items-center gap-2 font-bold text-sm"
                                title="Dùng dữ liệu Excel đè lên dữ liệu cũ (Sửa sai, cập nhật lại 'Nhập từ Excel')"
                            >
                                <Save size={16} className={isUpdating ? "animate-spin" : ""} /> 
                                {isUpdating ? 'Đang ghi đè...' : 'Cập nhật & Ghi đè'}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-8">
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4 animate-bounce" />
                    <h3 className="text-lg font-bold text-gray-800">Hoàn tất!</h3>
                    <p className="text-gray-600">{successMsg}</p>
                    <button 
                        onClick={() => { setSuccessMsg(''); setFile(null); setPreviewData([]); }}
                        className="mt-4 text-blue-600 hover:underline text-sm"
                    >
                        Tiếp tục nhập khác
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
