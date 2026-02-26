
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
            {/* MAIN HEADER TABS */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('vaoso')}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'vaoso' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <BookOpen size={16}/> Vào Số GCN
                </button>
                <button 
                    onClick={() => setActiveTab('saoluc')}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'saoluc' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Copy size={16}/> Sao Lục
                </button>
                <button 
                    onClick={() => setActiveTab('congvan')}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'congvan' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <FileText size={16}/> Công Văn
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'saoluc' && <SaoLucView currentUser={currentUser} />}
                {activeTab === 'vaoso' && <VaoSoView currentUser={currentUser} wards={wards} />}
                {activeTab === 'congvan' && <CongVanView currentUser={currentUser} />}
            </div>
        </div>
    );
};

export default ArchiveRecords;
