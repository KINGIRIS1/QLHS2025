import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { User } from '../../types';

interface DeleteAllModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    currentUser: User;
    title: string;
}

const DeleteAllModal: React.FC<DeleteAllModalProps> = ({ isOpen, onClose, onConfirm, currentUser, title }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setError('');
        if (!password) {
            setError('Vui lòng nhập mật khẩu');
            return;
        }

        if (password !== currentUser.password) {
            setError('Mật khẩu không chính xác');
            return;
        }

        setLoading(true);
        try {
            await onConfirm();
            setPassword('');
            onClose();
        } catch (err) {
            setError('Có lỗi xảy ra khi xóa dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-red-50">
                    <h3 className="font-bold text-red-700 flex items-center gap-2">
                        <AlertTriangle size={20} />
                        Xóa toàn bộ dữ liệu
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-sm text-gray-700 mb-4">
                        Bạn đang chuẩn bị xóa toàn bộ dữ liệu của tab <strong>{title}</strong>. Hành động này không thể hoàn tác.
                    </p>
                    <p className="text-sm text-gray-700 mb-4">
                        Vui lòng nhập mật khẩu của bạn để xác nhận:
                    </p>
                    
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Nhập mật khẩu..."
                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                        autoFocus
                    />
                    
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md font-medium text-sm"
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-bold text-sm shadow-sm flex items-center gap-2"
                        disabled={loading}
                    >
                        {loading ? <span className="animate-spin">⏳</span> : <Trash2 size={16}/>}
                        Xác nhận xóa
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteAllModal;
