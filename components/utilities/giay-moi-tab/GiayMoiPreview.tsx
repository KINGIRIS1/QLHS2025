import React from 'react';
import { ExternalLink, Loader2, Download, Copy, Check } from 'lucide-react';
import { GiayMoiData, formatInviteTargetDisplay } from '../../../utils/exportGiayMoiDocx';

interface GiayMoiPreviewProps {
    data: GiayMoiData;
    exportedFilePath: string | null;
    handleOpenFile: () => void;
    handleExport: () => void;
    loading: boolean;
}

const GiayMoiPreview: React.FC<GiayMoiPreviewProps> = ({
    data,
    exportedFilePath,
    handleOpenFile,
    handleExport,
    loading
}) => {
    const [copied, setCopied] = React.useState(false);

    const fullSo = `Số: ${data.soGiayMoi ? data.soGiayMoi : '      '}${data.soSymbol || '/GM-VPĐK.CT-TĐĐ'}`;
    const dateStr = `Chơn Thành, ngày ${data.ngayMoi || '...'} tháng ${data.thangMoi || '...'} năm ${data.namMoi || '2026'}`;

    const handleCopyText = () => {
        const inviteesText = data.kinhMoiList.map(item => `  - ${formatInviteTargetDisplay(item)}`).join('\n');
        const noiNhanText = data.noiNhan.map(nn => `  ${nn}`).join('\n');

        const fullText = `
${data.donViBanHanhCapTren || 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI'}         CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
${data.donViBanHanh || 'CHI NHÁNH CHƠN THÀNH'}                  Độc lập – Tự do – Hạnh phúc
${fullSo}                                  ${dateStr}

                                GIẤY MỜI
                   Về việc ${data.veViec}

Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Chơn Thành (sau đây viết tắt là Chi nhánh Chơn Thành) trân trọng kính mời:
${inviteesText}

Nội dung: ${data.noiDung}
${data.chuTri ? `Chủ trì: ${data.chuTri}\n` : ''}Thời gian: ${data.thoiGian}
Địa điểm: ${data.diaDiem}

${data.loiDeNghi}
${data.isDeNghiGiapRanh ? `${data.textDeNghiGiapRanh}\n` : ''}${data.ghiChuCanBo ? `Ghi chú: ${data.ghiChuCanBo}\n` : ''}
Nơi nhận:                                         ${data.nguoiKyChucVu1 || 'KT. GIÁM ĐỐC'}
${noiNhanText}                                    ${data.nguoiKyChucVu2 || 'PHÓ GIÁM ĐỐC'}
`;

        navigator.clipboard.writeText(fullText.trim()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="hidden lg:flex flex-col flex-1 bg-slate-200 relative min-w-0 h-full border-l border-slate-300">
            {/* TOOLBAR */}
            <div className="bg-white border-b border-slate-200 p-2 px-4 flex justify-between items-center shrink-0 z-20 shadow-xs">
                <div className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    Mẫu Giấy mời chuẩn A4 (Nghị định 30/2020/NĐ-CP)
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopyText}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="Sao chép nội dung văn bản"
                    >
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        {copied ? 'Đã chép' : 'Sao chép văn bản'}
                    </button>

                    {exportedFilePath && (
                        <button
                            onClick={handleOpenFile}
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 animate-bounce transition-colors"
                            title="Mở tệp vừa xuất"
                        >
                            <ExternalLink size={14} /> Mở tệp
                        </button>
                    )}

                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
                        title="Xuất Mẫu Giấy mời ra tệp Word .docx"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} Xuất File Word (.docx)
                    </button>
                </div>
            </div>

            {/* A4 PAPER PREVIEW AREA */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-8 flex flex-col items-center custom-scrollbar">
                <div 
                    id="giay-moi-print-area"
                    className="bg-white w-[210mm] min-h-[297mm] shadow-[0_10px_30px_rgba(0,0,0,0.15)] p-[20mm_15mm_20mm_30mm] transition-all relative ring-1 ring-slate-300 mb-20 flex flex-col shrink-0 text-[#000000]"
                    style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '13pt', lineHeight: '1.35' }}
                >
                    {/* Header Table: Structure into 2 rows for perfect alignment of Số and Ngày tháng */}
                    <table className="w-full mb-3 border-collapse" style={{ border: 'none' }}>
                        <tbody>
                            <tr>
                                <td className="w-[44%] align-bottom text-center p-0" style={{ border: 'none' }}>
                                    {/* NĐ 30: Cơ quan cấp trên: In hoa, đứng, KHÔNG ĐẬM, cỡ 12pt */}
                                    <div className="font-normal text-[12pt] uppercase leading-tight">
                                        {(data.donViBanHanhCapTren || 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI THÀNH PHỐ ĐỒNG NAI')
                                            .replace(/ĐẤT ĐAI/g, "ĐẤT\u00A0ĐAI")
                                            .replace(/ĐỒNG NAI/g, "ĐỒNG\u00A0NAI")}
                                    </div>
                                    {data.donViBanHanhCapGiua && (
                                        <div className="font-normal text-[12pt] uppercase leading-tight">
                                            {data.donViBanHanhCapGiua}
                                        </div>
                                    )}
                                    {/* NĐ 30: Cơ quan ban hành trực tiếp: In hoa, đứng, ĐẬM, cỡ 12pt */}
                                    <div className="font-bold text-[12pt] uppercase leading-tight mt-0.5">
                                        {data.donViBanHanh || 'CHI NHÁNH CHƠN THÀNH'}
                                    </div>
                                    <div className="w-16 border-b border-black mx-auto my-1"></div>
                                </td>
                                <td className="w-[56%] align-bottom text-center p-0" style={{ border: 'none' }}>
                                    {/* NĐ 30: Quốc hiệu: In hoa, đứng, ĐẬM, cỡ 12pt */}
                                    <div className="font-bold text-[12pt] uppercase leading-tight">
                                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT{"\u00A0"}NAM
                                    </div>
                                    {/* NĐ 30: Tiêu ngữ: In thường (chữ đầu viết hoa), đứng, ĐẬM, cỡ 13pt */}
                                    <div className="font-bold text-[13pt] leading-tight mt-0.5">
                                        Độc lập – Tự do – Hạnh phúc
                                    </div>
                                    <div className="w-36 border-b border-black mx-auto my-1"></div>
                                </td>
                            </tr>
                            <tr>
                                <td className="w-[44%] align-top text-center p-0 pt-1" style={{ border: 'none' }}>
                                    {/* NĐ 30: Số/ký hiệu: cỡ 13pt, đứng */}
                                    <div className="text-[13pt]">
                                        {fullSo}
                                    </div>
                                </td>
                                <td className="w-[56%] align-top text-center p-0 pt-1" style={{ border: 'none' }}>
                                    {/* NĐ 30: Địa danh, ngày tháng: In thường, NGHIÊNG, cỡ 13pt */}
                                    <div className="italic text-[13pt]">
                                        {dateStr}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Title */}
                    <div className="text-center my-4">
                        {/* NĐ 30: Tên loại văn bản: In hoa, ĐẬM, cỡ 14pt */}
                        <div className="font-bold text-[14pt] uppercase tracking-wide">
                            GIẤY MỜI
                        </div>
                        {/* NĐ 30: Trích yếu: In thường, ĐẬM, cỡ 14pt */}
                        <div className="font-bold text-[14pt] mt-1">
                            Về việc {data.veViec || '.....'}
                        </div>
                        <div className="w-20 border-b border-black mx-auto my-1"></div>
                    </div>

                    {/* Body intro */}
                    <div className="mt-2 mb-2 leading-relaxed text-justify" style={{ textIndent: '1cm' }}>
                        <span>Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Chơn Thành </span>
                        <span className="italic">(sau đây viết tắt là Chi nhánh Chơn Thành) </span>
                        <span>trân trọng kính mời:</span>
                    </div>

                    {/* Invitees List */}
                    <div className="mb-3 space-y-1 pl-8">
                        {data.kinhMoiList.length > 0 ? (
                            data.kinhMoiList.map((target) => (
                                <div key={target.id} className="leading-relaxed">
                                    - {formatInviteTargetDisplay(target)}
                                </div>
                            ))
                        ) : (
                            <div className="italic text-slate-400">- (Chưa nhập danh sách thành phần kính mời)</div>
                        )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 my-3">
                        <div className="leading-relaxed text-justify" style={{ textIndent: '1cm' }}>
                            <strong className="font-bold">Nội dung: </strong>
                            <span>{data.noiDung || '....................................................................................'}</span>
                        </div>

                        {data.chuTri && (
                            <div className="leading-relaxed text-justify" style={{ textIndent: '1cm' }}>
                                <strong className="font-bold">Chủ trì: </strong>
                                <span>{data.chuTri}</span>
                            </div>
                        )}

                        <div className="leading-relaxed text-justify" style={{ textIndent: '1cm' }}>
                            <strong className="font-bold">Thời gian: </strong>
                            <span>{data.thoiGian || '....................................................................................'}</span>
                        </div>

                        <div className="leading-relaxed text-justify" style={{ textIndent: '1cm' }}>
                            <strong className="font-bold">Địa điểm: </strong>
                            <span>{data.diaDiem || '....................................................................................'}</span>
                        </div>
                    </div>

                    {/* Lời đề nghị */}
                    <div className="my-3 leading-relaxed text-justify" style={{ textIndent: '1cm' }}>
                        {data.loiDeNghi || 'Rất mong ông(bà) đại diện các cơ quan, cá nhân nói trên quan tâm phối hợp thực hiện./.'}
                    </div>

                    {/* Đề nghị giáp ranh */}
                    {data.isDeNghiGiapRanh && data.textDeNghiGiapRanh && (
                        <div className="my-2 italic leading-relaxed text-justify text-[12pt]" style={{ textIndent: '1cm' }}>
                            {data.textDeNghiGiapRanh}
                        </div>
                    )}

                    {/* Ghi chú cán bộ */}
                    {data.ghiChuCanBo && (
                        <div className="mt-2 mb-4 italic leading-relaxed text-justify text-[12pt]" style={{ textIndent: '1cm' }}>
                            <strong className="font-bold not-italic">Ghi chú: </strong>
                            <span>{data.ghiChuCanBo}</span>
                        </div>
                    )}

                    {/* Footer Table */}
                    <div className="mt-auto pt-4">
                        <table className="w-full border-collapse" style={{ border: 'none' }}>
                            <tbody>
                                <tr>
                                    <td className="w-[45%] align-top p-0 text-left" style={{ border: 'none' }}>
                                        {/* NĐ 30: Nơi nhận: cỡ 12pt, nghiêng đậm */}
                                        <div className="font-bold italic text-[12pt] mb-1">
                                            Nơi nhận:
                                        </div>
                                        {/* NĐ 30: Thành phần nơi nhận: cỡ 11pt, đứng */}
                                        <div className="text-[11pt] space-y-0.5">
                                            {data.noiNhan.map((nn, idx) => (
                                                <div key={idx}>{nn}</div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="w-[55%] align-top p-0 text-center" style={{ border: 'none' }}>
                                        {/* NĐ 30: Chức vụ: cỡ 13pt, in hoa đậm */}
                                        {data.nguoiKyChucVu1 && (
                                            <div className="font-bold uppercase text-[13pt] leading-tight">
                                                {data.nguoiKyChucVu1}
                                            </div>
                                        )}
                                        {data.nguoiKyChucVu2 && (
                                            <div className="font-bold uppercase text-[13pt] leading-tight">
                                                {data.nguoiKyChucVu2}
                                            </div>
                                        )}
                                        <div className="h-24"></div> {/* Space for signature */}
                                        {data.nguoiKyTen && (
                                            <div className="font-bold text-[13pt]">
                                                {data.nguoiKyTen}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Document Bottom Footer Line & Address Info */}
                        <div className="border-t border-black pt-1.5 mt-6 text-[8.5pt] leading-tight text-slate-900">
                            <div className="font-bold">Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Chơn Thành</div>
                            <div>Đc: Đường Trần Huy Liệu, kp Trung Lợi, phường Chơn Thành, thành phố Đồng Nai.</div>
                            <div>Số ĐT: 027130660568</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GiayMoiPreview;
