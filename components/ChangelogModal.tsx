import React, { useState } from 'react';
import { 
  X, Sparkles, CheckCircle2, Wrench, ShieldCheck, 
  Calendar, Layers, Download, Clock, ArrowRight, 
  ChevronRight, Tag, Info, Flame
} from 'lucide-react';
import { APP_CHANGELOGS, ChangelogItem } from '../constants/changelog';
import { APP_VERSION } from '../constants';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  isUpdateAvailable?: boolean;
  latestVersion?: string;
  onUpdateNow?: () => void;
  customChangelog?: string | null;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
  isUpdateAvailable = false,
  latestVersion = '',
  onUpdateNow,
  customChangelog
}) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(
    APP_CHANGELOGS[0]?.version || APP_VERSION
  );

  if (!isOpen) return null;

  const currentRelease = APP_CHANGELOGS.find(c => c.version === selectedVersion) || APP_CHANGELOGS[0];

  const getItemBadge = (type: ChangelogItem['type']) => {
    switch (type) {
      case 'feature':
        return {
          label: 'Tính năng mới',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <Sparkles size={13} className="text-emerald-600" />
        };
      case 'improvement':
        return {
          label: 'Cải tiến',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <CheckCircle2 size={13} className="text-blue-600" />
        };
      case 'fix':
        return {
          label: 'Sửa lỗi',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Wrench size={13} className="text-amber-600" />
        };
      case 'security':
        return {
          label: 'Bảo mật',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: <ShieldCheck size={13} className="text-purple-600" />
        };
      default:
        return {
          label: 'Cập nhật',
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          icon: <Info size={13} className="text-slate-600" />
        };
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 p-5 md:p-6 text-white relative shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20 shadow-inner">
              <Flame className="text-amber-300 fill-amber-300" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">
                  Nhật ký cập nhật hệ thống
                </h2>
                <span className="bg-white/20 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-white/30 backdrop-blur-xs">
                  Hiện tại: v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5 font-medium">
                Theo dõi các tính năng mới, cải tiến nghiệp vụ và bản vá lỗi hệ thống
              </p>
            </div>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50">
          
          {/* VERSION SELECTOR SIDEBAR (DESKTOP) */}
          <div className="w-full md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-3 overflow-x-auto md:overflow-y-auto shrink-0 flex md:flex-col gap-1.5 custom-scrollbar">
            <div className="hidden md:block px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Lịch sử phiên bản
            </div>
            
            {APP_CHANGELOGS.map((rel) => {
              const isSelected = rel.version === selectedVersion;
              return (
                <button
                  key={rel.version}
                  onClick={() => setSelectedVersion(rel.version)}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-left transition-all shrink-0 cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 shadow-xs font-bold' 
                      : 'hover:bg-slate-100 text-slate-600 border border-transparent font-medium'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black">v{rel.version}</span>
                      {rel.isLatest && (
                        <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                          Mới
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{rel.releaseDate}</div>
                  </div>
                  <ChevronRight size={14} className={`hidden md:block shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                </button>
              );
            })}
          </div>

          {/* CHANGELOG DETAILS PANEL */}
          <div className="flex-1 p-5 md:p-6 overflow-y-auto custom-scrollbar space-y-5 bg-white md:bg-slate-50/50">
            
            {/* Custom Server Announcement (if available) */}
            {customChangelog && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
                  <Sparkles size={15} /> Thông báo cập nhật từ máy chủ:
                </div>
                <p className="whitespace-pre-line leading-relaxed font-medium">{customChangelog}</p>
              </div>
            )}

            {/* Current Selected Release Header */}
            {currentRelease && (
              <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-800">Phiên bản {currentRelease.version}</span>
                    {currentRelease.highlightBadge && (
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                        {currentRelease.highlightBadge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Calendar size={13} />
                    <span>Phát hành: {currentRelease.releaseDate}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-indigo-900">
                  {currentRelease.title}
                </h3>

                {currentRelease.summary && (
                  <p className="text-xs text-slate-600 leading-relaxed font-normal pt-1 border-t border-slate-100">
                    {currentRelease.summary}
                  </p>
                )}
              </div>
            )}

            {/* List of Changes */}
            {currentRelease && currentRelease.items && (
              <div className="space-y-3">
                <div className="text-xs font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-600" />
                  Chi tiết nội dung nâng cấp:
                </div>

                <div className="space-y-2.5">
                  {currentRelease.items.map((item, index) => {
                    const badge = getItemBadge(item.type);
                    return (
                      <div 
                        key={index}
                        className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-3xs hover:border-indigo-200 transition-all flex items-start gap-3"
                      >
                        <div className="pt-0.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${badge.bg}`}>
                            {badge.icon}
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 leading-snug">
                            {item.title}
                          </h4>
                          {item.description && (
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-white border-t border-slate-200 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span>Hệ thống luôn tự động kiểm tra phiên bản mới nhất khi khởi động.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {isUpdateAvailable && onUpdateNow && (
              <button
                onClick={onUpdateNow}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download size={14} /> Cập nhật v{latestVersion} ngay
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
            >
              Đã hiểu &amp; Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChangelogModal;
