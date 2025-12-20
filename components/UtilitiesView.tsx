
import React, { useState, useEffect } from 'react';
import { 
  Loader2, User, ClipboardList, 
  MoveHorizontal, CheckCircle, LandPlot, 
  Download, Plus, Trash2, FileText, Map as MapIcon,
  AlertCircle, CheckSquare, Square, Quote, Settings2, ExternalLink
} from 'lucide-react';
import saveAs from 'file-saver';
import { User as UserType } from '../types';
import CungCapThongTinTab from './utilities/CungCapThongTinTab';

interface BoundaryChange {
  id: string;
  direction: 'Bắc' | 'Đông' | 'Nam' | 'Tây';
  type: 'tăng' | 'giảm';
  area: string;
  adjacentPlot: string;
  mapSheet: string;
  objectName: string;
  roadNumber?: string; 
}

interface UtilitiesViewProps {
    currentUser: UserType;
}

const DIRECTIONS = ['Bắc', 'Đông', 'Nam', 'Tây'];
const WARDS_QUICK = [
    { label: 'xã Nha Bích', value: 'xã Nha Bích' },
    { label: 'phường Chơn Thành', value: 'phường Chơn Thành' },
    { label: 'phường Minh Hưng', value: 'phường Minh Hưng' }
];

const ADJACENT_OBJECTS = [
    "Thửa đất số",
    "Đường",
    "Đường nhựa",
    "Đường bê tông",
    "Đường đất",
    "Sông",
    "Suối",
    "Mương nước",
    "Cống"
];

const PRESETS = {
    ROAD: "Do mép đường theo hiện trạng có thay đổi so với GCN đã cấp (hiện trạng là đường đất và được công nhận theo kết quả đo đạc bản đồ địa chính năm 2024)",
    ERROR: "Ranh giới thửa đất có biến động so với GCNQSD đất do khi đo đạc cấp GCNQSD đất chưa chính xác"
};

