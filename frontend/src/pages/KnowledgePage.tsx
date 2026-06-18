import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crawlerAPI, documentsAPI } from '../lib/api'
import Badge from '../components/ui/Badge'
import type { WebsitePage, Document } from '../types'
import { Globe, Upload, Trash2, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KnowledgePage() {
  const [tab, setTab] = useState<'crawler' | 'documents'>('crawler')
  const [crawlUrl, setCrawlUrl] = useState('')
  const [maxPages, setMaxPages] = useState(20)
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: pages, isLoading: pagesLoading } = useQuery({
    queryKey: ['pages'],
    queryFn: () => crawlerAPI.getPages().then((r) => r.data as WebsitePage[]),
  })

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsAPI.list().then((r) => r.data as Document[]),
  })

  const crawlMutation = useMutation({
    mutationFn: () => crawlerAPI.start(crawlUrl, maxPages),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] })
      setCrawlUrl('')
    },
  })

  const deletePageMutation = useMutation({
    mutationFn: (id: string) => crawlerAPI.deletePage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] }),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsAPI.upload(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => documentsAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => uploadMutation.mutate(file))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Knowledge Base</h2>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('crawler')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'crawler' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Globe size={16} />
          Website Crawler
        </button>
        <button
          onClick={() => setTab('documents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'documents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Upload size={16} />
          Documents
        </button>
      </div>

      {tab === 'crawler' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Start Web Crawl</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                <input
                  type="url"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Pages: <span className="text-blue-600 font-semibold">{maxPages}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1</span>
                  <span>100</span>
                </div>
              </div>
              <button
                onClick={() => crawlMutation.mutate()}
                disabled={!crawlUrl || crawlMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                {crawlMutation.isPending ? (
                  <><RefreshCw size={16} className="animate-spin" /> Crawling...</>
                ) : (
                  <><Globe size={16} /> Start Crawl</>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Crawled Pages</h3>
            </div>
            {pagesLoading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : !pages || pages.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No pages crawled yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">URL</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Title</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Status</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Crawled</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pages.map((page) => (
                    <tr key={page.id}>
                      <td className="px-4 py-3 max-w-xs">
                        <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block text-xs">
                          {page.url}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-700 truncate max-w-xs">{page.title}</td>
                      <td className="px-4 py-3">
                        <Badge label={page.status} variant={page.status === 'done' ? 'done' : 'processing'} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {page.crawled_at ? format(new Date(page.crawled_at), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deletePageMutation.mutate(page.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-4">
          <div
            className={`bg-white rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              handleFileUpload(e.dataTransfer.files)
            }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Drop files here or click to upload</p>
            <p className="text-gray-400 text-sm mt-1">Supports PDF, DOCX, TXT</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>

          {uploadMutation.isPending && (
            <div className="bg-blue-50 border border-blue-200 text-blue-600 rounded-lg px-4 py-3 text-sm">
              Uploading file(s)...
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Documents</h3>
            </div>
            {docsLoading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : !docs || docs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No documents uploaded yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Filename</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Type</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Size</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Status</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Chunks</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3">Date</th>
                    <th className="text-left text-xs text-gray-500 font-semibold px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{doc.filename}</td>
                      <td className="px-4 py-3 text-gray-500 uppercase text-xs">{doc.file_type}</td>
                      <td className="px-4 py-3 text-gray-500">{formatFileSize(doc.file_size)}</td>
                      <td className="px-4 py-3">
                        <Badge label={doc.status} variant={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{doc.chunk_count}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteDocMutation.mutate(doc.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
