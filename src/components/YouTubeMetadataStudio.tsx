import React, { useState, useEffect } from 'react';
import {
  Youtube,
  Sparkles,
  Copy,
  Check,
  TrendingUp,
  Hash,
  Share2,
  FileText,
  Clock,
  ArrowRight,
  Loader2,
  History,
  Trash2,
  Layers,
} from 'lucide-react';
import { YouTubeMetadata } from '../types';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

interface HistoricalMetadata {
  id: string;
  timestamp: string;
  label: string;
  metadata: YouTubeMetadata;
}

interface YouTubeMetadataStudioProps {
  transcript: string;
  metadata: YouTubeMetadata | null;
  onGenerateMetadata: (hint?: string) => Promise<void>;
  isLoading: boolean;
  onSelectTitleForThumbnail: (titleText: string) => void;
}

export const YouTubeMetadataStudio: React.FC<YouTubeMetadataStudioProps> = ({
  transcript,
  metadata,
  onGenerateMetadata,
  isLoading,
  onSelectTitleForThumbnail,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [titleHint, setTitleHint] = useState('');
  const [activeSocialTab, setActiveSocialTab] = useState<'facebook' | 'instagram' | 'linkedin' | 'twitter'>('facebook');

  // Archive of recent generations so creators never lose previous packs
  const [recentPacks, setRecentPacks] = useState<HistoricalMetadata[]>(() => {
    try {
      const stored = localStorage.getItem('bs_recent_seo_packs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activePackId, setActivePackId] = useState<string>('current');

  // When new metadata arrives, automatically archive it into recent generations
  useEffect(() => {
    if (metadata && metadata.titles && metadata.titles.length > 0) {
      setRecentPacks((prev) => {
        const primaryTitle = metadata.titles[0]?.title || 'Bengali YouTube Pack';
        // Avoid duplicate immediate entries
        if (prev.length > 0 && prev[0].metadata.description === metadata.description) {
          return prev;
        }

        const newPack: HistoricalMetadata = {
          id: `pack-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          label: primaryTitle.slice(0, 32) + '...',
          metadata,
        };

        const updated = [newPack, ...prev].slice(0, 6); // Keep last 6 packs
        try {
          localStorage.setItem('bs_recent_seo_packs', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setActivePackId('current');
    }
  }, [metadata]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerate = () => {
    onGenerateMetadata(titleHint);
  };

  // Determine which metadata to display: active selected historical pack OR current metadata
  const selectedHistorical = recentPacks.find((p) => p.id === activePackId);
  const displayedMetadata =
    activePackId !== 'current' && selectedHistorical
      ? selectedHistorical.metadata
      : metadata || (recentPacks.length > 0 ? recentPacks[0].metadata : null);

  const handleCopyAll = () => {
    if (!displayedMetadata) return;
    const allText = `=== YOUTUBE VIDEO TITLES ===
${displayedMetadata.titles.map((t) => `• [${t.category}] ${t.title}`).join('\n')}

=== DESCRIPTION ===
${displayedMetadata.description}

=== TIMESTAMPS / CHAPTERS ===
${displayedMetadata.chapters.map((c) => `${c.timestamp} - ${c.title}`).join('\n')}

=== TAGS ===
${displayedMetadata.tags.join(', ')}
`;
    copyToClipboard(allText, 'copy-all');
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="bg-[#181818] border border-[#282828] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
                <Youtube className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                YouTube SEO & Creator Repurposing Studio
              </h2>
            </div>
            <p className="text-xs text-[#b3b3b3]">
              Generate high-CTR Bengali video titles, descriptions, auto-timestamps, and keyword tags from your transcript.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Input
              type="text"
              placeholder="Topic or focus keywords..."
              value={titleHint}
              onChange={(e) => setTitleHint(e.target.value)}
              className="text-xs w-60"
            />
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !transcript}
              size="sm"
              className="bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold whitespace-nowrap shadow-[0_2px_8px_rgba(30,215,96,0.25)]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing & Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{displayedMetadata ? 'Generate New Pack' : 'Generate AI SEO'}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Loading Progress Bar with Non-Blocking State */}
        {isLoading && (
          <div className="mt-4 pt-3 border-t border-[#282828] flex items-center justify-between text-xs text-[#1ed760] animate-pulse">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#1ed760]" />
              <span className="font-semibold">
                Synthesizing titles and chapters... Your previously generated SEO pack remains accessible below.
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#b3b3b3]">Gemini 3.8 Intelligence</span>
          </div>
        )}
      </div>

      {/* Recent Generations Version Selector */}
      {recentPacks.length > 0 && (
        <div className="p-3 rounded-2xl bg-[#141414] border border-[#282828] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <History className="w-4 h-4 text-[#1ed760]" />
            <span className="font-bold text-white">Recent Generations Archive:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {recentPacks.map((pack, idx) => {
              const isSelected = activePackId === pack.id || (activePackId === 'current' && idx === 0);
              return (
                <button
                  key={pack.id}
                  onClick={() => setActivePackId(pack.id)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#282828] text-white border border-[#383838] shadow-sm font-bold'
                      : 'bg-[#181818] text-[#b3b3b3] hover:text-white border border-[#282828]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" />
                  <span>Version {recentPacks.length - idx}</span>
                  <span className="text-[10px] text-[#7c7c7c]">({pack.timestamp})</span>
                </button>
              );
            })}

            {displayedMetadata && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAll}
                className="ml-2 text-xs h-7 px-3"
              >
                {copiedKey === 'copy-all' ? (
                  <>
                    <Check className="w-3 h-3 text-[#1ed760]" />
                    <span className="text-[#1ed760]">Copied Complete Pack!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy All (Titles + Desc + Tags)</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Empty State when no metadata has been generated yet */}
      {!displayedMetadata && !isLoading && (
        <div className="p-16 text-center rounded-2xl bg-[#181818] border border-[#282828]">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto mb-3 flex items-center justify-center">
            <Youtube className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            No YouTube Metadata Generated Yet
          </h3>
          <p className="text-xs text-[#b3b3b3] max-w-md mx-auto mb-5 leading-relaxed">
            Generate high-CTR Bengali video titles, descriptions with automatic chapter markers, and SEO tags from your transcript in 1 click.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={!transcript}
            size="default"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Now</span>
          </Button>
        </div>
      )}

      {/* Generated Content Grid */}
      {displayedMetadata && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Viral YouTube Titles & Thumbnail Ideas */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-5 bg-[#181818] border-[#282828]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#282828]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1ed760]" />
                  <h3 className="text-sm font-bold text-white">
                    High-CTR Video Titles
                  </h3>
                </div>
                <span className="text-[11px] text-[#7c7c7c] font-mono">
                  {displayedMetadata.titles.length} Variations
                </span>
              </div>

              <div className="space-y-3">
                {displayedMetadata.titles.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#141414] border border-[#282828] hover:border-[#383838] transition-all flex flex-col justify-between group"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1.5 text-[#b3b3b3]">
                      <span className="text-[#1ed760] font-bold">{item.category}</span>
                      {item.ctrScore && (
                        <span className="font-mono text-[#7c7c7c]">
                          CTR: <strong className="text-white">{item.ctrScore}%</strong>
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-white leading-relaxed mb-3">
                      {item.title}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-[#282828]">
                      <button
                        onClick={() => copyToClipboard(item.title, `title-${idx}`)}
                        className="flex items-center gap-1 text-[11px] text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedKey === `title-${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-[#1ed760]" />
                            <span className="text-[#1ed760] font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Title</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => onSelectTitleForThumbnail(item.title)}
                        className="flex items-center gap-1 text-[11px] text-[#1ed760] hover:text-[#1fdf64] font-bold transition-colors cursor-pointer"
                      >
                        <span>Use on Thumbnail</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Thumbnail Quick Headlines */}
            {displayedMetadata.thumbnailHeadlineIdeas && displayedMetadata.thumbnailHeadlineIdeas.length > 0 && (
              <Card className="p-5 bg-[#181818] border-[#282828]">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5">
                  Punchy Thumbnail Overlays:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {displayedMetadata.thumbnailHeadlineIdeas.map((headline, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectTitleForThumbnail(headline)}
                      className="px-3 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-white text-xs font-semibold border border-[#282828] hover:border-[#1ed760] transition-all cursor-pointer"
                      title="Send headline to 16:9 thumbnail canvas"
                    >
                      {headline}
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Description, Chapters, Tags, Social Media */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description & Chapters */}
            <Card className="p-6 bg-[#181818] border-[#282828]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#282828]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1ed760]" />
                  <h3 className="text-sm font-bold text-white">
                    Video Description & Chapters
                  </h3>
                </div>
                <button
                  onClick={() => copyToClipboard(displayedMetadata.description, 'desc')}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs text-[#b3b3b3] hover:text-white bg-[#282828] hover:bg-[#383838] rounded-full border border-[#383838] transition-colors cursor-pointer"
                >
                  {copiedKey === 'desc' ? (
                    <>
                      <Check className="w-3 h-3 text-[#1ed760]" />
                      <span className="text-[#1ed760] font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Description</span>
                    </>
                  )}
                </button>
              </div>

              {/* Formatted Description Display */}
              <div className="p-4 rounded-xl bg-[#141414] border border-[#282828] text-xs text-white whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-sans">
                {displayedMetadata.description}
              </div>

              {/* Auto Chapters list */}
              {displayedMetadata.chapters && displayedMetadata.chapters.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#282828]">
                  <div className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#1ed760]" />
                    <span>Auto-Generated YouTube Chapters:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {displayedMetadata.chapters.map((ch, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-[#141414] border border-[#282828] font-mono"
                      >
                        <span className="text-[#1ed760] font-bold">{ch.timestamp}</span>
                        <span className="text-white truncate font-sans text-xs">{ch.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* YouTube Studio Tags */}
            <Card className="p-6 bg-[#181818] border-[#282828]">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#282828]">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#1ed760]" />
                  <h3 className="text-sm font-bold text-white">
                    YouTube Studio Keyword Tags
                  </h3>
                </div>
                <button
                  onClick={() => copyToClipboard(displayedMetadata.tags.join(', '), 'tags')}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs text-[#b3b3b3] hover:text-white bg-[#282828] hover:bg-[#383838] rounded-full border border-[#383838] transition-colors cursor-pointer"
                >
                  {copiedKey === 'tags' ? (
                    <>
                      <Check className="w-3 h-3 text-[#1ed760]" />
                      <span className="text-[#1ed760] font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Comma Separated</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {displayedMetadata.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-[#141414] border border-[#282828] text-xs text-white"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </Card>

            {/* Social Media Repurposing Tabs */}
            <Card className="p-6 bg-[#181818] border-[#282828]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#282828]">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#1ed760]" />
                  <h3 className="text-sm font-bold text-white">
                    Multi-Platform Social Copy
                  </h3>
                </div>
                <div className="flex items-center p-0.5 bg-[#141414] rounded-full border border-[#282828]">
                  {(['facebook', 'instagram', 'linkedin', 'twitter'] as const).map((net) => (
                    <button
                      key={net}
                      onClick={() => setActiveSocialTab(net)}
                      className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all cursor-pointer ${
                        activeSocialTab === net
                          ? 'bg-[#282828] text-white shadow-sm'
                          : 'text-[#b3b3b3] hover:text-white'
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="p-4 rounded-xl bg-[#141414] border border-[#282828] text-xs text-white whitespace-pre-wrap leading-relaxed min-h-[90px]">
                  {displayedMetadata.socialPosts?.[activeSocialTab] || 'No social post generated for this platform.'}
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      displayedMetadata.socialPosts?.[activeSocialTab] || '',
                      `social-${activeSocialTab}`
                    )
                  }
                  className="absolute bottom-3 right-3 px-3 py-1 bg-[#282828] hover:bg-[#383838] text-white rounded-full text-[11px] font-bold border border-[#383838] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedKey === `social-${activeSocialTab}` ? (
                    <>
                      <Check className="w-3 h-3 text-[#1ed760]" />
                      <span className="text-[#1ed760]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
