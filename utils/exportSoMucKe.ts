import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { ArchiveRecord } from "../services/apiArchive";

export type SoMucKeTargetType = 'new_owner' | 'old_owner';

// Helper format số thập phân kiểu Việt Nam (ví dụ: 200,0 hoặc 1635,1)
const formatVNArea = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
    if (isNaN(num) || num <= 0) return '';
    return num.toFixed(1).replace('.', ',');
};

// Helper format ngày Việt Nam (DD/MM/YYYY)
const formatVNDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            const parts = dateStr.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                }
                return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
            }
            return dateStr;
        }
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr || '';
    }
};

// Helper tách tên nhiều chủ đất thành danh sách từng người (mỗi người 1 dòng)
const splitOwnerNames = (rawName: string): string[] => {
    if (!rawName) return [""];
    const str = String(rawName).trim();
    if (!str) return [""];

    // 1. Trường hợp chuỗi chứa dấu xuống dòng (\n hoặc \r\n)
    if (str.includes('\n')) {
        const lines = str.split('\n').map(s => s.trim()).filter(Boolean);
        return lines.length > 0 ? lines : [str];
    }

    // 2. Trường hợp chứa từ nối " và "
    if (/\s+và\s+/i.test(str)) {
        const parts = str.split(/\s+và\s+/i).map(s => s.trim()).filter(Boolean);
        if (parts.length > 1) {
            return parts.map((p, idx) => {
                if (idx > 0 && !p.toLowerCase().startsWith('và')) {
                    return `Và: ${p}`;
                }
                return p;
            });
        }
    }

    // 3. Trường hợp chứa dấu phẩy "," phân cách 2 tên chủ
    if (str.includes(',')) {
        const parts = str.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length > 1) {
            return parts.map((p, idx) => {
                if (idx > 0 && !p.toLowerCase().startsWith('và')) {
                    return `Và: ${p}`;
                }
                return p;
            });
        }
    }

    return [str];
};

