import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, VerticalAlign } from "docx";

export const generateDefaultReceiptDocx = async (data: any): Promise<Blob> => {
    const noBorder = {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    };

    const getTitleCase = (str: string) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1134, // 2cm
                            right: 1134,
                            bottom: 1134,
                            left: 1701, // 3cm
                        },
                    },
                },
                children: [
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: noBorder,
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 45, type: WidthType.PERCENTAGE },
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "VĂN PHÒNG ĐKĐĐ THÀNH PHỐ ĐỒNG NAI", font: "Times New Roman", size: 26, bold: true }),
                                                ],
                                            }),
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "CHI NHÁNH CHƠN THÀNH", font: "Times New Roman", size: 26, bold: true }),
                                                ],
                                            }),
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG", font: "Times New Roman", size: 26 }),
                                                ],
                                            }),
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: `${data.DON_VI_TIEP_NHAN || data.XA || ''}`, font: "Times New Roman", size: 26, bold: true, underline: {} }),
                                                ],
                                            }),
                                        ],
                                    }),
                                    new TableCell({
                                        width: { size: 55, type: WidthType.PERCENTAGE },
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", font: "Times New Roman", size: 26, bold: true }),
                                                ],
                                            }),
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", font: "Times New Roman", size: 26, bold: true, underline: {} }),
                                                ],
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 45, type: WidthType.PERCENTAGE },
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 120 },
                                                children: [
                                                    new TextRun({ text: `Mã số hồ sơ: `, font: "Times New Roman", size: 26 }),
                                                    new TextRun({ text: `${data.MA || ''}`, font: "Times New Roman", size: 26, bold: true }),
                                                ],
                                            }),
                                        ],
                                    }),
                                    new TableCell({
                                        width: { size: 55, type: WidthType.PERCENTAGE },
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 120 },
                                                children: [
                                                    new TextRun({ text: `${data.PHUONG ? getTitleCase(data.PHUONG.replace(/^(PHƯỜNG|XÃ|THỊ TRẤN)\s+/i, '')) : ''}, ngày ${data.NGAY || '...'} tháng ${data.THANG || '...'} năm ${data.NAM || '...'}`, font: "Times New Roman", size: 26 }),
                                                ],
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400, after: 300 },
                        children: [
                            new TextRun({ text: "GIẤY TIẾP NHẬN HỒ SƠ VÀ HẸN TRẢ KẾT QUẢ", font: "Times New Roman", size: 28, bold: true }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: "Tiếp nhận hồ sơ của ông/bà: ", font: "Times New Roman", size: 26, bold: true }),
                            new TextRun({ text: `${data.TEN || ''}`, font: "Times New Roman", size: 26, bold: true }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Số điện thoại: ${data.SDT || ''}`, font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Thửa đất số: ${data.THUA || ''}`, font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Tờ bản đồ số: ${data.TO || ''}`, font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Diện tích: ${data.DT || ''}m`, font: "Times New Roman", size: 26 }),
                            new TextRun({ text: "2", font: "Times New Roman", size: 26, superScript: true }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Địa chỉ thửa đất: ${data.DIA_CHI_CHI_TIET ? data.DIA_CHI_CHI_TIET + ' - ' : ''}${data.DIA_CHI || ''}`, font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { before: 80, after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: "Nội dung yêu cầu giải quyết: ", font: "Times New Roman", size: 26, bold: true }),
                            new TextRun({ text: `${data.LOAI_HS ? data.LOAI_HS + ' - ' : ''}${data.NOI_DUNG || ''}`, font: "Times New Roman", size: 26, bold: true }),
                        ],
                    }),
                    ...((data.LOAI_HS && (data.LOAI_HS.includes('Hiến đất') || data.LOAI_HS.includes('hiến đất') || data.LOAI_HS.includes('hien dat'))) ? [
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [ new TextRun({ text: "1. Giấy chứng nhận (gốc)", font: "Times New Roman", size: 26 }) ],
                        }),
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [ new TextRun({ text: "2. Hợp đồng tặng cho quyền sử dụng đất", font: "Times New Roman", size: 26 }) ],
                        }),
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [ new TextRun({ text: "3. Đơn đăng ký biến động", font: "Times New Roman", size: 26 }) ],
                        }),
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [ new TextRun({ text: "4. Phiếu đo đạc chỉnh lý thửa đất", font: "Times New Roman", size: 26 }) ],
                        }),
                        ...(data.GIAY_TO_KHAC ? [
                            new Paragraph({
                                spacing: { after: 80 },
                                indent: { left: 360 },
                                children: [ new TextRun({ text: `5. Giấy tờ khác: ${data.GIAY_TO_KHAC}`, font: "Times New Roman", size: 26 }) ],
                            })
                        ] : []),
                        ...(data.NGUOI_UY_QUYEN ? [
                            new Paragraph({
                                spacing: { after: 80 },
                                indent: { left: 360 },
                                children: [ new TextRun({ text: `${data.GIAY_TO_KHAC ? '6' : '5'}. Giấy tờ ủy quyền: ${data.NGUOI_UY_QUYEN}${data.LOAI_UY_QUYEN ? ` (${data.LOAI_UY_QUYEN})` : ''}`, font: "Times New Roman", size: 26 }) ],
                            })
                        ] : [])
                    ] : (data.LOAI_HS && (data.LOAI_HS.includes('thẩm định') || data.LOAI_HS.includes('Thẩm định') || data.LOAI_HS.includes('Kiểm tra, thẩm định'))) ? [
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [
                                new TextRun({ text: "1. Giấy chứng nhận (photo)", font: "Times New Roman", size: 26 }),
                            ],
                        }),
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [
                                new TextRun({ text: "2. Mảnh trích đo bản đồ địa chính", font: "Times New Roman", size: 26 }),
                            ],
                        }),
                        ...(data.GIAY_TO_KHAC ? [
                            new Paragraph({
                                spacing: { after: 80 },
                                indent: { left: 360 },
                                children: [
                                    new TextRun({ text: `3. Giấy tờ khác: ${data.GIAY_TO_KHAC}`, font: "Times New Roman", size: 26 }),
                                ],
                            })
                        ] : []),
                        ...(data.NGUOI_UY_QUYEN ? [
                            new Paragraph({
                                spacing: { after: 80 },
                                indent: { left: 360 },
                                children: [
                                    new TextRun({ text: `${data.GIAY_TO_KHAC ? '4' : '3'}. Giấy tờ ủy quyền: ${data.NGUOI_UY_QUYEN}${data.LOAI_UY_QUYEN ? ` (${data.LOAI_UY_QUYEN})` : ''}`, font: "Times New Roman", size: 26 }),
                                ],
                            })
                        ] : [])
                    ] : (data.LOAI_HS && (data.LOAI_HS.includes('Thu hồi Giấy chứng nhận') || data.LOAI_HS.includes('Thu hồi GCN'))) ? [
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [
                                new TextRun({ text: "1. Giấy chứng nhận bản gốc", font: "Times New Roman", size: 26 }),
                            ],
                        }),
                        ...(data.NGUOI_UY_QUYEN ? [
                            new Paragraph({
                                spacing: { after: 80 },
                                indent: { left: 360 },
                                children: [
                                    new TextRun({ text: `2. Hợp đồng ủy quyền (Giấy ủy quyền): ${data.NGUOI_UY_QUYEN || ''}${data.LOAI_UY_QUYEN ? ` (${data.LOAI_UY_QUYEN})` : ''}`, font: "Times New Roman", size: 26 }),
                                ],
                            })
                        ] : []),
                        ...(data.GIAY_TO_KHAC ? [
                            new Paragraph({
                                spacing: { after: 80 },
                                indent: { left: 360 },
                                children: [
                                    new TextRun({ text: `${data.NGUOI_UY_QUYEN ? '3' : '2'}. Giấy tờ kèm theo: ${data.GIAY_TO_KHAC || ''}`, font: "Times New Roman", size: 26 }),
                                ],
                            })
                        ] : [])
                    ] : [
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [
                                new TextRun({ text: `1. ${data.TP1 || ''}`, font: "Times New Roman", size: 26 }),
                            ],
                        }),
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [
                                new TextRun({ text: "2. Giấy chứng nhận quyền sử dụng đất bản sao (Photo)", font: "Times New Roman", size: 26 }),
                            ],
                        }),
                        new Paragraph({
                            spacing: { after: 80 },
                            indent: { left: 360 },
                            children: [
                                new TextRun({ text: `3. Hợp đồng ủy quyền - ${data.NGUOI_UY_QUYEN || ''}`, font: "Times New Roman", size: 26 }),
                            ],
                        }),
                        ...(data.GIAY_TO_KHAC ? [
                            new Paragraph({
                                spacing: { after: 80 },
                                indent: { left: 360 },
                                children: [
                                    new TextRun({ text: `4. ${data.GIAY_TO_KHAC || ''}`, font: "Times New Roman", size: 26 }),
                                ],
                            })
                        ] : [])
                    ]),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: "Số lượng hồ sơ:.......1....(bộ)", font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Thời gian giải quyết hồ sơ theo quy định là: `, font: "Times New Roman", size: 26 }),
                            new TextRun({ text: `${data.SO_NGAY || ''}`, font: "Times New Roman", size: 26, bold: true }),
                            new TextRun({ text: ` ngày làm việc`, font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Thời gian nhận hồ sơ: ngày `, font: "Times New Roman", size: 26 }),
                            new TextRun({ text: `${data.NGAY_NHAN || ''}`, font: "Times New Roman", size: 26, bold: true }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Thời gian hẹn trả kết quả giải quyết hồ sơ: ngày `, font: "Times New Roman", size: 26 }),
                            new TextRun({ text: `${data.NGAY_HEN || ''}`, font: "Times New Roman", size: 26, bold: true }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Nhận kết quả tại: ${data.NHAN_KET_QUA_TAI || ''}`, font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: "Vào Sổ theo dõi hồ sơ, Quyển số:.............Số thứ tự.........", font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Số điện thoại liên hệ: ${data.SDTLH || ''}`, font: "Times New Roman", size: 26 }),
                        ],
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: noBorder,
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 50, type: WidthType.PERCENTAGE },
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 300 },
                                                children: [
                                                    new TextRun({ text: "NGƯỜI NỘP HỒ SƠ", font: "Times New Roman", size: 26, bold: true }),
                                                ],
                                            }),
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "(Ký và ghi rõ họ tên)", font: "Times New Roman", size: 26, italics: true }),
                                                ],
                                            }),
                                        ],
                                    }),
                                    new TableCell({
                                        width: { size: 50, type: WidthType.PERCENTAGE },
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 300 },
                                                children: [
                                                    new TextRun({ text: "NGƯỜI TIẾP NHẬN HỒ SƠ", font: "Times New Roman", size: 26, bold: true }),
                                                ],
                                            }),
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "(Ký và ghi rõ họ tên)", font: "Times New Roman", size: 26, italics: true }),
                                                ],
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            },
        ],
    });

    return Packer.toBlob(doc);
};
