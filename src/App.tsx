import React, { useState, useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AudioPlayerController } from './components/AudioPlayerController';
import { AudioInputHub } from './components/AudioInputHub';
import { TranscriptEditor } from './components/TranscriptEditor';
import { YouTubeMetadataStudio } from './components/YouTubeMetadataStudio';
import { ThumbnailCanvasStudio } from './components/ThumbnailCanvasStudio';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { TranscriptHistory } from './components/TranscriptHistory';
import { LockedModuleNotice } from './components/LockedModuleNotice';
import { ExportModal } from './components/ExportModal';
import { AuthPage } from './components/AuthPage';
import { PricingModal } from './components/PricingModal';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { SAMPLE_AUDIOS, generateSyntheticAudioBlob } from './data/sampleAudios';
import {
  TranscriptSegment,
  AudioSource,
  ActiveTab,
  AuthPageMode,
  YouTubeMetadata,
  UserRole,
  SaaSUser,
  SavedTranscript,
} from './types';
import { safeFetchJson } from './utils/apiClient';
import {
  FileAudio,
  Youtube,
  Image as ImageIcon,
  Download,
  Mic,
  ChevronRight,
  Headphones,
  ShieldCheck,
  Zap,
  History,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';

function BanglaScribeApp() {
  const { user, isSuperAdmin, token, refreshProfile, isLoadingSession } = useAuth();

  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [fullTranscript, setFullTranscript] = useState<string>('');
  const [summary, setSummary] = useState<string>('');

  // Audio Playback State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // App Navigation & Modals - Default to 'landing' for visitors
  const [activeTab, setActiveTab] = useState<ActiveTab>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<AuthPageMode>('login');
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isPricingOpen, setIsPricingOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [showInputModal, setShowInputModal] = useState<boolean>(false);
  const [isLoadingTranscription, setIsLoadingTranscription] = useState<boolean>(false);

  // YouTube Studio State
  const [youtubeMetadata, setYoutubeMetadata] = useState<YouTubeMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);
  const [thumbnailTitle, setThumbnailTitle] = useState<string>('বাংলা অডিও থেকে ১ ক্লিকে সাবটাইটেল');

  // Track user login state transitions for role-based auto-redirection
  const previousUserRef = useRef<SaaSUser | null>(null);

  useEffect(() => {
    if (!isLoadingSession) {
      if (!previousUserRef.current && user) {
        // Just logged in or session restored -> redirect based on role
        if (user.role === 'superadmin') {
          setActiveTab('admin');
        } else {
          setActiveTab('studio');
        }
      } else if (previousUserRef.current && !user) {
        // Just logged out -> return to landing page
        setActiveTab('landing');
      }
      previousUserRef.current = user;
    }
  }, [user, isLoadingSession]);

  // Load first sample audio on mount for instant studio demo
  useEffect(() => {
    const initialSample = SAMPLE_AUDIOS[0];
    const blob = generateSyntheticAudioBlob(initialSample.duration);
    const url = URL.createObjectURL(blob);

    setAudioSource({
      url,
      name: initialSample.title,
      duration: initialSample.duration,
      blob,
      mimeType: 'audio/wav',
      isSample: true,
    });
    setSegments(initialSample.segments);
    setFullTranscript(initialSample.fullTranscript);
    setSummary(initialSample.summary);
    setDuration(initialSample.duration);
    setThumbnailTitle(initialSample.title);
  }, []);

  // Sync with HTML5 Audio Element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isLooping]);

  // Audio Playback Handlers
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handlePlaybackRateChange = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleVolumeChange = (vol: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = vol;
    setVolume(vol);
  };

  // Play a specific segment: seek and immediately begin playback
  const handlePlaySegment = (start: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = start;
    setCurrentTime(start);
    audio.play().then(() => setIsPlaying(true)).catch((err) => {
      console.warn('Playback initiation warning:', err);
    });
  };

  // Restore a saved transcript from history into the studio workspace
  const handleLoadTranscript = (item: SavedTranscript) => {
    setSegments(item.segments);
    setFullTranscript(item.fullTranscript);
    setSummary(item.summary || '');
    setDuration(item.duration);
    setThumbnailTitle(item.title);
    if (item.audioUrl) {
      setAudioSource({
        url: item.audioUrl,
        name: item.title,
        duration: item.duration,
        mimeType: 'audio/wav',
      });
    } else {
      const blob = generateSyntheticAudioBlob(item.duration);
      const url = URL.createObjectURL(blob);
      setAudioSource({
        url,
        name: item.title,
        duration: item.duration,
        blob,
        mimeType: 'audio/wav',
      });
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
    setActiveTab('studio');
  };

  // Direct export from history list
  const handleExportTranscriptFromHistory = (item: SavedTranscript) => {
    setSegments(item.segments);
    setSummary(item.summary || '');
    setAudioSource((prev) =>
      prev
        ? { ...prev, name: item.title }
        : {
            url: '',
            name: item.title,
            duration: item.duration,
            mimeType: 'audio/wav',
          }
    );
    setIsExportOpen(true);
  };

  // Callback when transcription finishes
  const handleTranscriptionComplete = (
    newSource: AudioSource,
    newSegments: TranscriptSegment[],
    newFullText: string,
    newSummary: string
  ) => {
    setAudioSource(newSource);
    setSegments(newSegments);
    setFullTranscript(newFullText);
    setSummary(newSummary);
    setDuration(newSource.duration);
    setShowInputModal(false);
    setActiveTab('studio');

    if (newSegments.length > 0) {
      setThumbnailTitle(newSegments[0].text);
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }

    refreshProfile();
  };

  // Segment Handlers
  const handleUpdateSegment = (id: string, updated: Partial<TranscriptSegment>) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, ...updated } : seg))
    );
  };

  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((seg) => seg.id !== id));
  };

  const handleAddSegment = (afterId?: string) => {
    const newId = `seg-${Date.now()}`;
    if (!afterId) {
      const lastEnd = segments.length > 0 ? segments[segments.length - 1].end : 0;
      const newSegment: TranscriptSegment = {
        id: newId,
        start: lastEnd,
        end: lastEnd + 4,
        speaker: 'Speaker',
        text: 'নতুন বাক্য লিখুন...',
      };
      setSegments((prev) => [...prev, newSegment]);
      return;
    }

    const index = segments.findIndex((s) => s.id === afterId);
    if (index === -1) return;

    const currentSeg = segments[index];
    const newSegment: TranscriptSegment = {
      id: newId,
      start: currentSeg.end,
      end: currentSeg.end + 4,
      speaker: currentSeg.speaker,
      text: 'নতুন বাক্য লিখুন...',
    };

    const updated = [...segments];
    updated.splice(index + 1, 0, newSegment);
    setSegments(updated);
  };

  const handleMergeSegments = (firstId: string) => {
    const index = segments.findIndex((s) => s.id === firstId);
    if (index === -1 || index >= segments.length - 1) return;

    const first = segments[index];
    const second = segments[index + 1];

    const merged: TranscriptSegment = {
      id: first.id,
      start: first.start,
      end: second.end,
      speaker: first.speaker,
      text: `${first.text.trim()} ${second.text.trim()}`,
    };

    const updated = [...segments];
    updated.splice(index, 2, merged);
    setSegments(updated);
  };

  const handleSplitSegment = (id: string, splitIndex: number) => {
    const index = segments.findIndex((s) => s.id === id);
    if (index === -1) return;
    const current = segments[index];
    const midpoint = (current.start + current.end) / 2;

    const firstHalf: TranscriptSegment = {
      ...current,
      end: midpoint,
      text: current.text.slice(0, splitIndex).trim(),
    };
    const secondHalf: TranscriptSegment = {
      id: `seg-${Date.now()}`,
      start: midpoint,
      end: current.end,
      speaker: current.speaker,
      text: current.text.slice(splitIndex).trim(),
    };

    const updated = [...segments];
    updated.splice(index, 1, firstHalf, secondHalf);
    setSegments(updated);
  };

  const handleSearchReplace = (searchTerm: string, replaceTerm: string): number => {
    let count = 0;
    const regex = new RegExp(searchTerm, 'gi');

    const updated = segments.map((seg) => {
      const matches = seg.text.match(regex);
      if (matches) count += matches.length;
      return {
        ...seg,
        text: seg.text.replace(regex, replaceTerm),
      };
    });

    setSegments(updated);
    setFullTranscript((prev) => prev.replace(regex, replaceTerm));
    return count;
  };

  const handleGenerateMetadata = async (hint: string = '', transcriptOverride?: string) => {
    const textToAnalyze = transcriptOverride || fullTranscript || segments.map((s) => s.text).join(' ');
    if (!textToAnalyze) return;
    setIsLoadingMetadata(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await safeFetchJson<{ success: boolean; data: YouTubeMetadata; error?: string }>(
        '/api/generate-metadata',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            transcript: textToAnalyze,
            titleHint: hint,
          }),
        }
      );

      if (!res.ok || !res.data?.success || !res.data?.data) {
        throw new Error(res.error || res.data?.error || 'Failed to generate YouTube metadata.');
      }

      setYoutubeMetadata(res.data.data);
      if (res.data.data.titles && res.data.data.titles.length > 0) {
        setThumbnailTitle(res.data.data.titles[0].title);
      }
    } catch (err: any) {
      console.warn('Metadata generation error:', err);
      if (!youtubeMetadata) {
        const sentences = textToAnalyze.split(/[।!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 5);
        const titleTopic = hint || sentences[0] || 'বাংলা ভিডিও কন্টেন্ট';
        setYoutubeMetadata({
          titles: [
            { title: `${titleTopic} — সম্পূর্ণ আলোচনা ও আসল সত্য`, category: 'High CTR', ctrScore: 94 },
            { title: `${titleTopic}: যা আপনার অবশ্যই জানা প্রয়োজন (২০২৬ আপডেট)`, category: 'Authority', ctrScore: 91 },
            { title: `কেন সবাই ${titleTopic} নিয়ে আলোচনা করছে? আসল কারণ জানুন`, category: 'Viral', ctrScore: 89 },
          ],
          description: `📌 আজকের ভিডিওতে আমরা বিস্তারিত আলোচনা করেছি: "${titleTopic}"।\n\n00:00 - ভূমিকা ও প্রারম্ভিক সারসংক্ষেপ\n01:30 - মূল পটভূমি ও আলোচনা\n04:00 - উপসংহার ও পরবর্তী করণীয়\n\n#BanglaVideo #YouTubeSEO`,
          chapters: [
            { timestamp: '00:00', title: 'ভূমিকা ও প্রারম্ভিক সারসংক্ষেপ' },
            { timestamp: '01:30', title: 'মূল পটভূমি ও আলোচনা' },
            { timestamp: '04:00', title: 'উপসংহার ও পরবর্তী করণীয়' },
          ],
          tags: [titleTopic, 'বাংলা ভিডিও', 'Bangla Tutorial', 'YouTube SEO', 'Bangla Content'],
          socialPosts: {
            facebook: `নতুন ভিডিও: ${titleTopic}! বিস্তারিত জানতে দেখুন।`,
            instagram: `নতুন ভিডিও: ${titleTopic} লিংক বায়োতে।`,
            linkedin: `Comprehensive discussion on ${titleTopic}.`,
            twitter: `নতুন ভিডিও: ${titleTopic} 🚀 #Bangla`,
          },
          thumbnailHeadlineIdeas: [titleTopic.slice(0, 20), 'আসল সত্য!', 'নতুন আপডেট'],
        });
        setThumbnailTitle(`${titleTopic} — সম্পূর্ণ আলোচনা`);
      }
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // Role-based redirect callback after successful login or registration
  const handleAuthSuccess = (role: UserRole) => {
    if (role === 'superadmin') {
      setActiveTab('admin');
    } else {
      setActiveTab('studio');
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans">
      {/* Hidden Audio Element */}
      {audioSource?.url && (
        <audio
          ref={audioRef}
          src={audioSource.url}
          preload="auto"
        />
      )}

      {/* Top Bar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewRecording={() => {
          if (!user) {
            setAuthInitialMode('login');
            setActiveTab('auth');
          } else {
            setShowInputModal(true);
          }
        }}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenAuth={(mode = 'login') => {
          setAuthInitialMode(mode);
          setActiveTab('auth');
        }}
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        hasSegments={segments.length > 0}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* ======================================================================== */}
        {/* VIEW 0: AUTHENTICATION PAGE (Dedicated Full Page, NOT Modal)              */}
        {/* ======================================================================== */}
        {activeTab === 'auth' && (
          <AuthPage
            initialMode={authInitialMode}
            onSuccess={() => {
              if (user?.role === 'superadmin') setActiveTab('admin');
              else setActiveTab('studio');
            }}
            onBackToHome={() => setActiveTab('landing')}
          />
        )}

        {/* ======================================================================== */}
        {/* VIEW 1: LANDING PAGE (Only Home, About, Contact Us sections)             */}
        {/* Rendered when unauthenticated OR explicitly navigated to landing         */}
        {/* ======================================================================== */}
        {activeTab !== 'auth' && (!user || activeTab === 'landing') && (
          <LandingPage
            onGetStarted={() => {
              if (user) {
                if (user.role === 'superadmin') setActiveTab('admin');
                else setActiveTab('studio');
              } else {
                setAuthInitialMode('register');
                setActiveTab('auth');
              }
            }}
            onSignIn={() => {
              setAuthInitialMode('login');
              setActiveTab('auth');
            }}
          />
        )}

        {/* ======================================================================== */}
        {/* VIEW 2: SUPERADMIN PORTAL (Strictly SuperAdmin Only, NO Creator Tools)   */}
        {/* ======================================================================== */}
        {user && user.role === 'superadmin' && activeTab === 'admin' && (
          <div className="space-y-6">
            <SuperAdminPanel />
          </div>
        )}

        {/* ======================================================================== */}
        {/* VIEW 3: CREATOR WORKSPACE (Strictly Creator Only, NO SuperAdmin Tools)   */}
        {/* ======================================================================== */}
        {user && user.role === 'user' && (
          <>
            {/* 3A. SUBTITLES & WAVEFORM EDITOR */}
            {activeTab === 'studio' && (
              <div className="space-y-6">
                {/* Workspace Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white tracking-tight font-display">
                        {audioSource?.name || 'Bengali Audio Track'}
                      </h2>
                      {audioSource?.isSample && (
                        <span className="text-[11px] text-slate-500 font-mono">
                          (Sample Audio)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      <span>{segments.length} Subtitle Segments</span>
                      <span className="mx-2 text-slate-600">·</span>
                      <span>Waveform Alignment</span>
                      <span className="mx-2 text-slate-600">·</span>
                      <span>SRT, DOCX, TXT, JSON</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setShowInputModal(true)}
                      size="sm"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Transcribe New</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExportOpen(true)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </Button>
                  </div>
                </div>

                {/* Global Seekable Waveform Player */}
                {audioSource && (
                  <AudioPlayerController
                    audioUrl={audioSource.url}
                    audioName={audioSource.name}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    playbackRate={playbackRate}
                    volume={volume}
                    isLooping={isLooping}
                    onPlayPause={handlePlayPause}
                    onSeek={handleSeek}
                    onPlaybackRateChange={handlePlaybackRateChange}
                    onVolumeChange={handleVolumeChange}
                    onToggleLoop={() => setIsLooping(!isLooping)}
                  />
                )}

                {/* Two-Column Editor Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-3">
                    <TranscriptEditor
                      segments={segments}
                      summary={summary}
                      currentTime={currentTime}
                      onUpdateSegment={handleUpdateSegment}
                      onDeleteSegment={handleDeleteSegment}
                      onAddSegment={handleAddSegment}
                      onMergeSegments={handleMergeSegments}
                      onSplitSegment={handleSplitSegment}
                      onSeek={handleSeek}
                      onPlaySegment={handlePlaySegment}
                      onSearchReplace={handleSearchReplace}
                    />
                  </div>

                  {/* Sidebar Actions */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Creator Tools & Repurposing */}
                    <Card className="p-4 space-y-2.5">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Creator Extensions
                      </div>

                      <button
                        onClick={() => {
                          setActiveTab('youtube');
                          if (!youtubeMetadata) handleGenerateMetadata();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800/80 transition-colors text-xs font-medium cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Youtube className="w-4 h-4 text-red-400" />
                          <span>YouTube SEO & Titles</span>
                        </span>
                        {!user.planModules?.includes('youtube_seo') && (
                          <Badge variant="outline" className="text-[10px]">Pro</Badge>
                        )}
                      </button>

                      <button
                        onClick={() => setActiveTab('thumbnail')}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800/80 transition-colors text-xs font-medium cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-amber-400" />
                          <span>16:9 Thumbnail Canvas</span>
                        </span>
                        {!user.planModules?.includes('thumbnail_canvas') && (
                          <Badge variant="outline" className="text-[10px]">Pro</Badge>
                        )}
                      </button>

                      <button
                        onClick={() => setActiveTab('history')}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800/80 transition-colors text-xs font-medium cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <History className="w-4 h-4 text-emerald-400" />
                          <span>Saved History</span>
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </Card>

                    {/* Credit balance widget */}
                    <Card className="p-4">
                      <div className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                        <span>Audio Minutes</span>
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                        {user.creditsRemaining} <span className="text-xs text-slate-400 font-normal">minutes</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 mb-3">
                        Plan: <strong className="text-slate-300 font-medium">{user.planName}</strong>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPricingOpen(true)}
                        className="w-full"
                      >
                        Top Up or Upgrade
                      </Button>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* 3B. TRANSCRIPT HISTORY ARCHIVE */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Subtitle Editor
                  </button>
                  <span className="text-xs text-slate-400">Creator Workspace · Cloud SQL History Archive</span>
                </div>
                <TranscriptHistory
                  onLoadTranscript={handleLoadTranscript}
                  onExportTranscript={handleExportTranscriptFromHistory}
                  onOpenInYouTube={(item) => {
                    handleLoadTranscript(item);
                    setActiveTab('youtube');
                    const textToAnalyze =
                      item.fullTranscript ||
                      (item.segments || []).map((s: any) => s.text).join(' ');
                    handleGenerateMetadata(item.title, textToAnalyze);
                  }}
                  onNewRecording={() => setShowInputModal(true)}
                />
              </div>
            )}

            {/* 3C. YOUTUBE METADATA STUDIO (With module gatekeeper) */}
            {activeTab === 'youtube' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Subtitle Editor
                  </button>
                  <span className="text-xs text-slate-400">Creator Workspace · YouTube SEO</span>
                </div>
                {(!user.planModules || !user.planModules.includes('youtube_seo')) ? (
                  <LockedModuleNotice
                    module="youtube_seo"
                    title="YouTube SEO & Metadata Studio"
                    description="Generate high-converting Bengali video titles, descriptions, hashtags, and timestamps with AI. Upgrade your plan to unlock this module."
                    onOpenPricing={() => setIsPricingOpen(true)}
                    onBackToStudio={() => setActiveTab('studio')}
                  />
                ) : (
                  <YouTubeMetadataStudio
                    transcript={fullTranscript || segments.map((s) => s.text).join(' ')}
                    metadata={youtubeMetadata}
                    onGenerateMetadata={handleGenerateMetadata}
                    isLoading={isLoadingMetadata}
                    onSelectTitleForThumbnail={(title) => {
                      setThumbnailTitle(title);
                      setActiveTab('thumbnail');
                    }}
                  />
                )}
              </div>
            )}

            {/* 3D. THUMBNAIL CANVAS STUDIO (With module gatekeeper) */}
            {activeTab === 'thumbnail' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Subtitle Editor
                  </button>
                  <span className="text-xs text-slate-400">Creator Workspace · 16:9 Thumbnail Canvas</span>
                </div>
                {(!user.planModules || !user.planModules.includes('thumbnail_canvas')) ? (
                  <LockedModuleNotice
                    module="thumbnail_canvas"
                    title="16:9 HD Thumbnail Canvas Studio"
                    description="Design high-CTR YouTube video thumbnails with custom typography, badge overlays, and 16:9 canvas export. Upgrade your plan to unlock."
                    onOpenPricing={() => setIsPricingOpen(true)}
                    onBackToStudio={() => setActiveTab('studio')}
                  />
                ) : (
                  <ThumbnailCanvasStudio initialTitle={thumbnailTitle} />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Input Modal */}
      {showInputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowInputModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
            <AudioInputHub
              onTranscriptionComplete={handleTranscriptionComplete}
              isLoading={isLoadingTranscription}
              setIsLoading={setIsLoadingTranscription}
              onOpenPricing={() => {
                setShowInputModal(false);
                setIsPricingOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        segments={segments}
        audioName={audioSource?.name || 'bengali_transcript'}
        summary={summary}
        onOpenPricing={() => {
          setIsExportOpen(false);
          setIsPricingOpen(true);
        }}
      />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onResetWorkspace={() => {
          const initialSample = SAMPLE_AUDIOS[0];
          const blob = generateSyntheticAudioBlob(initialSample.duration);
          const url = URL.createObjectURL(blob);
          setAudioSource({
            url,
            name: initialSample.title,
            duration: initialSample.duration,
            blob,
            mimeType: 'audio/wav',
            isSample: true,
          });
          setSegments(initialSample.segments);
          setFullTranscript(initialSample.fullTranscript);
          setSummary(initialSample.summary);
          setDuration(initialSample.duration);
        }}
      />

      {/* Onboarding Tour Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onStartTranscribing={() => {
          if (!user) {
            setAuthInitialMode('register');
            setActiveTab('auth');
          } else {
            setShowInputModal(true);
          }
        }}
      />

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
        BanglaScribe · AI Bengali Speech Intelligence & Video Creator Suite · PostgreSQL Cloud SQL Backend
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BanglaScribeApp />
    </AuthProvider>
  );
}
