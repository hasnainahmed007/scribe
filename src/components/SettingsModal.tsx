import React, { useState } from 'react';
import {
  X,
  Sliders,
  User,
  Volume2,
  FileCode,
  Keyboard,
  ShieldCheck,
  Check,
  RotateCcw,
  Database,
  Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetWorkspace?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetWorkspace,
}) => {
  const { user, isSuperAdmin } = useAuth();

  // Settings State with LocalStorage Persistence
  const [activeTab, setActiveTab] = useState<'preferences' | 'profile' | 'shortcuts' | 'storage'>('preferences');
  const [defaultSpeaker, setDefaultSpeaker] = useState<string>(() => localStorage.getItem('bs_speaker_prefix') || 'Speaker');
  const [autoplayOnSelect, setAutoplayOnSelect] = useState<boolean>(() => localStorage.getItem('bs_autoplay_select') === 'true');
  const [autoScrollTranscript, setAutoScrollTranscript] = useState<boolean>(() => localStorage.getItem('bs_autoscroll') !== 'false');
  const [timestampPrecision, setTimestampPrecision] = useState<'seconds' | 'milliseconds'>(
    () => (localStorage.getItem('bs_timestamp_prec') as 'seconds' | 'milliseconds') || 'milliseconds'
  );
  const [defaultExportFormat, setDefaultExportFormat] = useState<string>(
    () => localStorage.getItem('bs_default_export') || 'srt'
  );
  const [textNormalization, setTextNormalization] = useState<boolean>(
    () => localStorage.getItem('bs_text_normalize') !== 'false' && localStorage.getItem('bs_bn_normalize') !== 'false'
  );

  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('bs_speaker_prefix', defaultSpeaker);
    localStorage.setItem('bs_autoplay_select', String(autoplayOnSelect));
    localStorage.setItem('bs_autoscroll', String(autoScrollTranscript));
    localStorage.setItem('bs_timestamp_prec', timestampPrecision);
    localStorage.setItem('bs_default_export', defaultExportFormat);
    localStorage.setItem('bs_text_normalize', String(textNormalization));

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  const handleResetDefaults = () => {
    setDefaultSpeaker('Speaker');
    setAutoplayOnSelect(false);
    setAutoScrollTranscript(true);
    setTimestampPrecision('milliseconds');
    setDefaultExportFormat('srt');
    setTextNormalization(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-[#181818] border border-[#282828] rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 id="settings-title" className="text-base font-bold text-white tracking-tight">
                Studio Settings & Preferences
              </h2>
              <p className="text-xs text-[#b3b3b3]">
                Customize your Bengali subtitle editor, shortcuts, and transcription engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-[#282828] flex items-center gap-2 bg-[#141414]">
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === 'preferences'
                ? 'bg-[#282828] text-white shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            Editor Preferences
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'bg-[#282828] text-white shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            Keyboard Shortcuts
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#282828] text-white shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            Account & Cloud Sync
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'preferences' && (
            <div className="space-y-5">
              {/* Speaker Prefix */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white block">
                  Default Speaker Label
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    value={defaultSpeaker}
                    onChange={(e) => setDefaultSpeaker(e.target.value)}
                    placeholder="Speaker 1"
                    className="max-w-xs text-xs"
                  />
                  <span className="text-xs text-[#b3b3b3]">
                    Used when inserting new speech segments
                  </span>
                </div>
              </div>

              {/* Timestamp Precision */}
              <div className="space-y-2 pt-2 border-t border-[#282828]">
                <label className="text-xs font-semibold text-white block">
                  Timecode Display Precision
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTimestampPrecision('milliseconds')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      timestampPrecision === 'milliseconds'
                        ? 'bg-[#1ed760] text-black border-[#1ed760]'
                        : 'bg-transparent text-[#b3b3b3] border-[#383838] hover:border-white'
                    }`}
                  >
                    High Precision (00:01:23.450)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimestampPrecision('seconds')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      timestampPrecision === 'seconds'
                        ? 'bg-[#1ed760] text-black border-[#1ed760]'
                        : 'bg-transparent text-[#b3b3b3] border-[#383838] hover:border-white'
                    }`}
                  >
                    Standard Seconds (01:23)
                  </button>
                </div>
              </div>

              {/* Toggle Options */}
              <div className="space-y-3 pt-3 border-t border-[#282828]">
                <label className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f1f] border border-[#282828] cursor-pointer hover:border-[#383838]">
                  <div className="pr-4">
                    <div className="text-xs font-semibold text-white">
                      Autoplay on Segment Click
                    </div>
                    <div className="text-xs text-[#b3b3b3]">
                      Immediately play audio from segment start time when clicking in the transcript
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoplayOnSelect}
                    onChange={(e) => setAutoplayOnSelect(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1ed760] accent-[#1ed760] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f1f] border border-[#282828] cursor-pointer hover:border-[#383838]">
                  <div className="pr-4">
                    <div className="text-xs font-semibold text-white">
                      Auto-scroll with Audio Playback
                    </div>
                    <div className="text-xs text-[#b3b3b3]">
                      Keep active playing subtitle segment visible in viewport
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoScrollTranscript}
                    onChange={(e) => setAutoScrollTranscript(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1ed760] accent-[#1ed760] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f1f] border border-[#282828] cursor-pointer hover:border-[#383838]">
                  <div className="pr-4">
                    <div className="text-xs font-semibold text-white">
                      Text & Punctuation Auto-Normalization
                    </div>
                    <div className="text-xs text-[#b3b3b3]">
                      Clean Unicode diacritics, whitespace, and punctuation for crisp rendering across all languages
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={textNormalization}
                    onChange={(e) => setTextNormalization(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1ed760] accent-[#1ed760] cursor-pointer"
                  />
                </label>
              </div>

              {/* Default Export Format */}
              <div className="space-y-2 pt-3 border-t border-[#282828]">
                <label className="text-xs font-semibold text-white block">
                  Default Subtitle Format for Quick Export
                </label>
                <div className="flex flex-wrap gap-2">
                  {['srt', 'vtt', 'docx', 'txt', 'json'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setDefaultExportFormat(fmt)}
                      className={`px-3 py-1 rounded-full text-xs font-mono uppercase font-bold border transition-all cursor-pointer ${
                        defaultExportFormat === fmt
                          ? 'bg-[#1ed760] text-black border-[#1ed760]'
                          : 'bg-[#1f1f1f] text-[#b3b3b3] border-[#282828] hover:border-white'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <p className="text-xs text-[#b3b3b3]">
                Power through subtitle editing with these standard media hotkeys:
              </p>

              <div className="space-y-2">
                {[
                  { key: 'Space', desc: 'Toggle Audio Play / Pause' },
                  { key: '← / →', desc: 'Seek 2 seconds backward / forward' },
                  { key: 'Shift + ← / →', desc: 'Jump to previous / next subtitle block' },
                  { key: 'Ctrl / Cmd + Enter', desc: 'Split subtitle segment at cursor' },
                  { key: 'Ctrl / Cmd + M', desc: 'Merge current segment with next block' },
                  { key: 'Ctrl / Cmd + F', desc: 'Open Find & Replace modal' },
                  { key: 'Ctrl / Cmd + S', desc: 'Export SubRip (.srt) caption file' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#1f1f1f] border border-[#282828]"
                  >
                    <span className="text-xs text-[#b3b3b3]">{item.desc}</span>
                    <kbd className="px-2.5 py-1 text-xs font-mono font-bold text-white bg-[#121212] border border-[#383838] rounded-md shadow-inner">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <Card className="p-4 space-y-3 bg-[#181818] border-[#282828]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{user?.name || 'Creator User'}</h3>
                    <p className="text-xs text-[#b3b3b3]">{user?.email || 'user@scriby.com'}</p>
                  </div>
                  <Badge variant="default" className="text-xs font-bold">
                    {user?.planName || 'Free Starter'}
                  </Badge>
                </div>

                <div className="pt-3 border-t border-[#282828] flex items-center justify-between text-xs">
                  <span className="text-[#b3b3b3]">Remaining Audio Credits:</span>
                  <span className="font-mono font-bold text-[#1ed760]">
                    {user?.creditsRemaining ?? 30} Minutes
                  </span>
                </div>
              </Card>

              {/* Cloud Sync Connection Status */}
              <div className="p-4 rounded-xl bg-[#141414] border border-[#282828] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Database className="w-4 h-4 text-[#1ed760]" />
                  <span>Workspace Cloud Synchronization</span>
                </div>
                <p className="text-xs text-[#b3b3b3] leading-relaxed">
                  Persistent cloud workspace storage connected. All transcript segments, metadata, and audio credits are safely synchronized in real time.
                </p>
                <div className="text-xs font-mono text-[#878787]">
                  Status: Connected · Encryption: SSL/TLS
                </div>
              </div>

              {/* Reset Local Cache Button */}
              {onResetWorkspace && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Reset workspace audio and load sample audio?')) {
                        onResetWorkspace();
                        onClose();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Workspace to Sample Demo</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#121212] border-t border-[#282828] flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
          >
            Reset Defaults
          </button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
