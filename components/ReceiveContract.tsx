
import React, { useState, useEffect } from 'react';
import { RecordFile, Contract, PriceItem, SplitItem, User } from '../types';
import { fetchPriceList, deleteContractApi, updateContractApi, createContractApi, fetchContracts } from '../services/api';
import { FileSignature, LayoutList, Settings, Settings2, FileCheck, FileText } from 'lucide-react';
import PriceConfigModal from './PriceConfigModal';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import TemplateConfigModal from './TemplateConfigModal';
import DocxPreviewModal from './DocxPreviewModal';
import { confirmAction, removeVietnameseTones } from '../utils/appHelpers';

// Child Components
import ContractForm from './receive-contract/ContractForm';
import ContractList from './receive-contract/ContractList';

interface ReceiveContractProps {
  onSave: (record: RecordFile) => Promise<boolean>; 
  wards: string[];
  currentUser: User;
  records: RecordFile[]; 
  // New props for handling external liquidation request
  recordToLiquidate: RecordFile | null;
  onClearRecordToLiquidate: () => void;
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

const ReceiveContract: React.FC<ReceiveContractProps> = ({ wards, currentUser, records, recordToLiquidate, onClearRecordToLiquidate }) => {
  // Thay đổi: activeModule giờ bao gồm cả 'list'
  const [activeModule, setActiveModule] = useState<'contract' | 'liquidation' | 'list'>('list'); 
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]); // Move contracts state up to handle logic
  
  // Modal States
  const [isPriceConfigOpen, setIsPriceConfigOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);

  useEffect(() => { 
      loadPrices(); 
      loadContracts();
  }, []);

  const loadPrices = async () => { const prices = await fetchPriceList(); setPriceList(prices); };
  const loadContracts = async () => { const data = await fetchContracts(); setContracts(data); };

  // --- LOGIC XỬ LÝ KHI CÓ YÊU CẦU THANH LÝ TỪ BÊN NGOÀI ---
  useEffect(() => {
      // Quan trọng: Chỉ chạy logic khi recordToLiquidate có giá trị VÀ danh sách contracts ĐÃ ĐƯỢC TẢI
      // Điều này ngăn chặn việc tìm kiếm thất bại khi contracts chưa load xong (mảng rỗng)
      if (recordToLiquidate && contracts.length > 0) {
          
          const normalize = (s: string) => String(s || '').trim().toLowerCase();
          const recCode = normalize(recordToLiquidate.code);
          
          // 1. Tìm xem hồ sơ này đã có hợp đồng chưa
          const existingContract = contracts.find(c => normalize(c.code) === recCode);

          if (existingContract) {
              // NẾU CÓ HỢP ĐỒNG: Load toàn bộ dữ liệu hợp đồng đó (bao gồm splitItems, serviceType...)
              setEditingContract({
                  ...existingContract,
                  // Cập nhật lại diện tích thanh lý mới nhất từ hồ sơ (diện tích thực tế sau khi đo)
                  // Ưu tiên: recordToLiquidate.area > liquidationArea cũ > area hợp đồng
                  liquidationArea: recordToLiquidate.area || existingContract.liquidationArea || existingContract.area,
                  // Đảm bảo trạng thái hiển thị đúng để form hiển thị nút
                  status: 'PENDING'
              });
          } else {
              // NẾU CHƯA CÓ HỢP ĐỒNG: Tạo Contract ảo từ Record (AUTO MAP THÔNG MINH)
              
              // 1. Detect Area Type (Khu vực)
              let areaType = '';
              const w = (recordToLiquidate.ward || '').toLowerCase();
              if (w.includes('phường') || w.includes('tt.') || w.includes('thị trấn') || w.includes('minh hưng') || w.includes('chơn thành')) {
                  areaType = 'Đất đô thị';
              } else {
                  areaType = 'Đất nông thôn';
              }

              // 2. Detect Contract & Service Type (Loại dịch vụ)
              const recType = (recordToLiquidate.recordType || '').toLowerCase();
              let serviceType = '';
              let contractType: 'Đo đạc' | 'Tách thửa' | 'Cắm mốc' | 'Trích lục' = 'Đo đạc';

              if (recType.includes('trích lục')) {
                  contractType = 'Trích lục';
                  // Cố gắng map chính xác tên dịch vụ trong bảng giá
                  const match = priceList.find(p => p.serviceName.toLowerCase().includes('trích lục'));
                  serviceType = match ? match.serviceName : 'Trích lục bản đồ địa chính';
              } else if (recType.includes('cắm mốc')) {
                  contractType = 'Cắm mốc';
                  const match = priceList.find(p => p.serviceName.toLowerCase().includes('cắm mốc'));
                  serviceType = match ? match.serviceName : 'Cắm mốc ranh giới';
              } else if (recType.includes('tách thửa')) {
                  contractType = 'Tách thửa';
                  serviceType = 'Đo đạc tách thửa';
              } else if (recType.includes('đo đạc')) {
                  // Map theo diện tích
                  const area = recordToLiquidate.area || 0;
                  const match = priceList.find(p => 
                      p.serviceName.toLowerCase().includes('đo đạc') && 
                      area >= p.minArea && area < p.maxArea
                  );
                  serviceType = match ? match.serviceName : 'Đo đạc hiện trạng';
              }

              const newContract: Contract = {
                  id: Math.random().toString(36).substr(2, 9),
                  code: recordToLiquidate.code || generateContractCode(),
                  customerName: recordToLiquidate.customerName,
                  phoneNumber: recordToLiquidate.phoneNumber,
                  address: recordToLiquidate.address,
                  ward: recordToLiquidate.ward,
                  landPlot: recordToLiquidate.landPlot,
                  mapSheet: recordToLiquidate.mapSheet,
                  area: recordToLiquidate.area || 0,
                  
                  // Các trường quan trọng cần điền tự động
                  contractType: contractType,
                  serviceType: serviceType, 
                  areaType: areaType,       
                  
                  plotCount: 1,
                  markerCount: 1,
                  quantity: 1, 
                  unitPrice: 0, // Form sẽ tự tính lại dựa trên serviceType
                  vatRate: 8, 
                  vatAmount: 0, 
                  totalAmount: 0, 
                  deposit: 0,
                  createdDate: new Date().toISOString().split('T')[0],
                  status: 'PENDING',
                  liquidationArea: recordToLiquidate.area || 0
              };
              setEditingContract(newContract);
          }
          
          setActiveModule('liquidation');
          onClearRecordToLiquidate(); // Reset flag
      }
  }, [recordToLiquidate, contracts, priceList]);

  const generateContractCode = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `HĐ-${year}-${randomNum}`;
  };

  const handleEdit = (c: Contract) => { 
      setEditingContract(c); 
      setActiveModule('contract'); // Chuyển sang tab Lập HĐ để sửa
  };

  // Logic mới: Tạo thanh lý từ Hợp đồng có sẵn (trong danh sách HĐ)
  const handleCreateLiquidation = (c: Contract) => {
      setEditingContract(c); // Đưa dữ liệu hợp đồng vào form
      setActiveModule('liquidation'); // Chuyển sang tab Thanh lý
  };

  const handleDelete = async (id: string) => { 
      if(await confirmAction("Bạn có chắc chắn muốn xóa hợp đồng này không?")) {
          await deleteContractApi(id);
          loadContracts(); // Reload list
      } 
  }; 

  const handleSaveContract = async (contract: Contract, isUpdate: boolean): Promise<boolean> => {
      let success = false;
      if (isUpdate) {
          success = await updateContractApi(contract);
      } else {
          success = await createContractApi(contract);
      }
      if (success) loadContracts(); // Reload list
      return success;
  };

  // --- LOGIC IN ẤN HỢP ĐỒNG ---
  const handlePreviewDocx = async (dataToPrint: Partial<Contract> | undefined, printType: 'contract' | 'liquidation') => {
      if (!dataToPrint || !dataToPrint.customerName) { alert("Vui lòng nhập Tên khách hàng để in."); return; }
      
      let templateKey = '', typeName = '';
      const isCamMoc = dataToPrint.contractType === 'Cắm mốc';
      const isTrichLuc = dataToPrint.contractType === 'Trích lục';
      
      if (printType === 'liquidation') {
          if (isTrichLuc) {
              templateKey = STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_TRICHLUC;
              typeName = "Thanh lý Hợp đồng Trích lục";
          } else {
              templateKey = isCamMoc ? STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_CAMMOC : STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_DODAC;
              typeName = isCamMoc ? "Thanh lý Hợp đồng Cắm mốc" : "Thanh lý Hợp đồng Đo đạc";
          }
      } else {
          // Hợp đồng
          templateKey = isCamMoc ? STORAGE_KEYS.CONTRACT_TEMPLATE_CAMMOC : STORAGE_KEYS.CONTRACT_TEMPLATE_DODAC;
          typeName = isCamMoc ? "Hợp đồng Cắm mốc" : "Hợp đồng Đo đạc";
          
          // Trích lục thường không có hợp đồng, nhưng nếu cần có thể dùng chung mẫu Đo đạc
          if (isTrichLuc) typeName = "Hợp đồng Trích lục (Dùng mẫu đo đạc)";
      }
      
      if (!hasTemplate(templateKey)) { 
          if(await confirmAction(`Chưa có mẫu "${typeName}". Bạn có muốn cấu hình ngay không?`)) setIsTemplateModalOpen(true); 
          return; 
      }
      
      setIsProcessing(true);
      
      // XỬ LÝ NGÀY THÁNG (Tách biệt ngày Hợp đồng và ngày Thanh lý)
      
      // 1. Ngày hiện tại trên Form (Dùng cho loại văn bản đang in)
      const currentFormDate = dataToPrint.createdDate ? new Date(dataToPrint.createdDate) : new Date();
      
      // 2. Ngày Hợp Đồng Gốc (Cố gắng tìm lại từ Database nếu đang ở chế độ Thanh lý)
      let originalContractDate = currentFormDate; // Mặc định fallback
      
      if (printType === 'liquidation') {
          // Nếu đang in thanh lý, ngày trên form thường là ngày thanh lý.
          // Cần tìm ngày hợp đồng gốc.
          const originalContract = contracts.find(c => c.code === dataToPrint.code);
          if (originalContract && originalContract.createdDate) {
              originalContractDate = new Date(originalContract.createdDate);
          }
      } else {
          // Nếu đang in hợp đồng, ngày trên form chính là ngày hợp đồng
          originalContractDate = currentFormDate;
      }

      // 3. Helper Format Date
      const fmt = (d: Date) => ({
          day: d.getDate().toString().padStart(2, '0'),
          month: (d.getMonth() + 1).toString().padStart(2, '0'),
          year: d.getFullYear(),
          full: d.toLocaleDateString('vi-VN')
      });

      const dateHD = fmt(originalContractDate);
      const dateTL = fmt(currentFormDate); // Ngày trên form lúc này là ngày thanh lý (hoặc ngày in HĐ)

      // --- MAPPING DATA ---
      const moneyText = docTienBangChu(dataToPrint.totalAmount || 0);
      const val = (v: any) => (v === undefined || v === null) ? "" : String(v);
      const money = (v: any) => (v === undefined || v === null) ? "0" : Number(v).toLocaleString('vi-VN');
      
      const rawWard = val(dataToPrint.ward);
      const normWard = _nd(rawWard);
      
      let unitPrefix = 'Xã/Phường';
      if (normWard.includes('nha bich')) unitPrefix = 'Xã';
      else if (normWard.includes('minh hung') || normWard.includes('chon thanh') || normWard.includes('hung long') || normWard.includes('thanh tam')) unitPrefix = 'Phường';

      let signerName = 'PHẠM VĂN NAM'; 
      let signerPosition = 'PHÓ GIÁM ĐỐC';
      
      if (normWard.includes('nha bich')) {
          signerName = 'LƯƠNG NGỌC DINH';
          signerPosition = 'GIÁM ĐỐC';
      } else if (normWard.includes('minh hung')) {
          signerName = 'TRỊNH QUANG HƯNG';
          signerPosition = 'PHÓ GIÁM ĐỐC';
      }

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

      const vatRate = dataToPrint.vatRate || 0;
      const thueLabel = vatRate > 0 ? `Thuế GTGT (${vatRate}%)` : 'Thuế GTGT';

      const dsArray = (dataToPrint.splitItems || []).map((item, index) => ({
          STT: index + 1,
          TEN: item.serviceName,
          SL: item.quantity,
          GIA: money(item.price),
          THANH_TIEN: money(item.price * item.quantity),
          NOI_DUNG: item.serviceName,
          QTY: item.quantity,
          PRICE: money(item.price),
          TOTAL: money(item.price * item.quantity),
          DT_THUA: item.area ? val(item.area) : "",
          AREA: item.area ? val(item.area) : ""
      }));

      const finalDS = dsArray.length > 0 ? dsArray : [{
          STT: 1,
          TEN: val(dataToPrint.serviceType || dataToPrint.contractType),
          SL: qty,
          GIA: money(dataToPrint.unitPrice),
          THANH_TIEN: money(preTaxAmount),
          NOI_DUNG: val(dataToPrint.serviceType || dataToPrint.contractType),
          QTY: qty,
          PRICE: money(dataToPrint.unitPrice),
          TOTAL: money(preTaxAmount),
          DT_THUA: "",
          AREA: ""
      }];

      const printData = {
          code: val(dataToPrint.code),
          customerName: val(dataToPrint.customerName),
          landPlot: val(dataToPrint.landPlot),
          mapSheet: val(dataToPrint.mapSheet),
          address: val(dataToPrint.address),
          DIA_CHI_CHI_TIET: val(dataToPrint.address),
          MA_HS: val(dataToPrint.code),
          SO_HD: val(dataToPrint.code),
          
          // --- NGÀY THÁNG CHUNG (Theo ngày trên form hiện tại) ---
          NGAY: dateTL.day,
          THANG: dateTL.month,
          NAM: dateTL.year,
          NGAY_KY: dateTL.full,

          // --- NGÀY HỢP ĐỒNG (Cố định theo dữ liệu gốc) ---
          NGAY_HD: dateHD.day,
          THANG_HD: dateHD.month,
          NAM_HD: dateHD.year,
          NGAY_KY_HD: dateHD.full,

          // --- NGÀY THANH LÝ (Ngày trên form) ---
          NGAY_TL: dateTL.day,
          THANG_TL: dateTL.month,
          NAM_TL: dateTL.year,
          NGAY_KY_TL: dateTL.full,

          NGUOI_LAP: val(currentUser.name),
          BEN_A: val(dataToPrint.customerName).toUpperCase(),
          TEN: val(dataToPrint.customerName).toUpperCase(),
          KHACH_HANG: val(dataToPrint.customerName).toUpperCase(),
          DIA_CHI_A: val(dataToPrint.address || dataToPrint.ward),
          DIACHI: val(dataToPrint.address || dataToPrint.ward),
          SDT: val(dataToPrint.phoneNumber),
          SDT_A: val(dataToPrint.phoneNumber),
          BEN_B: "CN VPĐKĐĐ THỊ XÃ CHƠN THÀNH",
          DAI_DIEN_B: signerName,
          CHUC_VU_B: signerPosition,
          NGUOI_KY: signerName,
          CHUCVU_KY: signerPosition,
          SDTLH: sdtLienHe, 
          THUA: val(dataToPrint.landPlot),
          SO_THUA: val(dataToPrint.landPlot),
          TO: val(dataToPrint.mapSheet),
          SO_TO: val(dataToPrint.mapSheet),
          DT: val(dataToPrint.area),
          DIEN_TICH: val(dataToPrint.area),
          DIEN_TICH_TL: val(dataToPrint.liquidationArea || dataToPrint.area),
          DT_TL: val(dataToPrint.liquidationArea || dataToPrint.area),
          DIACHIDAT: fullLandAddress,
          DIA_CHI_THUA_DAT: fullLandAddress,
          XA_PHUONG: unitPrefix,
          TEN_XA: rawWard,
          XA: rawWard,
          KHUVUC: val(dataToPrint.areaType),
          TINH: "Bình Phước",
          HUYEN: "thị xã Chơn Thành",
          LOAIHS: val(dataToPrint.contractType),
          LOAIDV: val(dataToPrint.serviceType || dataToPrint.contractType),
          NOI_DUNG_CV: val(dataToPrint.serviceType || dataToPrint.contractType),
          GHICHU: val(dataToPrint.content),
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
          THUE_LABEL: thueLabel,
          TONGTIEN: money(dataToPrint.totalAmount),
          TONG_TIEN: money(dataToPrint.totalAmount),
          TONGTIEN_TEXT: money(dataToPrint.totalAmount),
          BANG_CHU: moneyText,
          TONGTIEN_CHU: moneyText,
          SO_TIEN_BANG_CHU: moneyText,
          DS: finalDS,
          SPLIT_ITEMS: finalDS
      };

      const blob = await generateDocxBlobAsync(templateKey, printData);
      setIsProcessing(false);
      if (blob) { setPreviewBlob(blob); setPreviewFileName(`${typeName.replace(/\s/g, '_')}_${dataToPrint.code}`); setIsPreviewOpen(true); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in-up overflow-hidden">
      
      {/* HEADER WITH TABS */}
      <div className="p-0 border-b border-gray-100 flex flex-col bg-purple-50/50 shrink-0 z-10 relative">
        <div className="flex justify-between items-center p-4">
            <div><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FileSignature className="text-purple-600" /> Quản Lý Hợp Đồng</h2></div>
            
            <div className="flex gap-2">
                <button onClick={() => setIsPriceConfigOpen(true)} className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm" title="Cấu hình Bảng giá Dịch vụ">
                    <Settings2 size={20} />
                </button>
                <button onClick={() => setIsTemplateModalOpen(true)} className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors shadow-sm" title="Cấu hình Mẫu in Hợp đồng">
                    <Settings size={20} />
                </button>
            </div>
        </div>

        {/* MAIN TABS */}
        <div className="flex px-4 gap-2">
            <button 
                onClick={() => { setActiveModule('contract'); setEditingContract(undefined); }}
                className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-all border-t border-l border-r ${activeModule === 'contract' ? 'bg-white text-purple-700 border-gray-200 relative top-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
            >
                <FileText size={16} className="inline mr-2" /> Lập Hợp Đồng
            </button>
            <button 
                onClick={() => { setActiveModule('liquidation'); setEditingContract(undefined); }}
                className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-all border-t border-l border-r ${activeModule === 'liquidation' ? 'bg-white text-green-700 border-gray-200 relative top-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
            >
                <FileCheck size={16} className="inline mr-2" /> Thanh Lý Hợp Đồng
            </button>
            {/* Tab Danh sách riêng biệt */}
            <button 
                onClick={() => { setActiveModule('list'); }}
                className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-all border-t border-l border-r ${activeModule === 'list' ? 'bg-white text-blue-700 border-gray-200 relative top-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
            >
                <LayoutList size={16} className="inline mr-2" /> Danh sách Hợp đồng
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {activeModule === 'contract' && (
                <ContractForm 
                    initialData={editingContract}
                    onSave={handleSaveContract}
                    onPrint={handlePreviewDocx}
                    priceList={priceList}
                    wards={wards}
                    records={records}
                    generateCode={generateContractCode}
                    mode='contract'
                />
            )}

            {activeModule === 'liquidation' && (
                <ContractForm 
                    initialData={editingContract}
                    onSave={handleSaveContract}
                    onPrint={handlePreviewDocx}
                    priceList={priceList}
                    wards={wards}
                    records={records}
                    generateCode={generateContractCode}
                    mode='liquidation'
                />
            )}

            {activeModule === 'list' && (
                <ContractList 
                    onEdit={handleEdit} // Chỉnh sửa hợp đồng
                    onDelete={handleDelete}
                    onPrint={handlePreviewDocx} 
                    onCreateLiquidation={handleCreateLiquidation} // Nút tạo thanh lý từ danh sách
                />
            )}
        </div>
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
