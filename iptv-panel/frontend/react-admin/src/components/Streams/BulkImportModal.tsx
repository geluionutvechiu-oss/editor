import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { streamsApi } from '../../services/api';
import toast from 'react-hot-toast';
import { Upload, X, Link, File } from 'lucide-react';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function BulkImportModal({ onClose, onImported }: Props) {
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [importMode, setImportMode] = useState<'url' | 'file'>('url');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.m3u', '.m3u8', '.txt'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024
  });

  const handleImport = async () => {
    if (importMode === 'url' && !url) {
      toast.error('Enter an M3U URL');
      return;
    }
    if (importMode === 'file' && !file) {
      toast.error('Select an M3U file');
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      if (importMode === 'url') {
        formData.append('url', url);
      } else if (file) {
        formData.append('file', file);
      }

      const response = await streamsApi.bulkImport(formData) as any;
      setResult(response);
      toast.success(`Imported ${response.stats?.imported || 0} streams`);
      onImported();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Import M3U</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setImportMode('url')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                importMode === 'url' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Link size={14} /> From URL
            </button>
            <button
              onClick={() => setImportMode('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                importMode === 'file' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <File size={14} /> Upload File
            </button>
          </div>

          {importMode === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">M3U URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://provider.com/playlist.m3u"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' :
                file ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' :
                'border-gray-300 hover:border-indigo-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload size={32} className={`mx-auto mb-2 ${file ? 'text-emerald-500' : 'text-gray-400'}`} />
              {file ? (
                <p className="text-sm text-emerald-600 font-medium">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isDragActive ? 'Drop the M3U file here' : 'Drag & drop or click to select'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">.m3u, .m3u8, .txt (max 50MB)</p>
                </>
              )}
            </div>
          )}

          {result && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Import Complete</p>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{result.stats?.total}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-emerald-600">{result.stats?.imported}</p>
                  <p className="text-xs text-gray-500">Imported</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-red-600">{result.stats?.errors}</p>
                  <p className="text-xs text-gray-500">Errors</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
