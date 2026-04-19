import React, { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';

export interface ReturnOption {
    value: string;
    label: string;
}

interface ReturnReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, targetStatus: string) => void;
    targetOptions?: ReturnOption[];
    defaultTargetStatus?: string;
}

const ReturnReasonModal: React.FC<ReturnReasonModalProps> = ({ isOpen, onClose, onConfirm, targetOptions, defaultTargetStatus }) => {
    const [reason, setReason] = useState('');
    const [selectedTarget, setSelectedTarget] = useState(defaultTargetStatus || '');

    useEffect(() => {
        if (isOpen) {
            setReason('');
            setSelectedTarget(defaultTargetStatus || (targetOptions?.[0]?.value || ''));
        }
    }, [isOpen, defaultTargetStatus, targetOptions]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <ArrowLeft className="text-red-500" size={20} />
                        Trả về bước trước
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    {targetOptions && targetOptions.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Trả về trạng thái / bước <span className="text-red-500">*</span>
                            </label>
                            <select 
                                value={selectedTarget}
                                onChange={e => setSelectedTarget(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                            >
                                <option value="" disabled>--- Chọn bước cần trả về ---</option>
                                {targetOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nội dung / Lý do trả về <span className="text-red-500">*</span>
                        </label>
                        <textarea 
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all"
                            rows={4}
                            placeholder="Nhập lý do trả về để người xử lý trước đó có thể nắm thông tin..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={() => {
                            if (!reason.trim()) {
                                alert("Vui lòng nhập lý do trả về");
                                return;
                            }
                            if (targetOptions && targetOptions.length > 0 && !selectedTarget) {
                                alert("Vui lòng chọn bước cần trả về");
                                return;
                            }
                            onConfirm(reason.trim(), selectedTarget);
                        }}
                        disabled={!reason.trim() || (targetOptions && targetOptions.length > 0 && !selectedTarget)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <ArrowLeft size={16} /> Xác nhận Trả về
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReturnReasonModal;
