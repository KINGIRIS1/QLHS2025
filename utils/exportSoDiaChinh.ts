import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, VerticalAlign } from "docx";
import { saveAs } from "file-saver";
import { ArchiveRecord } from "../services/apiArchive";

export const exportSoDiaChinh = async (record: ArchiveRecord) => {
    const data = record.data || {};

    // Helper to create a cell with specific text
    const createCell = (text: string, width: number, bold = false, align = AlignmentType.CENTER) => {
        return new TableCell({
            width: { size: width, type: WidthType.PERCENTAGE },
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
    if (data.muc_dich_su_dung?.toLowerCase().includes("ont") || data.muc_dich_su_dung?.toLowerCase().includes("odt")) {
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
                        width: 16535, // A3 width in twips (297mm)
                        height: 23390, // A3 height in twips (420mm)
                        orientation: "portrait",
                    },
                    margin: {
                        top: 1134, // 2cm
                        bottom: 1134,
                        left: 1701, // 3cm
                        right: 1134,
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

                // I - NGƯỜI SỬ DỤNG ĐẤT
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I - NGƯỜI SỬ DỤNG ĐẤT", bold: true, size: 22, font: "Times New Roman" })] })],
                                    columnSpan: 1,
                                    borders: {
                                        top: { style: BorderStyle.SINGLE, size: 1 },
                                        bottom: { style: BorderStyle.SINGLE, size: 1 },
                                        left: { style: BorderStyle.SINGLE, size: 1 },
                                        right: { style: BorderStyle.SINGLE, size: 1 },
                                    },
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: `Ông: ${data.chu_su_dung || ""}`, bold: true, size: 22, font: "Times New Roman" })] }),
                                        new Paragraph({ children: [new TextRun({ text: `CCCD: ${data.cccd || ""}`, size: 22, font: "Times New Roman" })] }),
                                        new Paragraph({ children: [new TextRun({ text: `Địa chỉ: ${data.dia_chi || ""}`, size: 22, font: "Times New Roman" })] }),
                                    ],
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                }),
                            ],
                            height: { value: 1500, rule: "atLeast" }, // Min height for user info
                        }),
                    ],
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // II - THỬA ĐẤT Header
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "II - THỬA ĐẤT", bold: true, size: 22, font: "Times New Roman" })] })],
                                    columnSpan: 10,
                                    borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
                                }),
                            ],
                        }),
                        // Header Row 1
                        new TableRow({
                            children: [
                                createCell("Ngày tháng năm vào sổ", 10, true),
                                createCell("Số thứ tự thửa đất", 8, true),
                                createCell("Số thứ tự tờ bản đồ", 8, true),
                                new TableCell({
                                    width: { size: 16, type: WidthType.PERCENTAGE },
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Diện tích sử dụng (m2)", bold: true, size: 22, font: "Times New Roman" })] })],
                                    columnSpan: 2,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                                createCell("Mục đích sử dụng", 10, true),
                                createCell("Thời hạn sử dụng", 10, true),
                                createCell("Nguồn gốc sử dụng", 12, true),
                                createCell("Số phát hành GCNQSDĐ", 13, true),
                                createCell("Số vào sổ cấp GCNQSDĐ", 13, true),
                            ],
                        }),
                        // Header Row 2 (Sub-headers for Area)
                        new TableRow({
                            children: [
                                createCell("1", 10),
                                createCell("2", 8),
                                createCell("3", 8),
                                createCell("Riêng", 8),
                                createCell("Chung", 8),
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
                                createCell(data.thua_dat || "", 8),
                                createCell(data.to_ban_do || "", 8),
                                createCell(data.dien_tich || "", 8),
                                createCell("", 8), // Chung (Empty for now)
                                createCell(mucDichSuDung, 10),
                                createCell("Lâu dài", 10), // Default per request/image
                                createCell("", 12), // Nguồn gốc (Empty)
                                createCell(soPhatHanh, 13),
                                createCell(soVaoSo, 13),
                            ],
                        }),
                        // Empty rows to fill space (approx 10 rows)
                        ...Array(10).fill(0).map(() => new TableRow({
                            children: Array(10).fill(0).map((_, i) => createCell("", i === 3 || i === 4 ? 8 : (i === 0 ? 10 : (i === 1 || i === 2 ? 8 : (i === 5 || i === 6 ? 10 : (i === 7 ? 12 : 13)))))),
                            height: { value: 500, rule: "atLeast" }
                        }))
                    ],
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // III - NHỮNG THAY ĐỔI
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "III - NHỮNG THAY ĐỔI TRONG QUÁ TRÌNH SỬ DỤNG ĐẤT VÀ GHI CHÚ", bold: true, size: 22, font: "Times New Roman" })] })],
                                    columnSpan: 3,
                                    borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
                                }),
                            ],
                        }),
                        // Header
                        new TableRow({
                            children: [
                                createCell("Số thứ tự thửa đất", 10, true),
                                createCell("Ngày tháng năm", 15, true),
                                createCell("Nội dung ghi chú hoặc biến động và căn cứ pháp lý", 75, true),
                            ],
                        }),
                        // Data Row
                        new TableRow({
                            children: [
                                createCell(data.thua_dat || "", 10),
                                createCell(ngayVaoSo, 15),
                                new TableCell({
                                    width: { size: 75, type: WidthType.PERCENTAGE },
                                    verticalAlign: VerticalAlign.CENTER,
                                    children: [
                                        new Paragraph({
                                            children: [new TextRun({ text: `Nhận ${data.loai_ho_so || "chuyển nhượng"} của ${data.chuyen_quyen || ""}`, size: 22, font: "Times New Roman" })],
                                            alignment: AlignmentType.LEFT,
                                        }),
                                    ],
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                }),
                            ],
                        }),
                        // Empty rows to fill space (approx 15 rows)
                        ...Array(15).fill(0).map(() => new TableRow({
                            children: [
                                createCell("", 10),
                                createCell("", 15),
                                createCell("", 75),
                            ],
                            height: { value: 500, rule: "atLeast" }
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
