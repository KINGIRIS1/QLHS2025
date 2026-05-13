
import React, { useState, useEffect, useMemo } from 'react';
import { Contract } from '../../types';
import { fetchContracts } from '../../services/api';
import { Search, RotateCcw, Edit, Printer, FileCheck, Trash2, Loader2, DollarSign, ExternalLink, Download, X } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface ContractListProps {
  onEdit: (c: Contract) => void;
  onDelete: (id: string) => void;
  onPrint: (c: Contract, type: 'contract' | 'liquidation') => void;
  onCreateLiquidation: (c: Contract) => void;
  viewMode: 'contract' | 'liquidation'; // Prop mới
}

const ContractList: React.FC<ContractListProps> = ({ onEdit, onDelete, onPrint, onCreateLiquidation, viewMode }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const loadContracts = async () => {
      setLoading(true);
      const data = await fetchContracts();
      setContracts(data);
      setLoading(false);
  };

  useEffect(() => { loadContracts(); }, []);

  const filtered = useMemo(() => {
      let list = contracts;
      // Nếu ở chế độ danh sách thanh lý, có thể lọc những HĐ đã thanh lý nếu muốn
      // Nhưng thường user muốn xem hết. Ở đây ta lọc cơ bản.
      
      if (!searchTerm) return list;
      const lower = searchTerm.toLowerCase();
      return list.filter(c => 
          (c.code || '').toLowerCase().includes(lower) || 
          (c.customerName || '').toLowerCase().includes(lower) ||
          (c.ward || '').toLowerCase().includes(lower)
      );
  }, [contracts, searchTerm]);

  const isLiquidationMode = viewMode === 'liquidation';

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [exportMonth, setExportMonth] = useState('');
  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setExportMonth(val);
      if (val) {
          const [year, month] = val.split('-');
          const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
          setExportFromDate(`${val}-01`);
          setExportToDate(`${val}-${lastDay}`);
      }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setExportYear(val);
      if (val) {
          setExportFromDate(`${val}-01-01`);
          setExportToDate(`${val}-12-31`);
          setExportMonth(''); // reset month
      }
  };

  const handleExportExcelClick = () => {
      setShowExportModal(true);
  };

  const executeExport = () => {
    let dataToExport = filtered;
    
    if (exportFromDate) {
        const from = new Date(exportFromDate);
        dataToExport = dataToExport.filter(c => {
            if (!c.createdDate) return false;
            return new Date(c.createdDate) >= from;
        });
    }
    
    if (exportToDate) {
        const to = new Date(exportToDate);
        to.setHours(23, 59, 59, 999);
        dataToExport = dataToExport.filter(c => {
            if (!c.createdDate) return false;
            return new Date(c.createdDate) <= to;
        });
    }

    const wsData = [
      [
        "STT",
        "Ngày lập HĐ",
        "Số hợp đồng",
        "Ngày hợp đồng",
        "Tên cá nhân/đơn vị",
        "Đại diện đơn vị",
        "Nội dung công việc",
        "Số lượng mốc/ diện tích",
        "Giá trị hợp đồng",
        "Giá trị thanh lý",
        "Ghi chú"
      ],
      ...dataToExport.map((c, index) => {
        const dateStr = c.createdDate ? new Date(c.createdDate).toLocaleDateString('vi-VN') : '';
        const slGiaTri = c.contractType === 'Cắm mốc' ? (c.markerCount || '') : (c.area || '');
        return [
          index + 1,
          dateStr,
          c.code || '',
          dateStr,
          c.customerName || '',
          c.customerName || '', // Có thể tuỳ biến nếu có field riêng
          c.serviceType || c.contractType || '',
          slGiaTri,
          c.totalAmount || 0,
          c.liquidationAmount || 0,
          c.content || ''
        ];
      })
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Style cho header
    for (let C = 0; C < 11; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ c: C, r: 0 });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, // indigo-600
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" }
        }
      };
    }

    // Set width
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 15 }, // Ngày lập HĐ
      { wch: 20 }, // Số hd
      { wch: 15 }, // Ngày hd
      { wch: 30 }, // Tên
      { wch: 30 }, // Đại diện
      { wch: 30 }, // Nội dung
      { wch: 25 }, // SL/DT
      { wch: 20 }, // Giá trị HĐ
      { wch: 20 }, // Giá trị Thanh lý
      { wch: 25 }  // Ghi chú
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach");
    XLSX.writeFile(wb, `Danh_Sach_Hop_Dong_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportModal(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden animate-fade-in">
        <div className={`p-4 border-b border-gray-200 flex items-center gap-3 shrink-0 ${isLiquidationMode ? 'bg-orange-50' : 'bg-purple-50'}`}>
            <h3 className={`font-bold text-lg ${isLiquidationMode ? 'text-orange-800' : 'text-purple-800'}`}>
                {isLiquidationMode ? 'Danh sách Thanh Lý' : 'Danh sách Hợp Đồng'}
            </h3>
            <div className="relative flex-1 max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..." 
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
            <button onClick={handleExportExcelClick} className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full border border-green-200" title="Xuất Excel">
                <Download size={18} />
            </button>
            <button onClick={loadContracts} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full border border-gray-200" title="Tải lại"> 
                <RotateCcw size={18} /> 
            </button>
        </div>
        <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-left table-fixed min-w-[1000px]">
                <thead className={`text-xs uppercase font-semibold sticky top-0 shadow-sm ${isLiquidationMode ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                    <tr> 
                        <th className="p-4 w-12 text-center">STT</th> 
                        <th className="p-4 w-[120px]">Mã HĐ</th> 
                        <th className="p-4 w-[200px]">Khách hàng</th> 
                        <th className="p-4 w-[150px]">Loại HĐ</th> 
                        <th className="p-4 w-[120px]">Ngày lập</th> 
                        
                        {/* Cột hiển thị tiền thay đổi theo mode */}
                        {!isLiquidationMode && <th className="p-4 text-right w-[150px]">Giá trị HĐ</th>}
                        {isLiquidationMode && <th className="p-4 text-right w-[150px]">Giá trị HĐ</th>}
                        {isLiquidationMode && <th className="p-4 text-right w-[150px] bg-orange-200">Giá trị Thanh Lý</th>}
                        
                        <th className="p-4 text-center w-[160px]">Thao tác</th> 
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {loading ? (
                        <tr>
                            <td colSpan={8} className="p-8 text-center">
                                <div className="flex items-center justify-center">
                                    <Loader2 className="animate-spin inline mr-2"/> Đang tải...
                                </div>
                            </td>
                        </tr>
                    ) : filtered.length > 0 ? (
                        filtered.map((c, index) => (
                            <tr key={c.id} className={`transition-colors group ${isLiquidationMode ? 'hover:bg-orange-50/50' : 'hover:bg-purple-50/50'}`}>
                                <td className="p-4 text-center text-gray-400 align-middle">{index + 1}</td>
                                <td className={`p-4 font-medium truncate align-middle ${isLiquidationMode ? 'text-orange-700' : 'text-purple-700'}`} title={c.code}>{c.code}</td>
                                <td className="p-4 font-medium truncate align-middle" title={c.customerName}>{c.customerName}</td>
                                <td className="p-4 align-middle"> 
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs border border-gray-200">{c.contractType || 'Khác'}</span> 
                                </td>
                                <td className="p-4 text-gray-500 align-middle">{c.createdDate ? new Date(c.createdDate).toLocaleDateString('vi-VN') : '-'}</td>
                                
                                {/* Cột tiền */}
                                {!isLiquidationMode && <td className="p-4 text-right font-mono font-bold text-gray-800 align-middle">{c.totalAmount?.toLocaleString('vi-VN')}</td>}
                                
                                {isLiquidationMode && (
                                    <>
                                        <td className="p-4 text-right font-mono text-gray-500 align-middle">{c.totalAmount?.toLocaleString('vi-VN')}</td>
                                        <td className="p-4 text-right font-mono font-bold text-orange-700 align-middle bg-orange-50/30">
                                            {c.liquidationAmount ? c.liquidationAmount.toLocaleString('vi-VN') : '-'}
                                        </td>
                                    </>
                                )}

                                <td className="p-4 text-center align-middle">
                                    <div className="flex justify-center gap-1">
                                        {/* Actions change based on viewMode */}
                                        {!isLiquidationMode ? (
                                            <>
                                                <button onClick={() => onEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Sửa Hợp Đồng"><Edit size={16} /></button>
                                                <button onClick={() => onPrint(c, 'contract')} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition-colors" title="Mở Hợp đồng"><ExternalLink size={16} /></button>
                                                <button onClick={() => onCreateLiquidation(c)} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors" title="Chuyển sang Thanh Lý"><FileCheck size={16} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => onCreateLiquidation(c)} className="p-1.5 text-orange-600 hover:bg-orange-100 rounded transition-colors" title="Sửa/Lưu Thanh Lý"><Edit size={16} /></button>
                                                <button onClick={() => onPrint(c, 'liquidation')} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors" title="Mở Thanh Lý"><ExternalLink size={16} /></button>
                                            </>
                                        )}
                                        
                                        <button onClick={async () => { if(await confirmAction('Xóa hợp đồng này?')) { onDelete(c.id); } }} className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors" title="Xóa"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : ( 
                        <tr><td colSpan={8} className="p-8 text-center text-gray-400">Không tìm thấy dữ liệu.</td></tr> 
                    )}
                </tbody>
            </table>
        </div>

        {/* Modal xuất Excel */}
        {showExportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <div className="flex items-center justify-between mb-4 border-b pb-3">
                        <h3 className="font-bold text-lg text-gray-800">Xuất Excel Hợp Đồng</h3>
                        <button onClick={() => setShowExportModal(false)} className="text-gray-500 hover:text-gray-700">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn tháng</label>
                                <input type="month" value={exportMonth} onChange={handleMonthChange} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn năm</label>
                                <select value={exportYear} onChange={handleYearChange} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                                    <option value="">- Chọn -</option>
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                                <input type="date" value={exportFromDate} onChange={e => setExportFromDate(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                                <input type="date" value={exportToDate} onChange={e => setExportToDate(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <button onClick={() => setShowExportModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                            Hủy
                        </button>
                        <button onClick={executeExport} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                            <Download size={16} /> Xuất File
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ContractList;
