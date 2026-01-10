
import React, { useState, useEffect, useRef } from 'react';
import { Contract, PriceItem, SplitItem, RecordFile } from '../../types';
import { Save, Calculator, Search, Plus, Trash2, Printer, FileCheck, CheckCircle, AlertCircle, X, RotateCcw, MapPin, Ruler, Grid, Banknote, User, FileText, Calendar, Wand2, ChevronDown, ChevronUp } from 'lucide-react';

interface ContractFormProps {
  initialData?: Contract;
  onSave: (contract: Contract, isUpdate: boolean) => Promise<boolean>;
  onPrint: (data: Partial<Contract>, type: 'contract' | 'liquidation') => void;
  priceList: PriceItem[];
  wards: string[];
  records: RecordFile[];
  generateCode: () => string;
  mode: 'contract' | 'liquidation'; // New prop
}

function _nd(s: string | undefined | null): string {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const ContractForm: React.FC<ContractFormProps> = ({ initialData, onSave, onPrint, priceList, wards, records, generateCode, mode }) => {
  const [activeTab, setActiveTab] = useState<'dd' | 'tt' | 'cm'>('dd');
  const [tachThuaItems, setTachThuaItems] = useState<SplitItem[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // States for Quick Import (Tách thửa)
  const [splitImportText, setSplitImportText] = useState('');
  const [isImportExpanded, setIsImportExpanded] = useState(false);

  const [formData, setFormData] = useState<Partial<Contract>>({
    code: '', customerName: '', phoneNumber: '', address: '', ward: '', landPlot: '', mapSheet: '', area: 0,
    contractType: 'Đo đạc', serviceType: '', areaType: '', plotCount: 1, markerCount: 1, quantity: 1, 
    unitPrice: 0, vatRate: 8, vatAmount: 0, totalAmount: 0, deposit: 0, content: '',
    createdDate: new Date().toISOString().split('T')[0], status: 'PENDING',
    liquidationArea: 0 // Init
  });

  useEffect(() => {
      if (initialData) {
          // Update Form Data
          setFormData(prev => ({
              ...initialData,
              // Quan trọng: Nếu vào chế độ Thanh lý và chưa có diện tích thanh lý, lấy diện tích hợp đồng
              liquidationArea: (mode === 'liquidation' && !initialData.liquidationArea) ? initialData.area : initialData.liquidationArea
          }));
          
          // Update Split Items (Chi tiết tính phí/Tách thửa)
          if (initialData.splitItems && initialData.splitItems.length > 0) {
              setTachThuaItems(initialData.splitItems);
          } else {
              setTachThuaItems([]);
          }

          // Update Active Tab based on Contract Type
          if (initialData.contractType === 'Tách thửa') setActiveTab('tt');
          else if (initialData.contractType === 'Cắm mốc') setActiveTab('cm');
          else setActiveTab('dd');
          
          setNotification(null);
      } else {
          setFormData(prev => ({ ...prev, code: generateCode() }));
          setTachThuaItems([]);
      }
  }, [initialData, mode]); 

  // Scroll to notification
  useEffect(() => {
      if (notification && topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (notification.type === 'success') {
              const timer = setTimeout(() => setNotification(null), 5000);
              return () => clearTimeout(timer);
          }
      }
  }, [notification]);

  // Tab change logic
  useEffect(() => {
      const typeMap: Record<string, any> = { 'dd': 'Đo đạc', 'tt': 'Tách thửa', 'cm': 'Cắm mốc' };
      setFormData(prev => ({ ...prev, contractType: typeMap[activeTab] }));
      if (activeTab === 'tt' && tachThuaItems.length === 0) setTachThuaItems([{ serviceName: '', quantity: 1, price: 0, area: 0 }]);
  }, [activeTab]);

  // Init Liquidation Area if missing (Fallback logic)
  useEffect(() => {
      if (mode === 'liquidation' && !formData.liquidationArea && formData.area) {
          setFormData(prev => ({ ...prev, liquidationArea: prev.area }));
      }
  }, [mode, formData.area]);

  // Helper tìm giá động theo AreaType hiện tại
  const getDynamicPrice = (serviceName: string) => {
      const currentAreaType = formData.areaType;
      const matchedRow = priceList.find(row => 
          _nd(row.serviceName) === _nd(serviceName) && 
          (!row.areaType || !currentAreaType || _nd(row.areaType) === _nd(currentAreaType))
      );
      
      // Ưu tiên giá từ CSDL nếu có
      if (matchedRow && matchedRow.price > 0) return matchedRow.price;

      // Logic mặc định cho Trích lục (nếu CSDL chưa cấu hình)
      if (_nd(serviceName).includes('trich luc')) return 53163;

      return 0;
  };

  // Logic nhập nhanh từ văn bản (Tách thửa)
  const handleParseSplitImport = () => {
      if (!splitImportText.trim()) return;

      const lines = splitImportText.split(/\n|;/).filter(line => line.trim() !== '');
      const newItems: SplitItem[] = [];
      const currentAreaType = formData.areaType; // Đất đô thị/nông thôn

      // Lấy danh sách các dịch vụ liên quan đến tách thửa trong bảng giá
      // Lọc theo Khu vực hiện tại
      const validPriceItems = priceList.filter(p => {
          const isTachThua = _nd(p.serviceGroup).includes('tach thua') || _nd(p.serviceName).includes('tach thua');
          const isMatchArea = !p.areaType || !currentAreaType || _nd(p.areaType) === _nd(currentAreaType);
          return isTachThua && isMatchArea;
      });

      lines.forEach(line => {
          // Regex tìm diện tích: "diện tích: 279,8" hoặc "dt: 50.5"
          // Hỗ trợ dấu phẩy hoặc chấm thập phân
          const areaMatch = line.match(/(?:diện tích|dt)[:\s]*([\d,.]+)/i);
          
          if (areaMatch) {
              // Chuẩn hóa số liệu: Xóa dấu chấm (ngàn) nếu có nhiều hơn 1, thay phẩy bằng chấm
              let areaStr = areaMatch[1];
              // Trường hợp 1.234,56 -> 1234.56
              if (areaStr.includes('.') && areaStr.includes(',')) {
                  areaStr = areaStr.replace(/\./g, '').replace(',', '.');
              } else if (areaStr.includes(',')) {
                  // Trường hợp 123,45 -> 123.45
                  areaStr = areaStr.replace(',', '.');
              }
              // Trường hợp 1.234 (nếu ko có phẩy, giả sử là chấm thập phân nếu nhỏ, hoặc chấm ngàn nếu lớn - logic đơn giản là parse float trực tiếp)
              
              const area = parseFloat(areaStr);

              if (!isNaN(area)) {
                  // Tự động chọn loại sản phẩm dựa trên diện tích (minArea <= area < maxArea)
                  let bestService = validPriceItems.find(p => area >= p.minArea && area < p.maxArea);
                  
                  // Nếu không tìm thấy range phù hợp, lấy item đầu tiên hoặc mặc định
                  let serviceName = bestService ? bestService.serviceName : (availableServices[0] || '');
                  let price = bestService ? bestService.price : getDynamicPrice(serviceName);

                  newItems.push({
                      serviceName: serviceName,
                      quantity: 1,
                      price: price,
                      area: area
                  });
              }
          }
      });

      if (newItems.length > 0) {
          setTachThuaItems(newItems);
          setNotification({ type: 'success', message: `Đã nhập tự động ${newItems.length} thửa đất.` });
          setIsImportExpanded(false); // Thu gọn sau khi nhập xong
      } else {
          setNotification({ type: 'error', message: 'Không tìm thấy thông tin diện tích hợp lệ trong văn bản.' });
      }
  };

  // Price Calculation Logic
  // IMPORTANT: Chỉ tính lại tự động nếu KHÔNG phải đang load initialData
  // Tuy nhiên, để đơn giản, ta cho phép tính lại nhưng phải đảm bảo initialData được set trước.
  useEffect(() => {
      // 1. Tự động xác định Khu vực (Đất đô thị / Nông thôn) dựa trên Xã/Phường
      let currentAreaType = formData.areaType;
      if (!currentAreaType && formData.ward) {
          const wardName = (formData.ward || '').toLowerCase();
          if (wardName.includes('phường') || wardName.includes('tt.') || wardName.includes('thị trấn') || wardName.includes('minh hưng') || wardName.includes('chơn thành')) {
              currentAreaType = 'Đất đô thị';
          } else {
              currentAreaType = 'Đất nông thôn';
          }
      }

      // 2. Logic Tách thửa
      if (activeTab === 'tt') {
          let totalBase = 0;
          // Cập nhật lại giá cho từng item dựa trên AreaType mới (nếu có thay đổi)
          const updatedItems = tachThuaItems.map(item => {
              const price = getDynamicPrice(item.serviceName);
              totalBase += (price * item.quantity);
              // Lưu ý: Chúng ta chỉ tính tổng ở đây, việc update state tachThuaItems sẽ gây infinite loop nếu làm trực tiếp
              // nên ta chỉ dùng giá trị price để tính toán.
              return { ...item, price }; 
          });
          
          const vatRate = 8; 
          const vatAmount = Math.round(totalBase * (vatRate / 100));
          setFormData(prev => ({ ...prev, unitPrice: 0, vatRate, vatAmount, totalAmount: totalBase + vatAmount, areaType: currentAreaType }));
          
          return;
      }

      // 3. Logic Đo đạc & Cắm mốc
      if (!formData.serviceType) return;
      const price = getDynamicPrice(formData.serviceType);
      
      // Tìm VAT rate của dịch vụ đó
      const matchedItem = priceList.find(p => _nd(p.serviceName) === _nd(formData.serviceType));
      const vatRate = matchedItem ? matchedItem.vatRate : 8;
      const vatIsPercent = matchedItem ? matchedItem.vatIsPercent : true;

      const qty = activeTab === 'cm' ? (formData.markerCount || 1) : (formData.plotCount || 1);
      
      const baseAmount = price * qty;
      let vatAmount = 0;
      
      if (vatIsPercent) {
          vatAmount = Math.round(baseAmount * (vatRate / 100));
      } else {
          vatAmount = vatRate * qty;
      }
      
      setFormData(prev => ({ 
          ...prev, 
          unitPrice: price, 
          vatRate: vatRate, 
          vatAmount, 
          totalAmount: baseAmount + vatAmount, 
          areaType: currentAreaType 
      }));
      
  }, [formData.area, formData.serviceType, formData.ward, formData.areaType, formData.plotCount, formData.markerCount, tachThuaItems, activeTab, priceList]);

  const handleSearchRecord = () => {
      const found = records.find(r => r.code.toLowerCase() === searchCode.toLowerCase());
      if (found) {
          // Tự động detect dịch vụ nếu là trích lục
          let suggestedService = '';
          const recType = (found.recordType || '').toLowerCase();
          if (recType.includes('trích lục')) {
              suggestedService = 'Trích lục bản đồ địa chính';
          }

          setFormData(prev => ({ 
              ...prev, 
              code: found.code, // Nếu muốn giữ mã hợp đồng giống mã hồ sơ
              customerName: found.customerName, 
              phoneNumber: found.phoneNumber, 
              ward: found.ward, 
              address: found.address || '', 
              landPlot: found.landPlot, 
              mapSheet: found.mapSheet, 
              area: found.area || 0,
              serviceType: suggestedService || prev.serviceType
          }));
          setNotification({ type: 'success', message: `Đã tải thông tin từ hồ sơ: ${found.code}` });
      } else {
          setNotification({ type: 'error', message: 'Không tìm thấy mã hồ sơ này.' });
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setNotification(null);

      if (!formData.code || !formData.customerName) { 
          setNotification({ type: 'error', message: "Vui lòng điền đầy đủ Mã hợp đồng và Tên khách hàng." }); 
          return; 
      }
      setLoading(true);
      
      // Chuẩn hóa lại giá của các item tách thửa trước khi lưu (đề phòng giá trên UI khác giá lưu do đổi khu vực)
      const finalSplitItems = activeTab === 'tt' ? tachThuaItems.map(item => ({
          ...item,
          price: getDynamicPrice(item.serviceName)
      })) : [];

      const contractData = { 
          ...formData, 
          splitItems: finalSplitItems, 
          serviceType: activeTab === 'tt' ? 'Đo đạc tách thửa' : formData.serviceType 
      } as Contract;
      
      if (!contractData.id) contractData.id = Math.random().toString(36).substr(2, 9);
      
      const success = await onSave(contractData, !!initialData);
      setLoading(false);

      if (success) {
          const msg = initialData ? 'Cập nhật hợp đồng thành công!' : 'Đã tạo hợp đồng mới thành công!';
          setNotification({ type: 'success', message: msg });
          // Nếu tạo mới thì reset form (giữ lại các field cần thiết nếu muốn, ở đây reset gần hết)
          if (!initialData) {
              // Giữ lại trạng thái tab và generate mã mới
              handleReset(true); 
          }
      } else {
          setNotification({ type: 'error', message: 'Lỗi khi lưu hợp đồng. Vui lòng thử lại.' });
      }
  };

  const handleReset = (keepNotification = false) => {
      setFormData({
        code: generateCode(), customerName: '', phoneNumber: '', address: '', ward: '', landPlot: '', mapSheet: '', area: 0,
        contractType: activeTab === 'tt' ? 'Tách thửa' : activeTab === 'cm' ? 'Cắm mốc' : 'Đo đạc', 
        serviceType: '', areaType: '', plotCount: 1, markerCount: 1, quantity: 1, 
        unitPrice: 0, vatRate: 8, vatAmount: 0, totalAmount: 0, deposit: 0, content: '',
        createdDate: new Date().toISOString().split('T')[0], status: 'PENDING',
        liquidationArea: 0
      });
      setTachThuaItems([]);
      setSplitImportText('');
      setSearchCode('');
      if (!keepNotification) setNotification(null);
  };

  const handlePrintClick = (type: 'contract' | 'liquidation') => {
      const currentData = { 
          ...formData, 
          // Cập nhật giá mới nhất cho view in ấn
          splitItems: activeTab === 'tt' ? tachThuaItems.map(i => ({...i, price: getDynamicPrice(i.serviceName)})) : [], 
          serviceType: activeTab === 'tt' ? 'Đo đạc tách thửa' : formData.serviceType 
      };
      onPrint(currentData, type);
  };

  // Helper
  const handleChange = (k: keyof Contract, v: any) => setFormData(p => ({ ...p, [k]: v }));
  
  // Logic lấy danh sách dịch vụ
  // ĐÃ SỬA: Không tự động thêm "Trích lục" vào danh sách nữa
  const availableServices = (() => {
      const services = priceList.map(p => p.serviceName).filter((v, i, a) => a.indexOf(v) === i);
      let filtered = services.filter(n => {
          if (activeTab === 'tt') return _nd(n).includes('tach thua');
          if (activeTab === 'cm') return _nd(n).includes('cam moc');
          return !_nd(n).includes('tach thua') && !_nd(n).includes('cam moc');
      });
      return filtered;
  })();

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all font-medium bg-white hover:border-purple-300";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in relative pb-10">
        <div ref={topRef} className="absolute -top-20" />
        
        {/* NOTIFICATION */}
        <div className="lg:col-span-12">
            {notification && (
                <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-fade-in-up mb-4 ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {notification.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                    <div className="flex-1">
                        <h4 className="font-bold text-sm uppercase">{notification.type === 'success' ? 'Thành công' : 'Thông báo'}</h4>
                        <p className="text-sm">{notification.message}</p>
                    </div>
                    <button type="button" onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
            )}
        </div>

        {/* CỘT TRÁI: NHẬP NHANH TỪ HỒ SƠ */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 border-b pb-3 flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Search size={16} /></span> 
                    Tải từ Hồ Sơ (Auto Fill)
                </h3>
                
                <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                        <input type="text" placeholder="Nhập mã hồ sơ..." className={`${inputClass} pl-9`} value={searchCode} onChange={(e) => setSearchCode(e.target.value)} />
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                    <button type="button" onClick={handleSearchRecord} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-all active:scale-95">Tải</button>
                </div>

                <div className="space-y-4">
                    <div><label className={labelClass}>Khách hàng</label><input className={inputClass} value={formData.customerName} onChange={e => handleChange('customerName', e.target.value)} /></div>
                    <div>
                        <label className={labelClass}>Xã phường</label>
                        <select className={inputClass} value={formData.ward || ''} onChange={e => handleChange('ward', e.target.value)}>
                            <option value="">-- Chọn Xã/Phường --</option>
                            {wards.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                    <div><label className={labelClass}>Địa chỉ đất</label><input className={inputClass} value={formData.address} onChange={e => handleChange('address', e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className={labelClass}>Tờ bản đồ</label><input className={`${inputClass} text-center`} value={formData.mapSheet} onChange={e => handleChange('mapSheet', e.target.value)} /></div>
                        <div><label className={labelClass}>Thửa đất</label><input className={`${inputClass} text-center`} value={formData.landPlot} onChange={e => handleChange('landPlot', e.target.value)} /></div>
                    </div>
                    <div><label className={labelClass}>Diện tích Hợp Đồng (m2)</label><input type="number" className={`${inputClass} font-bold text-blue-600`} value={formData.area} onChange={e => handleChange('area', parseFloat(e.target.value))} /></div>
                    
                    {/* LIQUIDATION AREA FIELD - ONLY IN LIQUIDATION MODE */}
                    {mode === 'liquidation' && (
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200 mt-2">
                            <label className={`${labelClass} text-green-700`}>Diện tích Thanh Lý (Thực tế)</label>
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="number" 
                                    className={`${inputClass} font-bold text-green-700 border-green-300 focus:border-green-500`} 
                                    value={formData.liquidationArea !== undefined ? formData.liquidationArea : formData.area} 
                                    onChange={e => handleChange('liquidationArea', parseFloat(e.target.value))} 
                                />
                                <span className="text-xs font-bold text-green-600">m²</span>
                            </div>
                            <p className="text-[10px] text-green-600 mt-1 italic">* Diện tích thực tế sau khi đo đạc xong.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT HỢP ĐỒNG */}
        <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* TABS HEADER */}
                <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 gap-1.5">
                    {['dd', 'tt', 'cm'].map(t => (
                        <button key={t} type="button" onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 text-sm font-bold text-center rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === t ? 'bg-white text-purple-700 shadow-md ring-1 ring-purple-100' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}>
                            {t === 'dd' ? <><Ruler size={16} /> Đo đạc</> : t === 'tt' ? <><Grid size={16} /> Tách thửa</> : <><MapPin size={16} /> Cắm mốc</>}
                        </button>
                    ))}
                </div>

                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <label className={labelClass}>Mã Hợp Đồng</label>
                            <div className="relative">
                                <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="text" readOnly className={`${inputClass} bg-white pl-9 font-mono font-bold text-purple-700`} value={formData.code} />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Ngày lập</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="date" className={`${inputClass} pl-9`} value={formData.createdDate} onChange={e => handleChange('createdDate', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Pricing Box */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-100 shadow-inner">
                        <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-4 text-lg">
                            <div className="bg-white p-1.5 rounded-lg shadow-sm text-purple-600"><Banknote size={20} /></div> 
                            Tính chi phí dịch vụ
                        </h4>
                        
                        {(activeTab === 'dd' || activeTab === 'cm') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Khu vực</label>
                                    <select className={`${inputClass} border-purple-200 bg-white/80`} value={formData.areaType} onChange={(e) => handleChange('areaType', e.target.value)}>
                                        <option value="">-- Tự động theo xã --</option>
                                        <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                        <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Loại dịch vụ</label>
                                    <select className={`${inputClass} border-purple-200 bg-white/80`} value={formData.serviceType} onChange={(e) => handleChange('serviceType', e.target.value)}>
                                        <option value="">-- Chọn dịch vụ --</option>{availableServices.map(name => <option key={name} value={name}>{name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">{activeTab === 'dd' ? 'Số thửa' : 'Số mốc'}</label>
                                    <input type="number" className={`${inputClass} border-purple-200 bg-white/80`} value={activeTab === 'dd' ? formData.plotCount : formData.markerCount} onChange={e => handleChange(activeTab === 'dd' ? 'plotCount' : 'markerCount', parseInt(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Đơn giá</label>
                                    <input type="number" readOnly className={`${inputClass} border-purple-200 bg-purple-100/50 text-right font-mono text-purple-700`} value={formData.unitPrice} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'tt' && (
                            <div className="space-y-4 mb-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Khu vực</label>
                                        <select className={`${inputClass} border-purple-200 bg-white/80`} value={formData.areaType} onChange={(e) => handleChange('areaType', e.target.value)}>
                                            <option value="">-- Tự động theo xã --</option>
                                            <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                            <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                {/* QUICK IMPORT SECTION (NEW) */}
                                <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-sm mb-3">
                                    <div 
                                        className="flex justify-between items-center cursor-pointer mb-2 select-none"
                                        onClick={() => setIsImportExpanded(!isImportExpanded)}
                                    >
                                        <label className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase">
                                            <Wand2 size={16} /> Nhập nhanh từ nội dung chi tiết
                                        </label>
                                        {isImportExpanded ? <ChevronUp size={16} className="text-purple-400" /> : <ChevronDown size={16} className="text-purple-400" />}
                                    </div>
                                    
                                    {isImportExpanded && (
                                        <div className="space-y-2 animate-fade-in">
                                            <textarea 
                                                className="w-full border border-purple-200 rounded-lg p-2 text-sm text-slate-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[80px]"
                                                placeholder={`Ví dụ:\n- Thửa đất thứ nhất 1618-1: diện tích: 279,8 m²...\n- Thửa đất thứ hai 1618-2: diện tích: 150,5 m²...`}
                                                value={splitImportText}
                                                onChange={(e) => setSplitImportText(e.target.value)}
                                            />
                                            <div className="flex justify-end">
                                                <button 
                                                    type="button"
                                                    onClick={handleParseSplitImport}
                                                    disabled={!splitImportText.trim()}
                                                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                                >
                                                    Phân tích & Nhập tự động
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-slate-500 italic mt-1">
                                                * Hệ thống sẽ tự động tìm diện tích (ví dụ "diện tích: 279,8") và chọn loại sản phẩm tương ứng trong bảng giá.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-purple-100 text-purple-800 text-xs uppercase font-bold">
                                            <tr>
                                                <th className="p-3 text-left">Loại sản phẩm</th>
                                                <th className="p-3 w-16 text-center">SL</th>
                                                <th className="p-3 w-20 text-center">Diện tích (m2)</th>
                                                <th className="p-3 w-28 text-right">Đơn giá</th>
                                                <th className="p-3 w-32 text-right">Thành tiền</th>
                                                <th className="p-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tachThuaItems.map((item, idx) => {
                                                const currentPrice = getDynamicPrice(item.serviceName) || 0;
                                                const lineTotal = currentPrice * (item.quantity || 0);
                                                return (
                                                    <tr key={idx} className="border-t border-purple-50 hover:bg-purple-50/30">
                                                        <td className="p-2">
                                                            <select 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-sm outline-none bg-purple-50/30 focus:border-purple-300" 
                                                                value={item.serviceName} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].serviceName = e.target.value; 
                                                                    // Update price immediately to state
                                                                    newItems[idx].price = getDynamicPrice(e.target.value);
                                                                    setTachThuaItems(newItems); 
                                                                }}
                                                            >
                                                                <option value="">-- Chọn --</option>
                                                                {availableServices.map(n => <option key={n} value={n}>{n}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="number" 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-purple-50/30 focus:border-purple-300" 
                                                                value={item.quantity} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].quantity = parseInt(e.target.value) || 0; 
                                                                    setTachThuaItems(newItems); 
                                                                }} 
                                                            />
                                                        </td>
                                                        {/* ADDED AREA INPUT FOR SPLIT ITEM */}
                                                        <td className="p-2">
                                                            <input 
                                                                type="number" 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-white font-bold text-blue-600 focus:border-purple-300" 
                                                                value={item.area || 0} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].area = parseFloat(e.target.value) || 0; 
                                                                    setTachThuaItems(newItems); 
                                                                }} 
                                                                placeholder="DT"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-right text-gray-600 font-mono">
                                                            {currentPrice.toLocaleString('vi-VN')}
                                                        </td>
                                                        <td className="p-2 text-right text-purple-700 font-mono font-bold">
                                                            {lineTotal.toLocaleString('vi-VN')}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button type="button" onClick={() => setTachThuaItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-md hover:bg-red-100 transition-colors">
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <button type="button" onClick={() => setTachThuaItems(prev => [...prev, { serviceName: '', quantity: 1, price: 0, area: 0 }])} className="w-full py-2 bg-purple-50 text-purple-600 text-xs font-bold hover:bg-purple-100 border-t border-purple-100 flex items-center justify-center gap-1 transition-colors"><Plus size={14}/> Thêm dòng</button>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row justify-end gap-6 pt-4 border-t border-purple-200 mt-2">
                            <div className="text-right">
                                <span className="text-xs text-purple-600 uppercase font-bold block mb-1">Thuế VAT ({formData.vatRate}%)</span>
                                <span className="font-medium text-slate-700 bg-white/50 px-2 py-1 rounded border border-purple-100">{formData.vatAmount?.toLocaleString('vi-VN')}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-purple-600 uppercase font-bold block mb-1">TỔNG TIỀN</span>
                                <span className="text-2xl font-black text-purple-700 bg-white px-3 py-1 rounded-lg shadow-sm border border-purple-100">{formData.totalAmount?.toLocaleString('vi-VN')} <span className="text-sm font-medium text-slate-500">VNĐ</span></span>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label className={labelClass}>Ghi chú hợp đồng</label>
                        <textarea rows={3} className={`${inputClass} resize-none`} value={formData.content} onChange={e => handleChange('content', e.target.value)} placeholder="Nội dung chi tiết..." />
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="flex gap-2">
                            <button type="submit" disabled={loading} className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-purple-700 shadow-lg shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                                <Save size={20} /> {loading ? 'Đang xử lý...' : (initialData ? 'CẬP NHẬT' : 'LƯU HỢP ĐỒNG')}
                            </button>
                            <button type="button" onClick={() => handleReset(false)} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shadow-sm font-bold border border-slate-200" title="Làm mới form">
                                {initialData ? <X size={20} className="text-red-500" /> : <RotateCcw size={20} />}
                            </button>
                        </div>
                        
                        <div className="flex gap-2">
                            {mode === 'contract' ? (
                                <button type="button" onClick={() => handlePrintClick('contract')} className="flex-1 px-4 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 flex items-center justify-center gap-2 shadow-sm transition-all border border-indigo-200">
                                    <Printer size={18} /> In Hợp đồng
                                </button>
                            ) : (
                                <button type="button" onClick={() => handlePrintClick('liquidation')} className="flex-1 px-4 py-3 bg-white text-green-700 rounded-xl font-bold hover:bg-green-50 flex items-center justify-center gap-2 shadow-sm transition-all border border-green-200">
                                    <FileCheck size={18} /> In Thanh lý
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
  );
};

export default ContractForm;
