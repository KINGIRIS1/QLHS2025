import React from 'react';

interface VietnamMapIntroProps {
  phase: 'map_in' | 'dongnai_glow' | 'login_ready';
}

export const VietnamMapIntro: React.FC<VietnamMapIntroProps> = ({ phase }) => {
  const isDongNaiGlowing = phase === 'dongnai_glow' || phase === 'login_ready';

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden">
      {/* Dynamic Animated Laser Pulse & Radar Beacon Overlay */}
      <svg
        viewBox="0 0 1920 1080"
        className="w-full h-full object-cover"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="goldLaserGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="18" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Tọa độ điểm sáng Đồng Nai trên khung hình 1920x1080: X ~ 635, Y ~ 685 */}
        {isDongNaiGlowing && (
          <g transform="translate(635, 685)">
            {/* Vòng radar sóng xung 1 */}
            <circle cx="0" cy="0" r="25" fill="none" stroke="#fbbf24" strokeWidth="2.5" opacity="0.95">
              <animate attributeName="r" values="15;120" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0" dur="2.4s" repeatCount="indefinite" />
            </circle>

            {/* Vòng radar sóng xung 2 */}
            <circle cx="0" cy="0" r="40" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.85">
              <animate attributeName="r" values="15;160" dur="2.4s" begin="0.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0" dur="2.4s" begin="0.8s" repeatCount="indefinite" />
            </circle>

            {/* Vòng radar sóng xung 3 */}
            <circle cx="0" cy="0" r="60" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.75">
              <animate attributeName="r" values="25;200" dur="2.4s" begin="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.85;0" dur="2.4s" begin="1.5s" repeatCount="indefinite" />
            </circle>

            {/* Điểm sáng trung tâm Đồng Nai */}
            <circle cx="0" cy="0" r="9" fill="#fbbf24" filter="url(#goldLaserGlow)" />
            <circle cx="0" cy="0" r="4" fill="#ffffff" />

            {/* Tia ngắm mục tiêu */}
            <line x1="-28" y1="0" x2="28" y2="0" stroke="#fbbf24" strokeWidth="1.5" opacity="0.85" />
            <line x1="0" y1="-28" x2="0" y2="28" stroke="#fbbf24" strokeWidth="1.5" opacity="0.85" />

            {/* Thẻ Holographic Callout */}
            <g className="animate-fade-in">
              <polyline
                points="0,0 55,-45 190,-45"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="5 3"
                filter="url(#goldLaserGlow)"
              />
              <rect
                x="55"
                y="-82"
                width="165"
                height="46"
                rx="8"
                fill="#070d19"
                fillOpacity="0.94"
                stroke="#fbbf24"
                strokeWidth="1.8"
                filter="url(#goldLaserGlow)"
              />
              <text x="70" y="-60" fill="#fbbf24" fontSize="13" fontWeight="900" letterSpacing="0.8">
                📍 TỈNH ĐỒNG NAI
              </text>
              <text x="70" y="-44" fill="#93c5fd" fontSize="9" fontWeight="700">
                TRUNG TÂM DỮ LIỆU ĐẤT ĐAI
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

export default VietnamMapIntro;
