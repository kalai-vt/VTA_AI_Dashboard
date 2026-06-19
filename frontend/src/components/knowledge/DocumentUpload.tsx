import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Trash2 } from 'lucide-react';
import { documentsAPI } from '../../lib/api';
import { Badge } from '../ui/Badge';

export default function DocumentUpload() {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['documents'], queryFn: documentsAPI.list });
  const docs: any[] = Array.isArray(data) ? data : [];
  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsAPI.upload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(f => uploadMutation.mutate(f));
  };
  return (
    <div className="space-y-6">
      <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}>
        <Upload className="mx-auto mb-3 text-gray-400" size={32} />
        <p className="text-sm font-medium text-gray-700">Drop files here or click to upload</p>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT supported</p>
        <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt" className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr><th className="text-left px-4 py-3">File</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading...</td></tr>}
            {!isLoading && docs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">No documents uploaded yet</td></tr>}
            {docs.map((doc: any) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 flex items-center gap-2"><FileText size={14} className="text-gray-400 shrink-0" /><span className="truncate max-w-xs">{doc.name || doc.filename}</span></td>
                <td className="px-4 py-3 text-gray-500 uppercase text-xs">{doc.file_type}</td>
                <td className="px-4 py-3"><Badge variant={doc.status === 'processed' ? 'success' : doc.status === 'failed' ? 'danger' : 'warning'}>{doc.status}</Badge></td>
                <td className="px-4 py-3 text-right"><button onClick={() => deleteMutation.mutate(doc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