const UtilitiesView: React.FC<UtilitiesViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'bienban' | 'thongtin'>('bienban');
  
  // --- STATE CỦA SOẠN BIÊN BẢN ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    GIO_LAP: new Date().getHours().toString().padStart(2, '0'),
    PHUT_LAP: new Date().getMinutes().toString().padStart(2, '0'),
    NGAY_LAP: new Date().getDate().toString().padStart(2, '0'),
    THANG_LAP: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    NAM_LAP: new Date().getFullYear().toString(),
    HO: 'Ông', TEN_CHU: '', DIA_CHI_CHU: '',
    SO_THUA_MOI: '', SO_TO_106: '', SO_TO_MOI: '', DIA_CHI_THUA: '', PHUONG: 'phường Chơn Thành',
    SO_GCN: '', SO_VAO_SO: '', DV_CAP_GCN: 'Sở Tài nguyên và Môi trường', NGAY_CAP: '',
    SO_THUA_CU: '', SO_TO_CU: '', 
    DT_CU: '0', DT_ODT: '0', DT_CLN: '0',
    HIEN_TRANG: 'Đất trống', LOAI_COC: 'Cọc bê tông', DT_MOI: '0',
    HO_GIAP_RANH: '...................................................................',
    NGUYEN_NHAN_TEXT: '', 
    HIEN_THI_Y_KIEN_GIAP_RANH: true,
    HIEN_THI_PHONG_KT: false,
    HIEN_THI_CAU_LUU_Y: true 
  });

  const [boundaryChanges, setBoundaryChanges] = useState<BoundaryChange[]>([]);

  // LOGIC KIỂM TRA KHỚP DIỆN TÍCH
  const checkAreaMismatch = () => {
      // 1. Tính tổng chênh lệch chung (Mới - Cũ)
      const dtCu = parseFloat(formData.DT_CU) || 0;
      const dtMoi = parseFloat(formData.DT_MOI) || 0;
      const totalDiff = dtMoi - dtCu;

      // 2. Tính tổng đại số các dòng chi tiết
      let detailsSum = 0;
      let hasDetailArea = false;

      boundaryChanges.forEach(row => {
          const areaVal = parseFloat(row.area);
          if (!isNaN(areaVal) && areaVal > 0) {
              hasDetailArea = true;
              if (row.type === 'tăng') {
                  detailsSum += areaVal;
              } else {
                  detailsSum -= areaVal;
              }
          }
      });

      // 3. So sánh (Dùng sai số nhỏ 0.1 để tránh lỗi float của JS)
      // Chỉ cảnh báo nếu CÓ nhập diện tích chi tiết và bị lệch
      if (hasDetailArea && Math.abs(totalDiff - detailsSum) > 0.1) {
          return true;
      }
      return false;
  };

  const isAreaMismatch = checkAreaMismatch();

  useEffect(() => {
    const total = parseFloat(formData.DT_CU) || 0;
    const odt = parseFloat(formData.DT_ODT) || 0;
    const cln = Math.max(0, total - odt).toFixed(1);
    setFormData(prev => ({ ...prev, DT_CLN: cln }));
  }, [formData.DT_CU, formData.DT_ODT]);

  const addBoundaryRow = () => {
    const newRow: BoundaryChange = {
      id: Math.random().toString(36).substr(2, 9),
      direction: 'Bắc',
      type: 'tăng',
      area: '',
      adjacentPlot: '',
      mapSheet: '',
      objectName: 'Thửa đất số',
      roadNumber: ''
    };
    setBoundaryChanges([...boundaryChanges, newRow]);
    setExportedFilePath(null);
  };

  const removeBoundaryRow = (id: string) => {
    setBoundaryChanges(boundaryChanges.filter(row => row.id !== id));
    setExportedFilePath(null);
  };

  const updateBoundaryRow = (id: string, field: keyof BoundaryChange, value: any) => {
    setBoundaryChanges(boundaryChanges.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
    setExportedFilePath(null);
  };

  const applyPreset = (text: string) => {
      setFormData(prev => ({
          ...prev,
          NGUYEN_NHAN_TEXT: prev.NGUYEN_NHAN_TEXT ? prev.NGUYEN_NHAN_TEXT + " và " + text.toLowerCase() : text
      }));
      setExportedFilePath(null);
  };

  const formatAreaLabel = (val: string) => {
    const num = parseFloat(val) || 0;
    return num.toFixed(1).replace('.', ',') + ' m²';
  };

  const generateContent = (isForWord: boolean = false) => {
    // Hàm chuyển đổi Title Case (Viết Hoa Chữ Cái Đầu)
    const toTitleCase = (str: string) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const dtCu = parseFloat(formData.DT_CU) || 0;
    const dtMoi = parseFloat(formData.DT_MOI) || 0;
    const absDiff = Math.abs(dtMoi - dtCu).toFixed(1).replace('.', ',');
    
    // CHUẨN THỤT LỀ TAB: 1.27cm = 35.4pt
    const indentStyle = isForWord ? "text-indent: 35.4pt;" : "text-indent: 48px;";

    let diffMainText = "";
    if (dtMoi > dtCu) diffMainText = `tăng ${absDiff} m² so với GCN`;
    else if (dtMoi < dtCu) diffMainText = `giảm ${absDiff} m² so với GCN`;
    else diffMainText = "khớp với GCN";

    const boundaryHtml = boundaryChanges.map(row => {
      let detailText = "";
      const areaText = row.area ? `, diện tích thửa đất ${row.type} <b>${row.area.replace('.', ',')} m²</b> so với GCN` : "";
      const effectiveMapSheet = row.mapSheet || formData.SO_TO_106 || formData.SO_TO_MOI || '...';

      let displayObjectName = row.objectName;
      if (row.objectName === 'Đường' && row.roadNumber) {
          const roadVal = row.roadNumber.trim();
          displayObjectName = /^\d+$/.test(roadVal) ? `Đường số ${roadVal}` : `Đường ${roadVal}`;
      }

      const isPhysicalObject = ['đường', 'sông', 'suối', 'mương', 'cống'].some(k => displayObjectName.toLowerCase().includes(k));

      if (isPhysicalObject) {
          detailText = `Ranh giới thửa đất có biến động <b>${row.type}</b> về phía <b>${row.direction}</b> giáp ranh với <b>${displayObjectName}</b>${areaText}.`;
      } else {
          detailText = `Biến động <b>${row.type}</b> về phía <b>${row.direction}</b> giáp ranh <b>${displayObjectName} ${row.adjacentPlot}</b> tờ bản đồ số <b>${effectiveMapSheet}</b>${areaText}.`;
      }

      return `<p style="${indentStyle} margin-bottom: 3px;">- ${detailText}</p>`;
    }).join('');

    const toBanDoMoTa = formData.SO_TO_106 || formData.SO_TO_MOI || '...';

    const nguyenNhanSection = formData.NGUYEN_NHAN_TEXT 
        ? `
        <p style="${indentStyle} margin-bottom: 0px; margin-top: 5px;"><b>Nguyên nhân:</b></p>
        <p style="${indentStyle} margin-bottom: 8px; margin-top: 0px;">${formData.NGUYEN_NHAN_TEXT}.</p>
        ` 
        : "";

    const camKetNghiaVu = dtMoi > dtCu 
      ? `<p style="${indentStyle} margin-top: 8px;"><b>Cam kết thực hiện đầy đủ nghĩa vụ tài chính theo quy định.</b></p>` 
      : "";
    
    const diffClause = dtCu !== dtMoi 
      ? `<p style="${indentStyle} margin-top: 10px;">“Đối với phần diện tích ${dtMoi > dtCu ? 'tăng' : 'giảm'} ${absDiff} m² không phải do chuyển nhượng, tặng cho.”</p>` 
      : "";

    const yKienGiapRanhText = formData.HIEN_THI_Y_KIEN_GIAP_RANH 
      ? `
        <p style="${indentStyle} margin-bottom: 5px; margin-top: 12px;"><b>Ý kiến của các chủ sử dụng đất liên ranh:</b></p>
        <p style="${indentStyle} margin-bottom: 5px;">Ranh giới, mốc giới được xác định theo hiện trạng ${formData.LOAI_COC}. Cam kết không tranh chấp, khiếu nại.</p>
        ${dtCu !== dtMoi ? `<p style="${indentStyle} margin-bottom: 5px;">Đối với phần diện tích ${dtMoi > dtCu ? 'tăng' : 'giảm'} ${absDiff} m² thửa đất của ${formData.HO} ${toTitleCase(formData.TEN_CHU)} không phải do chuyển nhượng, tặng cho.</p>` : ""}
      ` : "";

    // PHẦN Ý KIẾN PHÒNG KINH TẾ (5 DÒNG CHẤM)
    const yKienPhongKTText = formData.HIEN_THI_PHONG_KT
      ? `
        <p style="${indentStyle} margin-bottom: 5px; margin-top: 15px;"><b>Ý kiến của đại diện Phòng Kinh tế - Hạ tầng và Đô thị:</b></p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
      ` : "";

    const formattedNgayCap = formData.NGAY_CAP ? formData.NGAY_CAP.split('-').reverse().join('/') : '...';
    
    const dtOdtNum = parseFloat(formData.DT_ODT) || 0;
    const phuongLower = formData.PHUONG.toLowerCase();
    let areaBreakdown = "";
    if (dtOdtNum > 0) {
        let odtType = (phuongLower.includes("minh hưng") || phuongLower.includes("chơn thành")) ? "Đất ở tại đô thị" : "Đất ở tại nông thôn";
        areaBreakdown = `(trong đó: ${odtType}: ${formatAreaLabel(formData.DT_ODT)}; Đất nông nghiệp: ${formatAreaLabel(formData.DT_CLN)})`;
    } else {
        areaBreakdown = `(trong đó: Đất nông nghiệp: ${formatAreaLabel(formData.DT_CLN)})`;
    }

    // MỤC II: PHÒNG KINH TẾ (IN ĐẬM, TITLE CASE)
    const phongKTSection = formData.HIEN_THI_PHONG_KT 
      ? `
        <p style="margin-bottom: 5px;"><b>II. Đại Diện Phòng Kinh Tế - Hạ Tầng Và Đô Thị:</b></p>
        <p style="margin-bottom: 5px;">1. ........................................................... - Chức vụ: ...........................................</p>
        <p style="margin-bottom: 10px;">2. ........................................................... - Chức vụ: ...........................................</p>
      ` : "";

    const wordSpacerHeight = formData.HIEN_THI_CAU_LUU_Y ? '450pt' : '500pt';

    // KHUNG SƠ HỌA
    const soHoaSection = `
        <div style="margin-top: 40px; page-break-before: always;">
            <p style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 10px;">SƠ HỌA RANH GIỚI, MỐC GIỚI THỬA ĐẤT</p>
            
            <table border="1" cellspacing="0" cellpadding="10" style="width: 100%; border-collapse: collapse; border: 1.5pt solid black;">
                <tr>
                    <td style="height: ${isForWord ? '560pt' : '750px'}; vertical-align: top; padding: 15pt;">
                        
                        <!-- Block 1: Top Content -->
                        <div>
                            ${formData.HIEN_THI_CAU_LUU_Y ? `
                            <p style="text-align: center; font-weight: bold; font-size: 11pt; line-height: 1.3; margin: 0 0 10pt 0;">
                                (Việc thể hiện biến động giữa GCNQSD đất và hiện trạng sử dụng đất chỉ mang tính chất tham khảo, do GCNQSD đất được đo đạc và cấp theo phương pháp đo đạc độc lập, không theo hệ tọa độ hiện hành)
                            </p>
                            ` : ''}
                        </div>

                        <!-- Block 2: Spacer (Khoảng trống vật lý) -->
                        <div style="height: ${wordSpacerHeight}; width: 100%;"></div>

                        <!-- Block 3: Bottom Content -->
                        <div style="text-align: center; font-size: 11pt; font-style: italic; line-height: 1.4; margin-top: 10pt;">
                            <p style="margin: 0;">Thể hiện rõ ranh giới thay đổi giữa ranh hiện trạng (nét liền) và ranh theo hồ sơ pháp lý (nét đứt).</p>
                            <p style="margin: 0;">Trường hợp sơ họa thửa đất không đủ thể hiện trong biên bản thì in đính kèm và đóng dấu giáp lai</p>
                        </div>

                    </td>
                </tr>
            </table>
        </div>
    `;

    // PHẦN KÝ TÊN: IN ĐẬM VÀ CHỮ THƯỜNG (Chỉ viết hoa chữ cái đầu)
    const signatureTable = `
        <table style="width: 100%; margin-top: 40px; text-align: center; border-collapse: collapse;">
            <tr style="font-weight: bold; vertical-align: top;">
                <td style="width: 50%; padding-bottom: 80px;">Chủ sử dụng đất</td>
                <td style="width: 50%; padding-bottom: 80px;">Cán bộ đo đạc</td>
            </tr>
            <tr style="font-weight: bold; vertical-align: bottom;">
                <td style="width: 50%;"></td>
                <td style="width: 50%;">${toTitleCase(currentUser.name)}</td>
            </tr>
            <tr><td colspan="2" style="height: 40px;"></td></tr>
            <tr style="font-weight: bold; vertical-align: top;">
                <td style="width: 50%; padding-bottom: 80px;">
                    ${formData.HIEN_THI_Y_KIEN_GIAP_RANH ? 'Chủ sử dụng đất giáp ranh' : ''}
                </td>
                <td style="width: 50%; padding-bottom: 80px;">
                    ${formData.HIEN_THI_PHONG_KT ? `
                        <div style="line-height: 1.2;">
                            Đại diện<br/>
                            Phòng Kinh tế - Hạ tầng và Đô thị
                        </div>
                    ` : ''}
                </td>
            </tr>
        </table>
    `;

    // --- NEW: Sử dụng Table để tạo gạch chân (Word compatible) ---
    // Chỉ cần line cho Quốc hiệu
    const lineMottoHtml = `
        <table style="width: 185px; margin: 0 auto; border-collapse: collapse; border: none;">
            <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
        </table>
    `;

    return `
      <div style="font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; color: black; text-align: justify; width: 100%;">
        
        <!-- HEADER: Chỉ Quốc hiệu -->
        <div style="text-align: center; font-weight: bold; margin-bottom: 0px; font-size: 11pt;">
            <p style="margin: 0;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p style="margin: 0;">Độc lập - Tự do - Hạnh phúc</p>
            ${lineMottoHtml}
        </div>

        <!-- Thêm khoảng trắng tương đương 1 dòng -->
        <p style="margin: 0; line-height: 1.5;">&nbsp;</p>

        <div style="text-align: center; font-weight: bold; margin: 15px 0 25px 0;">
            <div style="font-size: 15pt; margin-bottom: 5px;">BIÊN BẢN LÀM VIỆC</div>
            <div style="font-size: 13pt; font-weight: normal; font-style: italic;">(V/v đo đạc, xác minh hiện trạng sử dụng đất)</div>
        </div>

        <p style="margin-bottom: 8px;">Hôm nay, vào lúc ${formData.GIO_LAP} giờ ${formData.PHUT_LAP} phút, ngày ${formData.NGAY_LAP} tháng ${formData.THANG_LAP} năm ${formData.NAM_LAP},</p>
        <p style="margin-bottom: 8px;">Tại khu đất của ${formData.HO}: <b>${toTitleCase(formData.TEN_CHU)}</b></p>
        <p style="margin-bottom: 15px;">Địa chỉ: ${formData.DIA_CHI_CHU}</p>

        <p style="margin-bottom: 5px;"><b>A. THÀNH PHẦN GỒM:</b></p>
        <p style="margin-bottom: 5px;"><b>I. Đại diện Văn phòng Đăng ký đất đai tỉnh Bình Phước – Chi nhánh Chơn Thành:</b></p>
        <p style="margin-bottom: 5px;">1. ........................................................... - Chức vụ: ...........................................</p>
        <p style="margin-bottom: 10px;">2. Ông: <b>${toTitleCase(currentUser.name)}</b> - Chức vụ: Nhân viên</p>

        ${phongKTSection}

        <p style="margin-bottom: 5px;"><b>${formData.HIEN_THI_PHONG_KT ? 'III' : 'II'}. Đại diện chủ sử dụng đất:</b></p>
        <p style="margin-bottom: 5px;">${formData.HO}: <b>${toTitleCase(formData.TEN_CHU)}</b></p>
        <p style="margin-bottom: 5px;">Và các hộ sử dụng đất liền kề:</p>
        <p style="margin-bottom: 15px;">${formData.HO_GIAP_RANH}</p>

        <p style="margin-bottom: 8px;"><b>B. NỘI DUNG:</b></p>
        <p style="${indentStyle} margin-bottom: 8px;">Tiến hành đo đạc, kiểm tra, xác minh ranh giới, mốc giới thửa đất ngoài thực địa đối với khu đất:</p>
        <p style="${indentStyle} margin-bottom: 8px;">Thửa đất số <b>${formData.SO_THUA_MOI || '...'}</b>, tờ bản đồ số <b>${toBanDoMoTa}</b>, tọa lạc tại ${formData.DIA_CHI_THUA}, ${formData.PHUONG}, tỉnh Bình Phước.</p>

        <p style="${indentStyle} margin-bottom: 8px;"><b>1. Về hồ sơ thửa đất:</b></p>
        <p style="${indentStyle} margin-bottom: 8px;">Khu đất đã được cấp GCNQSDĐ số phát hành <b>${formData.SO_GCN}</b> vào sổ cấp GCN số <b>${formData.SO_VAO_SO}</b> do <b>${formData.DV_CAP_GCN}</b> cấp ngày <b>${formattedNgayCap}</b>, thửa đất số ${formData.SO_THUA_CU}, tờ bản đồ số ${formData.SO_TO_CU}, diện tích ${formData.DT_CU.replace('.', ',')} m² ${areaBreakdown}.</p>
        <p style="${indentStyle} margin-bottom: 8px;">Theo bản đồ địa chính mới được Sở Tài nguyên và Môi trường ký duyệt ngày 10/10/2024 thuộc thửa đất số ${formData.SO_THUA_MOI || '...'}, tờ bản đồ số <b>${formData.SO_TO_MOI || '...'}</b>.</p>

        <p style="${indentStyle} margin-bottom: 8px;"><b>2. Kết quả đo đạc, kiểm tra, xác minh hiện trạng sử dụng đất:</b></p>
        <p style="${indentStyle} margin-bottom: 8px;">Kiểm tra hiện trạng thực tế trùng khớp với BĐĐC 2024.</p>
        <p style="${indentStyle} margin-bottom: 8px;">Hiện trạng sử dụng đất: ${formData.HIEN_TRANG}, ranh giới mốc giới được xác định bằng ${formData.LOAI_COC}.</p>
        <p style="${indentStyle} margin-bottom: 5px;">Diện tích đo đạc theo hiện trạng là <b>${formData.DT_MOI.replace('.', ',')} m²</b>, ${diffMainText}. Cụ thể:</p>

        <div style="margin-bottom: 8px;">
            ${boundaryHtml || `<p style="${indentStyle} font-style: italic; color: #666;">(Chưa nhập biến động ranh giới chi tiết)</p>`}
        </div>

        ${nguyenNhanSection}

        <p style="${indentStyle} margin-bottom: 8px;">Ranh giới, mốc giới tại thời điểm sử dụng đất trùng khớp với kết quả đo đạc bản đồ địa chính năm 2024.</p>
        <p style="${indentStyle} margin-bottom: 8px;">Tại thời điểm kiểm tra ranh giới, mốc giới sử dụng ổn định, không tranh chấp.</p>
        <p style="${indentStyle} margin-bottom: 8px;">Thửa đất không thuộc trường hợp ngăn chặn, tranh chấp.</p>
        <p style="${indentStyle} margin-bottom: 12px;">Ranh giới thửa đất không thay đổi so với ranh tại thời điểm cấp Giấy nhận quyền sử dụng đất (việc thay đổi diện tích, kích thước các cạnh không phải do nhận chuyển quyền, do lấn chiếm,...).</p>

        <p style="${indentStyle} margin-bottom: 5px;"><b>Ý kiến của chủ sử dụng đất:</b></p>
        <p style="${indentStyle} margin-bottom: 5px;">Ranh giới mốc giới thửa đất của gia đình tôi sử dụng ổn định, không tranh chấp với các hộ giáp ranh. Đề nghị điều chỉnh GCNQSD đất của gia đình theo đúng hiện trạng sử dụng đất, không có khiếu nại, khiếu kiện có liên quan đến thửa đất nói trên.</p>
        ${diffClause}
        ${camKetNghiaVu}

        ${yKienGiapRanhText}

        ${yKienPhongKTText}

        <p style="${indentStyle} margin-top: 15px;">Biên bản kết thúc vào lúc ${formData.GIO_LAP} giờ ${formData.PHUT_LAP} phút cùng ngày và được lập thành 02 bản, có nội dung như nhau./.</p>

        ${signatureTable}

        ${soHoaSection}
      </div>
    `;
  };

  const handleExportWord = async () => {
    setIsProcessing(true);
    const content = generateContent(true);
    
    const cleanName = formData.TEN_CHU.replace(/\s+/g, '_') || 'Chua_Ten';
    const toHienThi = formData.SO_TO_106 || formData.SO_TO_MOI || '...';
    const fileName = `BB_${cleanName}_${toHienThi}_${formData.SO_THUA_MOI || 'Chua_Thua'}.doc`;

    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          @page Section1 {
            size: 595.3pt 841.9pt; 
            margin: 56.7pt 42.5pt 56.7pt 70.9pt; 
          }
          div.Section1 { page: Section1; }
          body { font-family: "Times New Roman", serif; font-size: 13pt; text-align: justify; }
          p { margin: 0; margin-bottom: 2px; line-height: 1.3; }
          table { border-collapse: collapse; }
        </style>
      </head>
      <body><div class="Section1">${content}</div></body></html>
    `;

    if (window.electronAPI && window.electronAPI.saveAndOpenFile) {
        const base64Data = btoa(unescape(encodeURIComponent('\ufeff' + header)));
        const result = await window.electronAPI.saveAndOpenFile({ fileName, base64Data });
        if (result.success) {
            setExportedFilePath(result.path || null);
            if (window.electronAPI.openFilePath && result.path) {
                await window.electronAPI.openFilePath(result.path);
            }
        }
    } else {
        const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
        saveAs(blob, fileName);
    }
    
    setIsProcessing(false);
  };

  const handleOpenFile = async () => {
      if (exportedFilePath && window.electronAPI && window.electronAPI.openFilePath) {
          await window.electronAPI.openFilePath(exportedFilePath);
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden animate-fade-in">
      {/* Header Tabs */}
      <div className="bg-white border-b border-slate-300 p-2 flex items-center gap-4 shrink-0 shadow-sm z-20">
          <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                  onClick={() => setActiveTab('bienban')}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'bienban' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  Soạn Biên Bản
              </button>
              <button 
                  onClick={() => setActiveTab('thongtin')}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'thongtin' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  Cung Cấp Thông Tin
              </button>
          </div>
          
          <div className="flex-1 text-right pr-4">
              {activeTab === 'bienban' && (
                  <div className="inline-flex gap-2">
                      {exportedFilePath && (
                          <button 
                              onClick={handleOpenFile}
                              className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200 flex items-center gap-1 animate-bounce"
                          >
                              <ExternalLink size={14} /> Mở File
                          </button>
                      )}
                      <button 
                          onClick={handleExportWord} 
                          disabled={isProcessing}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                      >
                          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                          Xuất Word
                      </button>
                  </div>
              )}
          </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
          {/* TAB 1: SOẠN BIÊN BẢN (Giao diện đầy đủ) */}
          <div className={`absolute inset-0 flex flex-col ${activeTab === 'bienban' ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}>
              <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Form nhập liệu */}
                <div className="w-[500px] bg-[#f8fafc] border-r border-slate-300 overflow-y-auto p-5 custom-scrollbar shadow-inner z-10">
                  <div className="space-y-6 pb-32">
                    
                    {/* PHẦN TÍCH CHỌN CẤU HÌNH */}
                    <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
                        <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-wide mb-5 flex items-center gap-2.5">
                            <Settings2 size={18} className="text-blue-500" /> 
                            Cấu hình biểu mẫu
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            <button 
                                onClick={() => { setFormData({...formData, HIEN_THI_PHONG_KT: !formData.HIEN_THI_PHONG_KT}); setExportedFilePath(null); }}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 group ${formData.HIEN_THI_PHONG_KT ? 'bg-purple-50 border-purple-500 shadow-purple-100 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                            >
                                <div className="flex flex-col items-start">
                                    <span className={`text-[13px] font-black uppercase ${formData.HIEN_THI_PHONG_KT ? 'text-purple-800' : 'text-slate-600'}`}>Mục II (P. Kinh tế)</span>
                                    <span className="text-[11px] text-slate-400 font-medium">Hiện thành phần & 5 dòng ý kiến</span>
                                </div>
                                <div className={`p-1 rounded-lg ${formData.HIEN_THI_PHONG_KT ? 'bg-purple-600 text-white' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formData.HIEN_THI_PHONG_KT ? <CheckSquare size={24} /> : <Square size={24} />}
                                </div>
                            </button>

                            <button 
                                onClick={() => { setFormData({...formData, HIEN_THI_Y_KIEN_GIAP_RANH: !formData.HIEN_THI_Y_KIEN_GIAP_RANH}); setExportedFilePath(null); }}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 group ${formData.HIEN_THI_Y_KIEN_GIAP_RANH ? 'bg-blue-50 border-blue-500 shadow-blue-100 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                            >
                                <div className="flex flex-col items-start">
                                    <span className={`text-[13px] font-black uppercase ${formData.HIEN_THI_Y_KIEN_GIAP_RANH ? 'text-blue-800' : 'text-slate-600'}`}>Ý kiến hộ giáp ranh</span>
                                    <span className="text-[11px] text-slate-400 font-medium">Xác nhận ranh mốc & cam kết</span>
                                </div>
                                <div className={`p-1 rounded-lg ${formData.HIEN_THI_Y_KIEN_GIAP_RANH ? 'bg-blue-600 text-white' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formData.HIEN_THI_Y_KIEN_GIAP_RANH ? <CheckSquare size={24} /> : <Square size={24} />}
                                </div>
                            </button>

                            <button 
                                onClick={() => { setFormData({...formData, HIEN_THI_CAU_LUU_Y: !formData.HIEN_THI_CAU_LUU_Y}); setExportedFilePath(null); }}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 group ${formData.HIEN_THI_CAU_LUU_Y ? 'bg-amber-50 border-amber-500 shadow-amber-100 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                            >
                                <div className="flex flex-col items-start">
                                    <span className={`text-[13px] font-black uppercase ${formData.HIEN_THI_CAU_LUU_Y ? 'text-amber-900' : 'text-slate-600'}`}>Lưu ý trong Sơ họa</span>
                                    <span className="text-[11px] text-slate-400 font-medium">Hiện văn bản lưu ý bên trong khung vẽ</span>
                                </div>
                                <div className={`p-1 rounded-lg ${formData.HIEN_THI_CAU_LUU_Y ? 'bg-amber-600 text-white' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                    {formData.HIEN_THI_CAU_LUU_Y ? <CheckSquare size={24} /> : <Square size={24} />}
                                </div>
                            </button>

                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 mt-2">
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 block mb-1.5 uppercase tracking-wider">Giờ lập</label>
                                    <input type="time" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-black bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={`${formData.GIO_LAP}:${formData.PHUT_LAP}`} onChange={e => { const [h, m] = e.target.value.split(':'); setFormData({...formData, GIO_LAP: h, PHUT_LAP: m}); setExportedFilePath(null); }} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 block mb-1.5 uppercase tracking-wider">Ngày lập</label>
                                    <input type="date" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-black bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={`${formData.NAM_LAP}-${formData.THANG_LAP}-${formData.NGAY_LAP}`} onChange={e => { const [y, m, d] = e.target.value.split('-'); setFormData({...formData, NAM_LAP: y, THANG_LAP: m, NGAY_LAP: d}); setExportedFilePath(null); }} />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Chủ đất */}
                    <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-[13px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2.5 border-b border-blue-50 pb-2"><User size={16} /> 1. Chủ sử dụng</h3>
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                            <label className="text-[12px] font-bold text-slate-400 block mb-1 uppercase">Xưng hô</label>
                            <select value={formData.HO} onChange={e => { setFormData({...formData, HO: e.target.value}); setExportedFilePath(null); }} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] font-bold bg-slate-50 outline-none">
                                <option value="Ông">Ông</option><option value="Bà">Bà</option><option value="Hộ ông">Hộ ông</option><option value="Hộ bà">Hộ bà</option>
                            </select>
                        </div>
                        <div className="col-span-8">
                            <label className="text-[12px] font-bold text-slate-400 block mb-1 uppercase">Họ và tên</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-black uppercase bg-white outline-none" value={formData.TEN_CHU} onChange={e => { setFormData({...formData, TEN_CHU: e.target.value}); setExportedFilePath(null); }} />
                        </div>
                        <div className="col-span-12">
                            <label className="text-[12px] font-bold text-slate-400 block mb-1 uppercase">Địa chỉ thường trú</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-white outline-none" value={formData.DIA_CHI_CHU} onChange={e => { setFormData({...formData, DIA_CHI_CHU: e.target.value}); setExportedFilePath(null); }} />
                        </div>
                      </div>
                    </section>

                    {/* Giấy chứng nhận cũ */}
                    <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-[13px] font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2.5 border-b border-amber-50 pb-2"><ClipboardList size={16} /> 2. Thông tin GCN</h3>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Số phát hành</label>
                            <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-medium bg-white outline-none" value={formData.SO_GCN} onChange={e => { setFormData({...formData, SO_GCN: e.target.value}); setExportedFilePath(null); }} />
                          </div>
                          <div>
                            <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Số vào sổ</label>
                            <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-medium bg-white outline-none" value={formData.SO_VAO_SO} onChange={e => { setFormData({...formData, SO_VAO_SO: e.target.value}); setExportedFilePath(null); }} />
                          </div>
                          
                          <div>
                            <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Ngày cấp GCN</label>
                            <input type="date" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-medium bg-white outline-none" value={formData.NGAY_CAP} onChange={e => { setFormData({...formData, NGAY_CAP: e.target.value}); setExportedFilePath(null); }} />
                          </div>
                          <div>
                            <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Cơ quan cấp</label>
                            <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-medium bg-white outline-none" value={formData.DV_CAP_GCN} onChange={e => { setFormData({...formData, DV_CAP_GCN: e.target.value}); setExportedFilePath(null); }} />
                          </div>

                          <div>
                            <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Thửa (GCN)</label>
                            <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-bold text-center outline-none" value={formData.SO_THUA_CU} onChange={e => { setFormData({...formData, SO_THUA_CU: e.target.value}); setExportedFilePath(null); }} />
                          </div>
                          <div>
                            <label className="text-[12px] font-bold text-amber-700 block mb-1 uppercase">Tờ (GCN)</label>
                            <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-[13px] font-bold text-center outline-none" value={formData.SO_TO_CU} onChange={e => { setFormData({...formData, SO_TO_CU: e.target.value}); setExportedFilePath(null); }} />
                          </div>
                          
                          <div className="col-span-2 grid grid-cols-3 gap-3 pt-3 border-t border-amber-50 mt-2">
                            <div>
                                <label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Tổng DT</label>
                                <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] font-black" value={formData.DT_CU} onChange={e => { setFormData({...formData, DT_CU: e.target.value}); setExportedFilePath(null); }} />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-blue-500 block mb-1 uppercase">Đất Ở</label>
                                <input type="number" className="w-full border border-blue-200 rounded-lg px-2 py-2 text-[13px] font-black text-blue-700" value={formData.DT_ODT} onChange={e => { setFormData({...formData, DT_ODT: e.target.value}); setExportedFilePath(null); }} />
                            </div>
                            <div>
                                <label className="text-[12px] font-bold text-green-500 block mb-1 uppercase">Đất NN</label>
                                <div className="text-[13px] font-black text-green-700 pt-2">{formData.DT_CLN.replace('.', ',')}</div>
                            </div>
                          </div>
                      </div>
                    </section>

                    {/* Hiện trạng mới */}
                    <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-[13px] font-black text-green-600 uppercase tracking-widest mb-4 flex items-center gap-2.5 border-b border-green-50 pb-2"><LandPlot size={16} /> 3. Hiện trạng mới</h3>
                      <div className="space-y-4">
                          <div className="flex gap-2">
                              {WARDS_QUICK.map(w => (
                                  <button 
                                    key={w.value}
                                    onClick={() => { setFormData({...formData, PHUONG: w.value}); setExportedFilePath(null); }}
                                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-black border transition-all ${formData.PHUONG === w.value ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-200'}`}
                                  >
                                      {w.label}
                                  </button>
                              ))}
                          </div>
                          <div>
                            <label className="text-[12px] font-bold text-green-800 block uppercase mb-1">Địa chỉ đất tại</label>
                            <input className="w-full border border-green-200 rounded-lg px-3 py-2 text-[13px] bg-white outline-none" value={formData.DIA_CHI_THUA} onChange={e => { setFormData({...formData, DIA_CHI_THUA: e.target.value}); setExportedFilePath(null); }} />
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div><label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Thửa mới</label><input className="w-full border border-slate-200 rounded-lg px-1 py-2 text-[13px] font-black text-center" value={formData.SO_THUA_MOI} onChange={e => { setFormData({...formData, SO_THUA_MOI: e.target.value}); setExportedFilePath(null); }} /></div>
                            <div><label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Tờ mới</label><input className="w-full border border-slate-200 rounded-lg px-1 py-2 text-[13px] font-black text-center" value={formData.SO_TO_MOI} onChange={e => { setFormData({...formData, SO_TO_MOI: e.target.value}); setExportedFilePath(null); }} /></div>
                            <div><label className="text-[12px] font-bold text-purple-600 block mb-1 uppercase">Tờ 106</label><input className="w-full border border-purple-200 rounded-lg px-1 py-2 text-[13px] font-black text-purple-700 text-center" value={formData.SO_TO_106} onChange={e => { setFormData({...formData, SO_TO_106: e.target.value}); setExportedFilePath(null); }} /></div>
                            <div><label className="text-[12px] font-bold text-emerald-600 block mb-1 uppercase">DT đo đạc</label><input type="number" className="w-full border border-emerald-300 rounded-lg px-1 py-2 text-[13px] font-black bg-emerald-50 text-emerald-900 text-center" value={formData.DT_MOI} onChange={e => { setFormData({...formData, DT_MOI: e.target.value}); setExportedFilePath(null); }} /></div>
                          </div>

                          {/* FORM NHẬP HIỆN TRẠNG & LOẠI CỌC (MỚI) */}
                          <div className="col-span-4 mt-2 pt-3 border-t border-slate-100">
                              <div className="grid grid-cols-2 gap-3">
                                  <div>
                                      <label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Hiện trạng sử dụng</label>
                                      <input 
                                          className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all" 
                                          value={formData.HIEN_TRANG} 
                                          onChange={e => { setFormData({...formData, HIEN_TRANG: e.target.value}); setExportedFilePath(null); }} 
                                      />
                                      <div className="flex gap-1 mt-1.5 flex-wrap">
                                          {['Đất trống', 'Cao su', 'Điều', 'Nhà ở'].map(t => (
                                              <button key={t} onClick={() => { setFormData({...formData, HIEN_TRANG: t}); setExportedFilePath(null); }} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-200 transition-colors">
                                                  {t}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-[12px] font-bold text-slate-500 block mb-1 uppercase">Loại mốc giới</label>
                                      <input 
                                          className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all" 
                                          value={formData.LOAI_COC} 
                                          onChange={e => { setFormData({...formData, LOAI_COC: e.target.value}); setExportedFilePath(null); }} 
                                      />
                                      <div className="flex gap-1 mt-1.5 flex-wrap">
                                          {['Cọc bê tông', 'Cọc sắt', 'Đinh sắt', 'Sơn đỏ'].map(t => (
                                              <button key={t} onClick={() => { setFormData({...formData, LOAI_COC: t}); setExportedFilePath(null); }} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-200 transition-colors">
                                                  {t}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                    </section>

                    {/* Biến động ranh giới */}
                    <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-4 border-b border-purple-100 pb-2">
                        <h3 className="text-[13px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-2"><MoveHorizontal size={16} /> 4. Biến động</h3>
                        <button type="button" onClick={addBoundaryRow} className="text-[11px] font-black bg-purple-600 text-white px-3 py-1 rounded-full"><Plus size={12} className="inline mr-1" /> THÊM</button>
                      </div>

                      <div className="space-y-3">
                        {boundaryChanges.map((row) => (
                          <div key={row.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
                            <button onClick={() => removeBoundaryRow(row.id)} className="absolute -top-1 -right-1 bg-white text-red-500 p-1 rounded-full border border-red-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] font-bold bg-white outline-none" value={row.direction} onChange={e => updateBoundaryRow(row.id, 'direction', e.target.value as any)}>
                                    {DIRECTIONS.map(d => <option key={d} value={d}>Phía {d}</option>)}
                                </select>
                                <select className={`border rounded-lg px-2 py-1.5 text-[13px] font-black uppercase outline-none ${row.type === 'tăng' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-rose-600 border-rose-200 bg-rose-50'}`} value={row.type} onChange={e => updateBoundaryRow(row.id, 'type', e.target.value as any)}>
                                    <option value="tăng">Tăng (+)</option>
                                    <option value="giảm">Giảm (-)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-12 gap-2">
                              <div className={row.objectName === 'Đường' ? 'col-span-4' : 'col-span-4'}>
                                <select className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] bg-white outline-none" value={row.objectName} onChange={e => updateBoundaryRow(row.id, 'objectName', e.target.value)}>
                                    {ADJACENT_OBJECTS.map(obj => <option key={obj} value={obj}>{obj}</option>)}
                                </select>
                              </div>
                              
                              {row.objectName === 'Đường' && (
                                  <div className="col-span-3">
                                    <div className="relative">
                                        <input className="w-full border border-blue-300 rounded-lg px-1 py-1 text-[12px] text-center font-bold text-blue-600 bg-blue-50" value={row.roadNumber} onChange={e => updateBoundaryRow(row.id, 'roadNumber', e.target.value)} placeholder="Tên/Số..." />
                                        <div className="absolute -top-3 left-1 text-[9px] font-black text-blue-500 bg-white px-0.5 whitespace-nowrap">TÊN ĐƯỜNG/SỐ</div>
                                    </div>
                                  </div>
                              )}

                              <div className={row.objectName === 'Đường' ? 'col-span-2' : 'col-span-3'}>
                                <input className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] text-center outline-none" value={row.adjacentPlot} onChange={e => updateBoundaryRow(row.id, 'adjacentPlot', e.target.value)} placeholder="Thửa" />
                              </div>
                              <div className="col-span-2">
                                <input className="w-full border border-purple-200 rounded-lg px-1 py-1 text-[12px] text-center outline-none bg-white font-bold text-purple-700" value={row.mapSheet} onChange={e => updateBoundaryRow(row.id, 'mapSheet', e.target.value)} placeholder="Tờ" />
                              </div>
                              <div className={row.objectName === 'Đường' ? 'col-span-3' : 'col-span-3'}>
                                <input className="w-full border border-slate-200 rounded-lg px-1 py-1 text-[12px] font-bold text-blue-600 text-center outline-none" value={row.area} onChange={e => updateBoundaryRow(row.id, 'area', e.target.value)} placeholder="DT" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Nguyên nhân */}
                    <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-[13px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-indigo-100 pb-2"><Quote size={16} /> 5. Nguyên nhân</h3>
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                                <button onClick={() => applyPreset(PRESETS.ROAD)} className="text-[11px] font-bold p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all">Do ranh đường</button>
                                <button onClick={() => applyPreset(PRESETS.ERROR)} className="text-[11px] font-bold p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all">Do đo đạc cũ sai</button>
                                <button onClick={() => { setFormData({...formData, NGUYEN_NHAN_TEXT: ''}); setExportedFilePath(null); }} className="text-[11px] font-bold p-2 text-rose-500 hover:bg-rose-50 rounded-lg ml-auto">Xóa sạch</button>
                            </div>
                            <textarea 
                                className="w-full border border-indigo-200 rounded-xl p-3 text-[13px] font-medium focus:ring-2 focus:ring-indigo-500/10 outline-none min-h-[100px] bg-white leading-relaxed"
                                placeholder="Nhập nội dung nguyên nhân..."
                                value={formData.NGUYEN_NHAN_TEXT}
                                onChange={e => { setFormData({...formData, NGUYEN_NHAN_TEXT: e.target.value}); setExportedFilePath(null); }}
                            />
                        </div>
                    </section>
                  </div>
                </div>

                {/* Right Preview Panel */}
                <div className="flex-1 bg-slate-300 overflow-y-auto overflow-x-auto p-10 flex flex-col items-center custom-scrollbar shadow-inner relative min-w-0">
                  {/* CẢNH BÁO LỆCH DIỆN TÍCH (STICKY TOP) */}
                  {isAreaMismatch && (
                      <div className="bg-red-600 text-white font-bold text-center p-2 mb-4 rounded-lg shadow-xl animate-pulse text-sm sticky top-0 z-50 flex items-center gap-2 uppercase tracking-wide border-2 border-white/20 backdrop-blur-md">
                          <AlertCircle size={20} />
                          (TỔNG TĂNG GIẢM CHƯA KHỚP, ĐỀ NGHỊ KIỂM TRA LẠI)
                      </div>
                  )}

                  <div className="bg-white w-[210mm] min-h-[297mm] h-auto shadow-[0_0_80px_rgba(0,0,0,0.25)] p-[20mm_15mm_20mm_25mm] transition-all animate-fade-in-up relative ring-1 ring-slate-400 mb-24 flex flex-col shrink-0">
                    <div className="absolute top-0 left-0 w-[25mm] h-full bg-slate-50/40 pointer-events-none border-r border-slate-100 flex items-center justify-center z-0">
                        <div className="rotate-90 text-[10px] font-black text-slate-300 uppercase tracking-[1.5em] whitespace-nowrap">LỀ TRÁI ĐÓNG GHIM 25MM</div>
                    </div>
                    <div className="relative z-10 w-full h-auto overflow-visible select-none pointer-events-none" dangerouslySetInnerHTML={{ __html: generateContent(false) }} />
                  </div>
                  
                  <div className="fixed bottom-8 bg-white/95 backdrop-blur px-10 py-4 rounded-full border border-slate-400 shadow-2xl flex items-center gap-8 text-[11px] font-black text-slate-700 uppercase tracking-widest z-30 pointer-events-auto border-b-4 border-b-blue-600">
                    <div className="flex items-center gap-2.5"><MapIcon size={18} className="text-blue-500" /> Tự động dàn trang</div>
                    <div className="w-px h-5 bg-slate-300"></div>
                    <div className="flex items-center gap-2.5"><CheckCircle size={18} className="text-emerald-500" /> Lề chuẩn A4</div>
                    <div className="w-px h-5 bg-slate-300"></div>
                    <div className="flex items-center gap-2.5 text-blue-600 animate-pulse"><AlertCircle size={18} /> Chế độ xem trước</div>
                  </div>
                </div>
              </div>
          </div>

          {/* TAB 2: CUNG CẤP THÔNG TIN (Mới) */}
          <div className={`absolute inset-0 bg-[#f1f5f9] flex flex-col ${activeTab === 'thongtin' ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}>
              <CungCapThongTinTab currentUser={currentUser} /> {/* ADDED PROP */}
          </div>
      </div>
    </div>
  );
};

export default UtilitiesView;
