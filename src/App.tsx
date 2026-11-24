import React, { useState, useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { LandingPage } from './components/LandingPage';
import { AudioPlayerController } from './components/AudioPlayerController';
import { AudioInputHub, ChatSttActivity } from './components/AudioInputHub';
import { TranscriptEditor } from './components/TranscriptEditor';
import { YouTubeMetadataStudio } from './components/YouTubeMetadataStudio';
import { ThumbnailCanvasStudio } from './components/ThumbnailCanvasStudio';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { TranscriptHistory } from './components/TranscriptHistory';
import { VoiceoverStudio } from './components/VoiceoverStudio';
import { LockedModuleNotice } from './components/LockedModuleNotice';
import { ExportModal } from './components/ExportModal';
import { AuthPage } from './components/AuthPage';
import { PricingModal } from './components/PricingModal';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { InquiryModal } from './components/InquiryModal';
import { generateSyntheticAudioBlob } from './data/sampleAudios';
import { retrieveTranscriptAudio, deleteAudioBlob } from './utils/audioStorage';
import { createSegmentsFromScript } from './utils/subtitleUtils';
import { abortActiveSttSession } from './utils/moonshineEngine';
import { AiQuotaNotice } from './components/AiQuotaNotice';
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
  Download,
  Trash2,
} from 'lucide-react';
import { Button } from './components/ui/button';

