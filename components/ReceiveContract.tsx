
import React, { useState, useEffect, useMemo } from 'react';
import { RecordFile, Contract, PriceItem, User, SplitItem } from '../types';
import { fetchPriceList, createContractApi, fetchContracts } from '../services/api';
import { Save, FileSignature, Search, Calculator, RotateCcw, Printer, Settings2, Settings, Plus, Trash2, MapPin, Eye, LayoutList, PlusCircle, Loader2, FileCheck } from 'lucide-react';
import PriceConfigModal from './PriceConfigModal';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import TemplateConfigModal from './TemplateConfigModal';
import DocxPreviewModal from './DocxPreviewModal';

interface ReceiveContractProps {
  onSave: (record: RecordFile) => Promise<boolean>; 
  wards: string[];
  currentUser: User;
  records: RecordFile[]; 
}

function _nd(s: string): string {
    return String(s || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();
}

// --- HÀM ĐỌC SỐ TIỀN BẰNG CHỮ (VIETNAMESE) ---
const docSo3ChuSo = (baso: number): string => {
    const docSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    let tram = Math.floor(baso / 100);
    let chuc = Math.floor((baso % 100) / 10);
    let donvi = baso % 10;
    let ketQua = "";

    if (tram === 0 && chuc === 0 && donvi === 0) return "";

    if (tram !== 0) {
        ketQua += docSo[tram] + " trăm ";
        if ((chuc === 0) && (donvi !== 0)) ketQua += "linh ";
    }

    if ((chuc !== 0) && (chuc !== 1)) {
        ketQua += docSo[chuc] + " mươi";
        if ((chuc === 0) && (donvi !== 0)) ketQua = ketQua + " linh ";
    }

    if (chuc === 1) ketQua += "mười";

    switch (donvi) {
        case 1:
            if ((chuc !== 0) && (chuc !== 1)) ketQua += " mốt";
            else ketQua += " một";
            break;
        case 5:
            if (chuc === 0) ketQua += " năm";
            else ketQua += " lăm";
            break;
        default:
            if (donvi !== 0) ketQua += " " + docSo[donvi];
            break;
    }
    return ketQua;
}

const docTienBangChu = (soTien: number): string => {
    if (soTien === 0) return "Không đồng";
    const tien = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
    let lan = 0;
    let i = 0;
    let so = soTien;
    let ketQua = "";
    let viTri: number[] = [];

    if (so < 0) return "Số tiền âm";

    while (so > 0) {
        viTri[lan] = so % 1000;
        so = Math.floor(so / 1000);
        lan++;
    }

    for (i = lan - 1; i >= 0; i--) {
        let tmp = docSo3ChuSo(viTri[i]);
        if (tmp !== "") {
            ketQua += tmp;
            ketQua += " " + tien[i] + " ";
        }
    }

    ketQua = ketQua.replace(/\s+/g, ' ').trim();
    ketQua = ketQua.charAt(0).toUpperCase() + ketQua.slice(1);
    return ketQua + " đồng";
}
// ---------------------------------------------

const ReceiveContract: React.FC<ReceiveContractProps> = ({ wards, currentUser, records }) => {
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // State xử lý in
  const [searchCode, setSearchCode] = useState('');
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [isPriceConfigOpen, setIsPriceConfigOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');

  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  
  const [contractsList, setContractsList] = useState<Contract[]>([]);
  const [searchTermList, setSearchTermList] = useState('');

  const [activeTab, setActiveTab] = useState<'dd' | 'tt' | 'cm'>('dd');

  const [tachThuaItems, setTachThuaItems] = useState<SplitItem[]>([]);

  const [formData, setFormData] = useState<Partial<Contract>>({
    code: '',
    customerName: '',
    phoneNumber: '',
    address: '',
    ward: '',
    landPlot: '',
    mapSheet: '',
    area: 0,
    contractType: 'Đo đạc', 
    serviceType: '', 
    areaType: '', 
    plotCount: 1, 
    markerCount: 1, 
    quantity: 1, 
    unitPrice: 0,
    vatRate: 8,
    vatAmount: 0,
    totalAmount: 0,
    deposit: 0,
    content: '',
    createdDate: new Date().toISOString().split('T')[0],
    status: 'PENDING'
  });

  useEffect(() => {
    generateContractCode();
    loadPrices();
    loadContractsList();
  }, []);

  const loadContractsList = async () => {
      const data = await fetchContracts();
      setContractsList(data);
  };

  useEffect(() => {
      const typeMap: Record<string, 'Đo đạc' | 'Tách thửa' | 'Cắm mốc'> = {
          'dd': 'Đo đạc',
          'tt': 'Tách thửa',
          'cm': 'Cắm mốc'
      };
      setFormData(prev => ({ ...prev, contractType: typeMap[activeTab] }));
      
      if (activeTab === 'tt' && tachThuaItems.length === 0) {
          addTachThuaItem();
      }
  }, [activeTab]);

  const loadPrices = async () => {
      const prices = await fetchPriceList();
      setPriceList(prices);
  };

  useEffect(() => {
      calculateAutoPrice();
  }, [
      formData.area, formData.quantity, formData.serviceType, formData.ward, formData.areaType,
      formData.plotCount, formData.markerCount, tachThuaItems, activeTab
  ]);

  const calculateAutoPrice = () => {
      let currentAreaType = formData.areaType;
      if (!currentAreaType && formData.ward) {
          const wardName = (formData.ward || '').toLowerCase();
          if (wardName.includes('phường') || wardName.includes('tt.') || wardName.includes('thị trấn')) {
              currentAreaType = 'Đất đô thị';
          } else {
              currentAreaType = 'Đất nông thôn';
          }
      }

      if (activeTab === 'tt') {
          let totalBase = 0;
          tachThuaItems.forEach(item => {
              const matchedRow = priceList.find(row => 
                  _nd(row.serviceName) === _nd(item.serviceName) &&
                  (!row.areaType || _nd(row.areaType) === _nd(currentAreaType || ''))
              );
              if (matchedRow) {
                  totalBase += (matchedRow.price * item.quantity);
              }
          });
          
          const vatRate = 8; 
          const vatAmount = Math.round(totalBase * (vatRate / 100));
          const total = totalBase + vatAmount;

          setFormData(prev => ({
              ...prev,
              unitPrice: 0, 
              vatRate: vatRate,
              vatAmount: vatAmount,
              totalAmount: total,
              areaType: currentAreaType 
          }));
          return;
      }

      if (!formData.serviceType) return;

      const matchedPriceItem = priceList.find(item => {
          const matchName = item.serviceName === formData.serviceType;
          const matchAreaType = !item.areaType || !currentAreaType || _nd(item.areaType) === _nd(currentAreaType);
          
          let matchRange = true;
          if (activeTab === 'dd') {
              const area = formData.area || 0;
              matchRange = area >= item.minArea && area < item.maxArea;
          }
          return matchName && matchAreaType && matchRange;
      });

      if (matchedPriceItem) {
          const qty = activeTab === 'cm' ? (formData.markerCount || 1) : (formData.plotCount || 1);
          const price = matchedPriceItem.price;
          const vatRate = matchedPriceItem.vatRate;
          
          const baseAmount = price * qty;
          let vatAmount = 0;
          if (matchedPriceItem.vatIsPercent) {
              vatAmount = Math.round(baseAmount * (vatRate / 100));
          } else {
              vatAmount = vatRate * qty; 
          }
          
          const total = baseAmount + vatAmount;

          setFormData(prev => ({
              ...prev,
              unitPrice: price,
              vatRate: vatRate,
              vatAmount: vatAmount,
              totalAmount: total,
              areaType: currentAreaType 
          }));
      }
  };

  const generateContractCode = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    setFormData(prev => ({ ...prev, code: `HĐ-${year}-${randomNum}` }));
  };

  const handleSearchRecord = () => {
      const found = records.find(r => r.code.toLowerCase() === searchCode.toLowerCase());
      if (found) {
          setFormData(prev => ({
              ...prev,
              code: found.code, 
              customerName: found.customerName,
              phoneNumber: found.phoneNumber,
              ward: found.ward,
              address: found.address || '',
              landPlot: found.landPlot,
              mapSheet: found.mapSheet,
              area: found.area || 0,
          }));
          alert(`Đã tải thông tin từ hồ sơ: ${found.code}`);
      } else {
          alert('Không tìm thấy mã hồ sơ này.');
      }
  };

  const handleChange = (field: keyof Contract, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTachThuaItem = () => {
      setTachThuaItems(prev => [...prev, { serviceName: '', quantity: 1, price: 0 }]);
  };
  const removeTachThuaItem = (idx: number) => {
      setTachThuaItems(prev => prev.filter((_, i) => i !== idx));
  };
  const updateTachThuaItem = (idx: number, field: keyof SplitItem, val: any) => {
      setTachThuaItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.code || !formData.customerName) {
          alert("Vui lòng nhập đầy đủ thông tin.");
          return;
      }
      
      setLoading(true);
      const newContract: Contract = {
          ...formData,
          id: Math.random().toString(36).substr(2, 9),
          splitItems: activeTab === 'tt' ? tachThuaItems : [], 
          serviceType: activeTab === 'tt' ? 'Đo đạc tách thửa' : formData.serviceType
      } as Contract;

      const success = await createContractApi(newContract);
      setLoading(false);
      
      if (success) {
          alert('Lưu hợp đồng thành công!');
          loadContractsList(); 
      } else {
          alert('Lỗi khi lưu hợp đồng.');
      }
  };

  const handlePreviewDocx = async (contractData: Partial<Contract> | undefined, printType: 'contract' | 'liquidation') => {
      const dataToPrint = contractData || formData;

      if (!dataToPrint.customerName) {
          alert("Vui lòng nhập Tên khách hàng để in.");
          return;
      }

      // XÁC ĐỊNH TEMPLATE KEY
      let templateKey = '';
      let typeName = '';
      const isCamMoc = dataToPrint.contractType === 'Cắm mốc';

      if (printType === 'liquidation') {
          // --- LOGIC MỚI: Tách thanh lý Đo đạc và thanh lý Cắm mốc ---
          if (isCamMoc) {
              templateKey = STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_CAMMOC;
              typeName = "Thanh lý Hợp đồng Cắm mốc";
          } else {
              templateKey = STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_DODAC;
              typeName = "Thanh lý Hợp đồng Đo đạc";
          }
      } else {
          // Logic In Hợp đồng (giữ nguyên)
          templateKey = isCamMoc ? STORAGE_KEYS.CONTRACT_TEMPLATE_CAMMOC : STORAGE_KEYS.CONTRACT_TEMPLATE_DODAC;
          typeName = isCamMoc ? "Hợp đồng Cắm mốc" : "Hợp đồng Đo đạc";
      }

      if (!hasTemplate(templateKey)) {
        if(confirm(`Bạn chưa tải lên mẫu "${typeName}" (.docx) hoặc chưa cấu hình Link Google Docs. Bạn có muốn cấu hình ngay không?`)) {
            setIsTemplateModalOpen(true);
        }
        return;
      }

      setIsProcessing(true); // Bắt đầu loading

      const cDate = dataToPrint.createdDate ? new Date(dataToPrint.createdDate) : new Date();
      const day = cDate.getDate().toString().padStart(2, '0');
      const month = (cDate.getMonth() + 1).toString().padStart(2, '0');
      const year = cDate.getFullYear();
      
      const moneyText = docTienBangChu(dataToPrint.totalAmount || 0);

      const val = (v: any) => (v === undefined || v === null) ? "" : String(v);
      const money = (v: any) => (v === undefined || v === null) ? "0" : Number(v).toLocaleString('vi-VN');

      // --- LOGIC TỰ ĐỘNG XÁC ĐỊNH NGƯỜI KÝ & ĐƠN VỊ HÀNH CHÍNH ---
      const rawWard = val(dataToPrint.ward);
      const normWard = _nd(rawWard);
      let signerName = '';
      let signerPosition = '';
      
      // LOGIC MỚI: Phân biệt Xã / Phường
      let unitPrefix = 'Xã/Phường'; // Mặc định
      if (normWard.includes('nha bich')) {
          unitPrefix = 'Xã';
      } else if (normWard.includes('minh hung') || normWard.includes('chon thanh') || normWard.includes('hung long') || normWard.includes('thanh tam')) {
          unitPrefix = 'Phường';
      }

      // Logic người ký
      if (normWard.includes('nha bich')) {
          signerName = 'Lương Ngọc Dinh';
          signerPosition = 'GIÁM ĐỐC';
      } else if (normWard.includes('chon thanh')) {
          signerName = 'Phạm Văn Nam';
          signerPosition = 'PHÓ GIÁM ĐỐC';
      } else if (normWard.includes('minh hung')) {
          signerName = 'Trịnh Quang Hưng';
          signerPosition = 'PHÓ GIÁM ĐỐC';
      }

      // Logic Địa chỉ đất chi tiết: {{DIACHIDAT}}
      // Format: [Số nhà/Đường/Ấp], [Xã/Phường] [Tên Xã]
      const detailAddress = val(dataToPrint.address);
      const fullLandAddress = detailAddress 
          ? `${detailAddress}, ${unitPrefix} ${rawWard}`
          : `${unitPrefix} ${rawWard}`;

      // Tính thành tiền (Trước thuế)
      const qty = dataToPrint.contractType === 'Cắm mốc' ? (dataToPrint.markerCount || 0) : (dataToPrint.plotCount || 0);
      const preTaxAmount = (dataToPrint.unitPrice || 0) * qty;

      const printData = {
          // --- MAPPING CHUẨN THEO YÊU CẦU ---
          NGUOI_KY: signerName.toUpperCase(),
          CHUCVU_KY: signerPosition,
          TEN: val(dataToPrint.customerName).toUpperCase(),
          DIACHI: val(dataToPrint.address || dataToPrint.ward), // Địa chỉ khách hàng (thường trú)
          SDT: val(dataToPrint.phoneNumber),
          THUA: val(dataToPrint.landPlot),
          TO: val(dataToPrint.mapSheet),
          DT: val(dataToPrint.area),
          
          // CẬP NHẬT MỚI:
          DIACHIDAT: fullLandAddress, // Địa chỉ đất chi tiết (Kèm Xã/Phường)
          XA_PHUONG: unitPrefix,      // Biến mới: "Xã" hoặc "Phường"
          TEN_XA: rawWard,            // Tên xã/phường gốc
          
          LOAIHS: val(dataToPrint.contractType),
          LOAIDV: val(dataToPrint.serviceType || dataToPrint.contractType),
          KHUVUC: val(dataToPrint.areaType),
          GHICHU: val(dataToPrint.content),
          
          NGAYNHAN: cDate.toLocaleDateString('vi-VN'),
          NGAYTRA: "", 
          HOMNAY_NGAY: day,
          HOMNAY_THANG: month,
          HOMNAY_NAM: year,
          
          SOLUONG: qty,
          DONGIA_TEXT: money(dataToPrint.unitPrice),
          THANHTIEN_TEXT: money(preTaxAmount), 
          
          THUE_LABEL: val(dataToPrint.vatRate),
          THUE_TEXT: money(dataToPrint.vatAmount),
          
          TONGTIEN_TEXT: money(dataToPrint.totalAmount),
          TONGTIEN_CHU: moneyText,
          
          SOTHUA_SOMOC_LABEL: dataToPrint.contractType === 'Cắm mốc' ? 'Số mốc' : 'Số thửa',
          SOTHUA_SOMOC_VALUE: val(qty),
          MA_HS: val(dataToPrint.code),

          // --- CÁC BIẾN CŨ ---
          SO_HD: val(dataToPrint.code),
          KHACH_HANG: val(dataToPrint.customerName).toUpperCase(),
          NGUOI_LAP: val(currentUser.name),
          XA: val(dataToPrint.ward),
          TINH: "Bình Phước",
          HUYEN: "thị xã Chơn Thành"
      };

      // Dùng hàm Async mới để hỗ trợ tải từ URL
      const blob = await generateDocxBlobAsync(templateKey, printData);
      
      setIsProcessing(false); // Kết thúc loading

      if (blob) {
          setPreviewBlob(blob);
          setPreviewFileName(`${typeName.replace(/\s/g, '_')}_${dataToPrint.code}`);
          setIsPreviewOpen(true);
      }
  };

  const availableServices = useMemo(() => {
      const allNames = Array.from(new Set(priceList.map(p => p.serviceName)));
      if (activeTab === 'tt') return allNames.filter(n => _nd(n).includes('tach thua'));
      if (activeTab === 'cm') return allNames.filter(n => _nd(n).includes('cam moc'));
      return allNames.filter(n => !_nd(n).includes('tach thua') && !_nd(n).includes('cam moc'));
  }, [priceList, activeTab]);

  const filteredContracts = useMemo(() => {
      if (!searchTermList) return contractsList;
      const lower = searchTermList.toLowerCase();
      return contractsList.filter(c => 
          (c.code || '').toLowerCase().includes(lower) || 
          (c.customerName || '').toLowerCase().includes(lower) ||
          (c.ward || '').toLowerCase().includes(lower)
      );
  }, [contractsList, searchTermList]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in-up overflow-hidden">
      {/* HEADER */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-purple-50/50 shrink-0 z-10 relative">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSignature className="text-purple-600" />
            Quản Lý Hợp Đồng
          </h2>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200">
            <button onClick={() => setViewMode('create')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'create' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                <PlusCircle size={16} /> Tiếp nhận mới
            </button>
            <button onClick={() => { setViewMode('list'); loadContractsList(); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                <LayoutList size={16} /> Danh sách hợp đồng
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 min-h-0">
        {viewMode === 'create' ? (
            <form onSubmit={handleSubmit} className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-12 flex justify-end gap-2 mb-2">
                    <button type="button" onClick={() => setIsTemplateModalOpen(true)} className="text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm hover:bg-gray-50 flex items-center gap-1">
                        <Settings size={14} /> Cấu hình Mẫu
                    </button>
                    <button type="button" onClick={() => setIsPriceConfigOpen(true)} className="text-sm text-gray-700 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm hover:bg-gray-50 flex items-center gap-1">
                        <Settings2 size={14} /> Bảng Giá
                    </button>
                    
                    {/* NÚT IN HỢP ĐỒNG */}
                    <button 
                        type="button" 
                        onClick={() => handlePreviewDocx(undefined, 'contract')} 
                        disabled={isProcessing}
                        className="text-sm text-purple-700 bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-200 flex items-center gap-1 font-bold disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} 
                        {isProcessing ? 'Đang tạo...' : 'In Hợp Đồng'}
                    </button>

                    {/* NÚT IN THANH LÝ (MỚI) */}
                    <button 
                        type="button" 
                        onClick={() => handlePreviewDocx(undefined, 'liquidation')} 
                        disabled={isProcessing}
                        className="text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-lg border border-green-200 shadow-sm hover:bg-green-200 flex items-center gap-1 font-bold disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />} 
                        {isProcessing ? 'Đang tạo...' : 'In Thanh Lý'}
                    </button>
                    
                    <button type="button" onClick={generateContractCode} className="text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm hover:shadow-md flex items-center gap-1">
                        <RotateCcw size={14} /> Mã Mới
                    </button>
                </div>

                {/* --- Phần Form Nhập liệu (Giữ nguyên) --- */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 border-b pb-2 flex items-center gap-2">
                            <Search size={16} /> Tải từ Hồ Sơ
                        </h3>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                placeholder="Nhập mã hồ sơ..." 
                                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-purple-500"
                                value={searchCode}
                                onChange={(e) => setSearchCode(e.target.value)}
                            />
                            <button type="button" onClick={handleSearchRecord} className="bg-purple-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-purple-700">Tải</button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Khách hàng</label>
                                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50" value={formData.customerName} onChange={e => handleChange('customerName', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Xã phường</label>
                                <input list="wards-list-contract" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50" value={formData.ward} onChange={e => handleChange('ward', e.target.value)} />
                                <datalist id="wards-list-contract"> {wards.map(w => <option key={w} value={w} />)} </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Địa chỉ đất</label>
                                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50" value={formData.address} onChange={e => handleChange('address', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Tờ bản đồ</label>
                                    <input className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-center" value={formData.mapSheet} onChange={e => handleChange('mapSheet', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Thửa đất</label>
                                    <input className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-center" value={formData.landPlot} onChange={e => handleChange('landPlot', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Diện tích (m2)</label>
                                <input type="number" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white font-bold text-blue-600" value={formData.area} onChange={e => handleChange('area', parseFloat(e.target.value))} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="flex border-b border-gray-200 bg-gray-50">
                            {['dd', 'tt', 'cm'].map(t => (
                                <button key={t} type="button" onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === t ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                                    {t === 'dd' ? '🧰 Đo đạc' : t === 'tt' ? '🧩 Tách thửa' : '📍 Cắm mốc'}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã Hợp Đồng</label>
                                    <input type="text" readOnly className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 font-mono font-bold text-gray-600" value={formData.code} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày lập</label>
                                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none" value={formData.createdDate} onChange={e => handleChange('createdDate', e.target.value)} />
                                </div>
                            </div>

                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-3"><Calculator size={16} /> Tính chi phí dịch vụ</h4>
                                
                                {(activeTab === 'dd' || activeTab === 'cm') && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Khu vực</label>
                                            <select className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm bg-white" value={formData.areaType} onChange={(e) => handleChange('areaType', e.target.value)}>
                                                <option value="">-- Tự động theo xã --</option>
                                                <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                                <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Loại dịch vụ</label>
                                            <select className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm bg-white" value={formData.serviceType} onChange={(e) => handleChange('serviceType', e.target.value)}>
                                                <option value="">-- Chọn dịch vụ --</option>
                                                {availableServices.map(name => <option key={name} value={name}>{name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">{activeTab === 'dd' ? 'Số thửa' : 'Số mốc'}</label>
                                            <input type="number" className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm" value={activeTab === 'dd' ? formData.plotCount : formData.markerCount} onChange={e => handleChange(activeTab === 'dd' ? 'plotCount' : 'markerCount', parseInt(e.target.value))} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Đơn giá (VNĐ)</label>
                                            <input type="number" readOnly className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm bg-gray-100 text-right font-mono" value={formData.unitPrice} />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'tt' && (
                                    <div className="space-y-3 mb-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">Khu vực</label>
                                                <select className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm bg-white" value={formData.areaType} onChange={(e) => handleChange('areaType', e.target.value)}>
                                                    <option value="">-- Tự động theo xã --</option>
                                                    <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                                    <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <label className="block text-xs font-bold text-gray-600">Danh sách sản phẩm tách thửa</label>
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="p-2 text-left">Loại sản phẩm</th>
                                                        <th className="p-2 w-20 text-center">SL</th>
                                                        <th className="p-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tachThuaItems.map((item, idx) => (
                                                        <tr key={idx} className="border-t border-gray-100">
                                                            <td className="p-2">
                                                                <select className="w-full border border-gray-300 rounded px-2 py-1 outline-none text-xs" value={item.serviceName} onChange={(e) => updateTachThuaItem(idx, 'serviceName', e.target.value)}>
                                                                    <option value="">-- Chọn mức diện tích --</option>
                                                                    {availableServices.map(name => <option key={name} value={name}>{name}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="p-2">
                                                                <input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-center outline-none text-xs" value={item.quantity} min={1} onChange={(e) => updateTachThuaItem(idx, 'quantity', parseInt(e.target.value))} />
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <button type="button" onClick={() => removeTachThuaItem(idx)} className="text-red-500 hover:text-red-700"> <Trash2 size={14} /> </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <button type="button" onClick={addTachThuaItem} className="w-full py-2 bg-gray-50 text-blue-600 text-xs font-bold hover:bg-gray-100 flex items-center justify-center gap-1 border-t border-gray-200"> <Plus size={12} /> Thêm dòng </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-6 pt-3 border-t border-purple-200">
                                    <div className="text-right">
                                        <span className="text-xs text-gray-500 block">Thuế VAT ({formData.vatRate}%)</span>
                                        <span className="font-medium">{formData.vatAmount?.toLocaleString('vi-VN')}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-gray-500 block">TỔNG TIỀN</span>
                                        <span className="text-xl font-bold text-purple-700">{formData.totalAmount?.toLocaleString('vi-VN')} VNĐ</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú hợp đồng</label>
                                <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none resize-none" value={formData.content} onChange={e => handleChange('content', e.target.value)} placeholder="Nội dung chi tiết..." />
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-purple-700 shadow-lg transition-all active:scale-95 disabled:opacity-70">
                                {loading ? 'Đang lưu...' : 'Lưu Hợp Đồng'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        ) : (
            // LIST VIEW
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center gap-3 shrink-0">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input type="text" placeholder="Tìm kiếm hợp đồng..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500" value={searchTermList} onChange={(e) => setSearchTermList(e.target.value)} />
                    </div>
                    <button onClick={loadContractsList} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full" title="Tải lại danh sách"> <RotateCcw size={18} /> </button>
                </div>
                <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-left table-fixed min-w-[1000px]">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold sticky top-0 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 text-center">STT</th>
                                <th className="p-4 w-[120px]">Mã HĐ</th>
                                <th className="p-4 w-[200px]">Khách hàng</th>
                                <th className="p-4 w-[150px]">Loại HĐ</th>
                                <th className="p-4 w-[120px]">Ngày lập</th>
                                <th className="p-4 text-right w-[150px]">Tổng tiền</th>
                                <th className="p-4 text-center w-[120px]">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                            {filteredContracts.length > 0 ? (
                                filteredContracts.map((c, index) => (
                                    <tr key={c.id} className="hover:bg-purple-50/50 transition-colors">
                                        <td className="p-4 text-center text-gray-400 align-middle">{index + 1}</td>
                                        <td className="p-4 font-medium text-purple-700 truncate align-middle" title={c.code}>{c.code}</td>
                                        <td className="p-4 font-medium truncate align-middle" title={c.customerName}>{c.customerName}</td>
                                        <td className="p-4 align-middle"> <span className="px-2 py-1 bg-gray-100 rounded text-xs border border-gray-200">{c.contractType || 'Khác'}</span> </td>
                                        <td className="p-4 text-gray-500 align-middle">{c.createdDate ? new Date(c.createdDate).toLocaleDateString('vi-VN') : '-'}</td>
                                        <td className="p-4 text-right font-mono font-bold text-gray-800 align-middle">{c.totalAmount?.toLocaleString('vi-VN')}</td>
                                        <td className="p-4 text-center align-middle">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => handlePreviewDocx(c, 'contract')} disabled={isProcessing} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors disabled:opacity-50" title="In Hợp đồng">
                                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                                                </button>
                                                <button onClick={() => handlePreviewDocx(c, 'liquidation')} disabled={isProcessing} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors disabled:opacity-50" title="In Thanh lý">
                                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : ( <tr><td colSpan={7} className="p-8 text-center text-gray-400">Không tìm thấy hợp đồng nào.</td></tr> )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      <PriceConfigModal isOpen={isPriceConfigOpen} onClose={() => setIsPriceConfigOpen(false)} currentPriceList={priceList} onUpdate={loadPrices} />
      <TemplateConfigModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} type="contract" />
      <DocxPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} docxBlob={previewBlob} fileName={previewFileName} />
    </div>
  );
};

export default ReceiveContract;
