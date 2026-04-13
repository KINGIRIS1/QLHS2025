import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save, Plus, Trash2, Download } from 'lucide-react';
import { ArchiveRecord } from '../../services/apiArchive';
import { getSystemSetting, saveSystemSetting } from '../../services/apiSystem';

interface MortgageModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: ArchiveRecord | null;
    onSave: (recordId: string, mortgages: any[]) => Promise<void>;
}

const MortgageModal: React.FC<MortgageModalProps> = ({ isOpen, onClose, record, onSave }) => {
    const [mortgages, setMortgages] = useState<any[]>([]);
    const [banks, setBanks] = useState<string[]>([]);
    const [showBankConfig, setShowBankConfig] = useState(false);
    const [newBank, setNewBank] = useState('');
    const [loading, setLoading] = useState(false);

    // Form states for new mortgage
    const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);
    const [mBank, setMBank] = useState('');
    const [mNumber, setMNumber] = useState('');

    // Form states for remove mortgage
    const [rDate, setRDate] = useState(new Date().toISOString().split('T')[0]);
    const [rBank, setRBank] = useState('');
    const [rNumber, setRNumber] = useState('');

    useEffect(() => {
        if (isOpen && record) {
            setMortgages(record.data?.mortgages || []);
            loadBanks();
        }
    }, [isOpen, record]);

    const loadBanks = async () => {
        const banksStr = await getSystemSetting('mortgage_banks');
        if (banksStr) {
            try {
                setBanks(JSON.parse(banksStr));
            } catch (e) {
                setBanks([]);
            }
        }
    };

    const saveBanks = async (newBanks: string[]) => {
        await saveSystemSetting('mortgage_banks', JSON.stringify(newBanks));
        setBanks(newBanks);
    };

    const handleAddBank = async () => {
        if (newBank.trim() && !banks.includes(newBank.trim())) {
            await saveBanks([...banks, newBank.trim()]);
            setNewBank('');
        }
    };

    const handleRemoveBank = async (bank: string) => {
        await saveBanks(banks.filter(b => b !== bank));
    };

    const handleAddMortgage = async () => {
        if (!mBank || !mNumber || !mDate) {
            alert("Vui lòng nhập đủ thông tin thế chấp");
            return;
        }
        const newMortgage = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'mortgage',
            date: mDate,
            bank: mBank,
            number: mNumber
        };
        const updated = [...mortgages, newMortgage];
        setMortgages(updated);
        setMDate(new Date().toISOString().split('T')[0]);
        setMNumber('');
        
        setLoading(true);
        await onSave(record!.id, updated);
        setLoading(false);
    };

    const handleRemoveMortgage = async () => {
        if (!rBank || !rNumber || !rDate) {
            alert("Vui lòng nhập đủ thông tin xóa thế chấp");
            return;
        }
        const newRemoveMortgage = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'remove_mortgage',
            date: rDate,
            bank: rBank,
            number: rNumber
        };
        const updated = [...mortgages, newRemoveMortgage];
        setMortgages(updated);
        setRDate(new Date().toISOString().split('T')[0]);
        setRNumber('');
        
        setLoading(true);
        await onSave(record!.id, updated);
        setLoading(false);
    };

    const handleDeleteItem = async (id: string) => {
        if (confirm("Bạn có chắc muốn xóa bản ghi này?")) {
            const updated = mortgages.filter(m => m.id !== id);
            setMortgages(updated);
            setLoading(true);
            await onSave(record!.id, updated);
            setLoading(false);
        }
    };

    const handleLoadActiveMortgage = (m: any) => {
        setRBank(m.bank);
        // The prompt says "các nội dung tải xuống gồm Ngân hàng, Số xóa thế chấp"
        // It might mean we load the bank and the mortgage number, but let's just load the bank and let them input the remove number.
        // Or maybe load the mortgage number as well? Let's load both.
        setRNumber(m.number);
    };

    if (!isOpen || !record) return null;

    const activeMortgages = mortgages.filter(m => m.type === 'mortgage');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b bg-yellow-50 rounded-t-xl">
                    <h3 className="font-bold text-lg text-yellow-800 flex items-center gap-2">
                        <DollarSign size={20} /> Quản lý Giao dịch bảo đảm - {record.so_hieu}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Input Forms */}
                    <div className="space-y-6">
                        {/* Mortgage Form */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <span className="bg-yellow-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                                Giao dịch bảo đảm
                            </h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Ngày thế chấp</label>
                                    <input type="date" value={mDate} onChange={e => setMDate(e.target.value)} className="w-full border rounded p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1 flex justify-between">
                                        Ngân hàng
                                        <button onClick={() => setShowBankConfig(!showBankConfig)} className="text-blue-600 hover:underline text-xs">Thiết lập ngân hàng</button>
                                    </label>
                                    <select value={mBank} onChange={e => setMBank(e.target.value)} className="w-full border rounded p-2 text-sm">
                                        <option value="">-- Chọn ngân hàng --</option>
                                        {banks.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Số thế chấp</label>
                                    <input type="text" value={mNumber} onChange={e => setMNumber(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Nhập số thế chấp..." />
                                </div>
                                <button onClick={handleAddMortgage} disabled={loading} className="w-full bg-yellow-600 text-white py-2 rounded font-medium hover:bg-yellow-700 disabled:opacity-50">
                                    Thêm Giao dịch bảo đảm
                                </button>
                            </div>
                        </div>

                        {/* Remove Mortgage Form */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <span className="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                                Xóa thế chấp
                            </h4>
                            <div className="space-y-3">
                                {activeMortgages.length > 0 && (
                                    <div className="mb-2">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Tải nội dung thế chấp đang có:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {activeMortgages.map(m => (
                                                <button key={m.id} onClick={() => handleLoadActiveMortgage(m)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1">
                                                    <Download size={12} /> {m.bank} ({m.number})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Ngày xóa thế chấp</label>
                                    <input type="date" value={rDate} onChange={e => setRDate(e.target.value)} className="w-full border rounded p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Ngân hàng</label>
                                    <select value={rBank} onChange={e => setRBank(e.target.value)} className="w-full border rounded p-2 text-sm">
                                        <option value="">-- Chọn ngân hàng --</option>
                                        {banks.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Số xóa thế chấp</label>
                                    <input type="text" value={rNumber} onChange={e => setRNumber(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Nhập số xóa thế chấp..." />
                                </div>
                                <button onClick={handleRemoveMortgage} disabled={loading} className="w-full bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50">
                                    Thêm Xóa thế chấp
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: History & Config */}
                    <div className="flex flex-col gap-4">
                        {showBankConfig && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 animate-fade-in">
                                <h4 className="font-bold text-blue-800 mb-2 text-sm">Cấu hình Ngân hàng</h4>
                                <div className="flex gap-2 mb-3">
                                    <input type="text" value={newBank} onChange={e => setNewBank(e.target.value)} className="flex-1 border rounded p-1.5 text-sm" placeholder="Tên ngân hàng..." />
                                    <button onClick={handleAddBank} className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700"><Plus size={16}/></button>
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {banks.map(b => (
                                        <div key={b} className="flex justify-between items-center bg-white px-2 py-1 rounded border text-sm">
                                            <span>{b}</span>
                                            <button onClick={() => handleRemoveBank(b)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1 flex flex-col">
                            <h4 className="font-bold text-gray-700 mb-3 border-b pb-2">Lịch sử Giao dịch bảo đảm / Xóa thế chấp</h4>
                            <div className="flex-1 overflow-y-auto space-y-3">
                                {mortgages.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic text-center py-4">Chưa có dữ liệu</p>
                                ) : (
                                    mortgages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(m => (
                                        <div key={m.id} className={`p-3 rounded border relative ${m.type === 'mortgage' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                                            <button onClick={() => handleDeleteItem(m.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                                                <X size={16} />
                                            </button>
                                            <div className="font-bold text-sm mb-1">
                                                {m.type === 'mortgage' ? 'Giao dịch bảo đảm' : 'Xóa thế chấp'}
                                            </div>
                                            <div className="text-xs text-gray-600 space-y-1">
                                                <p><span className="font-medium">Ngày:</span> {m.date.split('-').reverse().join('/')}</p>
                                                <p><span className="font-medium">Ngân hàng:</span> {m.bank}</p>
                                                <p><span className="font-medium">Số:</span> {m.number}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MortgageModal;
