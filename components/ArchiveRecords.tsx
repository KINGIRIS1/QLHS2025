
import React, { useState } from 'react';
import { User } from '../types';
import { Copy, FileText, ShieldAlert, FileSignature, Archive } from 'lucide-react';
import SaoLucView from './archive/SaoLucView';
import CongVanView from './archive/CongVanView';
import ArchiveBlockingView from './archive/ArchiveBlockingView';
import VaoSoView from './archive/VaoSoView';

interface ArchiveRecordsProps {
    currentUser: User;
    wards: string[];
}

const ArchiveRecords: React.FC<ArchiveRecordsProps> = ({ currentUser, wards }) => {
    const [activeTab, setActiveTab] = useState<'saoluc' | 'congvan' | 'nganchan' | 'vaoso'>('saoluc');

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
            {/* MAIN HEADER TABS */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
                <div className="flex items-center">
                    <button 
                        onClick={() => setActiveTab('saoluc')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'saoluc' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Copy size={16}/> Sao lục hồ sơ
                    </button>
                    <button 
                        onClick={() => setActiveTab('congvan')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'congvan' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileText size={16}/> Quản lý Công văn
                    </button>
                    <button 
                        onClick={() => setActiveTab('nganchan')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'nganchan' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <ShieldAlert size={16}/> Quản lý ngăn chặn
                    </button>
                    <button 
                        onClick={() => setActiveTab('vaoso')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'vaoso' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileSignature size={16}/> Vào số GCN
                    </button>
                </div>

                {/* HIGHLIGHTED CATEGORY BADGE AT TOP-RIGHT */}
                <div className="py-1 px-2.5 ml-auto shrink-0 flex items-center">
                    <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white rounded-lg shadow-sm font-black text-xs sm:text-sm tracking-wide uppercase border border-purple-400/30">
                        <Archive size={16} className="text-purple-200 shrink-0" />
                        <span>Hồ sơ lưu trữ</span>
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'saoluc' && <SaoLucView currentUser={currentUser} wards={wards} />}
                {activeTab === 'congvan' && <CongVanView currentUser={currentUser} />}
                {activeTab === 'nganchan' && <ArchiveBlockingView currentUser={currentUser} />}
                {activeTab === 'vaoso' && <VaoSoView currentUser={currentUser} wards={wards} />}
            </div>
        </div>
    );
};

export default ArchiveRecords;
