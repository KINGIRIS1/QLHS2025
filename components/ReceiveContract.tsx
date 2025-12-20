
import React, { useState, useEffect } from 'react';
import { RecordFile, Contract, PriceItem, User } from '../types';
import { fetchPriceList, deleteContractApi, updateContractApi, createContractApi } from '../services/api';
import { FileSignature, PlusCircle, LayoutList, Settings, Settings2, Loader2, Printer, FileCheck } from 'lucide-react';
import PriceConfigModal from './PriceConfigModal';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import TemplateConfigModal from './TemplateConfigModal';
import DocxPreviewModal from './DocxPreviewModal';
import { confirmAction } from '../utils/appHelpers';

// Child Components
import ContractForm from './receive-contract/ContractForm';
import ContractList from './receive-contract/ContractList';

interface ReceiveContractProps {
  onSave: (record: RecordFile) => Promise<boolean>; 
  wards: string[];
  currentUser: User;
  records: RecordFile[]; 
}

// --- HÀM ĐỌC SỐ TIỀN ---
const docSo3ChuSo = (baso: number): string => {
    const docSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    let tram = Math.floor(baso / 100);
    let chuc = Math.floor((baso % 100) / 10);
    let donvi = baso % 10;
    let ketQua = "";
    if (tram === 0 && chuc === 0 && donvi === 0) return "";
    if (tram !== 0) { ketQua += docSo[tram] + " trăm "; if ((chuc === 0) && (donvi !== 0)) ketQua += "linh "; }
    if ((chuc !== 0) && (chuc !== 1)) { ketQua += docSo[chuc] + " mươi"; if ((chuc === 0) && (donvi !== 0)) ketQua = ketQua + " linh "; }
    if (chuc === 1) ketQua += "mười";
    switch (donvi) {
        case 1: if ((chuc !== 0) && (chuc !== 1)) ketQua += " mốt"; else ketQua += " một"; break;
        case 5: if (chuc === 0) ketQua += " năm"; else ketQua += " lăm"; break;
        default: if (donvi !== 0) ketQua += " " + docSo[donvi]; break;
    }
    return ketQua;
}
const docTienBangChu = (soTien: number): string => {
    if (soTien === 0) return "Không đồng";
    const tien = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
    let lan = 0; let i = 0; let so = soTien; let ketQua = ""; let viTri: number[] = [];
    if (so < 0) return "Số tiền âm";
    while (so > 0) { viTri[lan] = so % 1000; so = Math.floor(so / 1000); lan++; }
    for (i = lan - 1; i >= 0; i--) { let tmp = docSo3ChuSo(viTri[i]); if (tmp !== "") { ketQua += tmp; ketQua += " " + tien[i] + " "; } }
    ketQua = ketQua.replace(/\s+/g, ' ').trim();
    ketQua = ketQua.charAt(0).toUpperCase() + ketQua.slice(1);
    return ketQua + " đồng";
}

