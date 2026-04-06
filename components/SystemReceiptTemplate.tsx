import React, { useRef } from 'react';
import { RecordFile } from '../types';
import { getFullWard } from '../constants';
import { Printer } from 'lucide-react';

interface SystemReceiptTemplateProps {
    data: Partial<RecordFile>;
    receivingWard: string;
    onClose: () => void;
}

const SystemReceiptTemplate: React.FC<SystemReceiptTemplateProps> = ({ data, receivingWard, onClose }) => {
    const printRef = useRef<HTMLDivElement>(null);

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
                    <title>In Biên Nhận</title>
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
                        .indent { padding-left: 40px; }
                        .space-y-2 > * + * { margin-top: 8px; }
                        .whitespace-nowrap { white-space: nowrap; }
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

    const rDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
    const dDate = data.deadline ? new Date(data.deadline) : new Date();

    const formatDateOnly = (d: Date) => {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `ngày ${day} tháng ${month} năm ${year}`;
    };

    const formatDateShort = (d: Date) => {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const wardName = getFullWard(receivingWard);
    const wardNameNoPrefix = wardName.replace(/^(Phường|Xã|Thị trấn)\s+/i, '');

    const getTitleCase = (str: string) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const type = (data.recordType || '').toLowerCase();
    let standardDays = "30"; 
    if (type.includes('trích lục')) {
        standardDays = "10";
    } else if (type.includes('trích đo chỉnh lý')) {
        standardDays = "15"; 
    } else if (type.includes('trích đo') || type.includes('đo đạc') || type.includes('cắm mốc')) {
        standardDays = "30";
    }

    let tp1Value = 'Phiếu yêu cầu';
    if (type.includes('chỉnh lý') || type.includes('trích đo') || type.includes('trích lục')) {
        tp1Value = `Phiếu yêu cầu trích lục, trích đo`;
    } 
    else if (type.includes('đo đạc') || type.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }

    let sdtLienHe = "";
    const wRaw = (data.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) {
        sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    } else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) {
        sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    } else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) {
        sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">In Biên Nhận (Mẫu Hệ Thống)</h2>
                    <div className="flex space-x-2">
                        <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            <Printer className="w-4 h-4 mr-2" /> In Biên Nhận
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                            Đóng
                        </button>
                    </div>
                </div>
                
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50">
                    <div className="bg-white p-10 shadow-sm border border-gray-200 mx-auto text-black" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '16px', lineHeight: '1.5' }} ref={printRef}>
                        
                        {/* Header */}
                        <div className="flex justify-between mb-6">
                            <div className="text-center" style={{ width: '48%' }}>
                                <div className="font-bold" style={{ fontSize: '16px' }}>VĂN PHÒNG ĐKĐĐ TỈNH ĐỒNG NAI</div>
                                <div className="font-bold" style={{ fontSize: '16px' }}>CHI NHÁNH CHƠN THÀNH</div>
                                <div className="whitespace-nowrap" style={{ fontSize: '15px' }}>TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG</div>
                                <div className="font-bold underline" style={{ fontSize: '16px' }}>{wardName.toUpperCase()}</div>
                                
                                <div className="mt-4" style={{ fontSize: '16px' }}>
                                    Mã số hồ sơ: <span className="font-bold">{data.code}</span>
                                </div>
                            </div>
                            <div className="text-center" style={{ width: '52%' }}>
                                <div className="font-bold whitespace-nowrap" style={{ fontSize: '16px' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                <div className="font-bold underline mb-2" style={{ fontSize: '16px' }}>Độc lập - Tự do - Hạnh phúc</div>
                                <div className="italic mt-4" style={{ fontSize: '16px' }}>{getTitleCase(wardNameNoPrefix)}, {formatDateOnly(new Date())}</div>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mt-8 mb-6">
                            <div className="font-bold text-[18px]">GIẤY TIẾP NHẬN HỒ SƠ VÀ HẸN TRẢ KẾT QUẢ</div>
                        </div>

                        {/* Content */}
                        <div className="space-y-2 indent">
                            <div><span className="font-bold">Tiếp nhận hồ sơ của ông/bà: </span><span className="font-bold">{data.customerName}</span></div>
                            <div>Số điện thoại: {data.phoneNumber}</div>
                            <div>Thửa đất số: {data.landPlot}</div>
                            <div>Tờ bản đồ số: {data.mapSheet}</div>
                            <div>Diện tích: {data.area}m<sup>2</sup></div>
                            <div>Địa chỉ thửa đất: {data.address ? data.address + ' - ' : ''}{getFullWard(data.ward || '')}</div>
                            <div className="mt-2 mb-2"><span className="font-bold">Nội dung yêu cầu giải quyết: </span><span className="font-bold">{data.recordType ? `${data.recordType} - ` : ''}{data.content}</span></div>
                            
                            <div>1. {tp1Value}</div>
                            <div>2. Giấy chứng nhận quyền sử dụng đất bản sao (Photo)</div>
                            <div>3. Hợp đồng ủy quyền - {data.authorizedBy?.toUpperCase()}</div>
                            <div>4. </div>
                            <div>Số lượng hồ sơ:.......1....(bộ)</div>
                            <div>Thời gian giải quyết hồ sơ theo quy định là: <span className="font-bold">{standardDays}</span> ngày làm việc</div>
                            <div>Thời gian nhận hồ sơ: ngày <span className="font-bold">{formatDateShort(rDate)}</span></div>
                            <div>Thời gian hẹn trả kết quả giải quyết hồ sơ: ngày <span className="font-bold">{formatDateShort(dDate)}</span></div>
                            <div>Nhận kết quả tại: Trung tâm Phục vụ Hành chính công {getTitleCase(wardNameNoPrefix)}</div>
                            <div>Vào Sổ theo dõi hồ sơ, Quyển số:.............Số thứ tự.........</div>
                            <div>Số điện thoại liên hệ: {sdtLienHe}</div>
                        </div>

                        {/* Signatures */}
                        <div className="flex justify-between mt-8 text-center">
                            <div style={{ width: '48%' }}>
                                <div className="font-bold text-[16px]">NGƯỜI NỘP HỒ SƠ</div>
                                <div className="italic text-[16px]">(Ký và ghi rõ họ tên)</div>
                            </div>
                            <div style={{ width: '52%' }}>
                                <div className="font-bold text-[16px]">NGƯỜI TIẾP NHẬN HỒ SƠ</div>
                                <div className="italic text-[16px]">(Ký và ghi rõ họ tên)</div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemReceiptTemplate;
