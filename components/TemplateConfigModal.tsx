
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, Trash2, Download, AlertCircle, Save, FileSpreadsheet } from 'lucide-react';
import { saveTemplate, hasTemplate, removeTemplate, STORAGE_KEYS } from '../services/docxService';
import { saveExcelTemplate, hasExcelTemplate, removeExcelTemplate, EXCEL_STORAGE_KEYS } from '../services/excelTemplateService';
import * as XLSX from 'xlsx-js-style';

interface TemplateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'receipt' | 'contract' | 'excel_list';
}

const TemplateConfigModal: React.FC<TemplateConfigModalProps> = ({ isOpen, onClose, type }) => {
  const [file, setFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [startRow, setStartRow] = useState<number>(8); // Mặc định dòng 8

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  let storageKey = '';
  let title = '';
  let acceptExt = '.docx';
  let isExcel = false;

  switch (type) {
      case 'receipt':
          storageKey = STORAGE_KEYS.RECEIPT_TEMPLATE;
          title = 'Cấu hình Mẫu Biên Nhận (.docx)';
          break;
      case 'contract':
          storageKey = STORAGE_KEYS.CONTRACT_TEMPLATE;
          title = 'Cấu hình Mẫu Hợp Đồng (.docx)';
          break;
      case 'excel_list':
          storageKey = EXCEL_STORAGE_KEYS.DAILY_LIST_TEMPLATE;
          title = 'Cấu hình Mẫu Danh Sách Ngày (.xlsx)';
          acceptExt = '.xlsx';
          isExcel = true;
          break;
  }

  useEffect(() => {
    if (isOpen) {
        if (isExcel) {
            setSaved(hasExcelTemplate(storageKey));
            const savedRow = localStorage.getItem(storageKey + '_start_row');
            if (savedRow) setStartRow(parseInt(savedRow));
        } else {
            setSaved(hasTemplate(storageKey));
        }
        setFile(null);
    }
  }, [isOpen, storageKey, isExcel]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const selectedFile = e.target.files[0];
        if (!selectedFile.name.endsWith(acceptExt)) {
            alert(`Vui lòng chỉ chọn file ${acceptExt}`);
            return;
        }
        setFile(selectedFile);
    }
  };

  const handleSave = async () => {
    if (!file && !saved) return;
    
    let success = false;
    if (isExcel) {
        if (file) {
            success = await saveExcelTemplate(storageKey, file, startRow);
        } else if (saved) {
            localStorage.setItem(storageKey + '_start_row', startRow.toString());
            success = true;
        }
    } else {
        if (file) success = await saveTemplate(storageKey, file);
    }

    if (success) {
        setSaved(true);
        alert('Đã lưu cấu hình mẫu thành công!');
        onClose();
    } else {
        alert('Lỗi khi lưu mẫu.');
    }
  };

  const handleDelete = () => {
      if(confirm('Bạn có chắc muốn xóa mẫu hiện tại?')) {
          if (isExcel) removeExcelTemplate(storageKey);
          else removeTemplate(storageKey);
          setSaved(false);
          setFile(null);
      }
  };

  const handleDownloadExcelSample = () => {
      // Tạo file mẫu Excel chuẩn để người dùng tải về
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
          ["Độc lập - Tự do - Hạnh phúc"],
          [],
          ["DANH SÁCH HỒ SƠ TRÍCH LỤC TRÍCH ĐO"],
          ["NGÀY ... THÁNG ... NĂM ..."],
          [],
          ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ", "Loại Hồ Sơ", "Hẹn Trả", "Ghi Chú"], // Dòng 7
      ]);

      // Định dạng độ rộng cột
      ws['!cols'] = [
          { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 20 }
      ];

      // Định dạng merge tiêu đề
      ws['!merges'] = [
          { s: {r:0, c:0}, e: {r:0, c:6} }, // Quốc hiệu
          { s: {r:1, c:0}, e: {r:1, c:6} },
          { s: {r:3, c:0}, e: {r:3, c:6} }, // Tên danh sách
          { s: {r:4, c:0}, e: {r:4, c:6} }, // Ngày
      ];

      // Định dạng Style (Cơ bản)
      const centerStyle = { alignment: { horizontal: "center" }, font: { name: "Times New Roman", bold: true } };
      const headerStyle = { ...centerStyle, border: { top: {style:"thin"}, bottom: {style:"thin"}, left: {style:"thin"}, right: {style:"thin"} }, fill: { fgColor: { rgb: "E0E0E0" } } };

      if(ws['A1']) ws['A1'].s = { ...centerStyle, font: { ...centerStyle.font, sz: 12 } };
      if(ws['A2']) ws['A2'].s = { ...centerStyle, font: { ...centerStyle.font, sz: 12, underline: true } };
      if(ws['A4']) ws['A4'].s = { ...centerStyle, font: { ...centerStyle.font, sz: 14 } };
      if(ws['A5']) ws['A5'].s = { ...centerStyle, font: { ...centerStyle.font, sz: 12, italic: true } };

      // Style Header cột
      ['A7', 'B7', 'C7', 'D7', 'E7', 'F7', 'G7'].forEach(cell => {
          if(ws[cell]) ws[cell].s = headerStyle;
      });

      XLSX.utils.book_append_sheet(wb, ws, "Mau_DS");
      XLSX.writeFile(wb, "Mau_Danh_Sach_Ho_So.xlsx");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {isExcel ? <FileSpreadsheet className="text-green-600" /> : <FileText className="text-blue-600" />}
            {title}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
            <div className={`p-4 rounded-lg border flex items-center justify-between ${saved ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    {saved ? <CheckCircle className="text-green-600" size={24} /> : <AlertCircle className="text-gray-400" size={24} />}
                    <div>
                        <p className={`font-bold ${saved ? 'text-green-800' : 'text-gray-600'}`}>
                            {saved ? 'Đã có mẫu in' : 'Chưa có mẫu in'}
                        </p>
                        <p className="text-xs text-gray-500">
                            {saved ? 'Hệ thống sẽ dùng mẫu này để xuất file.' : `Vui lòng tải lên file ${acceptExt}.`}
                        </p>
                    </div>
                </div>
                {saved && (
                    <button onClick={handleDelete} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded">
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 cursor-pointer transition-colors relative"
                onClick={() => fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept={acceptExt} 
                    className="hidden" 
                />
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">
                    {file ? file.name : `Nhấn để chọn file mẫu (${acceptExt})`}
                </p>
                {isExcel && <p className="text-xs text-gray-500 mt-1">Nên xóa hết dữ liệu cũ trong file mẫu, chỉ giữ lại tiêu đề.</p>}
            </div>

            {isExcel && (
                <>
                    <div className="flex justify-end">
                        <button 
                            type="button"
                            onClick={handleDownloadExcelSample}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                            <Download size={14} /> Tải file mẫu chuẩn (.xlsx)
                        </button>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-2">
                        <label className="block text-sm font-bold text-blue-800">
                            Dữ liệu bắt đầu từ dòng số mấy?
                        </label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" min="1" 
                                className="w-20 border border-blue-300 rounded px-2 py-1 text-center font-bold text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={startRow}
                                onChange={(e) => setStartRow(parseInt(e.target.value) || 1)}
                            />
                            <span className="text-xs text-blue-600">
                                (Ví dụ: Tiêu đề ở dòng 7, thì dữ liệu bắt đầu dòng 8)
                            </span>
                        </div>
                        <p className="text-[11px] text-blue-500 italic mt-1">
                            * App sẽ điền dữ liệu từ dòng này trở xuống.
                        </p>
                        <div className="mt-2 text-xs bg-white p-2 rounded border border-blue-200">
                            <strong>Quy tắc cột (Bắt buộc theo thứ tự):</strong><br/>
                            A: STT | B: Mã HS | C: Tên Chủ HS | D: Địa chỉ | E: Loại HS | F: Hẹn trả | G: Ghi chú
                        </div>
                    </div>
                </>
            )}

            {!isExcel && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="text-sm font-bold text-yellow-800 mb-1 flex items-center gap-1">
                        <AlertCircle size={14} /> MẸO:
                    </p>
                    <div className="text-xs text-yellow-700">
                        Để tránh lỗi file Word, hãy copy các từ khóa (ví dụ <code>{'{{TEN}}'}</code>) ra Notepad rồi copy ngược lại vào file Word để xóa định dạng ẩn.
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t mt-auto">
                <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">
                    Hủy
                </button>
                <button 
                    onClick={handleSave} 
                    disabled={!file && !saved}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                    <Save size={18} /> Lưu Cấu Hình
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateConfigModal;