export const exportSoMucKe = async (
    records: ArchiveRecord[], 
    wardName: string, 
    fromDate: string, 
    toDate: string,
    targetType: SoMucKeTargetType = 'new_owner'
) => {
    if (!records || records.length === 0) return;

    // Group records by tờ bản đồ
    const recordsByTo: Record<string, ArchiveRecord[]> = {};
    records.forEach(record => {
        const data = record.data || {};
        const soTo = String(data.to_ban_do || data.so_to || data.to || "ChuaXacDinh").trim();
        if (!recordsByTo[soTo]) {
            recordsByTo[soTo] = [];
        }
        recordsByTo[soTo].push(record);
    });

    if (Object.keys(recordsByTo).length === 0) {
        recordsByTo["1"] = [];
    }

    const zip = new JSZip();
    const toKeys = Object.keys(recordsByTo).sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });

    const ROWS_PER_PAGE = 56; // 56 dòng nội dung mỗi trang Excel chuẩn A3

    const FONT_FAMILY = "Times New Roman";
    
    // Header Style (Font size 10pt, Bold, Centered, Thin solid borders)
    const headerStyle = {
        font: { name: FONT_FAMILY, sz: 10, bold: true },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
        }
    };

    // Sub Header Row (1), (2)... (Font size 10pt, Centered, Thin solid borders)
    const subHeaderStyle = {
        font: { name: FONT_FAMILY, sz: 10, italic: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
        }
    };

    // Content Cell Style (Font size 12pt, Light Dotted bottom border #CCCCCC, Thin side borders)
    const createContentStyle = (align: "center" | "left" | "right" = "center", isLastRowOfPage = false) => ({
        font: { name: FONT_FAMILY, sz: 12 },
        alignment: { horizontal: align, vertical: "center", wrapText: true },
        border: {
            top: { style: "none" },
            bottom: isLastRowOfPage 
                ? { style: "thin", color: { rgb: "000000" } } 
                : { style: "dotted", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
        }
    });

    // Style cho 2 dòng trống đệm ở cuối trang (không có viền bảng)
    const emptySpacerStyle = {
        font: { name: FONT_FAMILY, sz: 12 },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "none" },
            bottom: { style: "none" },
            left: { style: "none" },
            right: { style: "none" }
        }
    };

    for (const soTo of toKeys) {
        const toRecords = recordsByTo[soTo].sort((a, b) => {
            const dataA = a.data || {};
            const dataB = b.data || {};
            const thuaA = parseInt(String(dataA.thua_dat || dataA.so_thua || dataA.thua || "0")) || 0;
            const thuaB = parseInt(String(dataB.thua_dat || dataB.so_thua || dataB.thua || "0")) || 0;
            return thuaA - thuaB;
        });

        // Xây dựng toàn bộ các dòng nội dung thửa đất với cơ chế phân trang thông minh (Smart Pagination)
        const contentRowsData: any[][] = [];
        let currentLinesOnPage = 0; // Đếm số dòng nội dung đang có trên trang hiện tại

        toRecords.forEach((record) => {
            const data = record.data || {};
            const soThua = String(data.thua_dat || data.so_thua || data.thua || "").trim();

            let rawOwnerName = "";
            if (targetType === 'old_owner') {
                rawOwnerName = String(data.chu_chuyen_quyen || data.ten_chuyen_quyen || data.chu_cu || "").trim();
                if (!rawOwnerName) {
                    rawOwnerName = String(data.chu_su_dung || data.ten_chu_su_dung || data.customer_name || "").trim();
                }
            } else {
                rawOwnerName = String(data.chu_su_dung || data.ten_chu_su_dung || data.customer_name || "").trim();
            }

            // Tách các chủ đất thành từng dòng riêng biệt
            const owners = splitOwnerNames(rawOwnerName);
            const maDoiTuong = "GDC";

            let ghiChu = "";
            if (targetType === 'old_owner') {
                const loaiHoSo = (data.loai_ho_so || data.loai_bien_dong || "chuyển nhượng").trim();
                const ngayKyStr = formatVNDate(data.ngay_ky_gcn || record.ngay_thang);
                if (ngayKyStr) {
                    ghiChu = `Đã ${loaiHoSo} ngày ${ngayKyStr}`;
                } else {
                    ghiChu = `Đã ${loaiHoSo}`;
                }
            } else {
                ghiChu = String(data.ghi_chu || "").trim();
            }

            const tongDienTich = parseFloat(String(data.dien_tich || data.tong_dien_tich || "0").replace(',', '.'));
            const dtO = parseFloat(String(data.dien_tich_ont || data.dien_tich_odt || data.dien_tich_tho_cu || "0").replace(',', '.'));
            let dtNN = parseFloat(String(data.dien_tich_cln || data.dien_tich_hnk || data.dien_tich_khac || "0").replace(',', '.'));
            
            if (dtNN <= 0 && tongDienTich > dtO && dtO > 0) {
                dtNN = tongDienTich - dtO;
            }

            const rawLoaiDat = String(data.loai_dat || data.muc_dich_su_dung || "").toUpperCase().trim();
            let loaiDatO = "ONT*";
            if (rawLoaiDat.includes("ODT")) loaiDatO = "ODT*";

            let loaiDatNN = "CLN*";
            if (rawLoaiDat.includes("HNK")) loaiDatNN = "HNK*";
            else if (rawLoaiDat.includes("LUC") || rawLoaiDat.includes("LUA")) loaiDatNN = "LUC*";
            else if (rawLoaiDat.includes("BHK")) loaiDatNN = "BHK*";

            const hasMultiLandTypes = dtO > 0 && dtNN > 0;

            const landDetails: { loaiDat: string; dienTich: string }[] = [];
            if (hasMultiLandTypes) {
                landDetails.push({ loaiDat: "", dienTich: formatVNArea(tongDienTich) });
                landDetails.push({ loaiDat: loaiDatO, dienTich: formatVNArea(dtO) });
                landDetails.push({ loaiDat: loaiDatNN, dienTich: formatVNArea(dtNN) });
            } else {
                let displayLoaiDat = rawLoaiDat ? (rawLoaiDat.endsWith('*') ? rawLoaiDat : `${rawLoaiDat}*`) : (dtO > 0 ? "ONT*" : "CLN*");
                const displayArea = formatVNArea(tongDienTich > 0 ? tongDienTich : (dtO > 0 ? dtO : dtNN));
                landDetails.push({ loaiDat: displayLoaiDat, dienTich: displayArea });
            }

            // Số dòng nội dung cần thiết cho 1 thửa đất này
            const recordRowCount = Math.max(owners.length, landDetails.length);

            // THÔNG MINH: Nếu thửa đất không vừa số dòng còn lại trên trang hiện tại, đẩy nguyên thửa sang trang mới
            const remainingOnPage = ROWS_PER_PAGE - currentLinesOnPage;
            if (recordRowCount <= ROWS_PER_PAGE && recordRowCount > remainingOnPage && currentLinesOnPage > 0) {
                for (let b = 0; b < remainingOnPage; b++) {
                    contentRowsData.push(["", "", "", "", "", "", "", "", ""]);
                }
                currentLinesOnPage = 0; // Bắt đầu trang mới
            }

            for (let k = 0; k < recordRowCount; k++) {
                contentRowsData.push([
                    k === 0 ? soTo : "",
                    k === 0 ? soThua : "",
                    owners[k] || "",
                    k === 0 ? maDoiTuong : "",
                    "",
                    "",
                    landDetails[k] ? landDetails[k].loaiDat : "",
                    landDetails[k] ? landDetails[k].dienTich : "",
                    k === 0 ? ghiChu : ""
                ]);

                currentLinesOnPage++;
                if (currentLinesOnPage === ROWS_PER_PAGE) {
                    currentLinesOnPage = 0;
                }
            }
        });

        // Bổ sung các dòng trống cho tròn trang cuối cùng (mỗi trang đúng 56 dòng nội dung)
        if (currentLinesOnPage > 0) {
            const remainingOnLastPage = ROWS_PER_PAGE - currentLinesOnPage;
            for (let i = 0; i < remainingOnLastPage; i++) {
                contentRowsData.push(["", "", "", "", "", "", "", "", ""]);
            }
        } else if (contentRowsData.length === 0) {
            for (let i = 0; i < ROWS_PER_PAGE; i++) {
                contentRowsData.push(["", "", "", "", "", "", "", "", ""]);
            }
        }

        // Tính toán tổng số trang
        const totalPages = Math.max(1, Math.ceil(contentRowsData.length / ROWS_PER_PAGE));

        // Tạo Worksheet Excel và chia từng trang có tiêu đề lặp lại (62 dòng/trang: 4 header + 56 nội dung + 2 dòng trống đệm)
        const ws: XLSX.WorkSheet = {};
        const merges: XLSX.Range[] = [];
        const rowHeights: XLSX.RowInfo[] = [];
        const pageBreakRows: { r: number; flag: number }[] = [];

        for (let p = 0; p < totalPages; p++) {
            const r_base = p * 62; // Mỗi trang gồm 4 dòng header + 56 dòng nội dung + 2 dòng trống đệm = 62 dòng

            // Thêm ngắt trang sau 62 dòng (sau 2 dòng trống đệm của trang p)
            if (p < totalPages - 1) {
                pageBreakRows.push({ r: r_base + 62, flag: 1 });
            }

            // Các ô gộp cho tiêu đề trang p
            merges.push(
                { s: { r: r_base + 0, c: 8 }, e: { r: r_base + 0, c: 8 } }, // Trang số
                { s: { r: r_base + 1, c: 0 }, e: { r: r_base + 2, c: 0 } }, // A2:A3 Tờ bản đồ
                { s: { r: r_base + 1, c: 1 }, e: { r: r_base + 2, c: 1 } }, // B2:B3 Thửa đất
                { s: { r: r_base + 1, c: 2 }, e: { r: r_base + 2, c: 2 } }, // C2:C3 Tên người sử dụng
                { s: { r: r_base + 1, c: 3 }, e: { r: r_base + 2, c: 3 } }, // D2:D3 Mã đối tượng
                { s: { r: r_base + 1, c: 4 }, e: { r: r_base + 1, c: 5 } }, // E2:F2 Hiện trạng
                { s: { r: r_base + 1, c: 6 }, e: { r: r_base + 1, c: 7 } }, // G2:H2 Giấy tờ pháp lý
                { s: { r: r_base + 1, c: 8 }, e: { r: r_base + 2, c: 8 } }  // I2:I3 Ghi chú
            );

            // Dòng 1 của trang p: Header top (Trang số) - Chiều cao 18pt
            ws[XLSX.utils.encode_cell({ r: r_base + 0, c: 8 })] = {
                v: `Trang số: ${p + 1}`,
                s: {
                    font: { name: FONT_FAMILY, sz: 10, bold: true, italic: true },
                    alignment: { horizontal: "right", vertical: "center" }
                }
            };

            // Dòng 2 của trang p: Table Header row 1 (Cỡ chữ 10pt) - Chiều cao 30pt
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 0 })] = { v: "Tờ bản\nđồ số", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 1 })] = { v: "Thửa\nđất số", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 2 })] = { v: "Tên người sử dụng, quản lý đất", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 3 })] = { v: "Mã đối tượng\nsử dụng, đối\ntượng được\ngiao quản lý\nđất", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 4 })] = { v: "Theo hiện trạng sử\ndụng đất", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 5 })] = { v: "", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 6 })] = { v: "Theo giấy tờ pháp lý\nvề quyền sử dụng đất", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 7 })] = { v: "", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 1, c: 8 })] = { v: "Ghi chú", s: headerStyle };

            // Dòng 3 của trang p: Sub Headers (Cỡ chữ 10pt) - Chiều cao 37.5pt
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 0 })] = { v: "", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 1 })] = { v: "", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 2 })] = { v: "", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 3 })] = { v: "", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 4 })] = { v: "Loại đất", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 5 })] = { v: "Diện tích\n(m2)", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 6 })] = { v: "Loại đất", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 7 })] = { v: "Diện tích\n(m2)", s: headerStyle };
            ws[XLSX.utils.encode_cell({ r: r_base + 2, c: 8 })] = { v: "", s: headerStyle };

            // Dòng 4 của trang p: Column Indices (1) đến (9) - Chiều cao 18pt
            const colIndices = ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)"];
            colIndices.forEach((val, idx) => {
                const cellRef = XLSX.utils.encode_cell({ r: r_base + 3, c: idx });
                ws[cellRef] = { v: val, s: subHeaderStyle };
            });

            // Chiều cao chuẩn khớp file mẫu
            rowHeights[r_base + 0] = { hpt: 18, hpx: 18 };
            rowHeights[r_base + 1] = { hpt: 30, hpx: 30 };
            rowHeights[r_base + 2] = { hpt: 37.5, hpx: 37.5 };
            rowHeights[r_base + 3] = { hpt: 18, hpx: 18 };

            // Render 56 dòng nội dung của trang p
            const pageRows = contentRowsData.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
            pageRows.forEach((rowValues, rowIdx) => {
                const r = r_base + 4 + rowIdx;
                const isLastRowOfPage = (rowIdx === ROWS_PER_PAGE - 1);

                rowValues.forEach((val, c) => {
                    let align: "left" | "center" | "right" = "center";
                    if (c === 2 || c === 8) align = "left";
                    if (c === 5 || c === 7) align = "right";

                    const cellRef = XLSX.utils.encode_cell({ r, c });
                    ws[cellRef] = {
                        v: val,
                        t: 's',
                        s: createContentStyle(align, isLastRowOfPage)
                    };
                });

                rowHeights[r] = { hpt: 18, hpx: 18 };
            });

            // Render 2 dòng trống đệm ở cuối trang p (không có viền bảng)
            const spacer1Row = r_base + 4 + ROWS_PER_PAGE;     // r_base + 60
            const spacer2Row = r_base + 4 + ROWS_PER_PAGE + 1; // r_base + 61

            for (let c = 0; c < 9; c++) {
                ws[XLSX.utils.encode_cell({ r: spacer1Row, c })] = { v: "", s: emptySpacerStyle };
                ws[XLSX.utils.encode_cell({ r: spacer2Row, c })] = { v: "", s: emptySpacerStyle };
            }
            rowHeights[spacer1Row] = { hpt: 18, hpx: 18 };
            rowHeights[spacer2Row] = { hpt: 18, hpx: 18 };
        }

        const totalSheetRows = totalPages * 62;
        ws['!ref'] = `A1:I${totalSheetRows}`;
        ws['!merges'] = merges;
        
        // Độ rộng cột khớp chuẩn file mẫu SMK_Q1.xls
        ws['!cols'] = [
            { wch: 10.57 }, // A: Tờ bản đồ số
            { wch: 11.43 }, // B: Thửa đất số
            { wch: 26.86 }, // C: Tên người sử dụng
            { wch: 11.71 }, // D: Mã đối tượng
            { wch: 9.86 },  // E: HT Loại đất
            { wch: 10.14 }, // F: HT Diện tích
            { wch: 8.43 },  // G: PL Loại đất
            { wch: 12.86 }, // H: PL Diện tích
            { wch: 24.14 }  // I: Ghi chú
        ];
        ws['!rows'] = rowHeights;

        // Cài đặt dấu Ngắt Trang Cứng (Explicit Page Breaks) chính xác sau 2 dòng trống đệm
        if (pageBreakRows.length > 0) {
            ws['!pagebreaks'] = { row: pageBreakRows };
        }

        // Cài đặt Header/Footer hệ thống Excel (Native Header/Footer) để khi in luôn hiện Trang số: [Trang]
        ws['!headerFooter'] = {
            oddHeader: "&R&B&ITrang số: &P",
            evenHeader: "&R&B&ITrang số: &P"
        };

        // Cấu hình lề trang in khớp chuẩn file mẫu SMK_Q1.xls
        ws['!margins'] = {
            left: 0.5,
            right: 0.5,
            top: 0.5,
            bottom: 0.5,
            header: 0.3,
            footer: 0.3
        };

        // Cấu hình trang in A3 ngang khớp chuẩn file mẫu SMK_Q1.xls
        ws['!pageSetup'] = {
            orientation: 'landscape',
            paperSize: 8, // Khổ A3 (297mm x 420mm) trong Excel
            fitToWidth: 1,
            fitToHeight: 0
        };

        // Tạo workbook Excel
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SMK");

        // Ghi workbook ra binary ArrayBuffer
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        const targetSuffix = targetType === 'old_owner' ? 'ChuCu' : 'ChuMoi';
        zip.file(`SoMucKe_To_${soTo}_${targetSuffix}.xlsx`, wbout);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const safeWardName = wardName ? wardName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'all';
    const targetSuffix = targetType === 'old_owner' ? 'ChuCu_ChuyenQuyen' : 'ChuMoi_SuDung';
    saveAs(zipBlob, `SoMucKe_${safeWardName}_${targetSuffix}_${fromDate || 'all'}_den_${toDate || 'all'}.zip`);
};
