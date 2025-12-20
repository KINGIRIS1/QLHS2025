
import React from 'react';
import { RecordFile, RecordStatus } from '../types';
import { isRecordOverdue } from '../utils/appHelpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, RotateCcw, CheckCircle, AlertTriangle, ArchiveX } from 'lucide-react';

interface DashboardViewProps {
    records: RecordFile[];
}

const DashboardChart = ({ data }: { data: any[] }) => (
  <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ records }) => {
    const total = records.length;
    const completed = records.filter(r => r.status === RecordStatus.HANDOVER).length;
    const processing = records.filter(r => r.status !== RecordStatus.HANDOVER && r.status !== RecordStatus.RECEIVED && r.status !== RecordStatus.WITHDRAWN).length;
    const overdue = records.filter(r => isRecordOverdue(r)).length;
    const withdrawn = records.filter(r => r.status === RecordStatus.WITHDRAWN).length;
    
    const stats = [
        { name: 'Hoàn thành', value: completed, fill: '#22c55e' },
        { name: 'Đang xử lý', value: processing, fill: '#3b82f6' },
        { name: 'Quá hạn', value: overdue, fill: '#ef4444' },
        { name: 'Đã rút', value: withdrawn, fill: '#64748b' }
    ];

    return (
        <div className="h-full overflow-y-auto space-y-6 p-2">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><p className="text-gray-500 text-sm">Tổng hồ sơ</p><h3 className="text-2xl font-bold text-gray-800">{total}</h3></div>
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600"><FileText size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><p className="text-gray-500 text-sm">Đang xử lý</p><h3 className="text-2xl font-bold text-yellow-600">{processing}</h3></div>
                    <div className="bg-yellow-100 p-3 rounded-full text-yellow-600"><RotateCcw size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><p className="text-gray-500 text-sm">Hoàn thành</p><h3 className="text-2xl font-bold text-green-600">{completed}</h3></div>
                    <div className="bg-green-100 p-3 rounded-full text-green-600"><CheckCircle size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><p className="text-gray-500 text-sm">Quá hạn</p><h3 className="text-2xl font-bold text-red-600">{overdue}</h3></div>
                    <div className="bg-red-100 p-3 rounded-full text-red-600"><AlertTriangle size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><p className="text-gray-500 text-sm">Đã rút</p><h3 className="text-2xl font-bold text-slate-600">{withdrawn}</h3></div>
                    <div className="bg-slate-200 p-3 rounded-full text-slate-600"><ArchiveX size={24} /></div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Biểu đồ trạng thái</h3>
                    <div className="flex-1 min-h-0 w-full relative">
                    <div className="absolute inset-0">
                        <DashboardChart data={stats} />
                    </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center h-80">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Tỷ lệ hoàn thành</h3>
                    <div className="w-full flex-1 min-h-0 relative">
                        <div className="absolute inset-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {stats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