function _nd(s: string): string {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const ReceiveContract: React.FC<ReceiveContractProps> = ({ wards, currentUser, records }) => {
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  
  // Modal States
  const [isPriceConfigOpen, setIsPriceConfigOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);

  useEffect(() => { loadPrices(); }, []);
  const loadPrices = async () => { const prices = await fetchPriceList(); setPriceList(prices); };

  const generateContractCode = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `HĐ-${year}-${randomNum}`;
  };

  const handleEdit = (c: Contract) => { setEditingContract(c); setViewMode('create'); };
  const handleDelete = async (id: string) => { 
      if(await confirmAction("Bạn có chắc chắn muốn xóa hợp đồng này không?")) await deleteContractApi(id); 
  }; 

  // Updated: Trả về Promise<boolean> và không alert/switch view tại đây nữa
  const handleSaveContract = async (contract: Contract, isUpdate: boolean): Promise<boolean> => {
      let success = false;
      if (isUpdate) {
          success = await updateContractApi(contract);
      } else {
          success = await createContractApi(contract);
      }
      return success;
  };

  // --- LOGIC IN ẤN HỢP ĐỒNG (CẬP NHẬT FULL PLACEHOLDER) ---
  const handlePreviewDocx = async (dataToPrint: Partial<Contract> | undefined, printType: 'contract' | 'liquidation') => {
      if (!dataToPrint || !dataToPrint.customerName) { alert("Vui lòng nhập Tên khách hàng để in."); return; }
      
      let templateKey = '', typeName = '';
      const isCamMoc = dataToPrint.contractType === 'Cắm mốc';
      
      if (printType === 'liquidation') {
          templateKey = isCamMoc ? STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_CAMMOC : STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_DODAC;
          typeName = isCamMoc ? "Thanh lý Hợp đồng Cắm mốc" : "Thanh lý Hợp đồng Đo đạc";
      } else {
          templateKey = isCamMoc ? STORAGE_KEYS.CONTRACT_TEMPLATE_CAMMOC : STORAGE_KEYS.CONTRACT_TEMPLATE_DODAC;
          typeName = isCamMoc ? "Hợp đồng Cắm mốc" : "Hợp đồng Đo đạc";
      }
      
      if (!hasTemplate(templateKey)) { 
          if(await confirmAction(`Chưa có mẫu "${typeName}". Bạn có muốn cấu hình ngay không?`)) setIsTemplateModalOpen(true); 
          return; 
      }
      
      setIsProcessing(true);
      
      const cDate = dataToPrint.createdDate ? new Date(dataToPrint.createdDate) : new Date();
      const moneyText = docTienBangChu(dataToPrint.totalAmount || 0);
      const val = (v: any) => (v === undefined || v === null) ? "" : String(v);
      const money = (v: any) => (v === undefined || v === null) ? "0" : Number(v).toLocaleString('vi-VN');
      
      // --- LOGIC MAP DỮ LIỆU ĐẶC THÙ (BÊN B & ĐỊA DANH) ---
      const rawWard = val(dataToPrint.ward);
      const normWard = _nd(rawWard);
      
      // 1. Phân biệt Xã / Phường
      let unitPrefix = 'Xã/Phường';
      if (normWard.includes('nha bich')) unitPrefix = 'Xã';
      else if (normWard.includes('minh hung') || normWard.includes('chon thanh') || normWard.includes('hung long') || normWard.includes('thanh tam')) unitPrefix = 'Phường';

      // 2. Logic người ký & Chức vụ (Có thể tùy chỉnh theo thực tế)
      let signerName = 'PHẠM VĂN NAM'; // Mặc định
      let signerPosition = 'PHÓ GIÁM ĐỐC';
      
      if (normWard.includes('nha bich')) {
          signerName = 'LƯƠNG NGỌC DINH';
          signerPosition = 'GIÁM ĐỐC';
      } else if (normWard.includes('minh hung')) {
          signerName = 'TRỊNH QUANG HƯNG';
          signerPosition = 'PHÓ GIÁM ĐỐC';
      }

      // 3. Logic SĐT Liên hệ
      let sdtLienHe = ""; 
      if (normWard.includes("minh hung")) {
          sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
      } else if (normWard.includes("nha bich")) {
          sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
      } else if (normWard.includes("chon thanh")) {
          sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
      }

      const detailAddress = val(dataToPrint.address);
      const fullLandAddress = detailAddress ? `${detailAddress}, ${unitPrefix} ${rawWard}` : `${unitPrefix} ${rawWard}`;
      const qty = dataToPrint.contractType === 'Cắm mốc' ? (dataToPrint.markerCount || 0) : (dataToPrint.plotCount || 0);
      const preTaxAmount = (dataToPrint.unitPrice || 0) * qty;

      // THUE_LABEL logic
      const vatRate = dataToPrint.vatRate || 0;
      const thueLabel = vatRate > 0 ? `Thuế GTGT (${vatRate}%)` : 'Thuế GTGT';

      const printData = {
          // --- ENGLISH RAW KEYS (Added for consistency) ---
          code: val(dataToPrint.code),
          customerName: val(dataToPrint.customerName),
          landPlot: val(dataToPrint.landPlot),
          mapSheet: val(dataToPrint.mapSheet),
          address: val(dataToPrint.address), // Maps to DIA_CHI_CHI_TIET
          DIA_CHI_CHI_TIET: val(dataToPrint.address),

          // --- THÔNG TIN CHUNG ---
          MA_HS: val(dataToPrint.code),
          SO_HD: val(dataToPrint.code),
          NGAY: cDate.getDate().toString().padStart(2, '0'),
          THANG: (cDate.getMonth()+1).toString().padStart(2, '0'),
          NAM: cDate.getFullYear(),
          NGAY_KY: cDate.toLocaleDateString('vi-VN'),
          NGUOI_LAP: val(currentUser.name),
          
          // --- BÊN A (KHÁCH HÀNG) ---
          BEN_A: val(dataToPrint.customerName).toUpperCase(),
          TEN: val(dataToPrint.customerName).toUpperCase(),
          KHACH_HANG: val(dataToPrint.customerName).toUpperCase(),
          DIA_CHI_A: val(dataToPrint.address || dataToPrint.ward),
          DIACHI: val(dataToPrint.address || dataToPrint.ward),
          SDT: val(dataToPrint.phoneNumber),
          SDT_A: val(dataToPrint.phoneNumber),
          
          // --- BÊN B (CÔNG TY - DYNAMIC) ---
          BEN_B: "CN VPĐKĐĐ THỊ XÃ CHƠN THÀNH",
          DAI_DIEN_B: signerName,
          CHUC_VU_B: signerPosition,
          NGUOI_KY: signerName,
          CHUCVU_KY: signerPosition,
          SDTLH: sdtLienHe, // SĐT Liên hệ cán bộ

          // --- THÔNG TIN ĐẤT ---
          THUA: val(dataToPrint.landPlot),
          SO_THUA: val(dataToPrint.landPlot),
          TO: val(dataToPrint.mapSheet),
          SO_TO: val(dataToPrint.mapSheet),
          DT: val(dataToPrint.area),
          DIEN_TICH: val(dataToPrint.area),
          
          DIACHIDAT: fullLandAddress,
          DIA_CHI_THUA_DAT: fullLandAddress,
          XA_PHUONG: unitPrefix,
          TEN_XA: rawWard,
          XA: rawWard,
          KHUVUC: val(dataToPrint.areaType),
          TINH: "Bình Phước",
          HUYEN: "thị xã Chơn Thành",

          // --- CHI TIẾT CÔNG VIỆC ---
          LOAIHS: val(dataToPrint.contractType),
          LOAIDV: val(dataToPrint.serviceType || dataToPrint.contractType),
          NOI_DUNG_CV: val(dataToPrint.serviceType || dataToPrint.contractType),
          GHICHU: val(dataToPrint.content),
          
          // --- TÀI CHÍNH ---
          SOLUONG: qty,
          SO_LUONG: qty,
          SOTHUA_SOMOC_LABEL: dataToPrint.contractType === 'Cắm mốc' ? 'Số mốc' : 'Số thửa',
          SOTHUA_SOMOC_VALUE: val(qty),
          
          DONGIA: money(dataToPrint.unitPrice),
          DON_GIA: money(dataToPrint.unitPrice),
          DONGIA_TEXT: money(dataToPrint.unitPrice),
          
          THANHTIEN: money(preTaxAmount),
          THANH_TIEN: money(preTaxAmount),
          THANHTIEN_TEXT: money(preTaxAmount),
          
          VAT: val(dataToPrint.vatRate),
          THUE_VAT: val(dataToPrint.vatRate),
          TIEN_THUE: money(dataToPrint.vatAmount),
          VAT_AMOUNT: money(dataToPrint.vatAmount),
          THUE_LABEL: thueLabel, // <--- BIẾN MỚI
          
          TONGTIEN: money(dataToPrint.totalAmount),
          TONG_TIEN: money(dataToPrint.totalAmount),
          TONGTIEN_TEXT: money(dataToPrint.totalAmount),
          
          BANG_CHU: moneyText,
          TONGTIEN_CHU: moneyText,
          SO_TIEN_BANG_CHU: moneyText
      };

      const blob = await generateDocxBlobAsync(templateKey, printData);
      setIsProcessing(false);
      if (blob) { setPreviewBlob(blob); setPreviewFileName(`${typeName.replace(/\s/g, '_')}_${dataToPrint.code}`); setIsPreviewOpen(true); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in-up overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-purple-50/50 shrink-0 z-10 relative">
        <div><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FileSignature className="text-purple-600" /> Quản Lý Hợp Đồng</h2></div>
        
        <div className="flex gap-2">
            <div className="flex bg-white p-1 rounded-lg border border-gray-200">
                <button onClick={() => { setViewMode('create'); setEditingContract(undefined); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'create' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><PlusCircle size={16} /> Tiếp nhận mới</button>
                <button onClick={() => { setViewMode('list'); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><LayoutList size={16} /> Danh sách hợp đồng</button>
            </div>
            
            <button onClick={() => setIsPriceConfigOpen(true)} className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm" title="Cấu hình Bảng giá Dịch vụ">
                <Settings2 size={20} />
            </button>
            <button onClick={() => setIsTemplateModalOpen(true)} className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors shadow-sm" title="Cấu hình Mẫu in Hợp đồng">
                <Settings size={20} />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {viewMode === 'create' && (
            <ContractForm 
                initialData={editingContract}
                onSave={handleSaveContract}
                onPrint={handlePreviewDocx}
                priceList={priceList}
                wards={wards}
                records={records}
                generateCode={generateContractCode}
            />
        )}

        {viewMode === 'list' && (
            <ContractList 
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPrint={handlePreviewDocx}
            />
        )}
      </div>

      {/* Modals */}
      <PriceConfigModal 
          isOpen={isPriceConfigOpen} 
          onClose={() => setIsPriceConfigOpen(false)} 
          currentPriceList={priceList} 
          onUpdate={loadPrices} 
      />
      <TemplateConfigModal 
          isOpen={isTemplateModalOpen} 
          onClose={() => setIsTemplateModalOpen(false)} 
          type="contract" 
      />
      <DocxPreviewModal 
          isOpen={isPreviewOpen} 
          onClose={() => setIsPreviewOpen(false)} 
          docxBlob={previewBlob} 
          fileName={previewFileName} 
      />
    </div>
  );
};

export default ReceiveContract;
