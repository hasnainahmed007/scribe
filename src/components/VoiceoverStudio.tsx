import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Download,
  Trash2,
  Plus,
  Sparkles,
  RefreshCw,
  FileAudio,
  Radio,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  Sliders,
  FileText,
  RotateCcw,
  Send,
  AlertCircle,
  Headphones,
  Upload,
  FolderOpen,
  X,
  FileCheck,
  Globe,
} from 'lucide-react';
import { VoiceProfile, SavedVoiceoverItem, AudioExportFormat, VoiceTone, VoiceGender } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { formatPlayerTime } from '../utils/timeFormat';
import { parseSubtitleToPlainText } from '../utils/subtitleUtils';
import {
  CUSTOM_ACCENT_ID,
  SAMPLE_SCRIPTS_BY_LANGUAGE,
  getSynthesisLanguages,
  getCloningLanguages,
  getAccentsForLanguage,
  getDefaultAccentForLanguage,
  getShortLanguageLabel,
  resolveSelectionForVoiceProfile,
} from '../utils/voiceLanguages';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { AiQuotaNotice } from './AiQuotaNotice';

interface VoiceoverStudioProps {
  currentSubtitleText?: string;
  onSendToSubtitleStudio: (
    audioUrl: string,
    audioName: string,
    durationSeconds: number,
    script?: string
  ) => void;
  onOpenPricing?: () => void;
}

