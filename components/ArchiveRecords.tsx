
import React, { useState } from 'react';
import { User } from '../types';
import { FolderArchive, Copy, BookOpen, FileText } from 'lucide-react';
import SaoLucView from './archive/SaoLucView';
import VaoSoView from './archive/VaoSoView';
import CongVanView from './archive/CongVanView';

interface ArchiveRecordsProps {
    currentUser: User;
    wards: string[];
}

const ArchiveRecords: React.FC<ArchiveRecordsProps> = ({ currentUser, wards }) => {
    const [activeTab, setActiveTab] = useState<'saoluc' | 'vaoso' | 'congvan'>('vaoso');

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] animate-fade-in">
            {/* MAIN HEADER TABS */}
            <div className="bg-white border-b border-gray-200 px-4 pt-2 shadow-sm shrink-0 z-20">
                <div className="flex items-end gap-1">
                    <button 
                        onClick={() => setActiveTab('vaoso')}
                        className={`px-6 py-3 rounded-t-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'vaoso' ? 'bg-teal-600 text-white shadow-md' : 'bg-transparent text-gray-600 hover:bg-gray-100'}`}
                    >
                        <BookOpen size={18}/> Vào Số GCN
                    </button>
                    <button 
                        onClick={() => setActiveTab('saoluc')}
                        className={`px-6 py-3 rounded-t-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'saoluc' ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Copy size={18}/> Sao Lục
                    </button>
                    <button 
                        onClick={() => setActiveTab('congvan')}
                        className={`px-6 py-3 rounded-t-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'congvan' ? 'bg-orange-600 text-white shadow-md' : 'bg-transparent text-gray-600 hover:bg-gray-100'}`}
                    >
                        <FileText size={18}/> Công Văn
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden p-4">
                {activeTab === 'saoluc' && <SaoLucView currentUser={currentUser} />}
                {activeTab === 'vaoso' && <VaoSoView currentUser={currentUser} wards={wards} />}
                {activeTab === 'congvan' && <CongVanView currentUser={currentUser} />}
            </div>
        </div>
    );
};

export default ArchiveRecords;
