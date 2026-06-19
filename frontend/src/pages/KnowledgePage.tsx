import React, { useState } from 'react';
import { Globe, FileText } from 'lucide-react';
import CrawlerPanel from '../components/knowledge/CrawlerPanel';
import DocumentUpload from '../components/knowledge/DocumentUpload';

const TABS = [
  { id: 'crawler', label: 'Website Crawler', icon: Globe },
  { id: 'documents', label: 'Documents', icon: FileText },
];

export default function KnowledgePage() {
  const [tab, setTab] = useState('crawler');
  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {tab === 'crawler' ? <CrawlerPanel /> : <DocumentUpload />}
      </div>
    </div>
  );
}
