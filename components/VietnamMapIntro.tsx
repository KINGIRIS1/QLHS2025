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
            <feGaussianBlur stdDeviation="16" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Tâm điểm phát sáng chính xác tại Đồng Nai: X: 640, Y: 755 */}
        {isDongNaiGlowing && (
          <g transform="translate(640, 755)">
            {/* Vòng radar sóng xung 1 (Nhỏ gọn, vừa vặn theo vị trí Đồng Nai) */}
            <circle cx="0" cy="0" r="25" fill="none" stroke="#fbbf24" strokeWidth="2.2" opacity="0.95">
              <animate attributeName="r" values="12;80" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.95;0" dur="2.2s" repeatCount="indefinite" />
            </circle>

            {/* Vòng radar sóng xung 2 */}
            <circle cx="0" cy="0" r="40" fill="none" stroke="#38bdf8" strokeWidth="1.8" opacity="0.85">
              <animate attributeName="r" values="12;110" dur="2.2s" begin="0.7s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.85;0" dur="2.2s" begin="0.7s" repeatCount="indefinite" />
            </circle>

            {/* Vòng radar sóng xung 3 (Laser ngoài) */}
            <circle cx="0" cy="0" r="55" fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="5 5" opacity="0.75">
              <animate attributeName="r" values="18;135" dur="2.2s" begin="1.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="2.2s" begin="1.3s" repeatCount="indefinite" />
            </circle>

            {/* Điểm sáng trung tâm Đồng Nai */}
            <circle cx="0" cy="0" r="9" fill="#fbbf24" filter="url(#goldLaserGlow)" />
            <circle cx="0" cy="0" r="4" fill="#ffffff" />

            {/* Tia ngắm Laser */}
            <line x1="-20" y1="0" x2="20" y2="0" stroke="#fbbf24" strokeWidth="1.2" opacity="0.8" />
            <line x1="0" y1="-20" x2="0" y2="20" stroke="#fbbf24" strokeWidth="1.2" opacity="0.8" />
          </g>
        )}
      </svg>
    </div>
  );
};

export default VietnamMapIntro;
