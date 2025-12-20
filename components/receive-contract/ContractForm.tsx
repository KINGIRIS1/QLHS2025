
import React, { useState, useEffect, useRef } from 'react';
import { Contract, PriceItem, SplitItem, RecordFile } from '../../types';
import { Save, Calculator, Search, Plus, Trash2, Printer, FileCheck, CheckCircle, AlertCircle, X, RotateCcw, MapPin, Ruler, Grid, Banknote, User, FileText, Calendar } from 'lucide-react';

interface ContractFormProps {
  initialData?: Contract;
  onSave: (contract: Contract, isUpdate: boolean) => Promise<boolean>;
  onPrint: (data: Partial<Contract>, type: 'contract' | 'liquidation') => void;
  priceList: PriceItem[];
  wards: string[];
  records: RecordFile[];
  generateCode: () => string;
}

function _nd(s: string): string {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const ContractForm: React.FC<ContractFormProps> = ({ initialData, onSave, onPrint, priceList, wards, records, generateCode }) => {
  const [activeTab, setActiveTab] = useState<'dd' | 'tt' | 'cm'>('dd');
  const [tachThuaItems, setTachThuaItems] = useState<SplitItem[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Contract>>({
    code: '', customerName: '', phoneNumber: '', address: '', ward: '', landPlot: '', mapSheet: '', area: 0,
    contractType: 'Đo đạc', serviceType: '', areaType: '', plotCount: 1, markerCount: 1, quantity: 1, 
    unitPrice: 0, vatRate: 8, vatAmount: 0, totalAmount: 0, deposit: 0, content: '',
    createdDate: new Date().toISOString().split('T')[0], status: 'PENDING'
  });

  useEffect(() => {
      if (initialData) {
          setFormData(initialData);
          if (initialData.splitItems) setTachThuaItems(initialData.splitItems);
          if (initialData.contractType === 'Tách thửa') setActiveTab('tt');
          else if (initialData.contractType === 'Cắm mốc') setActiveTab('cm');
          else setActiveTab('dd');
          setNotification(null);
      } else {
          setFormData(prev => ({ ...prev, code: generateCode() }));
      }
  }, [initialData]);

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
      if (activeTab === 'tt' && tachThuaItems.length === 0) setTachThuaItems([{ serviceName: '', quantity: 1, price: 0 }]);
  }, [activeTab]);

  // Price Calculation Logic
  useEffect(() => {
      // 1. Tự động xác định Khu vực (Đất đô thị / Nông thôn) dựa trên Xã/Phường
      let currentAreaType = formData.areaType;
      if (!currentAreaType && formData.ward) {
          const wardName = (formData.ward || '').toLowerCase();
          if (wardName.includes('phường') || wardName.includes('tt.') || wardName.includes('thị trấn')) {
              currentAreaType = 'Đất đô thị';
          } else {
              currentAreaType = 'Đất nông thôn';
          }
      }

      // 2. Logic Tách thửa
      if (activeTab === 'tt') {
          let totalBase = 0;
          tachThuaItems.forEach(item => {
              // Tìm giá trong bảng giá khớp với Tên sản phẩm và Khu vực
              const matchedRow = priceList.find(row => 
                  _nd(row.serviceName) === _nd(item.serviceName) && 
                  (!row.areaType || _nd(row.areaType) === _nd(currentAreaType || ''))
              );
              if (matchedRow) totalBase += (matchedRow.price * item.quantity);
          });
          const vatRate = 8; 
          const vatAmount = Math.round(totalBase * (vatRate / 100));
          setFormData(prev => ({ ...prev, unitPrice: 0, vatRate, vatAmount, totalAmount: totalBase + vatAmount, areaType: currentAreaType }));
          return;
      }

      // 3. Logic Đo đạc & Cắm mốc
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
          // Kiểm tra xem VAT là % hay số tiền cố định
          if (matchedPriceItem.vatIsPercent) {
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
      }
  }, [formData.area, formData.serviceType, formData.ward, formData.areaType, formData.plotCount, formData.markerCount, tachThuaItems, activeTab, priceList]);

  const handleSearchRecord = () => {
      const found = records.find(r => r.code.toLowerCase() === searchCode.toLowerCase());
      if (found) {
          setFormData(prev => ({ 
              ...prev, 
              code: found.code, // Nếu muốn giữ mã hợp đồng giống mã hồ sơ
              customerName: found.customerName, 
              phoneNumber: found.phoneNumber, 
              ward: found.ward, 
              address: found.address || '', 
              landPlot: found.landPlot, 
              mapSheet: found.mapSheet, 
              area: found.area || 0 
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
      const contractData = { 
          ...formData, 
          splitItems: activeTab === 'tt' ? tachThuaItems : [], 
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
        createdDate: new Date().toISOString().split('T')[0], status: 'PENDING'
      });
      setTachThuaItems([]);
      setSearchCode('');
      if (!keepNotification) setNotification(null);
  };

  const handlePrintClick = (type: 'contract' | 'liquidation') => {
      const currentData = { 
          ...formData, 
          splitItems: activeTab === 'tt' ? tachThuaItems : [], 
          serviceType: activeTab === 'tt' ? 'Đo đạc tách thửa' : formData.serviceType 
      };
      onPrint(currentData, type);
  };

  // Helper
  const handleChange = (k: keyof Contract, v: any) => setFormData(p => ({ ...p, [k]: v }));
  
  const availableServices = priceList.map(p => p.serviceName).filter((v, i, a) => a.indexOf(v) === i).filter(n => {
      if (activeTab === 'tt') return _nd(n).includes('tach thua');
      if (activeTab === 'cm') return _nd(n).includes('cam moc');
      return !_nd(n).includes('tach thua') && !_nd(n).includes('cam moc');
  });

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
                    <div><label className={labelClass}>Diện tích (m2)</label><input type="number" className={`${inputClass} font-bold text-blue-600`} value={formData.area} onChange={e => handleChange('area', parseFloat(e.target.value))} /></div>
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
                                
                                <div className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-purple-100 text-purple-800 text-xs uppercase font-bold">
                                            <tr><th className="p-3 text-left">Loại sản phẩm</th><th className="p-3 w-20 text-center">SL</th><th className="p-3 w-10"></th></tr>
                                        </thead>
                                        <tbody>
                                            {tachThuaItems.map((item, idx) => (
                                                <tr key={idx} className="border-t border-purple-50">
                                                    <td className="p-2"><select className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-sm outline-none bg-purple-50/30" value={item.serviceName} onChange={(e) => { const newItems = [...tachThuaItems]; newItems[idx].serviceName = e.target.value; setTachThuaItems(newItems); }}><option value="">-- Chọn --</option>{availableServices.map(n => <option key={n} value={n}>{n}</option>)}</select></td>
                                                    <td className="p-2"><input type="number" className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-purple-50/30" value={item.quantity} onChange={(e) => { const newItems = [...tachThuaItems]; newItems[idx].quantity = parseInt(e.target.value); setTachThuaItems(newItems); }} /></td>
                                                    <td className="p-2 text-center"><button type="button" onClick={() => setTachThuaItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 bg-red-50 p-1 rounded-md"><Trash2 size={14}/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <button type="button" onClick={() => setTachThuaItems(prev => [...prev, { serviceName: '', quantity: 1, price: 0 }])} className="w-full py-2 bg-purple-50 text-purple-600 text-xs font-bold hover:bg-purple-100 border-t border-purple-100 flex items-center justify-center gap-1 transition-colors"><Plus size={14}/> Thêm dòng</button>
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
                            <button type="button" onClick={() => handlePrintClick('contract')} className="flex-1 px-4 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 flex items-center justify-center gap-2 shadow-sm transition-all border border-indigo-200">
                                <Printer size={18} /> In Hợp đồng
                            </button>
                            <button type="button" onClick={() => handlePrintClick('liquidation')} className="flex-1 px-4 py-3 bg-white text-green-700 rounded-xl font-bold hover:bg-green-50 flex items-center justify-center gap-2 shadow-sm transition-all border border-green-200">
                                <FileCheck size={18} /> In Thanh lý
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
  );
};

export default ContractForm;
