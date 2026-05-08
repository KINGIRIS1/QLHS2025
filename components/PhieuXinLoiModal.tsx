import React, { useRef, useState } from 'react';
import { RecordFile } from '../types';
import { getFullWard } from '../constants';
import { Printer, X } from 'lucide-react';
import { toTitleCase } from '../utils/appHelpers';

interface PhieuXinLoiModalProps {
    data: Partial<RecordFile>;
    receivingWard: string;
    onClose: () => void;
}

const PhieuXinLoiModal: React.FC<PhieuXinLoiModalProps> = ({ data, receivingWard, onClose }) => {
    const printRef = useRef<HTMLDivElement>(null);
    
    const formatForInput = (d: Date | null | undefined | string) => {
        if (!d) return '';
        const validDate = new Date(d);
        if (isNaN(validDate.getTime())) return '';
        return validDate.toISOString().split('T')[0];
    };

    const initialRDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
    const initialDDate = data.deadline ? new Date(data.deadline) : new Date();

    const [formState, setFormState] = useState({
        customerName: toTitleCase(data.customerName || ''),
        address: toTitleCase([data.address, getFullWard(data.ward || ''), 'thành phố Đồng Nai'].filter(Boolean).join(', ')),
        phoneNumber: data.phoneNumber || '',
        receivedDate: formatForInput(initialRDate),
        recordType: data.recordType || '',
        code: data.code || '',
        deadline: formatForInput(initialDDate),
        wardName: getFullWard(receivingWard),
        reason: 'Số lượng hồ sơ trích đo trên địa bàn tăng đột biến, dẫn đến quá tải trong công tác kiểm tra thực địa và biên tập hồ sơ kỹ thuật, chưa kịp thời xử lý đúng theo thời gian quy định.',
        newReturnDate: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        let formattedValue = value;
        if (name === 'customerName' || name === 'address') {
            formattedValue = toTitleCase(value);
        }
        setFormState(prev => ({ ...prev, [name]: formattedValue }));
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const printContent = printRef.current.innerHTML;
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const printDocument = iframe.contentWindow?.document;
        if (printDocument) {
            printDocument.open();
            printDocument.write(`
                <html>
                <head>
                    <title>In Phiếu Xin Lỗi</title>
                    <style>
                        @page { margin: 20mm; }
                        body { 
                            font-family: 'Times New Roman', Times, serif; 
                            font-size: 16px;
                            line-height: 1.5;
                            color: #000;
                            -webkit-print-color-adjust: exact;
                        }
                        .flex { display: flex; }
                        .justify-between { justify-content: space-between; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .italic { font-style: italic; }
                        .underline { text-decoration: underline; }
                        .mb-2 { margin-bottom: 8px; }
                        .mb-4 { margin-bottom: 16px; }
                        .mb-6 { margin-bottom: 24px; }
                        .mt-4 { margin-top: 16px; }
                        .mt-8 { margin-top: 32px; }
                        .text-lg { font-size: 18px; }
                        .text-xl { font-size: 20px; }
                        .indent { text-indent: 40px; }
                        .space-y-2 > * + * { margin-top: 8px; }
                        .whitespace-nowrap { white-space: nowrap; }
                        p { margin-top: 6px; margin-bottom: 6px; text-align: justify; }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
                </html>
            `);
            printDocument.close();
            
            iframe.contentWindow?.focus();
            setTimeout(() => {
                iframe.contentWindow?.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 500);
        }
    };

    const formatDateOnly = (d: Date) => {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `ngày ${day} tháng ${month} năm ${year}`;
    };

    const formatDateShort = (dateString: string) => {
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateString;
    };

    // Danh xưng
    let prefixCus = 'Ông (Bà)';
    if (formState.customerName) {
        const lowerName = formState.customerName.toLowerCase();
        if (lowerName.startsWith('bà')) prefixCus = 'Bà';
        else if (lowerName.startsWith('ông')) prefixCus = 'Ông';
        else prefixCus = 'Ông (bà)';
    }

    const shortName = formState.customerName?.replace(/^(Ông|Bà)\s+/i, '') || '...';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">Phiếu xin lỗi</h2>
                    <div className="flex space-x-2">
                        <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium tracking-wide">
                            <Printer className="w-4 h-4 mr-2" /> In Phiếu
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium cursor-pointer">
                            Đóng
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    {/* Form Edit */}
                    <div className="w-1/3 bg-gray-50 border-r border-gray-200 p-6 overflow-y-auto hidden md:block">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">✎</span>
                            Chỉnh sửa thông tin
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên chủ sử dụng</label>
                                <input name="customerName" value={formState.customerName} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Địa chỉ</label>
                                <textarea name="address" value={formState.address} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" rows={2} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Số điện thoại</label>
                                <input name="phoneNumber" value={formState.phoneNumber} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày nhận hồ sơ</label>
                                <input type="date" name="receivedDate" value={formState.receivedDate} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Loại hồ sơ (Lĩnh vực)</label>
                                <input name="recordType" value={formState.recordType} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Số biên nhận hồ sơ</label>
                                <input name="code" value={formState.code} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày hẹn trả</label>
                                <input type="date" name="deadline" value={formState.deadline} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Thời gian hẹn trả kết quả lại</label>
                                <input type="date" name="newReturnDate" value={formState.newReturnDate} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Bộ phận tiếp nhận (Xã/Phường)</label>
                                <input name="wardName" value={formState.wardName} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Lý do</label>
                                <textarea name="reason" value={formState.reason} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" rows={3} />
                            </div>
                        </div>
                    </div>

                    {/* Preview Document */}
                    <div className="w-full md:w-2/3 p-8 overflow-y-auto bg-gray-200 flex justify-center">
                        <div className="bg-white p-10 shadow-sm border border-gray-200 text-black flex-none" style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '16px', lineHeight: '1.5' }} ref={printRef}>
                            
                            {/* Header */}
                            <div className="flex justify-between mb-6">
                                <div className="text-center" style={{ width: '45%' }}>
                                    <div className="whitespace-nowrap uppercase" style={{ fontSize: '15px' }}>VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI</div>
                                    <div className="whitespace-nowrap uppercase" style={{ fontSize: '15px' }}>THÀNH PHỐ ĐỒNG NAI</div>
                                    <div className="font-bold underline uppercase" style={{ fontSize: '16px' }}>CHI NHÁNH CHƠN THÀNH</div>
                                    <div className="mt-4" style={{ fontSize: '16px' }}>
                                        Số: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/PXL
                                    </div>
                                </div>
                                <div className="text-center" style={{ width: '55%' }}>
                                    <div className="font-bold whitespace-nowrap" style={{ fontSize: '16px' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                    <div className="font-bold underline mb-2" style={{ fontSize: '16px' }}>Độc lập - Tự do - Hạnh phúc</div>
                                    <div className="italic mt-4" style={{ fontSize: '16px' }}>Chơn Thành, ngày ..... tháng .... năm 20....</div>
                                </div>
                            </div>

                            {/* Title */}
                            <div className="text-center mt-8 mb-6">
                                <div className="font-bold text-[18px]">PHIẾU XIN LỖI VÀ HẸN LẠI NGÀY TRẢ KẾT QUẢ</div>
                            </div>

                            {/* Content */}
                            <div className="text-center space-y-1 mb-6">
                                <div className="font-bold text-[16px]">Kính gửi: {formState.customerName || '...'}</div>
                                <div>(Địa chỉ: {formState.address}{formState.phoneNumber ? `, SĐT: ${formState.phoneNumber}` : ''})</div>
                            </div>

                            <div className="space-y-2">
                                <p className="indent">Ngày {formatDateShort(formState.receivedDate)}, Văn phòng Đăng ký đất đai thành phố Đồng Nai - Chi nhánh Chơn Thành (gọi tắt là Chi nhánh Chơn Thành) tiếp nhận hồ sơ thuộc lĩnh vực đất đai ({formState.recordType || '...'}) của {prefixCus.toLowerCase()} {shortName}.</p>
                                <p style={{ paddingLeft: '40px' }}>Số biên nhận hồ sơ: {formState.code}</p>
                                <p style={{ paddingLeft: '40px' }}>Ngày hẹn trả kết quả giải quyết hồ sơ: ngày {formatDateShort(formState.deadline)}</p>
                                <p className="indent">Sau khi tiếp nhận hồ sơ của {prefixCus.toLowerCase()} {shortName}, Bộ phận tiếp nhận và trả kết quả {formState.wardName} đã chuyển hồ sơ cho Chi nhánh Chơn thành xem xét, giải quyết theo quy định.</p>
                                <p className="indent">Tuy nhiên Văn phòng Đăng ký đất đai thành phố Đồng Nai- Chi nhánh Chơn Thành chưa trả kết quả giải quyết hồ sơ của {prefixCus.toLowerCase()} {shortName} đúng thời hạn quy định ghi trên Giấy tiếp nhận hồ sơ và trả kết quả / Biên nhận hồ sơ.</p>
                                <p className="indent">Lý do: {formState.reason}.</p>
                                <p className="indent">Chi nhánh Chơn Thành trân trọng gửi lời xin lỗi đến {prefixCus.toLowerCase()} {shortName}, rất mong nhận được sự thông cảm của ông, bà vì sự chậm trễ này.</p>
                                <p className="font-bold indent">Thời gian hẹn trả kết quả lại: {formState.newReturnDate ? `Ngày ${new Date(formState.newReturnDate).getDate().toString().padStart(2, '0')} tháng ${(new Date(formState.newReturnDate).getMonth() + 1).toString().padStart(2, '0')} năm ${new Date(formState.newReturnDate).getFullYear()}` : 'Ngày …… tháng …… năm 2026'}.</p>
                                <p className="indent">Trân trọng./.</p>
                            </div>

                            {/* Signatures */}
                            <div className="flex justify-between mt-8">
                                <div style={{ width: '50%' }}>
                                    <div className="font-bold text-[15px] italic mb-1">Nơi nhận:</div>
                                    <div className="text-[14px]">- Như trên;</div>
                                    <div className="text-[14px]">- TTPVHCC {formState.wardName}.</div>
                                    <div className="text-[14px]">- Lưu: VT.</div>
                                </div>
                                <div style={{ width: '50%' }} className="text-center">
                                    {(formState.wardName.toLowerCase().includes('chơn thành') || formState.wardName.toLowerCase().includes('minh hưng')) ? (
                                        <>
                                            <div className="font-bold text-[16px]">KT. GIÁM ĐỐC</div>
                                            <div className="font-bold text-[16px]">PHÓ GIÁM ĐỐC</div>
                                        </>
                                    ) : (
                                        <div className="font-bold text-[16px]">GIÁM ĐỐC</div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PhieuXinLoiModal;