export const VoiceoverStudio: React.FC<VoiceoverStudioProps> = ({
  currentSubtitleText = '',
  onSendToSubtitleStudio,
  onOpenPricing,
}) => {
  const { token, user } = useAuth();

  // Navigation Sub-tab: 'tts' | 'clone' | 'record' | 'history'
  const [activeSubTab, setActiveSubTab] = useState<'tts' | 'clone' | 'record' | 'history'>('tts');

  // Voices State
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | number>('male-default');
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(true);

  // Script & Synthesis Options
  const [script, setScript] = useState<string>(
    'Welcome to Scriby AI Voiceover Studio. Synthesize high-fidelity voiceovers in any language or clone your personal voice profile for automated digital narration across global languages.'
  );
  const [tone, setTone] = useState<VoiceTone>('natural');
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(0);
  const [ttsLanguage, setTtsLanguage] = useState<string>('auto');
  const [ttsAccent, setTtsAccent] = useState<string>(getDefaultAccentForLanguage('auto'));
  const [ttsCustomAccent, setTtsCustomAccent] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<AudioExportFormat>('wav');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [quotaErrorMessage, setQuotaErrorMessage] = useState<string | null>(null);

  // Current Generated Voiceover
  const [currentVoiceover, setCurrentVoiceover] = useState<{
    id?: number;
    voiceoverId: string;
    audioUrl: string;
    durationSeconds: number;
    format: AudioExportFormat;
    voiceName: string;
    language?: string;
    languageLabel?: string;
    accent?: string;
    script: string;
  } | null>(null);

  // Deletion Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<{
    id?: number;
    voiceoverId?: string;
    audioUrl?: string;
    title?: string;
    voiceName?: string;
    format?: string;
    source: 'generate' | 'recording';
  } | null>(null);
  const [isDeletingVoiceover, setIsDeletingVoiceover] = useState<boolean>(false);

  // Generated Audio Player State
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [playerVolume, setPlayerVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Previewing sample audio of voice card
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingSampleVoiceId, setPlayingSampleVoiceId] = useState<string | number | null>(null);

  // Voice Cloning Modal / Form State
  const [cloneName, setCloneName] = useState<string>('');
  const [cloneGender, setCloneGender] = useState<VoiceGender>('custom');
  const [cloneLanguage, setCloneLanguage] = useState<string>('multilingual');
  const [cloneAccent, setCloneAccent] = useState<string>(getDefaultAccentForLanguage('multilingual'));
  const [cloneCustomAccent, setCloneCustomAccent] = useState<string>('');
  const [cloneDescription, setCloneDescription] = useState<string>('');
  const [cloneAudioBlob, setCloneAudioBlob] = useState<Blob | null>(null);
  const [cloneAudioUrl, setCloneAudioUrl] = useState<string | null>(null);
  const [cloneDuration, setCloneDuration] = useState<number>(0);
  const [isCloning, setIsCloning] = useState<boolean>(false);

  // Live Microphone Recording State (Used for both voice clone training and live audio exporter)
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [liveRecordedBlob, setLiveRecordedBlob] = useState<Blob | null>(null);
  const [liveRecordedUrl, setLiveRecordedUrl] = useState<string | null>(null);

  // History of Saved Voiceovers
  const [savedVoiceovers, setSavedVoiceovers] = useState<SavedVoiceoverItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Platform Subtitles Modal State
  const [showPlatformSubtitlesModal, setShowPlatformSubtitlesModal] = useState<boolean>(false);
  const [platformTranscripts, setPlatformTranscripts] = useState<
    Array<{ id: number; title: string; fullTranscript: string; duration: number; createdAt?: string; segments?: any[] }>
  >([]);
  const [isLoadingPlatformTranscripts, setIsLoadingPlatformTranscripts] = useState<boolean>(false);
  const srtFileInputRef = useRef<HTMLInputElement | null>(null);

  // Show Toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Open Platform Subtitles selector modal
  const handleOpenPlatformSubtitles = async () => {
    setShowPlatformSubtitlesModal(true);
    if (token) {
      setIsLoadingPlatformTranscripts(true);
      try {
        const res = await safeFetchJson<{ success: boolean; data: any[] }>('/api/transcripts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && res.data?.data) {
          setPlatformTranscripts(res.data.data);
        }
      } catch (err) {
        console.warn('Failed to fetch platform transcripts:', err);
      } finally {
        setIsLoadingPlatformTranscripts(false);
      }
    }
  };

  // Handle uploading external SRT/VTT file
  const handleExternalSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as string;
        const parsed = parseSubtitleToPlainText(content);
        if (parsed && parsed.trim().length > 0) {
          setScript(parsed);
          showToast(`Imported external subtitles from ${file.name}!`);
        } else {
          showToast('Could not extract subtitle text from file. Please check file format.', 'error');
        }
      } catch (err: any) {
        showToast('Failed to parse subtitle file: ' + err.message, 'error');
      }
    };
    reader.onerror = () => {
      showToast('Failed to read external subtitle file.', 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Fetch Voice Profiles
  const fetchVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await safeFetchJson<{
        success: boolean;
        allVoices: VoiceProfile[];
      }>('/api/voices', { headers });

      if (res.ok && res.data?.allVoices) {
        setVoices(res.data.allVoices);
        if (!selectedVoiceId && res.data.allVoices.length > 0) {
          setSelectedVoiceId(res.data.allVoices[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load voices:', err);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  // Fetch Saved Voiceovers History
  const fetchSavedVoiceovers = async () => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const res = await safeFetchJson<{ success: boolean; data: SavedVoiceoverItem[] }>(
        '/api/voiceovers',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok && res.data?.data) {
        setSavedVoiceovers(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load voiceover history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchVoices();
    if (token) fetchSavedVoiceovers();
  }, [token]);

  // Audio Player Listeners for Generated Voiceover
  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setAudioDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [currentVoiceover]);

  // Play / Pause Generated Voiceover
  const togglePlayGenerated = () => {
    const audio = audioPlayerRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.warn);
    }
  };

  // Play / Stop Voice Profile Sample Preview
  const togglePlaySample = (voice: VoiceProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingSampleVoiceId === voice.id) {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        sampleAudioRef.current.currentTime = 0;
      }
      setPlayingSampleVoiceId(null);
      return;
    }

    if (sampleAudioRef.current) {
      sampleAudioRef.current.src = voice.sampleAudioUrl || `/api/voices/${voice.id}/sample`;
      sampleAudioRef.current.play().catch(console.warn);
      setPlayingSampleVoiceId(voice.id);
      sampleAudioRef.current.onended = () => setPlayingSampleVoiceId(null);
    }
  };

  // Linked Primary Language & Accent Options
  const synthesisLanguages = getSynthesisLanguages();
  const cloningLanguages = getCloningLanguages();
  const ttsAccentOptions = getAccentsForLanguage(ttsLanguage);
  const cloneAccentOptions = getAccentsForLanguage(cloneLanguage);
  const selectedVoice = voices.find((v) => String(v.id) === String(selectedVoiceId));
  const effectiveTtsAccent =
    ttsAccent === CUSTOM_ACCENT_ID ? ttsCustomAccent.trim() : ttsAccent;

  const handleTtsLanguageChange = (nextLang: string) => {
    setTtsLanguage(nextLang);
    setTtsAccent(getDefaultAccentForLanguage(nextLang));
    setTtsCustomAccent('');
  };

  const handleCloneLanguageChange = (nextLang: string) => {
    setCloneLanguage(nextLang);
    setCloneAccent(getDefaultAccentForLanguage(nextLang));
    setCloneCustomAccent('');
  };

  const handleSelectVoice = (voice: VoiceProfile) => {
    setSelectedVoiceId(voice.id);
    if (voice.isCustom) {
      const synced = resolveSelectionForVoiceProfile(voice);
      setTtsLanguage(synced.language);
      setTtsAccent(synced.accent);
      setTtsCustomAccent(synced.customAccent);
    }
  };

  const selectedVoiceCloneDefaults = selectedVoice?.isCustom
    ? resolveSelectionForVoiceProfile(selectedVoice)
    : null;

  const isOverridingCloneDefaults = Boolean(
    selectedVoiceCloneDefaults &&
      (ttsLanguage !== selectedVoiceCloneDefaults.language ||
        ttsAccent !== selectedVoiceCloneDefaults.accent ||
        (ttsAccent === CUSTOM_ACCENT_ID &&
          ttsCustomAccent.trim() !== selectedVoiceCloneDefaults.customAccent))
  );

  // Synthesize Voiceover
  const handleGenerateVoiceover = async () => {
    if (!script.trim()) {
      showToast('Please enter text script to synthesize.', 'error');
      return;
    }

    if (ttsAccent === CUSTOM_ACCENT_ID && !ttsCustomAccent.trim()) {
      showToast('Please enter your custom accent or dialect before generating.', 'error');
      return;
    }

    const activeVoice = voices.find((v) => String(v.id) === String(selectedVoiceId));
    setIsGenerating(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await safeFetchJson<{
        success: boolean;
        id?: number;
        voiceoverId: string;
        audioUrl: string;
        durationSeconds: number;
        format: AudioExportFormat;
        voiceName: string;
        gender?: string;
        ttsVoiceName?: string;
        engine?: string;
        language?: string;
        languageLabel?: string;
        accent?: string;
        script: string;
      }>('/api/voiceover/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          script,
          voiceId: selectedVoiceId,
          voiceName: activeVoice?.name || 'Studio Voice',
          gender: activeVoice?.gender || 'male',
          tone,
          speed,
          pitch,
          language: ttsLanguage,
          accent: effectiveTtsAccent,
          format: exportFormat,
        }),
      });

      if (res.ok && res.data) {
        const resolvedLangLabel =
          res.data.languageLabel || getShortLanguageLabel(res.data.language || ttsLanguage);
        const resolvedAccentLabel = res.data.accent || effectiveTtsAccent;

        const generatedItem = {
          id: res.data.id,
          voiceoverId: res.data.voiceoverId,
          audioUrl: res.data.audioUrl,
          durationSeconds: res.data.durationSeconds,
          format: res.data.format,
          voiceName: res.data.voiceName,
          language: res.data.language || ttsLanguage,
          languageLabel: resolvedLangLabel,
          accent: resolvedAccentLabel,
          script: res.data.script,
        };
        setCurrentVoiceover(generatedItem);
        setIsPlaying(false);
        setCurrentTime(0);

        // Instantly add to savedVoiceovers ("Recordings" section)
        const newSavedItem: SavedVoiceoverItem = {
          id: res.data.id || Date.now(),
          title: script.slice(0, 60) + (script.length > 60 ? '...' : ''),
          script,
          voiceId: String(selectedVoiceId),
          voiceName: res.data.voiceName,
          voiceGender: res.data.gender || activeVoice?.gender || 'male',
          language: res.data.language || ttsLanguage,
          languageLabel: resolvedLangLabel,
          accent: resolvedAccentLabel,
          audioUrl: res.data.audioUrl,
          durationSeconds: res.data.durationSeconds,
          format: res.data.format,
          createdAt: new Date().toISOString(),
        };

        setSavedVoiceovers((prev) => [
          newSavedItem,
          ...prev.filter(
            (p) =>
              p.audioUrl !== res.data?.audioUrl &&
              (res.data?.id ? p.id !== res.data.id : true)
          ),
        ]);

        if (res.data.engine === 'fallback') {
          showToast('AI TTS engine was temporarily unavailable; synthesized backup audio track.', 'error');
        } else {
          showToast('Voiceover synthesized and added to Recordings!');
        }
        if (token) fetchSavedVoiceovers();
      } else {
        if (res.isQuotaExceeded || res.status === 429) {
          setQuotaErrorMessage(res.error || 'AI speech engine is at peak capacity. Please wait a moment and try again.');
        }
        showToast(res.error || 'Failed to generate voiceover.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to generate voiceover.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Start Live Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setLiveRecordedBlob(blob);
        setLiveRecordedUrl(url);

        // If in cloning mode, populate clone audio
        if (activeSubTab === 'clone') {
          setCloneAudioBlob(blob);
          setCloneAudioUrl(url);
          setCloneDuration(recordingSeconds);
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      showToast('Microphone access denied: ' + (err.message || ''), 'error');
    }
  };

  // Stop Live Audio Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Handle Audio File Upload for Voice Cloning
  const handleVoiceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      showToast('Please upload a valid audio file (.wav, .mp3, .ogg, .m4a).', 'error');
      return;
    }

    const url = URL.createObjectURL(file);
    setCloneAudioBlob(file);
    setCloneAudioUrl(url);
    if (!cloneName) {
      setCloneName(file.name.replace(/\.[^/.]+$/, ''));
    }

    // Measure duration
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      setCloneDuration(Math.round(tempAudio.duration || 15));
    };
  };

  // Submit Voice Clone Profile
  const handleSaveVoiceClone = async () => {
    if (!cloneName.trim()) {
      showToast('Please enter a name for your cloned voice.', 'error');
      return;
    }
    if (!cloneAudioBlob) {
      showToast('Please record or upload a voice sample first.', 'error');
      return;
    }

    const effectiveCloneAccent =
      cloneAccent === CUSTOM_ACCENT_ID ? cloneCustomAccent.trim() : cloneAccent;

    if (cloneAccent === CUSTOM_ACCENT_ID && !effectiveCloneAccent) {
      showToast('Please enter a custom accent or dialect for your voice profile.', 'error');
      return;
    }

    setIsCloning(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(cloneAudioBlob);
      const audioBase64 = await base64Promise;

      const res = await safeFetchJson<{ success: boolean; voice: VoiceProfile }>(
        '/api/voices/clone',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: cloneName,
            gender: cloneGender,
            language: cloneLanguage,
            accent: effectiveCloneAccent,
            description: cloneDescription,
            audioBase64,
            durationSeconds: cloneDuration || 15,
          }),
        }
      );

      if (res.ok && res.data?.voice) {
        const savedVoice = res.data.voice;
        showToast('Voice cloned and saved successfully!');
        setCloneName('');
        setCloneDescription('');
        setCloneLanguage('multilingual');
        setCloneAccent(getDefaultAccentForLanguage('multilingual'));
        setCloneCustomAccent('');
        setCloneAudioBlob(null);
        setCloneAudioUrl(null);
        fetchVoices();
        setActiveSubTab('tts');
        handleSelectVoice(savedVoice);
      } else {
        showToast(res.error || 'Failed to clone voice.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to clone voice.', 'error');
    } finally {
      setIsCloning(false);
    }
  };

  // Delete Custom Voice Profile
  const handleDeleteVoice = async (voiceId: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await safeFetchJson(`/api/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('Voice profile deleted.');
        if (selectedVoiceId === voiceId) setSelectedVoiceId('male-default');
        fetchVoices();
      } else {
        showToast(res.error || 'Failed to delete voice profile.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete voice profile.', 'error');
    }
  };

  // Prompt deletion confirmation modal
  const promptDeleteVoiceover = (item: {
    id?: number;
    voiceoverId?: string;
    audioUrl?: string;
    title?: string;
    voiceName?: string;
    format?: string;
    source: 'generate' | 'recording';
  }) => {
    setItemToDelete(item);
  };

  // Confirm and execute deletion
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeletingVoiceover(true);
    try {
      const deleteKey = itemToDelete.id || itemToDelete.voiceoverId;
      if (deleteKey && token) {
        await safeFetchJson(`/api/voiceovers/${deleteKey}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      // 1. Remove from savedVoiceovers (Recordings archive)
      setSavedVoiceovers((prev) =>
        prev.filter((v) => {
          if (itemToDelete.id && v.id === itemToDelete.id) return false;
          if (itemToDelete.audioUrl && v.audioUrl === itemToDelete.audioUrl) return false;
          if (itemToDelete.voiceoverId && v.audioUrl.includes(itemToDelete.voiceoverId)) return false;
          return true;
        })
      );

      // 2. Also remove from Voice Generation preview section if matches current voiceover
      const matchesCurrent =
        currentVoiceover &&
        (itemToDelete.source === 'generate' ||
          (itemToDelete.id && currentVoiceover.id === itemToDelete.id) ||
          (itemToDelete.voiceoverId && currentVoiceover.voiceoverId === itemToDelete.voiceoverId) ||
          (itemToDelete.audioUrl && currentVoiceover.audioUrl === itemToDelete.audioUrl) ||
          (itemToDelete.voiceoverId && currentVoiceover.audioUrl.includes(itemToDelete.voiceoverId)));

      if (matchesCurrent) {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.currentTime = 0;
        }
        setCurrentVoiceover(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setAudioDuration(0);
      }

      showToast('Voice recording deleted successfully.');
      setItemToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete voice recording.', 'error');
    } finally {
      setIsDeletingVoiceover(false);
    }
  };

  // Word & character stats
  const cleanWords = script.trim().split(/\s+/).filter(Boolean);
  const wordCount = cleanWords.length;
  const charCount = script.length;
  const estimatedSeconds = Math.max(1, Math.round((wordCount / (140 * Math.max(0.5, speed))) * 60));

  return (
    <div className="space-y-6">
      {/* Hidden Audio Elements */}
      <audio ref={sampleAudioRef} className="hidden" preload="none" />
      {currentVoiceover && (
        <audio
          ref={audioPlayerRef}
          src={currentVoiceover.audioUrl}
          className="hidden"
          preload="auto"
        />
      )}

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-sm flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-bottom-4 ${
            notification.type === 'success'
              ? 'bg-[#181818] border-[#1db954]/50 text-[#e4e7ec]'
              : 'bg-[#181818] border-rose-500/50 text-[#e4e7ec]'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#3fb970]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#282828]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-[#e4e7ec] tracking-tight font-display">
              AI Voiceover Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1db954]/12 text-[#4cc37c] border border-[#1db954]/25 tracking-wide">
              Voice Clone & Studio TTS
            </span>
          </div>
          <p className="text-xs text-[#9ca3af] mt-1">
            Professional AI voice cloning, studio text-to-speech, and direct audio export in WAV, MP3, and OGG formats
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center p-1 bg-[#181818] rounded-full border border-[#282828] text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('tts')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              activeSubTab === 'tts'
                ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                : 'text-[#9ca3af] hover:text-[#e4e7ec]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#34a866]" />
            <span>Voiceover Studio</span>
          </button>

          <button
            onClick={() => setActiveSubTab('clone')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              activeSubTab === 'clone'
                ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                : 'text-[#9ca3af] hover:text-[#e4e7ec]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400/90" />
            <span>Clone Voice</span>
          </button>

          <button
            onClick={() => setActiveSubTab('record')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              activeSubTab === 'record'
                ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                : 'text-[#9ca3af] hover:text-[#e4e7ec]'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-rose-400/90" />
            <span>Live Recorder</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                : 'text-[#9ca3af] hover:text-[#e4e7ec]'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5 text-amber-400/90" />
            <span>Recordings ({savedVoiceovers.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: TEXT-TO-SPEECH VOICEOVER STUDIO                                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'tts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Script Editor & Tone Controls */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="p-5 bg-[#181818] border-[#282828] space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#34a866]" />
                  <h3 className="text-sm font-semibold text-[#e4e7ec]">Voiceover Script Text</h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {ttsLanguage !== 'auto' && SAMPLE_SCRIPTS_BY_LANGUAGE[ttsLanguage] && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setScript(SAMPLE_SCRIPTS_BY_LANGUAGE[ttsLanguage]);
                        showToast(`Loaded native ${getShortLanguageLabel(ttsLanguage)} sample script!`);
                      }}
                      className="text-xs h-7 gap-1.5 border-[#34373f] text-[#4cc37c] hover:bg-[#24272c] hover:border-[#1db954]/45 cursor-pointer"
                      title={`Load native ${getShortLanguageLabel(ttsLanguage)} test script`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Load {getShortLanguageLabel(ttsLanguage)} Sample</span>
                    </Button>
                  )}

                  {/* Option A: Use Platform Subtitles */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPlatformSubtitles}
                    className="text-xs h-7 gap-1.5 border-[#34373f] text-[#d0d5dd] hover:bg-[#24272c] hover:border-[#1db954]/45 cursor-pointer"
                    title="Import subtitles created in this platform"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#34a866]" />
                    <span>Use Platform Subtitles</span>
                  </Button>

                  {/* Option B: Import External SRT / VTT */}
                  <label
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs h-7 rounded-md border border-[#34373f] text-[#d0d5dd] hover:border-blue-400/50 hover:text-blue-300 bg-[#222428] hover:bg-[#282b30] cursor-pointer transition-colors"
                    title="Upload external .SRT, .VTT, or text file"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400/90" />
                    <span>Import External .SRT</span>
                    <input
                      ref={srtFileInputRef}
                      type="file"
                      accept=".srt,.vtt,.txt,.json,.sub"
                      onChange={handleExternalSubtitleUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Type or paste your voiceover script in any language (English, Bengali, Spanish, Hindi, Arabic, French, German, Japanese, etc.)..."
                  rows={7}
                  className="w-full bg-[#121212] border border-[#282828] rounded-xl p-3.5 text-sm text-[#d0d5dd] placeholder-[#6f7682] focus:border-[#1db954]/55 focus:ring-1 focus:ring-[#1db954]/25 outline-none transition-all resize-y leading-relaxed"
                />
              </div>

              {/* Word & Duration Readout */}
              <div className="flex items-center justify-between text-xs text-[#9ca3af] pt-1 font-mono">
                <div className="flex items-center gap-3">
                  <span>{wordCount} words</span>
                  <span>·</span>
                  <span>{charCount} characters</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#3fb970]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Est. Duration: ~{estimatedSeconds}s</span>
                </div>
              </div>
            </Card>

            {/* Vocal Modulation & Output Format Card */}
            <Card className="p-5 bg-[#181818] border-[#282828] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#34a866]" />
                  <h3 className="text-sm font-semibold text-[#e4e7ec]">Language, Accent &amp; Audio Tuning</h3>
                </div>
                {isOverridingCloneDefaults && selectedVoiceCloneDefaults && (
                  <button
                    type="button"
                    onClick={() => {
                      setTtsLanguage(selectedVoiceCloneDefaults.language);
                      setTtsAccent(selectedVoiceCloneDefaults.accent);
                      setTtsCustomAccent(selectedVoiceCloneDefaults.customAccent);
                    }}
                    className="text-xs font-semibold text-[#3fb970] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Reset to clone default
                  </button>
                )}
              </div>

              {/* Linked Primary Language & Regional Accent Row */}
              <div className="space-y-3 pb-3 border-b border-[#282828]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Primary Language Select */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="tts-primary-language"
                      className="text-xs font-semibold text-[#9ca3af] flex items-center gap-1.5"
                    >
                      <Globe className="w-3.5 h-3.5 text-[#34a866]" />
                      <span>Primary Language</span>
                    </label>
                    <select
                      id="tts-primary-language"
                      value={ttsLanguage}
                      onChange={(e) => handleTtsLanguageChange(e.target.value)}
                      className="w-full h-10 bg-[#222428] border border-[#34373f] text-xs text-[#d0d5dd] rounded-lg px-3 outline-none focus:border-[#1db954]/55"
                    >
                      {synthesisLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.nativeName ? `${lang.label} (${lang.nativeName})` : lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Linked Accent / Dialect Select */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="tts-accent-select"
                      className="text-xs font-semibold text-[#9ca3af]"
                    >
                      Accent / Dialect
                    </label>
                    <select
                      id="tts-accent-select"
                      value={ttsAccent}
                      onChange={(e) => setTtsAccent(e.target.value)}
                      className="w-full h-10 bg-[#222428] border border-[#34373f] text-xs text-[#d0d5dd] rounded-lg px-3 outline-none focus:border-[#1db954]/55"
                    >
                      {ttsAccentOptions.map((acc) => (
                        <option key={acc.id} value={acc.label}>
                          {acc.label}
                        </option>
                      ))}
                      <option value={CUSTOM_ACCENT_ID}>Custom Accent...</option>
                    </select>
                  </div>
                </div>

                {/* Inline Custom Accent Input when Custom Accent is selected */}
                {ttsAccent === CUSTOM_ACCENT_ID && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="tts-custom-accent"
                      className="text-xs font-semibold text-[#9ca3af]"
                    >
                      Custom Accent / Dialect Description
                    </label>
                    <Input
                      id="tts-custom-accent"
                      type="text"
                      maxLength={80}
                      autoFocus
                      value={ttsCustomAccent}
                      onChange={(e) => setTtsCustomAccent(e.target.value)}
                      placeholder="e.g., Scottish Highlands, Rioplatense Buenos Aires, Warm Documentary"
                      className="h-10 bg-[#121212] border-[#34373f] text-xs text-[#d0d5dd] focus:border-[#1db954]/55"
                    />
                  </div>
                )}

                {selectedVoice?.isCustom && selectedVoice.accent && (
                  <p className="text-xs text-[#9ca3af]">
                    Synced with cloned voice <span className="text-[#d0d5dd] font-medium">{selectedVoice.name}</span> ({getShortLanguageLabel(selectedVoice.language)} · {selectedVoice.accent}) — change above anytime to override.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Speech Delivery Tone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#9ca3af]">Delivery Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as VoiceTone)}
                    className="w-full h-10 bg-[#222428] border border-[#34373f] text-xs text-[#d0d5dd] rounded-lg px-3 outline-none focus:border-[#1db954]/55"
                  >
                    <option value="natural">Natural Conversational</option>
                    <option value="broadcast">Professional Broadcast / News</option>
                    <option value="storytelling">Storytelling & Narrative</option>
                    <option value="energetic">Energetic Promo / High CTR</option>
                  </select>
                </div>

                {/* Speech Speed */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#9ca3af]">
                    <span>Speed</span>
                    <span className="font-mono text-[#3fb970] tabular-nums">{speed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full accent-[#1db954] cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-[#6f7682] font-mono tabular-nums">
                    <span>0.75x</span>
                    <span>1.0x</span>
                    <span>1.5x</span>
                  </div>
                </div>

                {/* Export Audio Format */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#9ca3af]">Export Format</label>
                  <div className="grid grid-cols-3 gap-1 bg-[#121212] p-1 rounded-lg border border-[#282828] h-10 items-center">
                    {(['wav', 'mp3', 'ogg'] as AudioExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setExportFormat(fmt)}
                        className={`h-full text-xs font-semibold rounded uppercase transition-colors cursor-pointer ${
                          exportFormat === fmt
                            ? 'bg-[#1db954] text-[#08100b] shadow-sm'
                            : 'text-[#9ca3af] hover:text-[#e4e7ec]'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quota Notice if API rate limit or high demand */}
              {quotaErrorMessage && (
                <div className="pt-2">
                  <AiQuotaNotice
                    message={quotaErrorMessage}
                    onRetry={handleGenerateVoiceover}
                    onDismiss={() => setQuotaErrorMessage(null)}
                    onOpenPricing={onOpenPricing}
                    compact
                  />
                </div>
              )}

              {/* Synthesize Button */}
              <div className="pt-2">
                <Button
                  onClick={handleGenerateVoiceover}
                  disabled={isGenerating || !script.trim()}
                  className="w-full h-11 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold text-sm rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#08100b]" />
                      <span>Synthesizing Voiceover Audio ({exportFormat.toUpperCase()})...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Voiceover ({exportFormat.toUpperCase()})</span>
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Live Waveform Preview Player for Synthesized Voiceover */}
            {currentVoiceover && (
              <Card className="p-5 bg-gradient-to-br from-[#181818] to-[#141414] border border-[#1db954]/35 rounded-xl space-y-4 shadow-lg">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1db954]" />
                    <div>
                      <h4 className="text-sm font-semibold text-[#e4e7ec] font-display">
                        Ready: {currentVoiceover.voiceName}
                      </h4>
                      <p className="text-xs text-[#9ca3af] font-mono tabular-nums">
                        {currentVoiceover.format.toUpperCase()} · {formatPlayerTime(audioDuration || currentVoiceover.durationSeconds)}
                        {currentVoiceover.languageLabel ? ` · ${currentVoiceover.languageLabel}` : ''}
                        {currentVoiceover.accent ? ` · ${currentVoiceover.accent}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Direct Download in Chosen Audio Format */}
                    <a
                      href={`${currentVoiceover.audioUrl}&download=1`}
                      download={`scriby-voiceover-${currentVoiceover.voiceoverId}.${currentVoiceover.format}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#24272c] hover:bg-[#2e3238] hover:text-[#4cc37c] text-[#d0d5dd] text-xs font-semibold rounded-lg border border-[#34373f] transition-all cursor-pointer"
                      title={`Download as ${currentVoiceover.format.toUpperCase()}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {currentVoiceover.format.toUpperCase()}</span>
                    </a>

                    {/* Send to Subtitle Editor */}
                    <Button
                      size="sm"
                      onClick={() => {
                        onSendToSubtitleStudio(
                          currentVoiceover.audioUrl,
                          `Voiceover - ${currentVoiceover.voiceName}`,
                          audioDuration || currentVoiceover.durationSeconds,
                          currentVoiceover.script
                        );
                        showToast('Voiceover loaded into Subtitle Editor!');
                      }}
                      className="text-xs h-8 gap-1.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send to Subtitles</span>
                    </Button>

                    {/* Delete Voiceover from Generator & Recordings */}
                    <button
                      onClick={() =>
                        promptDeleteVoiceover({
                          id: currentVoiceover.id,
                          voiceoverId: currentVoiceover.voiceoverId,
                          audioUrl: currentVoiceover.audioUrl,
                          title: currentVoiceover.script.slice(0, 60),
                          voiceName: currentVoiceover.voiceName,
                          format: currentVoiceover.format,
                          source: 'generate',
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#24272c] hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/25 hover:border-rose-500/45 transition-all cursor-pointer"
                      title="Delete this generated voiceover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Scrubber Timeline */}
                <div className="space-y-1.5">
                  <div
                    onClick={(e) => {
                      if (!audioPlayerRef.current || !audioDuration) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const percent = clickX / rect.width;
                      audioPlayerRef.current.currentTime = percent * audioDuration;
                      setCurrentTime(percent * audioDuration);
                    }}
                    className="h-2 bg-[#34373f] rounded-full cursor-pointer relative overflow-hidden group hover:h-2.5 transition-all"
                  >
                    <div
                      className="h-full bg-[#1db954] rounded-full transition-all"
                      style={{
                        width: `${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] font-mono text-[#6f7682]">
                    <span className="text-[#3fb970] font-semibold">{formatPlayerTime(currentTime)}</span>
                    <span>{formatPlayerTime(audioDuration || currentVoiceover.durationSeconds)}</span>
                  </div>
                </div>

                {/* Player Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (audioPlayerRef.current) audioPlayerRef.current.currentTime = 0;
                      }}
                      className="p-1.5 text-[#9ca3af] hover:text-[#e4e7ec] transition-colors cursor-pointer"
                      title="Restart"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={togglePlayGenerated}
                      className="w-10 h-10 rounded-full bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] flex items-center justify-center font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (audioPlayerRef.current) {
                          audioPlayerRef.current.muted = !isMuted;
                          setIsMuted(!isMuted);
                        }
                      }}
                      className="text-[#9ca3af] hover:text-[#e4e7ec]"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : playerVolume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPlayerVolume(val);
                        setIsMuted(false);
                        if (audioPlayerRef.current) {
                          audioPlayerRef.current.volume = val;
                          audioPlayerRef.current.muted = false;
                        }
                      }}
                      className="w-20 accent-[#1db954] cursor-pointer"
                    />
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Voice Selector & Cloned Voices Library */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#e4e7ec]">Select Voice Persona</h3>
                <p className="text-xs text-[#9ca3af]">
                  Default voices or your custom voice clones
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveSubTab('clone')}
                className="h-7 text-xs border-[#1db954]/35 text-[#4cc37c] hover:bg-[#1db954]/10 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Clone Voice</span>
              </Button>
            </div>

            {/* Voices Grid */}
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {isLoadingVoices && (
                <div className="text-center py-8 text-xs text-[#9ca3af]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#34a866]" />
                  Loading voice profiles...
                </div>
              )}

              {voices.map((voice) => {
                const isSelected = String(selectedVoiceId) === String(voice.id);
                const isSamplePlaying = playingSampleVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    onClick={() => handleSelectVoice(voice)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#202422] border-[#1db954]/55'
                        : 'bg-[#181818] border-[#282828] hover:border-[#34373f]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {/* Voice Avatar Badge */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 ${
                            voice.gender === 'female' || voice.vocalFingerprint?.detectedGender === 'female'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                              : voice.isCustom
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                              : 'bg-emerald-500/15 text-[#4cc37c] border border-emerald-500/25'
                          }`}
                        >
                          {voice.gender === 'female' || voice.vocalFingerprint?.detectedGender === 'female'
                            ? 'F'
                            : voice.gender === 'male' || voice.vocalFingerprint?.detectedGender === 'male'
                            ? 'M'
                            : 'C'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#e4e7ec]">{voice.name}</span>
                            <span
                              className={`text-xs font-semibold ${
                                voice.isCustom ? 'text-blue-300/90' : 'text-[#3fb970]'
                              }`}
                            >
                              {voice.isCustom ? '· Cloned' : '· Studio'}
                            </span>
                          </div>
                          <p className="text-xs text-[#9ca3af] mt-0.5 font-mono tabular-nums">
                            {voice.gender === 'female'
                              ? 'Female'
                              : voice.gender === 'male'
                              ? 'Male'
                              : voice.vocalFingerprint?.detectedGender === 'female'
                              ? 'Female'
                              : voice.vocalFingerprint?.detectedGender === 'male'
                              ? 'Male'
                              : 'Custom'}
                            {` · ${getShortLanguageLabel(voice.language)}`}
                            {voice.accent ? ` · ${voice.accent}` : ''}
                            {voice.isCustom && voice.durationSeconds ? ` · ${voice.durationSeconds}s` : ''}
                          </p>
                          {(voice.description || voice.vocalFingerprint?.pitchRegister) && (
                            <p className="text-xs text-[#9ca3af] mt-1 line-clamp-2">
                              {voice.description ||
                                [voice.vocalFingerprint?.pitchRegister, voice.vocalFingerprint?.vocalTimbre]
                                  .filter(Boolean)
                                  .join(' — ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Sample Play Button & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => togglePlaySample(voice, e)}
                          className={`p-2 rounded-full transition-colors cursor-pointer ${
                            isSamplePlaying
                              ? 'bg-[#1db954] text-[#08100b]'
                              : 'bg-[#24272c] text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#2e3238]'
                          }`}
                          title="Preview voice sample"
                        >
                          {isSamplePlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>

                        {voice.isCustom && (
                          <button
                            onClick={(e) => handleDeleteVoice(voice.id, e)}
                            className="p-1.5 text-[#6f7682] hover:text-rose-400 rounded-lg hover:bg-[#282828] transition-colors"
                            title="Delete custom voice profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: VOICE CLONING STUDIO                                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'clone' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="p-6 bg-[#181818] border-[#282828] space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[#e4e7ec] tracking-tight font-display">
                Clone Your Voice
              </h2>
              <p className="text-xs text-[#9ca3af] mt-1">
                Record your voice for 15-30 seconds or upload a clean voice sample to clone your personal voice for automatic AI voiceovers.
              </p>
            </div>

            {/* Step 1: Voice Sample Source (Record Mic or Upload File) */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#d0d5dd] uppercase tracking-wider">
                Step 1: Provide Voice Sample (15-30 Seconds)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Live Microphone Recorder Box */}
                <div
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-3 transition-all ${
                    isRecording
                      ? 'bg-rose-500/10 border-rose-500/45'
                      : 'bg-[#121212] border-[#282828]'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isRecording ? 'bg-rose-500 text-[#e4e7ec] animate-pulse' : 'bg-[#24272c] text-[#34a866]'
                    }`}
                  >
                    <Mic className="w-6 h-6" />
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-[#e4e7ec]">
                      {isRecording ? `Recording... (${recordingSeconds}s)` : 'Record from Microphone'}
                    </h4>
                    <p className="text-[11px] text-[#6f7682] mt-0.5">
                      Read aloud in natural speaking cadence
                    </p>
                  </div>

                  {isRecording ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopRecording}
                      className="text-xs gap-1.5"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Stop Recording</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startRecording}
                      className="text-xs gap-1.5 border-[#34373f] text-[#4cc37c] hover:bg-[#24272c]"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Start Voice Recording</span>
                    </Button>
                  )}
                </div>

                {/* File Upload Box */}
                <div className="p-4 rounded-xl border bg-[#121212] border-[#282828] flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#24272c] text-blue-400/90 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-[#e4e7ec]">Upload Audio Sample</h4>
                    <p className="text-[11px] text-[#6f7682] mt-0.5">
                      WAV, MP3, OGG, or M4A audio file
                    </p>
                  </div>

                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleVoiceFileUpload}
                      className="hidden"
                    />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#34373f] text-[#d0d5dd] hover:bg-[#24272c] transition-colors">
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Choose Audio File</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Sample Reading Prompt Helper */}
              <div className="p-3 bg-[#121212] rounded-xl border border-[#24262c] text-xs text-[#9ca3af] space-y-1">
                <span className="font-semibold text-[#d0d5dd]">Recommended sample reading text (any language):</span>
                <p className="italic text-[#6f7682]">
                  &quot;I am recording this audio sample to clone my personal voice in Scriby AI. This recording will capture my natural cadence, tone, and pronunciation for automated voiceovers.&quot;
                </p>
              </div>

              {/* Sample Audio Player Preview */}
              {cloneAudioUrl && (
                <div className="p-3 bg-[#202422] rounded-xl border border-[#1db954]/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3fb970]" />
                    <span className="text-xs font-semibold text-[#e4e7ec]">
                      Sample Captured (~{cloneDuration || 15}s)
                    </span>
                  </div>
                  <audio controls src={cloneAudioUrl} className="h-8 max-w-[200px]" />
                </div>
              )}
            </div>

            {/* Step 2: Voice Profile Information */}
            <div className="space-y-4 pt-2 border-t border-[#282828]">
              <label className="text-xs font-semibold text-[#d0d5dd] uppercase tracking-wider">
                Step 2: Voice Profile Details
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#9ca3af]">Voice Name</label>
                  <Input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="e.g., My Studio Narrator Voice"
                    className="bg-[#121212] border-[#282828] text-[#d0d5dd]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#9ca3af]">Gender / Timbre</label>
                  <select
                    value={cloneGender}
                    onChange={(e) => setCloneGender(e.target.value as VoiceGender)}
                    className="w-full h-10 bg-[#121212] border border-[#282828] text-xs text-[#d0d5dd] rounded-lg px-3 outline-none focus:border-[#1db954]/55"
                  >
                    <option value="custom">Auto-Detect from Voice Sample</option>
                    <option value="male">Male (Deep Studio Voice)</option>
                    <option value="female">Female (Clear Narrative Voice)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="clone-primary-language" className="text-xs font-semibold text-[#9ca3af]">
                    Primary Language
                  </label>
                  <select
                    id="clone-primary-language"
                    value={cloneLanguage}
                    onChange={(e) => handleCloneLanguageChange(e.target.value)}
                    className="w-full h-10 bg-[#121212] border border-[#282828] text-xs text-[#d0d5dd] rounded-lg px-3 outline-none focus:border-[#1db954]/55"
                  >
                    {cloningLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.nativeName ? `${lang.label} (${lang.nativeName})` : lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="clone-accent-select" className="text-xs font-semibold text-[#9ca3af]">
                    Accent / Dialect
                  </label>
                  <select
                    id="clone-accent-select"
                    value={cloneAccent}
                    onChange={(e) => setCloneAccent(e.target.value)}
                    className="w-full h-10 bg-[#121212] border border-[#282828] text-xs text-[#d0d5dd] rounded-lg px-3 outline-none focus:border-[#1db954]/55"
                  >
                    {cloneAccentOptions.map((acc) => (
                      <option key={acc.id} value={acc.label}>
                        {acc.label}
                      </option>
                    ))}
                    <option value={CUSTOM_ACCENT_ID}>Custom Accent...</option>
                  </select>
                </div>
              </div>

              {cloneAccent === CUSTOM_ACCENT_ID && (
                <div className="space-y-1.5">
                  <label htmlFor="clone-custom-accent" className="text-xs font-semibold text-[#9ca3af]">
                    Custom Accent / Dialect Style
                  </label>
                  <Input
                    id="clone-custom-accent"
                    type="text"
                    maxLength={80}
                    autoFocus
                    value={cloneCustomAccent}
                    onChange={(e) => setCloneCustomAccent(e.target.value)}
                    placeholder="e.g., Sylheti-inflected Warm, Scottish Highlands, Calm Documentary"
                    className="h-10 bg-[#121212] border-[#282828] text-xs text-[#d0d5dd] focus:border-[#1db954]/55"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#9ca3af]">Description (Optional)</label>
                <Input
                  type="text"
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  placeholder="e.g., Warm documentary narrator voice for tech reviews"
                  className="bg-[#121212] border-[#282828] text-[#d0d5dd]"
                />
              </div>

              {/* Submit Clone Button */}
              <div className="pt-2">
                <Button
                  onClick={handleSaveVoiceClone}
                  disabled={isCloning || !cloneName.trim() || !cloneAudioBlob}
                  className="w-full h-11 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold text-sm rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  {isCloning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#08100b]" />
                      <span>Analyzing Voice &amp; Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Save Voice Clone to Library</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: LIVE MICROPHONE RECORDER & EXPORTER                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'record' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="p-6 bg-[#181818] border-[#282828] text-center space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[#e4e7ec] tracking-tight font-display">
                Studio Audio Recorder & Exporter
              </h2>
              <p className="text-xs text-[#9ca3af] mt-1">
                Record your voice directly in the browser with studio quality and download in WAV, MP3, or OGG format.
              </p>
            </div>

            {/* Big Record Button & Timer */}
            <div className="py-6 flex flex-col items-center justify-center gap-4">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isRecording
                    ? 'bg-rose-500 text-[#e4e7ec] animate-pulse'
                    : 'bg-[#1db954] text-[#08100b]'
                }`}
              >
                {isRecording ? <Mic className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
              </div>

              <div className="font-mono tabular-nums text-2xl font-semibold text-[#e4e7ec]">
                {formatPlayerTime(recordingSeconds)}
              </div>

              {isRecording ? (
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={stopRecording}
                  className="rounded-full px-8 font-semibold gap-2"
                >
                  <MicOff className="w-4 h-4" />
                  <span>Stop Recording</span>
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={startRecording}
                  className="rounded-full px-8 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold gap-2"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Live Recording</span>
                </Button>
              )}
            </div>

            {/* Recorded Audio Action Bar */}
            {liveRecordedUrl && (
              <div className="p-4 bg-[#121212] rounded-xl border border-[#282828] space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3fb970]" />
                    <span className="text-xs font-semibold text-[#e4e7ec]">
                      Recording Ready ({formatPlayerTime(recordingSeconds)})
                    </span>
                  </div>
                  <audio controls src={liveRecordedUrl} className="h-8 max-w-[220px]" />
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#24262c]">
                  {/* Download Direct */}
                  <a
                    href={liveRecordedUrl}
                    download={`scriby-recording-${Date.now()}.wav`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#24272c] hover:bg-[#2e3238] hover:text-[#4cc37c] text-[#d0d5dd] text-xs font-semibold rounded-lg border border-[#34373f] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Audio (WAV)</span>
                  </a>

                  <div className="flex items-center gap-2">
                    {/* Save to Recordings archive */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (liveRecordedUrl) {
                          const newRec: SavedVoiceoverItem = {
                            id: Date.now(),
                            title: `Live Voice Recording (${formatPlayerTime(recordingSeconds)})`,
                            script: 'Microphone live voice capture',
                            voiceId: 'live-mic',
                            voiceName: 'Live Microphone',
                            voiceGender: 'custom',
                            audioUrl: liveRecordedUrl,
                            durationSeconds: recordingSeconds,
                            format: 'wav',
                            createdAt: new Date().toISOString(),
                          };
                          setSavedVoiceovers((prev) => [newRec, ...prev]);
                          showToast('Live recording saved to Recordings archive!');
                        }
                      }}
                      className="text-xs h-8 gap-1.5 border-[#34373f] text-[#d0d5dd] hover:border-[#1db954]/50 hover:text-[#4cc37c] cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Save to Recordings</span>
                    </Button>

                    {/* Send to Subtitle Studio */}
                    <Button
                      size="sm"
                      onClick={() => {
                        onSendToSubtitleStudio(
                          liveRecordedUrl,
                          `Live Voice Recording - ${new Date().toLocaleTimeString()}`,
                          recordingSeconds,
                          script.trim() || 'Live microphone voice capture'
                        );
                        showToast('Live recording loaded into Subtitle Editor with synced subtitles!');
                      }}
                      className="text-xs h-8 gap-1.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send to Subtitles</span>
                    </Button>

                    {/* Discard Recording */}
                    <button
                      onClick={() => {
                        setLiveRecordedBlob(null);
                        setLiveRecordedUrl(null);
                        setRecordingSeconds(0);
                        showToast('Live recording discarded.');
                      }}
                      className="p-1.5 text-[#6f7682] hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Discard recording"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: SAVED VOICEOVERS ARCHIVE                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <Card className="p-5 bg-[#181818] border-[#282828] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#282828]">
            <div>
              <h3 className="text-sm font-semibold text-[#e4e7ec] font-display">
                Generated Voiceover Archive
              </h3>
              <p className="text-xs text-[#9ca3af]">
                Saved audio recordings and speech synthesis sessions
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchSavedVoiceovers}
              disabled={isLoadingHistory}
              className="text-xs h-7 gap-1 border-[#34373f] text-[#9ca3af]"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>

          {savedVoiceovers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Headphones className="w-8 h-8 text-[#6f7682] mx-auto" />
              <p className="text-xs text-[#9ca3af]">No generated voiceovers yet.</p>
              <Button
                size="sm"
                onClick={() => setActiveSubTab('tts')}
                className="text-xs bg-[#1db954] text-[#08100b] font-semibold"
              >
                Synthesize First Voiceover
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {savedVoiceovers.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-[#121212] border border-[#282828] rounded-xl flex items-center justify-between gap-4 hover:border-[#34373f] transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-8 h-8 rounded-full bg-[#24272c] text-[#34a866] flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4" />
                    </div>

                    <div className="truncate">
                      <h4 className="text-xs font-semibold text-[#e4e7ec] truncate">{item.title}</h4>
                      <p className="text-xs text-[#9ca3af] flex items-center gap-2 mt-0.5 flex-wrap font-mono tabular-nums">
                        <span className="font-semibold text-[#3fb970] font-sans">{item.voiceName}</span>
                        <span>·</span>
                        <span className="uppercase">{item.format}</span>
                        {item.languageLabel && (
                          <>
                            <span>·</span>
                            <span className="font-sans">{item.languageLabel}</span>
                          </>
                        )}
                        {item.accent && (
                          <>
                            <span>·</span>
                            <span className="font-sans">{item.accent}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <audio controls src={item.audioUrl} className="h-7 max-w-[160px]" />

                    <a
                      href={`${item.audioUrl}&download=1`}
                      download={`scriby-${item.id}.${item.format}`}
                      className="p-1.5 bg-[#24272c] hover:bg-[#2e3238] hover:text-[#4cc37c] text-[#d0d5dd] rounded-lg border border-[#34373f] transition-colors"
                      title="Download audio"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    <Button
                      size="sm"
                      onClick={() => {
                        onSendToSubtitleStudio(item.audioUrl, item.title, item.durationSeconds, item.script);
                        showToast('Loaded into Subtitle Editor with synced subtitles!');
                      }}
                      className="text-[11px] h-7 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold cursor-pointer"
                    >
                      Use in Studio
                    </Button>

                    <button
                      onClick={() =>
                        promptDeleteVoiceover({
                          id: item.id,
                          audioUrl: item.audioUrl,
                          title: item.title,
                          voiceName: item.voiceName,
                          format: item.format,
                          source: 'recording',
                        })
                      }
                      className="p-1.5 text-[#6f7682] hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete recording"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL: DELETE VOICE RECORDING                                */}
      {/* ========================================================================= */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeletingVoiceover) setItemToDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-[#181818] border border-rose-500/25 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#e4e7ec] font-display">
                  Delete Voice Recording?
                </h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Are you sure you want to delete this voiceover recording? This will permanently remove the audio file from your recordings archive and voice generation workspace.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#121212] border border-[#282828] rounded-xl space-y-1.5 text-xs">
              <div className="font-semibold text-[#e4e7ec] line-clamp-2">
                {itemToDelete.title || itemToDelete.voiceName || 'Voiceover Clip'}
              </div>
              <div className="text-[11px] text-[#6f7682] flex items-center gap-2">
                <span className="text-[#3fb970] font-semibold">{itemToDelete.voiceName || 'Studio Voice'}</span>
                <span>·</span>
                <span className="uppercase font-mono">{itemToDelete.format || 'WAV'}</span>
                <span>·</span>
                <span className="text-rose-400 font-medium">Permanent Removal</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItemToDelete(null)}
                disabled={isDeletingVoiceover}
                className="border-[#34373f] text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#282828] text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeletingVoiceover}
                className="bg-rose-600/90 hover:bg-rose-600 text-[#e4e7ec] font-semibold text-xs h-9 px-4 gap-1.5 cursor-pointer"
              >
                {isDeletingVoiceover ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SELECT PLATFORM SUBTITLES / TRANSCRIPTS                             */}
      {/* ========================================================================= */}
      {showPlatformSubtitlesModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowPlatformSubtitlesModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-[#181818] border border-[#282828] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-left"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#282828]">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#34a866]" />
                <h3 className="text-base font-semibold text-[#e4e7ec] font-display">
                  Import Platform Subtitles
                </h3>
              </div>
              <button
                onClick={() => setShowPlatformSubtitlesModal(false)}
                className="p-1 text-[#9ca3af] hover:text-[#e4e7ec] rounded-lg hover:bg-[#282828] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9ca3af]">
              Choose from your active subtitle editor session or saved transcripts previously created on this platform.
            </p>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {/* Option 1: Current Active Subtitle Session */}
              {currentSubtitleText ? (
                <div
                  onClick={() => {
                    setScript(currentSubtitleText);
                    showToast('Imported active subtitles into Voiceover Studio!');
                    setShowPlatformSubtitlesModal(false);
                  }}
                  className="p-3.5 bg-[#121212] border border-[#1db954]/35 hover:border-[#1db954]/60 rounded-xl cursor-pointer transition-all hover:bg-[#1a1c20] group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#e4e7ec] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#1db954]" />
                      Current Subtitle Editor Transcript
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#1db954]/10 text-[#4cc37c] border border-[#1db954]/25">
                      Active Session
                    </span>
                  </div>
                  <p className="text-xs text-[#9ca3af] line-clamp-2 italic">
                    "{currentSubtitleText}"
                  </p>
                  <div className="text-xs text-[#6f7682] mt-2 flex items-center gap-2">
                    <span>{currentSubtitleText.split(/\s+/).filter(Boolean).length} words</span>
                    <span>·</span>
                    <span className="text-[#3fb970] group-hover:underline">Click to load into script</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#121212] border border-[#282828] rounded-xl text-xs text-[#6f7682]">
                  No active subtitle session open in editor. Choose from your saved transcripts below or type a script.
                </div>
              )}

              {/* Option 2: Saved Platform Transcripts from Cloud SQL */}
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#6f7682] uppercase tracking-wider mb-2">
                  Saved Platform Transcripts ({platformTranscripts.length})
                </div>

                {isLoadingPlatformTranscripts && (
                  <div className="py-6 text-center text-xs text-[#6f7682]">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#34a866] mx-auto mb-1.5" />
                    Loading saved platform transcripts...
                  </div>
                )}

                {!isLoadingPlatformTranscripts && platformTranscripts.length === 0 && (
                  <div className="p-3 text-center text-xs text-[#6f7682] bg-[#121212] rounded-xl border border-[#282828]">
                    No saved transcripts found in history.
                  </div>
                )}

                {!isLoadingPlatformTranscripts &&
                  platformTranscripts.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        const targetText =
                          t.fullTranscript ||
                          (t.segments && t.segments.length > 0 ? t.segments.map((s: any) => s.text).join(' ') : '') ||
                          t.title;
                        setScript(targetText);
                        showToast(`Imported subtitles from "${t.title}"!`);
                        setShowPlatformSubtitlesModal(false);
                      }}
                      className="p-3 bg-[#121212] border border-[#282828] hover:border-[#1db954]/50 rounded-xl cursor-pointer transition-all hover:bg-[#1a1c20] mb-2 group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#e4e7ec] group-hover:text-[#4cc37c] transition-colors truncate max-w-[300px]">
                          {t.title}
                        </span>
                        <span className="text-xs text-[#6f7682] font-mono tabular-nums">
                          ~{Math.round(t.duration || 30)}s
                        </span>
                      </div>
                      <p className="text-xs text-[#9ca3af] line-clamp-2">
                        {t.fullTranscript || 'Transcript audio session'}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#282828]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPlatformSubtitlesModal(false)}
                className="border-[#34373f] text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#282828] text-xs h-8 px-4 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
