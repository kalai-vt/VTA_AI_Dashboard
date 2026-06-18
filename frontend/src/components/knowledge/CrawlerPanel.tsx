import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Trash2, RefreshCw } from 'lucide-react';
import { crawlerAPI } from '../../lib/api';
import { Badge } from '../ui/Badge';

export default function CrawlerPanel() {
  const [url, setUrl] = useState('');
  const qc = useQueryClient();

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['crawler-pages'],
    queryFn: crawlerAPI.getPages,
    refetchInterval: 5000,
  });

  const crawlMutation = useMutation({
    mutationFn: crawlerAPI.start,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crawler-pages'] }); setUrl(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: crawlerAPI.deletePage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crawler-pages'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => crawlMutation.mutate(url)}
          disabled={!url || crawlMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {crawlMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Globe size={16} />}
          Crawl
        </button>
      </div>

      {crawlMutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
          Failed to start crawl. Please check the URL.
        </p>
      )}

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">URL</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Chunks</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading...</td></tr>
            )}
            {!isLoading && pages.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">No pages crawled yet</td></tr>
            )}
            {pages.map((page: any) => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 max-w-xs truncate text-blue-600">{page.url}</td>
                <td className="px-4 py-3">
                  <Badge variant={page.status === 'processed' ? 'success' : page.status === 'failed' ? 'danger' : 'warning'}>
                    {page.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">{page.chunks_count ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => deleteMutation.mutate(page.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
