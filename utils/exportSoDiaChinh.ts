import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, VerticalAlign } from "docx";
import { saveAs } from "file-saver";
import { ArchiveRecord } from "../services/apiArchive";

export const exportSoDiaChinh = async (record: ArchiveRecord) => {
    const data = record.data || {};

    // Helper to create a cell with specific text
    const createCell = (text: string, width: number, bold = false, align = AlignmentType.CENTER, colSpan = 1, rowSpan = 1) => {
        return new TableCell({
            width: { size: width, type: WidthType.PERCENTAGE },
            columnSpan: colSpan,
            rowSpan: rowSpan,
            verticalAlign: VerticalAlign.CENTER,
            children: [
                new Paragraph({
                    alignment: align,
                    children: [new TextRun({ text, bold, size: 22, font: "Times New Roman" })], // Size 22 = 11pt
                }),
            ],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
        });
    };

    // Parse date
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const ngayVaoSo = formatDate(data.ngay_nhan);
    const soPhatHanh = data.so_phat_hanh || "";
    const soVaoSo = data.so_vao_so || "";
    
    // Determine land use purpose
    let mucDichSuDung = "";
    if (data.dien_tich_tho_cu && parseFloat(data.dien_tich_tho_cu) > 0) {
        mucDichSuDung = "ODT+CLN";
    } else {
        mucDichSuDung = "CLN";
    }

    // Create the document
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    size: {
                        width: 16838, // A3 width in twips (297mm)
                        height: 23811, // A3 height in twips (420mm)
                        orientation: "portrait",
                    },
                    margin: {
                        top: 567, // 1cm
                        bottom: 567, // 1cm
                        left: 1701, // 3cm
                        right: 1134, // 2cm
                    },
                },
            },
            children: [
                // Header: Page number placeholder
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({ text: "(Tiếp theo trang số: ............)", size: 22, font: "Times New Roman" }),
                        new TextRun({ text: "\t\t\t\t\t\t\t\t", size: 22 }), // Tabs for spacing
                        new TextRun({ text: "Trang số: ............", size: 22, font: "Times New Roman" }),
                    ],
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Combined Table for all parts
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        // I - NGƯỜI SỬ DỤNG ĐẤT
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I - NGƯỜI SỬ DỤNG ĐẤT", bold: true, size: 22, font: "Times New Roman" })] })],
                                    columnSpan: 10,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                            ],
                            height: { value: 600, rule: "atLeast" }
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: `Ông: ${data.ten_chu_su_dung || record.noi_nhan_gui || ""}`, bold: true, size: 22, font: "Times New Roman" })] }),
                                        new Paragraph({ children: [new TextRun({ text: `CCCD: ${data.cccd || ""}`, size: 22, font: "Times New Roman" })] }),
                                        new Paragraph({ children: [new TextRun({ text: `Địa chỉ: ${data.dia_chi || ""}`, size: 22, font: "Times New Roman" })] }),
                                    ],
                                    columnSpan: 10,
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                }),
                            ],
                            height: { value: 1500, rule: "atLeast" }, // Min height for user info
                        }),

                        // II - THỬA ĐẤT Header
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "II - THỬA ĐẤT", bold: true, size: 22, font: "Times New Roman" })] })],
                                    columnSpan: 10,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                            ],
                            height: { value: 600, rule: "atLeast" }
                        }),
                        // Header Row 1
                        new TableRow({
                            children: [
                                createCell("Ngày tháng năm vào sổ", 10, true, AlignmentType.CENTER, 1, 2),
                                createCell("Số thứ tự thửa đất", 8, true, AlignmentType.CENTER, 1, 2),
                                createCell("Số thứ tự tờ bản đồ", 8, true, AlignmentType.CENTER, 1, 2),
                                new TableCell({
                                    width: { size: 16, type: WidthType.PERCENTAGE },
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Diện tích sử dụng (m2)", bold: true, size: 22, font: "Times New Roman" })] })],
                                    columnSpan: 2,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                                createCell("Mục đích sử dụng", 10, true, AlignmentType.CENTER, 1, 2),
                                createCell("Thời hạn sử dụng", 10, true, AlignmentType.CENTER, 1, 2),
                                createCell("Nguồn gốc sử dụng", 12, true, AlignmentType.CENTER, 1, 2),
                                createCell("Số phát hành GCNQSDĐ", 13, true, AlignmentType.CENTER, 1, 2),
                                createCell("Số vào sổ cấp GCNQSDĐ", 13, true, AlignmentType.CENTER, 1, 2),
                            ],
                        }),
                        // Header Row 2 (Sub-headers for Area)
                        new TableRow({
                            children: [
                                createCell("Riêng", 8),
                                createCell("Chung", 8),
                            ],
                        }),
                        // Header Row 3 (Numbers)
                        new TableRow({
                            children: [
                                createCell("1", 10),
                                createCell("2", 8),
                                createCell("3", 8),
                                createCell("4", 8),
                                createCell("5", 8),
                                createCell("6", 10),
                                createCell("7", 10),
                                createCell("8", 12),
                                createCell("9", 13),
                                createCell("10", 13),
                            ],
                        }),
                        // Data Row
                        new TableRow({
                            children: [
                                createCell(ngayVaoSo, 10),
                                createCell(data.so_thua || "", 8),
                                createCell(data.so_to || "", 8),
                                createCell(data.tong_dien_tich || "", 8),
                                createCell("", 8), // Chung (Empty for now)
                                createCell(mucDichSuDung, 10),
                                createCell("Lâu dài", 10), // Default per request/image
                                createCell("", 12), // Nguồn gốc (Empty)
                                createCell(soPhatHanh, 13),
                                createCell(soVaoSo, 13),
                            ],
                            height: { value: 385, rule: "exact" }
                        }),
                        // Empty rows to fill space (14 rows to make it 15 total)
                        ...Array(14).fill(0).map(() => new TableRow({
                            children: Array(10).fill(0).map((_, i) => createCell("", i === 3 || i === 4 ? 8 : (i === 0 ? 10 : (i === 1 || i === 2 ? 8 : (i === 5 || i === 6 ? 10 : (i === 7 ? 12 : 13)))))),
                            height: { value: 385, rule: "exact" }
                        })),

                        // III - NHỮNG THAY ĐỔI
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "III - NHỮNG THAY ĐỔI TRONG QUÁ TRÌNH SỬ DỤNG ĐẤT VÀ GHI CHÚ", bold: true, size: 22, font: "Times New Roman" })] })],
                                    columnSpan: 10,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                            ],
                            height: { value: 600, rule: "atLeast" }
                        }),
                        // Header
                        new TableRow({
                            children: [
                                createCell("Số thứ tự thửa đất", 10, true, AlignmentType.CENTER, 1),
                                createCell("Ngày tháng năm", 16, true, AlignmentType.CENTER, 2),
                                createCell("Nội dung ghi chú hoặc biến động và căn cứ pháp lý", 74, true, AlignmentType.CENTER, 7),
                            ],
                        }),
                        // Data Row
                        new TableRow({
                            children: [
                                createCell(data.so_thua || "", 10, false, AlignmentType.CENTER, 1),
                                createCell(ngayVaoSo, 16, false, AlignmentType.CENTER, 2),
                                new TableCell({
                                    width: { size: 74, type: WidthType.PERCENTAGE },
                                    columnSpan: 7,
                                    verticalAlign: VerticalAlign.CENTER,
                                    children: [
                                        new Paragraph({
                                            children: [new TextRun({ text: `Nhận ${data.loai_ho_so || "chuyển nhượng"} của ${data.ten_chuyen_quyen || ""}`, size: 22, font: "Times New Roman" })],
                                            alignment: AlignmentType.LEFT,
                                        }),
                                    ],
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                }),
                            ],
                            height: { value: 380, rule: "exact" }
                        }),
                        // Empty rows to fill space (19 rows to make it 20 total)
                        ...Array(19).fill(0).map(() => new TableRow({
                            children: [
                                createCell("", 10, false, AlignmentType.CENTER, 1),
                                createCell("", 16, false, AlignmentType.CENTER, 2),
                                createCell("", 74, false, AlignmentType.CENTER, 7),
                            ],
                            height: { value: 380, rule: "exact" }
                        }))
                    ],
                }),
                
                // Footer
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 400 },
                    children: [
                        new TextRun({ text: "Chuyển tiếp trang số: ............", size: 22, font: "Times New Roman" }),
                    ],
                }),
            ],
        }],
    });

    // Generate and save
    Packer.toBlob(doc).then((blob) => {
        saveAs(blob, `SoDiaChinh_${data.so_vao_so || "new"}.docx`);
    });
};
