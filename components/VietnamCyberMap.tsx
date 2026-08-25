import React from 'react';

interface VietnamCyberMapProps {
  phase: number; // 1: scan map (0-1s), 2: focus dong nai + radar (1-2.2s), 3: ready & idle login (2.2s+)
}

export const VietnamCyberMap: React.FC<VietnamCyberMapProps> = ({ phase }) => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#040b17] select-none">
      {/* Background Cyber Grids & Starfield / Hexagons */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0, 180, 255, 0.07) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 180, 255, 0.07) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
        {/* Hexagonal Tech Overlay Top Right */}
        <div className="absolute top-6 right-80 w-64 h-32 opacity-20 hidden lg:block"
             style={{
               backgroundImage: `radial-gradient(circle, #00e5ff 10%, transparent 11%)`,
               backgroundSize: '16px 16px'
             }} 
        />
      </div>

      {/* Cyber Corner HUD Borders */}
      <div className="absolute top-4 left-4 border-l-2 border-t-2 border-cyan-500/40 w-8 h-8 pointer-events-none" />
      <div className="absolute top-4 right-4 border-r-2 border-t-2 border-cyan-500/40 w-8 h-8 pointer-events-none" />
      <div className="absolute bottom-4 left-4 border-l-2 border-b-2 border-cyan-500/40 w-8 h-8 pointer-events-none" />
      <div className="absolute bottom-4 right-4 border-r-2 border-b-2 border-cyan-500/40 w-8 h-8 pointer-events-none" />

      {/* TOP LEFT HUD: Cyber Header & Coordinates */}
      <div className="absolute top-6 left-6 z-20 pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 bg-cyan-400 rounded-sm animate-ping opacity-75" />
          <span className="text-[11px] font-mono tracking-widest text-cyan-400/90 font-bold uppercase">
            GEOSPATIAL INTELLIGENCE // CADASTRE SYSTEM
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-wider flex items-center gap-2 drop-shadow-[0_0_15px_rgba(0,229,255,0.6)]">
          VIETNAM GEOSPATIAL INTELLIGENCE
        </h1>
        <p className="text-xs sm:text-sm font-semibold tracking-widest text-cyan-300/80 font-mono mt-0.5">
          REGIONAL FOCUS: DONG NAI PROVINCE
        </p>

        {/* Small Data Panel */}
        <div className="mt-3 hidden sm:block bg-cyan-950/40 border border-cyan-500/30 rounded px-3 py-1.5 backdrop-blur-md max-w-xs">
          <div className="flex justify-between text-[10px] font-mono text-cyan-300/70 border-b border-cyan-500/20 pb-1">
            <span>SYS_LOC: VN_SOUTHERN</span>
            <span className="text-emerald-400 animate-pulse">● CAD_ONLINE</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1 text-[10px] font-mono text-slate-300">
            <div>LAT: 10.9575° N</div>
            <div>LON: 106.8427° E</div>
            <div>DATUM: VN-2000</div>
            <div>ZONE: 107°45' (3°)</div>
          </div>
        </div>
      </div>

      {/* TOP RIGHT HUD: Live Status */}
      <div className="absolute top-6 right-6 z-20 pointer-events-none hidden md:block">
        <div className="bg-cyan-950/50 border border-cyan-400/40 rounded-lg p-3 backdrop-blur-md min-w-[170px] shadow-[0_0_20px_rgba(0,180,255,0.2)]">
          <div className="text-[11px] font-mono font-black text-cyan-400 tracking-wider border-b border-cyan-500/30 pb-1 flex justify-between items-center">
            <span>STATUS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div className="mt-2 space-y-1 text-[10px] font-mono">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">LIVE STATS:</span>
              <span className="font-bold text-cyan-300">18.375</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">LIVE STATS:</span>
              <span className="font-bold text-cyan-300">1.33</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">MOSYERATURS:</span>
              <span className="font-bold text-emerald-400">23.83%</span>
            </div>
          </div>
        </div>

        {/* Compass Rose Widget */}
        <div className="mt-3 flex justify-end">
          <div className="relative w-16 h-16 border border-cyan-500/30 rounded-full flex items-center justify-center bg-cyan-950/20 backdrop-blur-xs">
            <span className="absolute top-0.5 text-[8px] font-mono font-black text-cyan-300">N</span>
            <span className="absolute right-1 text-[8px] font-mono text-cyan-500/70">E</span>
            <span className="absolute bottom-0.5 text-[8px] font-mono text-cyan-500/70">S</span>
            <span className="absolute left-1 text-[8px] font-mono text-cyan-500/70">W</span>
            <div className="w-6 h-6 border border-cyan-400/40 rotate-45" />
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* SVG MAP CONTAINER WITH SMOOTH CAMERA TRANSLATION */}
      <div 
        className="w-full h-full transition-all duration-1000 ease-out flex items-center justify-center"
        style={{
          transform: phase >= 3 ? 'translateX(-16%) scale(1.05)' : 'translateX(0%) scale(1)'
        }}
      >
        <svg
          viewBox="0 0 1200 900"
          className="w-full h-full max-h-[95vh] object-contain drop-shadow-[0_0_30px_rgba(0,180,255,0.3)]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Glow Filters */}
            <filter id="cyan-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur1" />
              <feGaussianBlur stdDeviation="8" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="gold-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur1" />
              <feGaussianBlur stdDeviation="14" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <radialGradient id="dongNaiRadial" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffea79" stopOpacity="1" />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.4" />
            </radialGradient>

            <linearGradient id="cyberLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
            </linearGradient>

            <linearGradient id="circuitGoldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* BACKGROUND NEIGHBOR COUNTRIES (Subtle outlines) */}
          <g className="opacity-20 stroke-slate-600 fill-slate-900/40" strokeWidth="1">
            {/* Laos */}
            <path d="M 280,180 Q 320,240 350,320 Q 390,380 430,420 L 380,450 Q 330,360 270,290 Z" />
            {/* Cambodia */}
            <path d="M 330,520 Q 420,530 490,560 Q 480,660 410,680 Q 320,640 330,520 Z" />
            {/* Labels */}
            <text x="290" y="270" fill="#64748b" fontSize="13" fontFamily="monospace" letterSpacing="3">LAOS</text>
            <text x="360" y="610" fill="#64748b" fontSize="13" fontFamily="monospace" letterSpacing="3">CAMBODIA</text>
            <text x="210" y="440" fill="#475569" fontSize="12" fontFamily="monospace" letterSpacing="3">THAILAND</text>
          </g>

          {/* MAIN VIETNAM SHAPE & PROVINCES (HI-TECH CYBER GRID) */}
          {/* Northern Vietnam */}
          <g className="transition-all duration-1000">
            {/* Northern Outlines and Internal Grids */}
            <path
              d="M 360,110 
                 L 430,90 L 490,110 L 540,150 L 510,190 L 460,200 L 430,240 
                 L 390,260 L 360,220 L 320,200 L 330,150 Z"
              fill="rgba(2, 28, 58, 0.65)"
              stroke="#00e5ff"
              strokeWidth="2.5"
              filter="url(#cyan-glow)"
              className="map-path-northern"
            />
            {/* Northern internal grid lines */}
            <path
              d="M 430,90 L 430,160 L 490,160 M 360,150 L 430,160 L 390,220 M 430,160 L 460,200 M 490,110 L 470,160 L 510,190"
              fill="none"
              stroke="#00c8ff"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.75"
            />
            <circle cx="435" cy="165" r="4" fill="#ffffff" filter="url(#cyan-glow)" />
            <circle cx="435" cy="165" r="9" fill="none" stroke="#00e5ff" strokeWidth="1.5" className="animate-ping" />
            <text x="445" y="160" fill="#e0f2fe" fontSize="11" fontFamily="monospace" fontWeight="bold">HA NOI</text>
          </g>

          {/* Central Vietnam (Curve along the coastline) */}
          <g className="transition-all duration-1000">
            <path
              d="M 430,240 
                 Q 470,300 520,360 
                 Q 570,430 630,500 
                 Q 670,560 670,620
                 L 620,630
                 Q 590,560 550,480
                 Q 490,410 440,330
                 L 390,260 Z"
              fill="rgba(2, 28, 58, 0.65)"
              stroke="#00e5ff"
              strokeWidth="2.5"
              filter="url(#cyan-glow)"
              className="map-path-central"
            />
            {/* Central mesh lines */}
            <path
              d="M 450,290 L 485,320 L 530,390 L 575,460 L 635,530 L 650,590
                 M 485,320 L 440,330 M 530,390 L 490,410 M 575,460 L 550,480"
              fill="none"
              stroke="#00c8ff"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.75"
            />
            <circle cx="565" cy="425" r="3" fill="#ffffff" filter="url(#cyan-glow)" />
            <text x="575" y="425" fill="#bae6fd" fontSize="10" fontFamily="monospace">DA NANG</text>
          </g>

          {/* Southern Vietnam & Mekong Delta */}
          <g className="transition-all duration-1000">
            <path
              d="M 670,620 
                 L 640,660 L 590,690 L 530,710 L 480,780 L 440,840 
                 L 390,810 L 410,750 L 450,700 L 500,660 L 550,640 L 620,630 Z"
              fill="rgba(2, 28, 58, 0.65)"
              stroke="#00e5ff"
              strokeWidth="2.5"
              filter="url(#cyan-glow)"
            />
            {/* Mekong grid lines */}
            <path
              d="M 590,690 L 520,730 L 480,780 M 520,730 L 450,700 M 480,780 L 410,750"
              fill="none"
              stroke="#00c8ff"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.75"
            />
            {/* Phu Quoc Island */}
            <path
              d="M 330,780 L 340,760 L 345,785 L 335,800 Z"
              fill="rgba(0, 229, 255, 0.5)"
              stroke="#00e5ff"
              strokeWidth="2"
              filter="url(#cyan-glow)"
            />
            <text x="270" y="785" fill="#7dd3fc" fontSize="9" fontFamily="monospace">PHU QUOC</text>
          </g>

          {/* ARCHIPELAGO: HOANG SA (PARACEL ISLANDS) */}
          <g className="cursor-pointer">
            {/* Connection lines from Da Nang */}
            <line x1="565" y1="425" x2="800" y2="380" stroke="#00e5ff" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <g transform="translate(800, 360)">
              {/* Island Cluster Dots */}
              <circle cx="0" cy="0" r="4" fill="#ffffff" filter="url(#cyan-glow)" />
              <circle cx="0" cy="0" r="10" fill="none" stroke="#00e5ff" strokeWidth="1.2" className="animate-ping" />
              <circle cx="-15" cy="-8" r="2.5" fill="#38bdf8" />
              <circle cx="12" cy="-12" r="2" fill="#38bdf8" />
              <circle cx="20" cy="10" r="3" fill="#38bdf8" />
              <circle cx="-8" cy="18" r="2" fill="#38bdf8" />
              <circle cx="15" cy="24" r="2" fill="#38bdf8" />
              
              <text x="25" y="0" fill="#ffffff" fontSize="13" fontFamily="monospace" fontWeight="bold" letterSpacing="2" filter="url(#cyan-glow)">
                HOANG SA
              </text>
              <text x="25" y="16" fill="#7dd3fc" fontSize="10" fontFamily="monospace" letterSpacing="1">
                (PARACEL ISLANDS)
              </text>
            </g>
          </g>

          {/* ARCHIPELAGO: TRUONG SA (SPRATLY ISLANDS) */}
          <g className="cursor-pointer">
            {/* Connection lines */}
            <line x1="640" y1="660" x2="930" y2="700" stroke="#00e5ff" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <g transform="translate(930, 680)">
              {/* Island Cluster Dots */}
              <circle cx="0" cy="0" r="4.5" fill="#ffffff" filter="url(#cyan-glow)" />
              <circle cx="0" cy="0" r="12" fill="none" stroke="#00e5ff" strokeWidth="1.2" className="animate-ping" />
              
              <circle cx="-25" cy="-15" r="2.5" fill="#38bdf8" />
              <circle cx="-10" cy="-30" r="2" fill="#38bdf8" />
              <circle cx="20" cy="-20" r="3" fill="#38bdf8" />
              <circle cx="-40" cy="10" r="2" fill="#38bdf8" />
              <circle cx="15" cy="25" r="3" fill="#38bdf8" />
              <circle cx="-20" cy="40" r="2.5" fill="#38bdf8" />
              <circle cx="35" cy="35" r="2" fill="#38bdf8" />
              <circle cx="50" cy="-5" r="2" fill="#38bdf8" />
              <circle cx="-60" cy="25" r="2" fill="#38bdf8" />

              <text x="25" y="0" fill="#ffffff" fontSize="13" fontFamily="monospace" fontWeight="bold" letterSpacing="2" filter="url(#cyan-glow)">
                TRUONG SA
              </text>
              <text x="25" y="16" fill="#7dd3fc" fontSize="10" fontFamily="monospace" letterSpacing="1">
                (SPRATLY ISLANDS)
              </text>
            </g>
          </g>

          {/* CIRCUIT BOARD DIGITAL TRAILS SPREADING OUT OF DONG NAI */}
          <g className="transition-opacity duration-700" style={{ opacity: phase >= 2 ? 1 : 0.2 }}>
            <path
              d="M 580,680 L 580,740 L 610,770 L 680,770
                 M 540,690 L 500,730 L 500,790
                 M 610,650 L 670,650 L 700,620
                 M 560,620 L 560,570 L 530,540 L 470,540"
              fill="none"
              stroke="url(#circuitGoldGrad)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Circuit Nodes */}
            <circle cx="680" cy="770" r="3" fill="#fde047" />
            <circle cx="500" cy="790" r="3" fill="#38bdf8" />
            <circle cx="700" cy="620" r="3" fill="#f59e0b" />
            <circle cx="470" cy="540" r="3" fill="#00e5ff" />
          </g>

          {/* ========================================================================= */}
          {/* REGIONAL FOCUS: DONG NAI PROVINCE (GOLD AMBER GLOW & PULSE RADAR RIPPLES) */}
          {/* ========================================================================= */}
          <g transform="translate(565, 650)">
            {/* Multi-layered Pulsing Radar Rings */}
            {phase >= 2 && (
              <g>
                {/* Outermost Radar Ring */}
                <circle cx="0" cy="0" r="140" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 4" opacity="0.35" className="animate-spin" style={{ animationDuration: '24s' }} />
                <circle cx="0" cy="0" r="110" fill="none" stroke="#00e5ff" strokeWidth="1.5" opacity="0.4" />
                <circle cx="0" cy="0" r="80" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
                
                {/* Dynamic Radar Pulse Waves */}
                <circle cx="0" cy="0" r="40" fill="rgba(245, 158, 11, 0.15)" stroke="#fbbf24" strokeWidth="2.5" className="animate-ping" style={{ animationDuration: '2.5s' }} />
                <circle cx="0" cy="0" r="75" fill="none" stroke="#38bdf8" strokeWidth="2" className="animate-ping" style={{ animationDuration: '3.2s', animationDelay: '0.8s' }} />
                <circle cx="0" cy="0" r="120" fill="none" stroke="#f59e0b" strokeWidth="1.5" className="animate-ping" style={{ animationDuration: '4s', animationDelay: '1.4s' }} />

                {/* Radar Sweep Beam Effect */}
                <g className="animate-spin" style={{ animationDuration: '6s', transformOrigin: '0 0' }}>
                  <path d="M 0,0 L 120,-40 A 130 130 0 0 1 130,20 Z" fill="url(#cyberLineGrad)" opacity="0.35" />
                </g>
              </g>
            )}

            {/* DONG NAI PROVINCE GEOMETRY (Detailed Highlighted Polygon) */}
            <path
              d="M -30,-25 
                 L -5,-35 L 25,-30 L 40,-15 L 50,10 L 35,30 L 10,40 L -20,35 L -35,15 L -45,-5 Z"
              fill="url(#dongNaiRadial)"
              stroke="#fffbeb"
              strokeWidth="3.5"
              filter="url(#gold-glow)"
              className="transition-transform duration-500 hover:scale-110"
            />
            {/* Internal district lines */}
            <path
              d="M -5,-35 L 5,0 L 35,30 M -35,15 L 5,0 L 40,-15 M 5,0 L 10,40"
              fill="none"
              stroke="#78350f"
              strokeWidth="1.2"
              opacity="0.6"
            />

            {/* Futuristic Pin / Location Marker */}
            <g transform="translate(5, -15)">
              {/* Vertical Laser Beam */}
              <line x1="0" y1="0" x2="0" y2="-60" stroke="#fef08a" strokeWidth="2" filter="url(#gold-glow)" />
              
              {/* Pin Head */}
              <g transform="translate(0, -65)">
                <circle cx="0" cy="0" r="18" fill="rgba(15, 23, 42, 0.9)" stroke="#fbbf24" strokeWidth="2" filter="url(#gold-glow)" />
                <circle cx="0" cy="0" r="12" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" className="animate-spin" style={{ animationDuration: '8s' }} />
                <circle cx="0" cy="0" r="5" fill="#fef08a" />
              </g>

              {/* Pin Label Banner */}
              <g transform="translate(25, -70)">
                <rect x="0" y="0" width="130" height="32" rx="4" fill="rgba(6, 20, 39, 0.9)" stroke="#f59e0b" strokeWidth="1.5" />
                <text x="8" y="14" fill="#fde047" fontSize="11" fontFamily="monospace" fontWeight="bold">DONG NAI</text>
                <text x="8" y="26" fill="#93c5fd" fontSize="9" fontFamily="monospace">CADASTRE CENTER</text>
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* BOTTOM FOOTER BRANDING */}
      <div className="absolute bottom-3 left-6 right-6 z-20 flex justify-between items-center text-[10px] font-mono text-cyan-500/60 pointer-events-none">
        <div>CHI NHANH VAN PHONG DANG KY DAT DAI // CHON THANH - DONG NAI</div>
        <div>SECURE ENCRYPTION: SHA-256 / SSL 4096-BIT</div>
      </div>
    </div>
  );
};