function ScribyApp() {
  const { user, isSuperAdmin, token, refreshProfile, isLoadingSession } = useAuth();

  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [previousSegmentsBackup, setPreviousSegmentsBackup] = useState<TranscriptSegment[] | null>(null);
  const [fullTranscript, setFullTranscript] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [loadedTranscriptId, setLoadedTranscriptId] = useState<number | null>(null);
  const [globalAiQuotaNotice, setGlobalAiQuotaNotice] = useState<string | null>(null);

  // Clear studio workspace and active editor state completely
  const handleClearStudioState = () => {
    setLoadedTranscriptId(null);
    setSegments([]);
    setPreviousSegmentsBackup(null);
    setFullTranscript('');
    setSummary('');
    setAudioSource(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setYoutubeMetadata(null);
    setChatActivity(null);
    setIsLoadingTranscription(false);
    setThumbnailTitle('Generate High-CTR Subtitles & Titles');
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      } catch (e) {
        // ignore
      }
    }
  };

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
  const [isInquiryOpen, setIsInquiryOpen] = useState<boolean>(false);
  const [isLoadingTranscription, setIsLoadingTranscription] = useState<boolean>(false);
  const [chatActivity, setChatActivity] = useState<ChatSttActivity | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Sidebar History & Pinned Transcripts
  const [transcriptHistory, setTranscriptHistory] = useState<SavedTranscript[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [pinnedTranscriptIds, setPinnedTranscriptIds] = useState<number[]>([]);

  // YouTube Studio State
  const [youtubeMetadata, setYoutubeMetadata] = useState<YouTubeMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);
  const [thumbnailTitle, setThumbnailTitle] = useState<string>('Generate High-CTR Subtitles & Titles');

  // Track user login state transitions for role-based auto-redirection
  const previousUserRef = useRef<SaaSUser | null>(null);

  const fetchTranscriptHistory = async () => {
    if (!token || !user || user.role !== 'user') return;
    setIsLoadingHistory(true);
    try {
      const res = await safeFetchJson<{ success: boolean; data: SavedTranscript[] }>(
        '/api/transcripts',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok && res.data?.data) {
        setTranscriptHistory(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch sidebar transcript history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      try {
        const stored = localStorage.getItem(`scriby_pinned_transcripts_${user.uid}`);
        setPinnedTranscriptIds(stored ? JSON.parse(stored) : []);
      } catch {
        setPinnedTranscriptIds([]);
      }
    } else {
      setPinnedTranscriptIds([]);
      setTranscriptHistory([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (token && user?.role === 'user') {
      fetchTranscriptHistory();
    }
  }, [token, user?.id, user?.role]);

  const handleTogglePinTranscript = (id: number) => {
    setPinnedTranscriptIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev];
      if (user?.uid) {
        try {
          localStorage.setItem(`scriby_pinned_transcripts_${user.uid}`, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
      }
      return next;
    });
  };

  const handleDeleteTranscriptFromSidebar = async (item: SavedTranscript) => {
    if (!token) return;
    const res = await safeFetchJson(`/api/transcripts/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      try {
        await deleteAudioBlob(`transcript_${item.id}`);
        if (item.audioName) await deleteAudioBlob(`title_${item.audioName.trim()}`);
        if (item.title) await deleteAudioBlob(`title_${item.title.trim()}`);
      } catch {
        // ignore vault errors
      }
      setTranscriptHistory((prev) => prev.filter((t) => t.id !== item.id));
      setPinnedTranscriptIds((prev) => {
        const next = prev.filter((id) => id !== item.id);
        if (user?.uid) {
          try {
            localStorage.setItem(`scriby_pinned_transcripts_${user.uid}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
      if (
        loadedTranscriptId === item.id ||
        (audioSource && (audioSource.name === item.audioName || audioSource.name === item.title))
      ) {
        handleClearStudioState();
      }
    }
  };

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

  // Studio opens clean with the inline bottom chat composer ready for audio input

  // Sync with HTML5 Audio Element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(false);
    setCurrentTime(0);

    const syncDuration = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        setDuration(d);
      } else if (audioSource?.duration && Number.isFinite(audioSource.duration) && audioSource.duration > 0) {
        setDuration(audioSource.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      syncDuration();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleEnded = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        setIsPlaying(false);
      }
    };

    const handleError = (e: Event) => {
      console.warn('Audio tag encountered error:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('canplay', syncDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('seeking', handleTimeUpdate);
    audio.addEventListener('seeked', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Initial check
    syncDuration();

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('canplay', syncDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('seeking', handleTimeUpdate);
      audio.removeEventListener('seeked', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioSource?.url, isLooping]);

  // Audio Playback Handlers
  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err: any) {
        console.error('Audio play error:', err);
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetDuration = Number.isFinite(duration) && duration > 0 ? duration : (audioSource?.duration || Infinity);
    const safeTime = Math.max(0, Math.min(targetDuration, time));
    audio.currentTime = safeTime;
    setCurrentTime(safeTime);
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
  const handlePlaySegment = async (start: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = start;
    setCurrentTime(start);
    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.warn('Playback initiation warning on segment:', err);
    }
  };

  // Restore a saved transcript from history into the studio workspace with full audio playback
  const handleLoadTranscript = async (item: SavedTranscript, targetTab: ActiveTab = 'studio') => {
    const safeDuration = Number(
      item.durationSeconds ||
      item.duration ||
      (item.segments && item.segments.length > 0 ? item.segments[item.segments.length - 1].end : 30)
    );

    setSegments(item.segments || []);
    setFullTranscript(item.fullTranscript || '');
    setSummary(item.summary || '');
    setDuration(safeDuration);
    setThumbnailTitle(item.title);
    setLoadedTranscriptId(item.id);

    // 1. Try local client-side IndexedDB vault first (instant zero-latency playback of exact uploaded file)
    let playableUrl = '';
    let audioBlob: Blob | undefined = undefined;
    try {
      const cached = await retrieveTranscriptAudio(item.id, item.audioName || item.title);
      if (cached) {
        playableUrl = URL.createObjectURL(cached);
        audioBlob = cached;
      }
    } catch (e) {
      console.warn('Failed to retrieve audio from IndexedDB vault:', e);
    }

    // 2. If not in local vault, stream directly from the server endpoint
    if (!playableUrl && (item.audioUrl || item.id)) {
      playableUrl = item.audioUrl || `/api/audio/${item.id}`;
    }

    // 3. Fallback to synthetic audio tone if neither is available
    if (playableUrl) {
      setAudioSource({
        url: playableUrl,
        name: item.audioName || item.title,
        title: item.title,
        duration: safeDuration,
        blob: audioBlob,
        mimeType: audioBlob?.type || 'audio/wav',
      });
    } else {
      const blob = generateSyntheticAudioBlob(safeDuration);
      const url = URL.createObjectURL(blob);
      setAudioSource({
        url,
        name: item.audioName || item.title,
        title: item.title,
        duration: safeDuration,
        blob,
        mimeType: 'audio/wav',
      });
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
    setActiveTab(targetTab);
  };

  // Transfer audio and synchronized subtitle segments from AI Voiceover & Cloning into Subtitle Studio
  const handleSendToSubtitleStudio = (
    audioUrl: string,
    audioName: string,
    durationSeconds: number,
    scriptText?: string,
    customSegments?: TranscriptSegment[]
  ) => {
    const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 10;
    const cleanScript = (scriptText || '').trim();
    const newSegments =
      customSegments && customSegments.length > 0
        ? customSegments
        : createSegmentsFromScript(cleanScript, safeDuration, audioName || 'Studio Voice');

    setAudioSource({
      url: audioUrl,
      name: audioName,
      duration: safeDuration,
      mimeType: 'audio/wav',
    });
    setSegments(newSegments);
    setFullTranscript(cleanScript || (newSegments.length > 0 ? newSegments.map((s) => s.text).join(' ') : ''));
    setSummary(
      cleanScript
        ? `AI Voiceover recording: ${cleanScript.slice(0, 100)}${cleanScript.length > 100 ? '...' : ''}`
        : 'Voice recording'
    );
    setDuration(safeDuration);
    setCurrentTime(0);
    setLoadedTranscriptId(null);
    if (newSegments.length > 0) {
      setThumbnailTitle(newSegments[0].text);
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.src = audioUrl;
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
        ? { ...prev, name: item.audioName || item.title, title: item.title }
        : {
            url: '',
            name: item.audioName || item.title,
            title: item.title,
            duration: item.duration,
            mimeType: 'audio/wav',
          }
    );
    setIsExportOpen(true);
  };

  // Scroll directly to the inline chat audio composer inside the Studio view
  const scrollToChatComposer = () => {
    setActiveTab('studio');
    setTimeout(() => {
      const el = document.getElementById('studio-chat-composer');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
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
    setChatActivity(null);
    setActiveTab('studio');

    if (newSource.title) {
      setThumbnailTitle(newSource.title);
    } else if (newSegments.length > 0) {
      setThumbnailTitle(newSegments[0].text);
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }

    refreshProfile();
    fetchTranscriptHistory();
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
        text: 'Type new subtitle segment...',
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
      text: 'Type new subtitle segment...',
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

  const handleMergeAllSegments = () => {
    if (segments.length <= 1) return;

    // Backup current state for undo capability
    setPreviousSegmentsBackup([...segments]);

    const first = segments[0];
    const last = segments[segments.length - 1];
    const combinedText = segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(' ');

    const mergedAll: TranscriptSegment = {
      id: `seg-merged-all-${Date.now()}`,
      start: first.start,
      end: last.end,
      speaker: first.speaker || 'Speaker 1',
      text: combinedText,
    };

    setSegments([mergedAll]);
    setFullTranscript(combinedText);
  };

  const handleUndoMergeAll = () => {
    if (previousSegmentsBackup && previousSegmentsBackup.length > 0) {
      setSegments(previousSegmentsBackup);
      const restoredFullText = previousSegmentsBackup
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join(' ');
      setFullTranscript(restoredFullText);
      setPreviousSegmentsBackup(null);
    }
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

      if (res.isQuotaExceeded || res.status === 429) {
        setGlobalAiQuotaNotice(res.error || 'AI engine is at peak capacity. Please wait a moment and try again.');
      }

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
        const sentences = textToAnalyze.split(/[.!?।\n]+/).map((s) => s.trim()).filter((s) => s.length > 5);
        const titleTopic = hint || sentences[0] || 'Creator Video Strategy';
        setYoutubeMetadata({
          titles: [
            { title: `${titleTopic}: The Complete Guide & Key Insights`, category: 'High CTR', ctrScore: 94 },
            { title: `What You Must Know About ${titleTopic} (2026 Strategy)`, category: 'Authority', ctrScore: 91 },
            { title: `Why Everyone Is Talking About ${titleTopic} (Full Breakdown)`, category: 'Viral', ctrScore: 89 },
          ],
          description: `📌 In this video, we break down everything you need to know about: "${titleTopic}".\n\n00:00 - Introduction & Overview\n01:30 - Core Analysis & Deep Dive\n04:00 - Key Takeaways & Action Items\n\n#ContentCreator #YouTubeSEO #VideoStrategy`,
          chapters: [
            { timestamp: '00:00', title: 'Introduction & Overview' },
            { timestamp: '01:30', title: 'Core Analysis & Deep Dive' },
            { timestamp: '04:00', title: 'Key Takeaways & Action Items' },
          ],
          tags: [titleTopic, 'Video SEO', 'Creator Strategy', 'Tutorial', 'Content Production'],
          socialPosts: {
            facebook: `New Video: Deep dive into ${titleTopic}! Watch the breakdown now.`,
            instagram: `New Video: ${titleTopic}. Link in bio!`,
            linkedin: `Comprehensive discussion on ${titleTopic}.`,
            twitter: `New Video: ${titleTopic} — key insights and action items 🚀 #Creator #Video`,
          },
          thumbnailHeadlineIdeas: [titleTopic.slice(0, 20), 'MUST WATCH!', 'NEW 2026'],
        });
        setThumbnailTitle(`${titleTopic}: Complete Breakdown`);
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
    <div className="min-h-screen bg-[#121212] text-[#d0d5dd] flex flex-col font-sans">
      {/* Hidden Audio Element */}
      {audioSource?.url && (
        <audio
          key={audioSource.url}
          ref={audioRef}
          src={audioSource.url}
          preload="auto"
        />
      )}

      {/* Top Bar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={(mode = 'login') => {
          setAuthInitialMode(mode);
          setActiveTab('auth');
        }}
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenInquiry={() => setIsInquiryOpen(true)}
        hasSegments={segments.length > 0}
        isSidebarOpen={isMobileSidebarOpen}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
      />

      {/* Non-Creator Shell (Visitor Landing, Auth, SuperAdmin) */}
      {(!user || user.role !== 'user' || activeTab === 'landing' || activeTab === 'auth') && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* VIEW 0: AUTHENTICATION PAGE */}
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

          {/* VIEW 1: LANDING PAGE */}
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

          {/* VIEW 2: SUPERADMIN PORTAL */}
          {user && user.role === 'superadmin' && activeTab === 'admin' && (
            <div className="space-y-6">
              <SuperAdminPanel />
            </div>
          )}
        </main>
      )}

      {/* VIEW 3: CREATOR WORKSPACE WITH LEFT SIDEBAR */}
      {user && user.role === 'user' && activeTab !== 'landing' && activeTab !== 'auth' && (
        <div className="flex flex-1 min-w-0">
          <WorkspaceSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenPricing={() => setIsPricingOpen(true)}
            transcripts={transcriptHistory}
            isLoadingHistory={isLoadingHistory}
            pinnedIds={pinnedTranscriptIds}
            activeTranscriptId={loadedTranscriptId}
            onTogglePin={handleTogglePinTranscript}
            onLoadTranscript={(item) => handleLoadTranscript(item, 'studio')}
            onExportTranscript={handleExportTranscriptFromHistory}
            onOpenInYouTube={async (item) => {
              await handleLoadTranscript(item, 'youtube');
              const textToAnalyze =
                item.fullTranscript ||
                (item.segments || []).map((s: any) => s.text).join(' ');
              handleGenerateMetadata(item.title, textToAnalyze);
            }}
            onDeleteTranscript={handleDeleteTranscriptFromSidebar}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          <main className="flex-1 min-w-0 max-w-6xl mx-auto w-full px-4 lg:px-8 py-6 space-y-6">
            {/* Global AI Quota Notice if API rate limit or peak capacity occurs */}
            {globalAiQuotaNotice && (
              <div className="mb-4">
                <AiQuotaNotice
                  message={globalAiQuotaNotice}
                  onDismiss={() => setGlobalAiQuotaNotice(null)}
                  onOpenPricing={() => setIsPricingOpen(true)}
                />
              </div>
            )}

            {/* 3A. SUBTITLES & CHAT WORKSPACE */}
            {activeTab === 'studio' && (
              <div className="space-y-6">
                {/* Workspace Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#282828]">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-[#e4e7ec] tracking-tight font-display truncate">
                      {audioSource?.title || audioSource?.name || 'Transcript Chat Workspace'}
                    </h2>
                    <div className="text-xs text-[#9ca3af] mt-0.5 flex items-center flex-wrap gap-x-2">
                      <span>{segments.length} Subtitle Segments</span>
                      {audioSource?.title && audioSource?.name && audioSource.title !== audioSource.name && (
                        <>
                          <span className="text-[#4a4e57]">·</span>
                          <span className="truncate max-w-[260px] text-[#9ca3af]" title={audioSource.name}>
                            {audioSource.name}
                          </span>
                        </>
                      )}
                      <span className="text-[#4a4e57]">·</span>
                      <span>Waveform Alignment</span>
                      <span className="text-[#4a4e57]">·</span>
                      <span>SRT, DOCX, TXT, JSON</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(segments.length > 0 || audioSource) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearStudioState}
                        className="text-xs text-[#9ca3af] hover:text-rose-400 hover:bg-[#282828] h-8"
                        title="Clear studio workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>Clear Studio</span>
                      </Button>
                    )}

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
                    duration={Number.isFinite(duration) && duration > 0 ? duration : (audioSource.duration || 0)}
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

                {/* Full-Width Chat & Subtitle Editor */}
                <TranscriptEditor
                  segments={segments}
                  summary={summary}
                  audioName={audioSource?.name}
                  audioTitle={audioSource?.title}
                  userName={user.name}
                  currentTime={currentTime}
                  isTranscribing={isLoadingTranscription}
                  chatActivity={chatActivity}
                  onCancelTranscription={() => {
                    abortActiveSttSession();
                    setIsLoadingTranscription(false);
                    setChatActivity(null);
                  }}
                  onUpdateSegment={handleUpdateSegment}
                  onDeleteSegment={handleDeleteSegment}
                  onAddSegment={handleAddSegment}
                  onMergeSegments={handleMergeSegments}
                  onMergeAllSegments={handleMergeAllSegments}
                  onUndoMergeAll={handleUndoMergeAll}
                  canUndoMergeAll={!!previousSegmentsBackup}
                  onSplitSegment={handleSplitSegment}
                  onSeek={handleSeek}
                  onPlaySegment={handlePlaySegment}
                  onSearchReplace={handleSearchReplace}
                  composerFooter={
                    <AudioInputHub
                      onTranscriptionStart={(sourceLabel) => {
                        setSummary('');
                        setSegments([]);
                        setPreviousSegmentsBackup(null);
                        setFullTranscript('');
                        setAudioSource(null);
                        setDuration(0);
                        setCurrentTime(0);
                        setIsPlaying(false);
                        setLoadedTranscriptId(null);
                        setYoutubeMetadata(null);
                        setThumbnailTitle(sourceLabel);
                      }}
                      onPartialSegments={(partialSegs) => {
                        setSegments(partialSegs);
                      }}
                      onTranscriptionAbort={() => {
                        setIsLoadingTranscription(false);
                        setChatActivity(null);
                      }}
                      onActivityChange={setChatActivity}
                      onTranscriptionComplete={handleTranscriptionComplete}
                      isLoading={isLoadingTranscription}
                      setIsLoading={setIsLoadingTranscription}
                      onOpenPricing={() => setIsPricingOpen(true)}
                      onQuotaExceeded={(msg) => setGlobalAiQuotaNotice(msg)}
                    />
                  }
                />
              </div>
            )}

            {/* 3B. TRANSCRIPT HISTORY ARCHIVE */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="text-xs text-[#3fb970] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Subtitle Editor
                  </button>
                  <span className="text-xs text-[#9ca3af]">Creator Workspace · Saved History Archive</span>
                </div>
                <TranscriptHistory
                  onLoadTranscript={handleLoadTranscript}
                  onExportTranscript={handleExportTranscriptFromHistory}
                  onOpenInYouTube={async (item) => {
                    await handleLoadTranscript(item, 'youtube');
                    const textToAnalyze =
                      item.fullTranscript ||
                      (item.segments || []).map((s: any) => s.text).join(' ');
                    handleGenerateMetadata(item.title, textToAnalyze);
                  }}
                  onDeleteTranscript={(deletedId, item) => {
                    if (
                      loadedTranscriptId === deletedId ||
                      (item && audioSource && (audioSource.name === item.audioName || audioSource.name === item.title))
                    ) {
                      handleClearStudioState();
                    }
                  }}
                  onHistoryChanged={fetchTranscriptHistory}
                  onNewRecording={scrollToChatComposer}
                />
              </div>
            )}

            {/* 3B-2. AI VOICEOVER & VOICE CLONING STUDIO */}
            {activeTab === 'voiceover' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="text-xs text-[#3fb970] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Subtitle Editor
                  </button>
                  <span className="text-xs text-[#9ca3af]">Creator Workspace · AI Voiceover & Cloning</span>
                </div>
                {(!user.planModules || !user.planModules.includes('voiceover_studio')) ? (
                  <LockedModuleNotice
                    module="voiceover_studio"
                    title="AI Voiceover & Voice Cloning Studio"
                    description="Clone your voice from microphone recording or audio files, and synthesize natural AI voiceovers with studio male & female voices. Exclusive to the Agency Studio plan."
                    requiredPlanName="Agency Studio"
                    benefits={[
                      'Zero-shot ZipVoice cloning via microphone or audio file upload',
                      'Studio male (Adam) and female (Heart) Moonshine WASM voice synthesis',
                      'Multi-format audio export in WAV, MP3, and OGG formats',
                      'Direct integration to load generated audio into the Subtitle Editor',
                      '1,200 Audio Minutes/Month for high-volume creator workflows',
                    ]}
                    onOpenPricing={() => setIsPricingOpen(true)}
                    onBackToStudio={() => setActiveTab('studio')}
                  />
                ) : (
                  <VoiceoverStudio
                    currentSubtitleText={fullTranscript || segments.map((s) => s.text).join(' ')}
                    currentSegments={segments}
                    onSendToSubtitleStudio={handleSendToSubtitleStudio}
                    onOpenPricing={() => setIsPricingOpen(true)}
                  />
                )}
              </div>
            )}

            {/* 3C. YOUTUBE METADATA STUDIO (With module gatekeeper) */}
            {activeTab === 'youtube' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="text-xs text-[#3fb970] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Subtitle Editor
                  </button>
                  <span className="text-xs text-[#9ca3af]">Creator Workspace · YouTube SEO</span>
                </div>
                {(!user.planModules || !user.planModules.includes('youtube_seo')) ? (
                  <LockedModuleNotice
                    module="youtube_seo"
                    title="YouTube SEO & Metadata Studio"
                    description="Generate high-converting video titles, descriptions, hashtags, and timestamps with AI. Upgrade your plan to unlock this module."
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
                <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="text-xs text-[#3fb970] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Subtitle Editor
                  </button>
                  <span className="text-xs text-[#9ca3af]">Creator Workspace · 16:9 Thumbnail Canvas</span>
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
          </main>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        segments={segments}
        audioName={audioSource?.title || audioSource?.name || 'audio_transcript'}
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
        onResetWorkspace={handleClearStudioState}
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
            scrollToChatComposer();
          }
        }}
      />

      {/* Support / Inquiry Modal */}
      <InquiryModal
        isOpen={isInquiryOpen}
        onClose={() => setIsInquiryOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ScribyApp />
    </AuthProvider>
  );
}
