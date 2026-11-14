import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  FileCode,
  FileSpreadsheet,
  File,
  Lock,
  Sparkles,
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import {
  generateSRT,
  generateTXT,
  generateJSON,
  downloadDOCX,
  triggerDownload,
} from '../utils/exportUtils';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: TranscriptSegment[];
  audioName: string;
  summary: string;
  onOpenPricing?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  segments,
  audioName,
  summary,
  onOpenPricing,
}) => {
  const { user } = useAuth();
  const [activeFormat, setActiveFormat] = useState<'srt' | 'txt' | 'docx' | 'json'>('srt');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeSpeakers, setIncludeSpeakers] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);

  if (!isOpen) return null;

  // Check if current user has access to advanced exports (docx & json)
  const isSuperAdmin = user?.role === 'superadmin';
  const hasAdvancedExport = isSuperAdmin || Boolean(user?.planModules?.includes('advanced_export'));
  const isCurrentFormatLocked = (activeFormat === 'docx' || activeFormat === 'json') && !hasAdvancedExport;

  const baseFileName = (audioName || 'bengali_transcript').replace(/\.[^/.]+$/, '');

  const srtContent = generateSRT(segments);
  const txtContent = generateTXT(segments, includeTimestamps, includeSpeakers);
  const jsonContent = generateJSON(segments, { audioName, summary });

  const handleCopy = () => {
    if (isCurrentFormatLocked) return;
    let textToCopy = '';
    if (activeFormat === 'srt') textToCopy = srtContent;
    else if (activeFormat === 'txt') textToCopy = txtContent;
    else if (activeFormat === 'json') textToCopy = jsonContent;
    else textToCopy = txtContent;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (isCurrentFormatLocked) {
      if (onOpenPricing) onOpenPricing();
      return;
    }

    if (activeFormat === 'srt') {
      triggerDownload(srtContent, `${baseFileName}.srt`, 'text/plain;charset=utf-8');
    } else if (activeFormat === 'txt') {
      triggerDownload(txtContent, `${baseFileName}.txt`, 'text/plain;charset=utf-8');
    } else if (activeFormat === 'json') {
      triggerDownload(jsonContent, `${baseFileName}.json`, 'application/json');
    } else if (activeFormat === 'docx') {
      setIsGeneratingDocx(true);
      try {
        await downloadDOCX(segments, audioName || 'Bengali Audio Transcript', summary);
      } finally {
        setIsGeneratingDocx(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#101726] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Export Subtitles & Transcript Files
              </h3>
              <p className="text-xs text-slate-400">
                Choose your required format and download in 1 click
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          {/* SRT (Standard) */}
          <button
            onClick={() => setActiveFormat('srt')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFormat === 'srt'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>SRT Subtitles (.srt)</span>
          </button>

          {/* TXT (Standard) */}
          <button
            onClick={() => setActiveFormat('txt')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFormat === 'txt'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <File className="w-4 h-4 text-amber-400" />
            <span>Plain Text (.txt)</span>
          </button>

          {/* Word (.docx) - Advanced Export */}
          <button
            onClick={() => setActiveFormat('docx')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFormat === 'docx'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <span>Word Document (.docx)</span>
            {!hasAdvancedExport && (
              <Badge variant="amber" className="text-[11px] px-1.5 py-0 h-4">
                <Lock className="w-2.5 h-2.5 mr-0.5" />
                Pro
              </Badge>
            )}
          </button>

          {/* JSON (.json) - Advanced Export */}
          <button
            onClick={() => setActiveFormat('json')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFormat === 'json'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-4 h-4 text-purple-400" />
            <span>Data JSON (.json)</span>
            {!hasAdvancedExport && (
              <Badge variant="amber" className="text-[11px] px-1.5 py-0 h-4">
                <Lock className="w-2.5 h-2.5 mr-0.5" />
                Pro
              </Badge>
            )}
          </button>
        </div>

        {/* Format Specific Options */}
        {activeFormat === 'txt' && (
          <div className="px-6 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-5 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
              />
              <span>Include Timestamps</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSpeakers}
                onChange={(e) => setIncludeSpeakers(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
              />
              <span>Include Speaker Names</span>
            </label>
          </div>
        )}

        {/* Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 font-mono text-xs text-slate-300">
          {/* Locked Notice if format is locked */}
          {isCurrentFormatLocked ? (
            <div className="py-12 text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white font-display">
                .{activeFormat.toUpperCase()} Export Requires Pro Creator
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Native Microsoft Word (.docx) tables and structured JSON files are part of our Pro Creator and Agency tiers. Upgrade today to unlock all export options.
              </p>
              {onOpenPricing && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenPricing();
                  }}
                  className="px-5 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all font-sans cursor-pointer"
                >
                  Upgrade Plan to Unlock
                </button>
              )}
            </div>
          ) : (
            <>
              {activeFormat === 'srt' && (
                <pre className="whitespace-pre-wrap leading-relaxed font-sans font-bengali">
                  {srtContent}
                </pre>
              )}

              {activeFormat === 'txt' && (
                <pre className="whitespace-pre-wrap leading-relaxed font-sans font-bengali">
                  {txtContent}
                </pre>
              )}

              {activeFormat === 'json' && (
                <pre className="whitespace-pre-wrap text-emerald-300/90 leading-relaxed">
                  {jsonContent}
                </pre>
              )}

              {activeFormat === 'docx' && (
                <div className="font-sans space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300">
                    <div className="text-sm font-bold text-white mb-1">
                      Microsoft Word (.docx) Document Preview
                    </div>
                    <p className="text-xs text-slate-400">
                      Formatted table document containing segment timecodes, speaker tags, and accurate Bengali transcript text.
                    </p>
                  </div>
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-200">
                        <tr>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Speaker</th>
                          <th className="p-2.5">Transcript</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {segments.slice(0, 5).map((seg) => (
                          <tr key={seg.id} className="text-slate-300">
                            <td className="p-2.5 font-mono text-slate-400">
                              {seg.start}s - {seg.end}s
                            </td>
                            <td className="p-2.5 font-semibold text-slate-200">{seg.speaker}</td>
                            <td className="p-2.5 font-bengali">{seg.text}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#0e1422] flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Total Segments: <span className="font-mono text-slate-200 font-semibold">{segments.length}</span>
          </div>

          <div className="flex items-center gap-3">
            {!isCurrentFormatLocked && activeFormat !== 'docx' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </Button>
            )}

            {isCurrentFormatLocked ? (
              <Button
                onClick={() => {
                  onClose();
                  if (onOpenPricing) onOpenPricing();
                }}
                size="sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade to Export .{activeFormat.toUpperCase()}</span>
              </Button>
            ) : (
              <Button
                onClick={handleDownload}
                disabled={isGeneratingDocx}
                size="sm"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isGeneratingDocx ? 'Generating Document...' : `Download (.${activeFormat})`}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
