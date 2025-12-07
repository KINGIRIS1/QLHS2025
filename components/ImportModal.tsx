

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee } from '../types';
import { STATUS_LABELS } from '../constants';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QUAN TRỌNG: Nếu modal không mở, không hiển thị gì cả
  if (!isOpen) return null;

  // Hàm chuyển đổi ngày từ Excel an toàn hơn
  // Khắc phục lỗi: 22007 (invalid syntax), 22008 (out of range)
  const parseDate = (dateVal: any): string | undefined => {
    if (!dateVal) return undefined;

    try {
        let date: Date | null = null;

        // Trường hợp 1: Excel Serial Number (VD: 45321)
        if (typeof dateVal === 'number') {
            // Excel tính từ 30/12/1899, cần trừ đi sai số múi giờ nếu cần
            date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        }
        // Trường hợp 2: Chuỗi ký tự
        else if (typeof dateVal === 'string') {
            const cleanStr = dateVal.trim();
            // Nếu chuỗi chứa ký tự lạ không phải số hoặc dấu phân cách ngày -> Bỏ qua
            // VD: "619-0032", "CSD RÚT HS" -> Regex check
            if (!/^[\d\-\/\.]+$/.test(cleanStr)) return undefined;

            // Xử lý dd/mm/yyyy
            if (cleanStr.includes('/')) {
                const parts = cleanStr.split('/');
                if (parts.length === 3) {
                    const d = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const y = parseInt(parts[2], 10);
                    // Kiểm tra ngày tháng hợp lệ (VD: Tháng 6 không có ngày 60)
                    if (m > 12 || d > 31) return undefined;
                    date = new Date(y, m - 1, d);
                }
            } 
            // Xử lý yyyy-mm-dd
            else if (cleanStr.includes('-')) {
                const parts = cleanStr.split('-');
                if (parts.length === 3) {
                     // Nếu format ngược dd-mm-yyyy hoặc yyyy-mm-dd
                     // Kiểm tra phần tử đầu tiên có phải năm không (> 1900)
                     const p1 = parseInt(parts[0], 10);
                     if (p1 > 1900) {
                         date = new Date(cleanStr); // Chuẩn ISO
                     } else {
                         // Giả sử dd-mm-yyyy
                         const d = parseInt(parts[0], 10);
                         const m = parseInt(parts[1], 10);
                         const y = parseInt(parts[2], 10);
                         if (m > 12 || d > 31) return undefined;
                         date = new Date(y, m - 1, d);
                     }
                }
            }
        }

        // Kiểm tra cuối cùng: Date object có hợp lệ không
        if (date && !isNaN(date.getTime())) {
             // Định dạng lại thành YYYY-MM-DD để gửi API
             const y = date.getFullYear();
             const m = String(date.getMonth() + 1).padStart(2, '0');
             const d = String(date.getDate()).padStart(2, '0');
             
             // Chặn năm quá xa hoặc quá khứ (lỗi data rác)
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
        // FIX: Đổi từ 'binary' sang 'array' để đọc ArrayBuffer -> Ổn định hơn cho file .xlsx
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0]; // Lấy sheet đầu tiên
        const sheet = workbook.Sheets[sheetName];
        // defval: '' để đảm bảo các ô trống không bị undefined
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        setPreviewData(jsonData);
      } catch (err) {
        setError('Không thể đọc file. Vui lòng kiểm tra định dạng.');
        console.error(err);
      }
    };
    // FIX: Sử dụng readAsArrayBuffer thay vì readAsBinaryString
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadSample = () => {
      const headers = [
          "MÃ HỒ SƠ", "CHỦ SỬ DỤNG", "SỐ ĐIỆN THOẠI", "CCCD", 
          "ĐỊA CHỈ", "XÃ PHƯỜNG", "NHÓM", "TỜ", "THỬA", "DIỆN TÍCH",
          "LOẠI HỒ SƠ", "NỘI DUNG", "NGÀY TIẾP NHẬN", "NGÀY HẸN TRẢ", 
          "NGƯỜI XỬ LÝ", "TRẠNG THÁI"
      ];
      const sampleData = [
          "HS-2024-001", "Nguyễn Văn A", "0909123456", "070090001234",
          "Ấp 1", "Minh Hưng", "Minh Hưng", "10", "123", 150.5,
          "Trích lục", "Xin trích lục", "2024-01-01", "2024-01-15",
          "Nguyễn Văn B", "Tiếp nhận mới"
      ];

      const ws = XLSX.utils.aoa_to_sheet([headers, sampleData]);
      
      // Auto width
      const wscols = headers.map(h => ({ wch: h.length + 5 }));
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Ho_So");
      XLSX.writeFile(wb, "Mau_Nhap_Ho_So.xlsx");
  };

  const handleImport = () => {
    if (previewData.length === 0) {
      setError('File không có dữ liệu hợp lệ.');
      return;
    }

    const mappedRecords: RecordFile[] = [];
    let importErrors = 0;

    // Ánh xạ cột Excel sang cấu trúc RecordFile
    previewData.forEach((row: any) => {
        try {
            // --- LOGIC CHUẨN HÓA TÊN CỘT (CASE-INSENSITIVE) ---
            // Tạo một map với key là chữ IN HOA để dễ tìm kiếm
            // Ví dụ Excel có cột "Họ Tên" -> normalizedRow["HỌ TÊN"] = "Nguyễn Văn A"
            const normalizedRow: Record<string, any> = {};
            Object.keys(row).forEach(key => {
                if (key) {
                    normalizedRow[key.toString().trim().toUpperCase()] = row[key];
                }
            });

            // Hàm helper tìm giá trị theo danh sách từ khóa ưu tiên
            const getVal = (possibleKeys: string[]) => {
                for (const key of possibleKeys) {
                    const val = normalizedRow[key.trim().toUpperCase()];
                    if (val !== undefined && val !== '') return val;
                }
                return '';
            };

            // --- ĐỊNH NGHĨA CÁC TỪ KHÓA CỘT ---
            const code = getVal(['MÃ HỒ SƠ', 'MÃ HS', 'SỐ HỒ SƠ', 'CODE', 'MA HO SO']);
            const customerName = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN', 'KHÁCH HÀNG', 'CHỦ HỘ', 'TEN', 'CHU SU DUNG']);
            
            // Xử lý cột ngày tháng
            const deadline = parseDate(getVal(['NGÀY HẸN TRẢ', 'HẸN TRẢ', 'DEADLINE', 'NGAY HEN TRA']));
            // Nếu không có ngày nhận -> lấy ngày hôm nay
            const receivedDate = parseDate(getVal(['NGÀY TIẾP NHẬN', 'NGÀY NHẬN', 'NGÀY NỘP', 'NGAY TIEP NHAN'])) || new Date().toISOString().split('T')[0];
            const assignedDate = parseDate(getVal(['NGÀY GIAO NHÂN VIÊN', 'NGÀY GIAO NV', 'NGAY GIAO']));
            const completedDateRaw = getVal(['NGÀY GIAO MỘT CỬA', 'NGÀY TRẢ', 'NGÀY HOÀN THÀNH', 'NGAY TRA KQ']);
            const completedDate = parseDate(completedDateRaw);

            // --- XỬ lý SỐ ĐIỆN THOẠI ---
            const rawPhone = getVal(['SỐ ĐIỆN THOẠI', 'SĐT', 'ĐIỆN THOẠI', 'PHONE', 'SDT', 'DIEN THOAI']);
            let phoneNumber = '';
            if (rawPhone) {
                if (typeof rawPhone === 'number') {
                    phoneNumber = '0' + rawPhone.toString();
                } else {
                    phoneNumber = String(rawPhone);
                }
            }
            
            // --- XỬ LÝ CCCD ---
            const cccd = String(getVal(['CCCD', 'CMND', 'CĂN CƯỚC', 'CHỨNG MINH']));

            // --- XỬ LÝ ĐỊA CHỈ & DIỆN TÍCH ---
            const address = String(getVal(['ĐỊA CHỈ', 'DIA CHI', 'ADDRESS']));
            const areaRaw = getVal(['DIỆN TÍCH', 'DT', 'AREA', 'S']);
            // Chuyển diện tích sang số
            const area = parseFloat(String(areaRaw).replace(',', '.')); 

            // --- XỬ LÝ NHÂN VIÊN ĐƯỢC GIAO ---
            // Tìm kiếm cột tên nhân viên hoặc người xử lý
            const employeeNameRaw = String(getVal(['NGƯỜI XỬ LÝ', 'NHÂN VIÊN', 'CÁN BỘ', 'NGUOI XU LY', 'ASSIGNED TO', 'NHAN VIEN'])).trim();
            let assignedToId = '';
            
            if (employeeNameRaw) {
                // 1. Tìm theo tên (Không phân biệt hoa thường)
                const foundEmp = employees.find(e => e.name.toLowerCase() === employeeNameRaw.toLowerCase());
                if (foundEmp) {
                    assignedToId = foundEmp.id;
                } else {
                     // 2. Tìm theo ID (nếu người dùng nhập thẳng ID)
                     const foundById = employees.find(e => e.id === employeeNameRaw);
                     if (foundById) assignedToId = foundById.id;
                }
            }

            // --- XỬ LÝ TRẠNG THÁI ---
            const statusInput = String(getVal(['TRẠNG THÁI', 'STATUS', 'TÌNH TRẠNG', 'TRANG THAI'])).trim();
            let status = RecordStatus.RECEIVED; // Mặc định

            const matchedStatusEntry = Object.entries(STATUS_LABELS).find(
                ([_, label]) => label.toLowerCase() === statusInput.toLowerCase()
            );

            if (matchedStatusEntry) {
                status = matchedStatusEntry[0] as RecordStatus;
            } else {
                if (completedDateRaw) {
                    status = RecordStatus.HANDOVER;
                } else if (assignedToId || assignedDate) {
                    // Nếu có tên người xử lý hoặc ngày giao -> coi như Đã giao việc
                    status = RecordStatus.ASSIGNED;
                }
            }

            // --- XỬ LÝ DANH SÁCH XUẤT (BATCH) ---
            const exportBatchRaw = String(getVal(['DANH SÁCH XUẤT', 'DS XUẤT', 'DANH SÁCH', 'ĐỢT', 'BATCH', 'EXPORT BATCH']) || '').trim();
            let exportBatch: number | undefined;
            let exportDate: string | undefined;

            // Tách lấy số từ chuỗi (VD: "DS1", "Đợt 5", "DS 01") -> Lấy 1, 5
            const batchMatch = exportBatchRaw.match(/\d+/);
            if (batchMatch) {
                exportBatch = parseInt(batchMatch[0], 10);
                
                // Nếu có đợt xuất và có ngày hoàn thành -> Ghi nhận ngày xuất = ngày hoàn thành (dạng ISO)
                if (completedDate) {
                    try {
                        exportDate = new Date(completedDate).toISOString();
                    } catch (e) {
                        exportDate = completedDate; // Fallback
                    }
                }
                
                // Nếu có đợt xuất, chắc chắn trạng thái phải là HANDOVER hoặc SIGNED
                if (status !== RecordStatus.HANDOVER) {
                    status = RecordStatus.HANDOVER;
                }
            }

            // --- XỬ LÝ LOẠI HỒ SƠ (MAPPING VIẾT TẮT) ---
            let recordTypeRaw = String(getVal(['LOẠI HỒ SƠ', 'LOẠI', 'NOI DUNG', 'LOAI HO SO']) || '').trim();
            
            // Bảng mã hóa viết tắt -> Tên ĐẦY ĐỦ (để lưu vào DB)
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

            // Chuẩn hóa input về dạng chữ hoa để so sánh
            const typeKey = recordTypeRaw.toUpperCase();
            // Nếu tìm thấy trong bảng map thì lấy giá trị
            let finalRecordType = recordTypeMapping[typeKey] || recordTypeRaw;
            
            // Mapping thêm một số trường hợp tên dài chưa chuẩn
            const typeLower = finalRecordType.toLowerCase();
            if (typeLower.includes('trích lục') && !typeLower.includes('bản đồ')) finalRecordType = 'Trích lục bản đồ địa chính';
            else if ((typeLower.includes('chỉnh lý') || typeLower.includes('hiến đường')) && !typeLower.includes('bản đồ')) finalRecordType = 'Trích đo chỉnh lý bản đồ địa chính';
            else if (typeLower.includes('trích đo') && !typeLower.includes('chỉnh lý') && !typeLower.includes('bản đồ')) finalRecordType = 'Trích đo bản đồ địa chính';


            // --- XỬ LÝ XÃ PHƯỜNG & ĐỊA CHÍNH ---
            // Tìm kiếm rộng hơn với nhiều từ khóa
            const ward = String(getVal(['XÃ PHƯỜNG', 'XÃ/PHƯỜNG', 'XÃ', 'PHƯỜNG', 'ĐỊA CHỈ', 'ĐỊA BÀN', 'XA PHUONG', 'XA', 'PHUONG']));
            const group = String(getVal(['NHÓM', 'KHU VỰC', 'TỔ', 'GROUP', 'KHU VUC']));
            const landPlot = String(getVal(['THỬA', 'SỐ THỬA', 'THUA']));
            const mapSheet = String(getVal(['TỜ', 'TỜ BẢN ĐỒ', 'SỐ TỜ', 'TO']));

            const newRecord: RecordFile = {
                id: Math.random().toString(36).substr(2, 9),
                code: String(code || `AUTO-${Math.floor(Math.random()*10000)}`), 
                customerName: String(customerName || 'Chưa cập nhật'), 
                phoneNumber: phoneNumber, 
                cccd: cccd,
                address: address,
                area: isNaN(area) ? 0 : area,
                receivedDate: receivedDate || new Date().toISOString().split('T')[0], // Fallback nếu parse fail
                deadline: deadline || '',
                ward: ward,
                group: group,
                landPlot: landPlot,
                mapSheet: mapSheet,
                assignedTo: assignedToId,
                assignedDate: assignedDate || (assignedToId ? new Date().toISOString().split('T')[0] : undefined), // Nếu có người mà chưa có ngày -> lấy hôm nay
                completedDate: completedDate,
                recordType: finalRecordType,
                measurementNumber: String(getVal(['SỐ TRÍCH ĐO', 'TRÍCH ĐO', 'SO TRICH DO']) || ''),
                excerptNumber: String(getVal(['SỐ TRÍCH LỤC', 'TRÍCH LỤC', 'SO TRICH LUC']) || ''),
                status: status,
                exportBatch: exportBatch,
                exportDate: exportDate,
                content: 'Nhập từ Excel',
            };

            mappedRecords.push(newRecord);
        } catch (err) {
            importErrors++;
        }
    });

    if (mappedRecords.length > 0) {
        onImport(mappedRecords);
        setSuccessMsg(`Đang nhập ${mappedRecords.length} hồ sơ... Vui lòng đợi.`);
        // Không đóng ngay lập tức để App xử lý logic API
        setTimeout(() => {
            onClose();
            setFile(null);
            setPreviewData([]);
            setSuccessMsg('');
        }, 1500);
    } else {
        setError('Không tìm thấy dữ liệu phù hợp. Vui lòng kiểm tra tên cột trong Excel.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
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
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {previewData.length > 0 && (
                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                            Tìm thấy <span className="font-bold">{previewData.length}</span> dòng dữ liệu.
                            <br/>
                            <span className="text-xs text-gray-500 italic block mt-1">
                                * Hệ thống sẽ <strong>tự động bỏ qua</strong> các cột thừa.<br/>
                                * Tự động lấy các cột quan trọng: Mã HS, Tên, SĐT, Diện tích, Địa chỉ, Loại HS, Ngày tháng...
                            </span>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">
                            Hủy
                        </button>
                        <button 
                            onClick={handleImport}
                            disabled={!file || previewData.length === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Upload size={16} /> Nhập dữ liệu
                        </button>
                    </div>
                </>
            ) : (
                <div className="text-center py-8">
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4 animate-bounce" />
                    <h3 className="text-lg font-bold text-gray-800">Đang xử lý!</h3>
                    <p className="text-gray-600">{successMsg}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;