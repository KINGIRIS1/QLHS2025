
import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { saveAs } from 'file-saver';

interface DocxPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docxBlob: Blob | null;
  fileName: string;
}

const DocxPreviewModal: React.FC<DocxPreviewModalProps> = ({ isOpen, onClose, docxBlob, fileName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && docxBlob && containerRef.current) {
        setLoading(true);
        // Dọn dẹp nội dung cũ trước khi render mới để tránh xung đột DOM
        containerRef.current.innerHTML = '';
        
        // Sử dụng docx-preview để render blob vào div
        renderAsync(docxBlob, containerRef.current, undefined, {
            inWrapper: false, // Không thêm wrapper mặc định để dễ style
            ignoreWidth: false,
            experimental: true
        })
        .then(() => setLoading(false))
        .catch((err) => {
            console.error(err);
            setLoading(false);
            if (containerRef.current) {
                containerRef.current.innerHTML = `<div class="text-red-500 p-4 text-center">Lỗi hiển thị xem trước. Vui lòng tải về để xem.<br/><span class="text-xs text-gray-500">${err.message}</span></div>`;
            }
        });
    }
  }, [isOpen, docxBlob]);

  if (!isOpen) return null;

  // --- CƠ CHẾ IN MỚI: IFRAME ISOLATION ---
  // Tạo một trang web con ẩn, bơm nội dung vào đó rồi in
  // Đảm bảo máy in nhận được dữ liệu sạch, không bị ảnh hưởng bởi CSS của App
  const handlePrint = () => {
      if (!containerRef.current) return;

      // 1. Tạo một iframe ẩn
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      // 2. Lấy nội dung HTML từ vùng xem trước
      const content = containerRef.current.innerHTML;

      // 3. Viết nội dung vào iframe
      const doc = iframe.contentWindow?.document;
      if (doc) {
          doc.open();
          doc.write(`
              <html>
                  <head>
                      <title>${fileName}</title>
                      <style>
                          /* CSS Reset CHUẨN A4 cho in ấn */
                          @page { 
                              size: A4 portrait; /* Bắt buộc khổ A4 dọc */
                              margin: 10mm 15mm 10mm 20mm; /* Lề in: Trên - Phải - Dưới - Trái (Đã nới rộng để vừa nội dung) */
                          }
                          
                          html, body { 
                              width: 100%;
                              height: 100%;
                              margin: 0; 
                              padding: 0;
                              background: white;
                              font-family: "Times New Roman", serif; 
                              font-size: 13pt; 
                              color: #000;
                              -webkit-print-color-adjust: exact;
                              line-height: 1.3;
                          }

                          /* Cấu hình hiển thị nội dung từ docx-preview */
                          .docx-wrapper { 
                              background: white !important; 
                              padding: 0 !important; 
                              margin: 0 !important; 
                          }
                          
                          /* Thẻ section đại diện cho 1 trang giấy trong thư viện */
                          section { 
                              width: 100% !important; /* Tự động co giãn theo khổ giấy */
                              margin: 0 auto !important; 
                              padding: 0 !important; /* Padding đã được xử lý bởi @page */
                              box-shadow: none !important; 
                              box-sizing: border-box;
                              overflow: visible;
                              page-break-after: always;
                          }
                          
                          /* Đảm bảo ảnh và bảng hiển thị đúng */
                          img { max-width: 100%; height: auto; }
                          table { width: 100% !important; border-collapse: collapse; }
                          
                          /* --- XỬ LÝ PHẦN GIAO NHẬN (BẢNG KÝ TÊN) --- */
                          /* Giả định bảng ký tên là bảng cuối cùng trong văn bản */
                          table:last-of-type {
                              margin-top: 20px;
                              width: 100% !important;
                          }
                          
                          /* Ẩn đường viền cho bảng cuối cùng (Giao nhận) */
                          table:last-of-type td, table:last-of-type th {
                              border: none !important;
                              padding: 5px;
                              vertical-align: top;
                          }

                          /* Căn đều 2 bên cho bảng ký tên */
                          table:last-of-type td {
                              width: 50% !important; /* Chia đôi cột */
                              text-align: center !important; /* Căn giữa nội dung trong cột */
                          }

                          /* Ẩn phần tử thừa */
                          section:last-child { page-break-after: auto; }
                      </style>
                  </head>
                  <body>
                      ${content}
                  </body>
              </html>
          `);
          doc.close();

          // 4. Đợi iframe load xong tài nguyên (nếu có ảnh) rồi gọi lệnh in
          iframe.contentWindow?.focus();
          // setTimeout để đảm bảo render hoàn tất
          setTimeout(() => {
              iframe.contentWindow?.print();
              // 5. Dọn dẹp iframe sau khi in (đợi 1 chút để lệnh in được gửi đi)
              setTimeout(() => {
                  document.body.removeChild(iframe);
              }, 1000);
          }, 500);
      }
  };

  const handleDownload = () => {
      if (docxBlob) {
          saveAs(docxBlob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 shrink-0">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                Xem trước văn bản: <span className="text-blue-600">{fileName}</span>
            </h2>
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors"
                >
                    <Download size={18} /> Tải về
                </button>
                <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm transition-colors shadow-sm"
                >
                    <Printer size={18} /> In ngay
                </button>
                <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-full text-gray-500 hover:text-red-600 transition-colors">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-200 p-8 text-center relative">
            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-blue-600 mb-2" size={40} />
                    <p className="text-gray-500 font-medium">Đang tạo bản xem trước...</p>
                </div>
            )}

            {/* Container hiển thị trên UI */}
            <div 
                ref={containerRef} 
                className="bg-white shadow-lg mx-auto min-h-[1000px] p-12 text-left transition-opacity duration-300 docx-viewer-container"
                style={{ width: '210mm', opacity: loading ? 0 : 1 }} 
            />
        </div>
        
        {/* Footer Hint */}
        <div className="p-2 text-center text-xs text-gray-500 bg-gray-100 border-t shrink-0">
            Lưu ý: Chế độ "In ngay" đã được tối ưu hóa khổ giấy A4 và tự động ẩn khung bảng chữ ký.
        </div>
      </div>
    </div>
  );
};

export default DocxPreviewModal;
