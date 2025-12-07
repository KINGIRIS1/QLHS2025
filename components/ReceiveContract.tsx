
import React, { useState, useEffect, useMemo } from 'react';
import { RecordFile, Contract, PriceItem, User, SplitItem } from '../types';
import { fetchPriceList, createContractApi, fetchContracts } from '../services/api';
import { Save, FileSignature, Search, Calculator, RotateCcw, Printer, Settings2, Settings, Plus, Trash2, MapPin, Eye, LayoutList, PlusCircle } from 'lucide-react';
import PriceConfigModal from './PriceConfigModal';
import { generateDocxBlob, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import TemplateConfigModal from './TemplateConfigModal';
import DocxPreviewModal from './DocxPreviewModal';

interface ReceiveContractProps {
  onSave: (record: RecordFile) => Promise<boolean>; 
  wards: string[];
  currentUser: User;
  records: RecordFile[]; 
}

// Hàm chuẩn hóa chuỗi (bỏ dấu, lowercase)
function _nd(s: string): string {
    return String(s || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();
}

const ReceiveContract: React.FC<ReceiveContractProps> = ({ wards, currentUser, records }) => {
  const [loading, setLoading] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [isPriceConfigOpen, setIsPriceConfigOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  // Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');

  // Main View State: 'create' | 'list'
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  
  // Contracts List State
  const [contractsList, setContractsList] = useState<Contract[]>([]);
  const [searchTermList, setSearchTermList] = useState('');

  // Form Tab State (Inside Create Mode)
  const [activeTab, setActiveTab] = useState<'dd' | 'tt' | 'cm'>('dd');

  // Specific States
  const [tachThuaItems, setTachThuaItems] = useState<SplitItem[]>([]);

  // Form Data
  const [formData, setFormData] = useState<Partial<Contract>>({
    code: '',
    customerName: '',
    phoneNumber: '',
    address: '',
    ward: '',
    landPlot: '',
    mapSheet: '',
    area: 0,
    contractType: 'Đo đạc', // Default
    serviceType: '', // Tên dịch vụ
    areaType: '', // Khu vực
    plotCount: 1, // Số thửa
    markerCount: 1, // Số mốc
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

  // Load contracts for list view
  const loadContractsList = async () => {
      const data = await fetchContracts();
      setContractsList(data);
  };

  // Update Contract Type when Tab Changes
  useEffect(() => {
      const typeMap: Record<string, 'Đo đạc' | 'Tách thửa' | 'Cắm mốc'> = {
          'dd': 'Đo đạc',
          'tt': 'Tách thửa',
          'cm': 'Cắm mốc'
      };
      setFormData(prev => ({ ...prev, contractType: typeMap[activeTab] }));
      
      // Reset some fields
      if (activeTab === 'tt' && tachThuaItems.length === 0) {
          addTachThuaItem();
      }
  }, [activeTab]);

  const loadPrices = async () => {
      const prices = await fetchPriceList();
      setPriceList(prices);
  };

  // Logic tính giá tự động
  useEffect(() => {
      calculateAutoPrice();
  }, [
      formData.area, formData.quantity, formData.serviceType, formData.ward, formData.areaType,
      formData.plotCount, formData.markerCount, tachThuaItems, activeTab
  ]);

  const calculateAutoPrice = () => {
      // 1. Xác định Khu vực (Area Type)
      // Nếu user chọn tay thì dùng, nếu không thì tự đoán từ Xã/Phường
      let currentAreaType = formData.areaType;
      if (!currentAreaType && formData.ward) {
          const wardName = (formData.ward || '').toLowerCase();
          if (wardName.includes('phường') || wardName.includes('tt.') || wardName.includes('thị trấn')) {
              currentAreaType = 'Đất đô thị';
          } else {
              currentAreaType = 'Đất nông thôn';
          }
      }

      // Logic riêng cho TÁCH THỬA
      if (activeTab === 'tt') {
          let totalBase = 0;
          tachThuaItems.forEach(item => {
              // Tìm giá cho từng dòng
              const matchedRow = priceList.find(row => 
                  _nd(row.serviceName) === _nd(item.serviceName) &&
                  (!row.areaType || _nd(row.areaType) === _nd(currentAreaType || ''))
              );
              if (matchedRow) {
                  totalBase += (matchedRow.price * item.quantity);
              }
          });
          
          const vatRate = 8; // Mặc định 8% cho Tách thửa (như code cũ)
          const vatAmount = Math.round(totalBase * (vatRate / 100));
          const total = totalBase + vatAmount;

          setFormData(prev => ({
              ...prev,
              unitPrice: 0, // Không có đơn giá chung
              vatRate: vatRate,
              vatAmount: vatAmount,
              totalAmount: total,
              areaType: currentAreaType // Update auto detected area type
          }));
          return;
      }

      // Logic cho ĐO ĐẠC & CẮM MỐC
      if (!formData.serviceType) return;

      const matchedPriceItem = priceList.find(item => {
          const matchName = item.serviceName === formData.serviceType;
          // Khu vực: Khớp hoặc Item không quy định
          const matchAreaType = !item.areaType || !currentAreaType || _nd(item.areaType) === _nd(currentAreaType);
          
          // Diện tích: Chỉ áp dụng range nếu tab là Đo đạc (thường tính theo diện tích)
          // Cắm mốc thường tính theo Số mốc (đơn vị 'mốc')
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
              areaType: currentAreaType // Update auto detected
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
              code: found.code, // CẬP NHẬT: Mã hợp đồng = Mã hồ sơ
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

  // --- TÁCH THỬA HELPERS ---
  const addTachThuaItem = () => {
      setTachThuaItems(prev => [...prev, { serviceName: '', quantity: 1, price: 0 }]);
  };
  const removeTachThuaItem = (idx: number) => {
      setTachThuaItems(prev => prev.filter((_, i) => i !== idx));
  };
  const updateTachThuaItem = (idx: number, field: keyof SplitItem, val: any) => {
      setTachThuaItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  // --- SUBMIT ---
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
          splitItems: activeTab === 'tt' ? tachThuaItems : [], // Chỉ lưu khi là tab tách thửa
          serviceType: activeTab === 'tt' ? 'Đo đạc tách thửa' : formData.serviceType
      } as Contract;

      const success = await createContractApi(newContract);
      setLoading(false);
      
      if (success) {
          alert('Lưu hợp đồng thành công!');
          loadContractsList(); // Refresh list
          // generateContractCode();
          // setTachThuaItems([]);
      } else {
          alert('Lỗi khi lưu hợp đồng.');
      }
  };

  const handlePreviewDocx = (contractData?: Partial<Contract>) => {
      // Use provided data (for list) or form data (for create)
      const dataToPrint = contractData || formData;

      // 1. Validate
      if (!dataToPrint.customerName) {
          alert("Vui lòng nhập Tên khách hàng để in.");
          return;
      }

      if (!hasTemplate(STORAGE_KEYS.CONTRACT_TEMPLATE)) {
        if(confirm('Bạn chưa tải lên mẫu Hợp Đồng (.docx). Bạn có muốn tải lên ngay bây giờ không?')) {
            setIsTemplateModalOpen(true);
        }
        return;
      }

      // 2. Data Preparation
      const cDate = dataToPrint.createdDate ? new Date(dataToPrint.createdDate) : new Date();
      const dateFullString = `ngày ${cDate.getDate()} tháng ${cDate.getMonth() + 1} năm ${cDate.getFullYear()}`;
      const moneyText = `${dataToPrint.totalAmount?.toLocaleString('vi-VN') || 0} đồng`; 

      // Helper val
      const val = (v: any) => (v === undefined || v === null) ? "" : String(v);
      const money = (v: any) => (v === undefined || v === null) ? "0" : Number(v).toLocaleString('vi-VN');

      // 3. Data Mapping & Aliases
      const printData = {
          // --- English Keys ---
          code: val(dataToPrint.code),
          customerName: val(dataToPrint.customerName),
          createdDate: cDate.toLocaleDateString('vi-VN'),
          
          totalAmount: money(dataToPrint.totalAmount),
          unitPrice: money(dataToPrint.unitPrice),
          vatAmount: money(dataToPrint.vatAmount),
          
          currentUser: val(currentUser.name),
          address: val(dataToPrint.address || dataToPrint.ward),
          ward: val(dataToPrint.ward),
          landPlot: val(dataToPrint.landPlot),
          mapSheet: val(dataToPrint.mapSheet),
          area: val(dataToPrint.area),
          
          // Determine service type for display
          serviceType: val(dataToPrint.serviceType || dataToPrint.contractType),
          
          // --- Vietnamese Aliases ---
          SO_HD: val(dataToPrint.code),
          MA_HD: val(dataToPrint.code),
          
          TEN: val(dataToPrint.customerName),
          KHACH_HANG: val(dataToPrint.customerName),
          
          NGAY_KY: cDate.toLocaleDateString('vi-VN'),
          NGAY_LAP: cDate.toLocaleDateString('vi-VN'),
          NGAY_THANG_NAM: dateFullString,
          NGAYLAP: dateFullString,
          
          TONG_TIEN: money(dataToPrint.totalAmount),
          DON_GIA: money(dataToPrint.unitPrice),
          THUE_VAT: money(dataToPrint.vatAmount),
          
          TONGTIEN_TEXT: money(dataToPrint.totalAmount),
          TONGTIEN_CHU: moneyText, // Bằng chữ
          
          NGUOI_LAP: val(currentUser.name),
          
          DIA_CHI: val(dataToPrint.address || dataToPrint.ward),
          DIACHI: val(dataToPrint.address || dataToPrint.ward),
          
          XA: val(dataToPrint.ward),
          PHUONG: val(dataToPrint.ward),
          XAPHUONG: val(dataToPrint.ward),
          
          TO: val(dataToPrint.mapSheet),
          THUA: val(dataToPrint.landPlot),
          DT: val(dataToPrint.area),
          DIEN_TICH: val(dataToPrint.area),
          
          LOAI_DV: val(dataToPrint.serviceType),
          DICH_VU: val(dataToPrint.serviceType),
          
          // Special
          SOTHUA_SOMOC_LABEL: dataToPrint.contractType === 'Cắm mốc' ? 'Số mốc' : 'Số thửa',
          SOTHUA_SOMOC_VALUE: dataToPrint.contractType === 'Cắm mốc' ? val(dataToPrint.markerCount) : val(dataToPrint.plotCount),
      };

      // 4. Generate Blob
      const blob = generateDocxBlob(STORAGE_KEYS.CONTRACT_TEMPLATE, printData);
      if (blob) {
          setPreviewBlob(blob);
          setPreviewFileName(`HopDong_${dataToPrint.code}`);
          setIsPreviewOpen(true);
      }
  };

  // Filter lists based on Tab
  const availableServices = useMemo(() => {
      const allNames = Array.from(new Set(priceList.map(p => p.serviceName)));
      if (activeTab === 'tt') {
          return allNames.filter(n => _nd(n).includes('tach thua'));
      }
      if (activeTab === 'cm') {
          return allNames.filter(n => _nd(n).includes('cam moc'));
      }
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in-up">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-purple-50/50">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSignature className="text-purple-600" />
            Quản Lý Hợp Đồng
          </h2>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200">
            <button 
                onClick={() => setViewMode('create')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'create' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <PlusCircle size={16} /> Tiếp nhận mới
            </button>
            <button 
                onClick={() => { setViewMode('list'); loadContractsList(); }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <LayoutList size={16} /> Danh sách hợp đồng
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {viewMode === 'create' ? (
            /* ================= VIEW: CREATE FORM ================= */
            <form onSubmit={handleSubmit} className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* TOOLBAR FOR CREATE */}
                <div className="lg:col-span-12 flex justify-end gap-2 mb-2">
                    <button type="button" onClick={() => setIsTemplateModalOpen(true)} className="text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm hover:bg-gray-50 flex items-center gap-1">
                        <Settings size={14} /> Mẫu In
                    </button>
                    <button type="button" onClick={() => setIsPriceConfigOpen(true)} className="text-sm text-gray-700 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm hover:bg-gray-50 flex items-center gap-1">
                        <Settings2 size={14} /> Bảng Giá
                    </button>
                    <button type="button" onClick={() => handlePreviewDocx()} className="text-sm text-purple-700 bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-200 flex items-center gap-1 font-semibold">
                        <Eye size={14} /> Xem & In Ngay
                    </button>
                    <button type="button" onClick={generateContractCode} className="text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm hover:shadow-md flex items-center gap-1">
                        <RotateCcw size={14} /> Mã Mới
                    </button>
                </div>

                {/* CỘT TRÁI: THÔNG TIN KHÁCH HÀNG */}
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
                                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50" 
                                    value={formData.customerName} onChange={e => handleChange('customerName', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Xã phường</label>
                                <input list="wards-list-contract" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50" 
                                    value={formData.ward} onChange={e => handleChange('ward', e.target.value)} />
                                <datalist id="wards-list-contract">
                                    {wards.map(w => <option key={w} value={w} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Địa chỉ đất</label>
                                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50" 
                                    value={formData.address} onChange={e => handleChange('address', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Tờ bản đồ</label>
                                    <input className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-center" 
                                        value={formData.mapSheet} onChange={e => handleChange('mapSheet', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Thửa đất</label>
                                    <input className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-center" 
                                        value={formData.landPlot} onChange={e => handleChange('landPlot', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Diện tích (m2)</label>
                                <input type="number" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white font-bold text-blue-600" 
                                    value={formData.area} onChange={e => handleChange('area', parseFloat(e.target.value))} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* CỘT PHẢI: CHI TIẾT HỢP ĐỒNG */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* SUB-TABS */}
                        <div className="flex border-b border-gray-200 bg-gray-50">
                            <button type="button" onClick={() => setActiveTab('dd')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'dd' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                                🧰 Đo đạc
                            </button>
                            <button type="button" onClick={() => setActiveTab('tt')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'tt' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                                🧩 Tách thửa
                            </button>
                            <button type="button" onClick={() => setActiveTab('cm')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'cm' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                                📍 Cắm mốc
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã Hợp Đồng</label>
                                    <input type="text" readOnly className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 font-mono font-bold text-gray-600" value={formData.code} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày lập</label>
                                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none" 
                                        value={formData.createdDate} onChange={e => handleChange('createdDate', e.target.value)} />
                                </div>
                            </div>

                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-3"><Calculator size={16} /> Tính chi phí dịch vụ</h4>
                                
                                {(activeTab === 'dd' || activeTab === 'cm') && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Khu vực</label>
                                            <select className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm bg-white"
                                                value={formData.areaType} onChange={(e) => handleChange('areaType', e.target.value)}>
                                                <option value="">-- Tự động theo xã --</option>
                                                <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                                <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Loại dịch vụ</label>
                                            <select className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm bg-white"
                                                value={formData.serviceType} onChange={(e) => handleChange('serviceType', e.target.value)}>
                                                <option value="">-- Chọn dịch vụ --</option>
                                                {availableServices.map(name => <option key={name} value={name}>{name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">{activeTab === 'dd' ? 'Số thửa' : 'Số mốc'}</label>
                                            <input type="number" className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm" 
                                                value={activeTab === 'dd' ? formData.plotCount : formData.markerCount} 
                                                onChange={e => handleChange(activeTab === 'dd' ? 'plotCount' : 'markerCount', parseInt(e.target.value))} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Đơn giá (VNĐ)</label>
                                            <input type="number" readOnly className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm bg-gray-100 text-right font-mono" 
                                                value={formData.unitPrice} />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'tt' && (
                                    <div className="space-y-3 mb-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">Khu vực</label>
                                                <select className="w-full border border-gray-300 rounded px-3 py-2 outline-none text-sm bg-white"
                                                    value={formData.areaType} onChange={(e) => handleChange('areaType', e.target.value)}>
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
                                                                <select className="w-full border border-gray-300 rounded px-2 py-1 outline-none text-xs"
                                                                    value={item.serviceName} 
                                                                    onChange={(e) => updateTachThuaItem(idx, 'serviceName', e.target.value)}>
                                                                    <option value="">-- Chọn mức diện tích --</option>
                                                                    {availableServices.map(name => <option key={name} value={name}>{name}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="p-2">
                                                                <input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-center outline-none text-xs"
                                                                    value={item.quantity} min={1}
                                                                    onChange={(e) => updateTachThuaItem(idx, 'quantity', parseInt(e.target.value))} />
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <button type="button" onClick={() => removeTachThuaItem(idx)} className="text-red-500 hover:text-red-700">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <button type="button" onClick={addTachThuaItem} className="w-full py-2 bg-gray-50 text-blue-600 text-xs font-bold hover:bg-gray-100 flex items-center justify-center gap-1 border-t border-gray-200">
                                                <Plus size={12} /> Thêm dòng
                                            </button>
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
                                <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none resize-none"
                                    value={formData.content} onChange={e => handleChange('content', e.target.value)} placeholder="Nội dung chi tiết..." />
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-purple-700 shadow-lg transition-all active:scale-95 disabled:opacity-70">
                                {loading ? 'Đang lưu...' : 'Lưu Hợp Đồng'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        ) : (
            /* ================= VIEW: LIST TABLE ================= */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
                <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm hợp đồng..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                            value={searchTermList}
                            onChange={(e) => setSearchTermList(e.target.value)}
                        />
                    </div>
                    <button onClick={loadContractsList} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full" title="Tải lại danh sách">
                        <RotateCcw size={18} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left table-fixed min-w-[1000px]">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold sticky top-0 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 text-center">STT</th>
                                <th className="p-4 w-[120px]">Mã HĐ</th>
                                <th className="p-4 w-[200px]">Khách hàng</th>
                                <th className="p-4 w-[150px]">Loại HĐ</th>
                                <th className="p-4 w-[120px]">Ngày lập</th>
                                <th className="p-4 text-right w-[150px]">Tổng tiền</th>
                                <th className="p-4 text-center w-[80px]">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                            {filteredContracts.length > 0 ? (
                                filteredContracts.map((c, index) => (
                                    <tr key={c.id} className="hover:bg-purple-50/50 transition-colors">
                                        <td className="p-4 text-center text-gray-400 align-middle">{index + 1}</td>
                                        <td className="p-4 font-medium text-purple-700 truncate align-middle" title={c.code}>{c.code}</td>
                                        <td className="p-4 font-medium truncate align-middle" title={c.customerName}>{c.customerName}</td>
                                        <td className="p-4 align-middle">
                                            <span className="px-2 py-1 bg-gray-100 rounded text-xs border border-gray-200">
                                                {c.contractType || 'Khác'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-500 align-middle">{c.createdDate ? new Date(c.createdDate).toLocaleDateString('vi-VN') : '-'}</td>
                                        <td className="p-4 text-right font-mono font-bold text-gray-800 align-middle">
                                            {c.totalAmount?.toLocaleString('vi-VN')}
                                        </td>
                                        <td className="p-4 text-center align-middle">
                                            <button 
                                                onClick={() => handlePreviewDocx(c)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                                title="In lại hợp đồng"
                                            >
                                                <Printer size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-400">Không tìm thấy hợp đồng nào.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

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
