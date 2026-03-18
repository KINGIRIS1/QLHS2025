import React from 'react';
import { RecordFile, RecordStatus } from '../../types';
import { STATUS_LABELS } from '../../constants';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Users
} from 'lucide-react';

interface MobileDashboardProps {
  records: RecordFile[];
}

const MobileDashboard: React.FC<MobileDashboardProps> = ({ records }) => {
  const stats = [
    { 
      label: 'Tổng hồ sơ', 
      value: records.length, 
      icon: FileText, 
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    { 
      label: 'Đã hoàn thành', 
      value: records.filter(r => r.status === RecordStatus.RETURNED).length, 
      icon: CheckCircle, 
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    { 
      label: 'Đang xử lý', 
      value: records.filter(r => [RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK].includes(r.status)).length, 
      icon: Clock, 
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    },
    { 
      label: 'Quá hạn', 
      value: records.filter(r => {
        if (!r.deadline || r.status === RecordStatus.RETURNED) return false;
        return new Date(r.deadline) < new Date();
      }).length, 
      icon: AlertTriangle, 
      color: 'bg-red-500',
      textColor: 'text-red-600'
    },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-white shadow-inner`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-medium">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            Hoạt động gần đây
          </h3>
          <button className="text-blue-600 text-xs font-bold">Xem tất cả</button>
        </div>
        <div className="divide-y divide-slate-50">
          {records.slice(0, 5).map((record, idx) => (
            <div key={idx} className="px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 shrink-0">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{record.customerName}</p>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="font-mono">{record.code}</span>
                  <span>•</span>
                  <span>{STATUS_LABELS[record.status]}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400">{record.receivedDate}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;
