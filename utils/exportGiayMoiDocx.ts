import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, Footer } from "docx";

export interface GiayMoiInviteTarget {
    id: string;
    name: string;
    address?: string;
    phone?: string;
}

export const formatInviteTargetDisplay = (target: GiayMoiInviteTarget): string => {
    if (!target) return '';
    const name = target.name || '';
    if (!target.address && !target.phone) {
        return name;
    }
    const details: string[] = [];
    if (target.address) details.push(`Địa chỉ: ${target.address}`);
    if (target.phone) details.push(`Số điện thoại: ${target.phone}`);
    
    return `${name} (${details.join(' – ')})`;
};

export const getLastNameWord = (fullName?: string): string => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1] || '';
};

export const getVietnameseDayOfWeek = (dateStr: string): string => {
    if (!dateStr) return '';
    // handle YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
            const days = ['Chủ Nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];
            return days[d.getDay()];
        }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const days = ['Chủ Nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];
    return days[d.getDay()];
};

export const formatThoiGianFull = (gioPhut?: string, dateIso?: string): string => {
    if (!dateIso) return gioPhut || '';
    const parts = dateIso.split('-');
    if (parts.length !== 3) return gioPhut || dateIso;
    
    const day = parts[2];
    const month = parts[1];
    const year = parts[0];
    const dow = getVietnameseDayOfWeek(dateIso);

    const timePart = gioPhut ? `${gioPhut}, ` : '';
    const dowPart = dow ? ` (${dow})` : '';

    return `${timePart}ngày ${day}/${month}/${year}${dowPart}`;
};

export const formatNoiDungFull = (
    noiDungLamViec?: string,
    soThua?: string,
    soTo?: string,
    chuSuDung?: string,
    diaChiThuaDat?: string
): string => {
    const parts: string[] = [];
    if (noiDungLamViec) parts.push(noiDungLamViec.trim());
    
    const landParts: string[] = [];
    if (soThua) landParts.push(`thửa đất số ${soThua.trim()}`);
    if (soTo) landParts.push(`tờ bản đồ số ${soTo.trim()}`);
    if (landParts.length > 0) parts.push(landParts.join(', '));

    if (chuSuDung) parts.push(`của ${chuSuDung.trim()}`);
    if (diaChiThuaDat) parts.push(`tại ${diaChiThuaDat.trim()}`);

    return parts.join(' ');
};

export const formatDiaDiemFull = (
    soThua?: string,
    soTo?: string,
    diaChiThuaDat?: string
): string => {
    const landParts: string[] = [];
    if (soThua) landParts.push(`thửa đất số ${soThua.trim()}`);
    if (soTo) landParts.push(`tờ bản đồ số ${soTo.trim()}`);
    
    const landStr = landParts.length > 0 ? `${landParts.join(', ')}` : '';
    const addrStr = diaChiThuaDat ? diaChiThuaDat.trim() : '';

    const combined = [landStr, addrStr].filter(Boolean).join(', ');
    if (!combined) return 'Tại thực địa.';
    return `Tại thực địa ${combined}.`;
};

export interface GiayMoiData {
    soGiayMoi: string;
    soSymbol: string;
    ngayMoi: string;
    thangMoi: string;
    namMoi: string;
    donViBanHanhCapTren: string;
    donViBanHanhCapGiua: string;
    donViBanHanh: string;
    veViec: string;
    kinhMoiList: GiayMoiInviteTarget[];
    noiDung: string;
    thoiGian: string;
    diaDiem: string;
    chuTri?: string;
    loiDeNghi: string;
    isDeNghiGiapRanh: boolean;
    textDeNghiGiapRanh: string;
    canBoTen?: string;
    canBoSdt?: string;
    ghiChuCanBo: string;
    toVietTat?: string;
    noiNhan: string[];
    nguoiKyChucVu1: string;
    nguoiKyChucVu2: string;
    nguoiKyTen: string;

    // Structured subfields
    gioPhut?: string;
    ngayThangNamIso?: string;
    noiDungLamViec?: string;
    soThua?: string;
    soTo?: string;
    chuSuDung?: string;
    diaChiThuaDat?: string;
}

export const generateGiayMoiDocx = async (data: GiayMoiData): Promise<Blob> => {
    const noBorder = {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    };

    // Theo Nghị định 30/2020/NĐ-CP về thể thức văn bản hành chính:
    // Font: Times New Roman, Unicode TCVN 6909:2001
    // Đơn vị nửa pt (half-points): 28 = 14pt, 26 = 13pt, 24 = 12pt, 22 = 11pt, 17 = 8.5pt
    const FONT_FAMILY = "Times New Roman";
    const SIZE_TITLE = 28;      // 14pt: Tên loại văn bản (GIẤY MỜI)
    const SIZE_SUBTITLE = 28;   // 14pt: Trích yếu nội dung (Về việc...)
    const SIZE_BODY = 26;       // 13pt: Nội dung chính, Số/Ký hiệu, Địa danh ngày tháng
    const SIZE_HEADER = 24;     // 12pt: Cơ quan ban hành, Quốc hiệu, Nơi nhận tiêu đề
    const SIZE_NOTE = 24;       // 12pt: Đề nghị giáp ranh, Ghi chú cán bộ
    const SIZE_RECIPIENT = 22;  // 11pt: Danh sách nơi nhận
    const SIZE_FOOTER = 17;     // 8.5pt: Thông tin chân trang

    const dateStr = `Chơn Thành, ngày ${data.ngayMoi || '...'} tháng ${data.thangMoi || '...'} năm ${data.namMoi || '2026'}`;
    const fullSo = `Số: ${data.soGiayMoi ? data.soGiayMoi : '      '}${data.soSymbol || '/GM-VPĐK.CT-TĐĐ'}`;

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1134,    // 2.0 cm (Theo NĐ 30: 20 - 25 mm)
                            bottom: 1134, // 2.0 cm (Theo NĐ 30: 20 - 25 mm)
                            left: 1701,   // 3.0 cm (Theo NĐ 30: 30 - 35 mm - Lề trái đóng sổ)
                            right: 850,   // 1.5 cm (Theo NĐ 30: 15 - 20 mm)
                        },
                    },
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.LEFT,
                                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "000000" } },
                                spacing: { before: 60, after: 20 },
                                children: [
                                    new TextRun({ 
                                        text: "Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Chơn Thành", 
                                        font: FONT_FAMILY, 
                                        size: SIZE_FOOTER,
                                        bold: true 
                                    }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.LEFT,
                                spacing: { before: 0, after: 20 },
                                children: [
                                    new TextRun({ 
                                        text: "Đc: Đường Trần Huy Liệu, kp Trung Lợi, phường Chơn Thành, thành phố Đồng Nai.", 
                                        font: FONT_FAMILY, 
                                        size: SIZE_FOOTER 
                                    }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.LEFT,
                                spacing: { before: 0, after: 0 },
                                children: [
                                    new TextRun({ 
                                        text: "Số ĐT: 027130660568", 
                                        font: FONT_FAMILY, 
                                        size: SIZE_FOOTER 
                                    }),
                                ],
                            }),
                        ],
                    }),
                },
                children: [
                    // Header Table: 2-Row structure for perfect alignment of Số and Ngày tháng
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: noBorder,
                        rows: [
                            // Row 1: Agency & National Motto
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 44, type: WidthType.PERCENTAGE },
                                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                        borders: noBorder,
                                        children: [
                                            // NĐ 30: Cơ quan cấp trên: In hoa, đứng, KHÔNG ĐẬM, cỡ 12-13
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ 
                                                        text: (data.donViBanHanhCapTren || "VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI THÀNH PHỐ ĐỒNG NAI")
                                                            .replace(/ĐẤT ĐAI/g, "ĐẤT\u00A0ĐAI")
                                                            .replace(/ĐỒNG NAI/g, "ĐỒNG\u00A0NAI"), 
                                                        font: FONT_FAMILY, 
                                                        size: SIZE_HEADER, 
                                                        bold: false 
                                                    }),
                                                ],
                                            }),
                                            ...(data.donViBanHanhCapGiua ? [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [
                                                        new TextRun({ text: data.donViBanHanhCapGiua, font: FONT_FAMILY, size: SIZE_HEADER, bold: false }),
                                                    ],
                                                })
                                            ] : []),
                                            // NĐ 30: Cơ quan ban hành trực tiếp: In hoa, đứng, ĐẬM, cỡ 12-13
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: data.donViBanHanh || "CHI NHÁNH CHƠN THÀNH", font: FONT_FAMILY, size: SIZE_HEADER, bold: true }),
                                                ],
                                            }),
                                            // Đường kẻ ngang nét liền dưới tên cơ quan (độ dài 1/3 - 1/2)
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 20, after: 40 },
                                                children: [
                                                    new TextRun({ text: "──────────", font: FONT_FAMILY, size: 16, bold: true }),
                                                ],
                                            }),
                                        ],
                                    }),
                                    new TableCell({
                                        width: { size: 56, type: WidthType.PERCENTAGE },
                                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                        borders: noBorder,
                                        children: [
                                            // NĐ 30: Quốc hiệu: In hoa, đứng, ĐẬM, cỡ 12-13
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT\u00A0NAM", font: FONT_FAMILY, size: SIZE_HEADER, bold: true }),
                                                ],
                                            }),
                                            // NĐ 30: Tiêu ngữ: In thường (chữ đầu viết hoa), đứng, ĐẬM, cỡ 13-14
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: [
                                                    new TextRun({ text: "Độc lập – Tự do – Hạnh phúc", font: FONT_FAMILY, size: SIZE_BODY, bold: true }),
                                                ],
                                            }),
                                            // Đường kẻ ngang nét liền bằng độ dài dòng chữ Tiêu ngữ
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 20, after: 40 },
                                                children: [
                                                    new TextRun({ text: "───────────────", font: FONT_FAMILY, size: 16, bold: true }),
                                                ],
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            // Row 2: Số hiệu & Ngày tháng năm (được đặt chung Row 2 để chắc chắn ngang bằng hàng)
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 44, type: WidthType.PERCENTAGE },
                                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                        borders: noBorder,
                                        children: [
                                            // NĐ 30: Số, ký hiệu: In thường/hoa, đứng, không đậm, cỡ 13
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 60, after: 0 },
                                                children: [
                                                    new TextRun({ text: fullSo, font: FONT_FAMILY, size: SIZE_BODY }),
                                                ],
                                            }),
                                        ],
                                    }),
                                    new TableCell({
                                        width: { size: 56, type: WidthType.PERCENTAGE },
                                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                        borders: noBorder,
                                        children: [
                                            // NĐ 30: Địa danh, ngày tháng: In thường, NGHIÊNG, cỡ 13-14
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 60, after: 0 },
                                                children: [
                                                    new TextRun({ text: dateStr, font: FONT_FAMILY, size: SIZE_BODY, italics: true }),
                                                ],
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),

                    // Tên loại văn bản (GIẤY MỜI): In hoa, ĐẬM, cỡ 14-15
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 280, after: 60 },
                        children: [
                            new TextRun({ text: "GIẤY MỜI", font: FONT_FAMILY, size: SIZE_TITLE, bold: true }),
                        ],
                    }),
                    // Trích yếu nội dung: In thường, ĐẬM, cỡ 13-14
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 40 },
                        children: [
                            new TextRun({ text: `Về việc ${data.veViec || '.....'}`, font: FONT_FAMILY, size: SIZE_SUBTITLE, bold: true }),
                        ],
                    }),
                    // Đường kẻ ngang nét liền dưới trích yếu nội dung (độ dài 1/3 - 1/2)
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 20, after: 200 },
                        children: [
                            new TextRun({ text: "──────────", font: FONT_FAMILY, size: 16, bold: true }),
                        ],
                    }),

                    // Intro Paragraph (Chỉ nghiêng cụm trong ngoặc đơn sau đây viết tắt...)
                    new Paragraph({
                        spacing: { before: 100, after: 100, line: 300 },
                        indent: { firstLine: 576 }, // 1.0 cm indent
                        children: [
                            new TextRun({ 
                                text: "Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Chơn Thành ", 
                                font: FONT_FAMILY, 
                                size: SIZE_BODY, 
                                italics: false 
                            }),
                            new TextRun({ 
                                text: "(sau đây viết tắt là Chi nhánh Chơn Thành) ", 
                                font: FONT_FAMILY, 
                                size: SIZE_BODY, 
                                italics: true 
                            }),
                            new TextRun({ 
                                text: "trân trọng kính mời:", 
                                font: FONT_FAMILY, 
                                size: SIZE_BODY, 
                                italics: false 
                            }),
                        ],
                    }),

                    // Invitees List
                    ...data.kinhMoiList.map((item) => new Paragraph({
                        spacing: { before: 40, after: 40, line: 300 },
                        indent: { left: 576 }, // Indent list items 1.0cm
                        children: [
                            new TextRun({ text: `- ${formatInviteTargetDisplay(item)}`, font: FONT_FAMILY, size: SIZE_BODY }),
                        ],
                    })),

                    // Nội dung: In đậm nhãn, nội dung đứng 13-14pt, thụt đầu dòng 1.0cm
                    new Paragraph({
                        spacing: { before: 140, after: 60, line: 300 },
                        indent: { firstLine: 576 }, // 1.0 cm indent
                        children: [
                            new TextRun({ text: "Nội dung: ", font: FONT_FAMILY, size: SIZE_BODY, bold: true }),
                            new TextRun({ text: data.noiDung || "...", font: FONT_FAMILY, size: SIZE_BODY }),
                        ],
                    }),

                    // Chủ trì (if entered)
                    ...(data.chuTri ? [
                        new Paragraph({
                            spacing: { before: 60, after: 60, line: 300 },
                            indent: { firstLine: 576 }, // 1.0 cm indent
                            children: [
                                new TextRun({ text: "Chủ trì: ", font: FONT_FAMILY, size: SIZE_BODY, bold: true }),
                                new TextRun({ text: data.chuTri, font: FONT_FAMILY, size: SIZE_BODY }),
                            ],
                        })
                    ] : []),

                    // Thời gian
                    new Paragraph({
                        spacing: { before: 60, after: 60, line: 300 },
                        indent: { firstLine: 576 }, // 1.0 cm indent
                        children: [
                            new TextRun({ text: "Thời gian: ", font: FONT_FAMILY, size: SIZE_BODY, bold: true }),
                            new TextRun({ text: data.thoiGian || "...", font: FONT_FAMILY, size: SIZE_BODY }),
                        ],
                    }),

                    // Địa điểm
                    new Paragraph({
                        spacing: { before: 60, after: 140, line: 300 },
                        indent: { firstLine: 576 }, // 1.0 cm indent
                        children: [
                            new TextRun({ text: "Địa điểm: ", font: FONT_FAMILY, size: SIZE_BODY, bold: true }),
                            new TextRun({ text: data.diaDiem || "...", font: FONT_FAMILY, size: SIZE_BODY }),
                        ],
                    }),

                    // Lời đề nghị / Mong muốn
                    new Paragraph({
                        spacing: { before: 120, after: 80, line: 300 },
                        indent: { firstLine: 576 }, // 1.0 cm indent
                        children: [
                            new TextRun({ text: data.loiDeNghi || "Rất mong ông(bà) đại diện các cơ quan, cá nhân nói trên quan tâm phối hợp thực hiện./.", font: FONT_FAMILY, size: SIZE_BODY }),
                        ],
                    }),

                    // Tùy chọn đề nghị chủ đất mời giáp ranh
                    ...(data.isDeNghiGiapRanh && data.textDeNghiGiapRanh ? [
                        new Paragraph({
                            spacing: { before: 60, after: 80, line: 300 },
                            indent: { firstLine: 576 }, // 1.0 cm indent
                            children: [
                                new TextRun({ text: data.textDeNghiGiapRanh, font: FONT_FAMILY, size: SIZE_NOTE, italics: true }),
                            ],
                        })
                    ] : []),

                    // Ghi chú cán bộ
                    ...(data.ghiChuCanBo ? [
                        new Paragraph({
                            spacing: { before: 80, after: 180, line: 300 },
                            indent: { firstLine: 576 }, // 1.0 cm indent
                            children: [
                                new TextRun({ text: "Ghi chú: ", font: FONT_FAMILY, size: SIZE_NOTE, bold: true, italics: true }),
                                new TextRun({ text: data.ghiChuCanBo, font: FONT_FAMILY, size: SIZE_NOTE, italics: true }),
                            ],
                        })
                    ] : []),

                    // Footer Table (Nơi nhận & Chữ ký)
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
                                            // NĐ 30: "Nơi nhận:" in thường, NGHIÊNG, ĐẬM, cỡ 12
                                            new Paragraph({
                                                spacing: { after: 40 },
                                                children: [
                                                    new TextRun({ text: "Nơi nhận:", font: FONT_FAMILY, size: SIZE_HEADER, bold: true, italics: true }),
                                                ],
                                            }),
                                            // NĐ 30: Thành phần nơi nhận in thường, đứng, cỡ 11
                                            ...data.noiNhan.map((nn) => new Paragraph({
                                                spacing: { before: 20, after: 20 },
                                                children: [
                                                    new TextRun({ text: nn, font: FONT_FAMILY, size: SIZE_RECIPIENT }),
                                                ],
                                            })),
                                        ],
                                    }),
                                    new TableCell({
                                        width: { size: 55, type: WidthType.PERCENTAGE },
                                        borders: noBorder,
                                        children: [
                                            // NĐ 30: Chức vụ: In hoa, ĐẬM, cỡ 13-14
                                            ...(data.nguoiKyChucVu1 ? [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [
                                                        new TextRun({ text: data.nguoiKyChucVu1, font: FONT_FAMILY, size: SIZE_BODY, bold: true }),
                                                    ],
                                                })
                                            ] : []),
                                            ...(data.nguoiKyChucVu2 ? [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [
                                                        new TextRun({ text: data.nguoiKyChucVu2, font: FONT_FAMILY, size: SIZE_BODY, bold: true }),
                                                    ],
                                                })
                                            ] : []),
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                spacing: { before: 1200 }, // Khoảng trống chữ ký (~3-4 dòng)
                                                children: [
                                                    new TextRun({ text: data.nguoiKyTen || "", font: FONT_FAMILY, size: SIZE_BODY, bold: true }),
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

    return await Packer.toBlob(doc);
};

