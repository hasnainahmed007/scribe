import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  FileAudio,
  Trash2,
  Download,
  RefreshCw,
  FolderOpen,
  Youtube,
  CheckCircle2,
} from 'lucide-react';
import { SavedTranscript } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { formatPlayerTime } from '../utils/timeFormat';
import { deleteAudioBlob } from '../utils/audioStorage';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

interface TranscriptHistoryProps {
  onLoadTranscript: (transcript: SavedTranscript) => void;
  onExportTranscript: (transcript: SavedTranscript) => void;
  onOpenInYouTube?: (transcript: SavedTranscript) => void;
  onDeleteTranscript?: (deletedId: number, item: SavedTranscript) => void;
  onNewRecording: () => void;
}

export const TranscriptHistory: React.FC<TranscriptHistoryProps> = ({
  onLoadTranscript,
  onExportTranscript,
  onOpenInYouTube,
  onDeleteTranscript,
  onNewRecording,
}) => {
  const { token } = useAuth();
  const [transcripts, setTranscripts] = useState<SavedTranscript[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await safeFetchJson<{ success: boolean; data: SavedTranscript[] }>(
        '/api/transcripts',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok && res.data?.data) {
        setTranscripts(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch transcript history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const executeDelete = async (item: SavedTranscript, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(item.id);
    try {
      const res = await safeFetchJson(`/api/transcripts/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        // Also remove local cached audio from vault
        try {
          await deleteAudioBlob(`transcript_${item.id}`);
          if (item.audioName) await deleteAudioBlob(`title_${item.audioName.trim()}`);
          if (item.title) await deleteAudioBlob(`title_${item.title.trim()}`);
        } catch (vaultErr) {
          console.warn('Failed to remove audio from vault:', vaultErr);
        }

        setTranscripts((prev) => prev.filter((t) => t.id !== item.id));

        // Notify parent workspace to immediately clear subtitle and active editor state
        if (onDeleteTranscript) {
          onDeleteTranscript(item.id, item);
        }

        setActionMessage('Transcript permanently deleted from history.');
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        setActionMessage(res.error || 'Failed to delete transcript.');
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (err) {
      console.warn('Delete transcript failed:', err);
      setActionMessage('Failed to delete transcript.');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const filteredTranscripts = transcripts.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      t.title.toLowerCase().includes(query) ||
      (t.audioName ? t.audioName.toLowerCase().includes(query) : false) ||
      t.fullTranscript.toLowerCase().includes(query) ||
      (t.summary ? t.summary.toLowerCase().includes(query) : false)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight font-display">
            Transcription Archive
          </h2>
          <p className="text-sm text-[#b3b3b3] mt-0.5">
            Your saved audio transcription sessions and subtitle exports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchHistory}
            disabled={isLoading}
            title="Refresh History"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            onClick={onNewRecording}
            size="sm"
            className="flex items-center gap-1.5"
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Transcribe Audio</span>
          </Button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search transcripts by title or spoken text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          <span>{filteredTranscripts.length} of {transcripts.length} sessions</span>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Transcripts List */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
          <p>Loading transcripts...</p>
        </div>
      ) : filteredTranscripts.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#0f1726] border border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">
            {searchQuery ? 'No matching transcripts' : 'No recorded sessions'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching with a different title or keyword.'
              : 'Whenever you transcribe an audio file, it will automatically appear here for later editing and export.'}
          </p>
          {!searchQuery && (
            <button
              onClick={onNewRecording}
              className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Start First Transcription
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTranscripts.map((item) => {
            const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            const wordCount = item.wordCount || item.fullTranscript.split(/\s+/).filter(Boolean).length;
            const segmentsCount = item.segments?.length || 0;

            return (
              <Card
                key={item.id}
                className="p-5 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar: Title & Delete */}
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="text-sm font-semibold text-white truncate flex-1">
                      {item.title}
                    </h3>
                    {confirmDeleteId === item.id ? (
                      <div
                        className="flex items-center gap-1.5 bg-red-950/80 border border-red-500/40 px-2 py-1 rounded-md text-xs shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-rose-300 font-medium text-xs">Delete?</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="text-[#b3b3b3] hover:text-white px-2 py-0.5 rounded text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={(e) => executeDelete(item, e)}
                          disabled={deletingId === item.id}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-2.5 py-0.5 rounded text-xs flex items-center gap-1 cursor-pointer"
                        >
                          {deletingId === item.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            'Confirm'
                          )}
                        </button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(item.id);
                        }}
                        disabled={deletingId === item.id}
                        className="text-slate-500 hover:text-red-400 shrink-0"
                        title="Delete transcript"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Unboxed Metadata Line with typographic separators */}
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-3.5">
                    <span>{formattedDate}</span>
                    <span className="text-slate-600">·</span>
                    <span className="tabular-nums">{formatPlayerTime(item.durationSeconds ?? item.duration ?? 0)}</span>
                    <span className="text-slate-600">·</span>
                    <span>{segmentsCount} blocks</span>
                    <span className="text-slate-600">·</span>
                    <span>{wordCount} words</span>
                  </div>

                  {/* Transcript Excerpt */}
                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                    {item.fullTranscript || 'No transcript text available...'}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onLoadTranscript(item)}
                    className="flex-1 flex items-center justify-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open in Studio</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onExportTranscript(item)}
                    title="Export File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>

                  {onOpenInYouTube && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onOpenInYouTube(item)}
                      title="Open in YouTube SEO & Generate Automatically"
                    >
                      <Youtube className="w-3.5 h-3.5 text-[#b3b3b3] hover:text-red-400" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
