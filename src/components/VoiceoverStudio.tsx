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
} from 'lucide-react';
import { VoiceProfile, SavedVoiceoverItem, AudioExportFormat, VoiceTone, VoiceGender } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { formatPlayerTime } from '../utils/timeFormat';
import { parseSubtitleToPlainText } from '../utils/subtitleUtils';
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
  const [cloneLanguage, setCloneLanguage] = useState<'bn' | 'en' | 'multilingual'>('bn');
  const [cloneAccent, setCloneAccent] = useState<string>('Standard Bangla');
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

  // Synthesize Voiceover
  const handleGenerateVoiceover = async () => {
    if (!script.trim()) {
      showToast('Please enter text script to synthesize.', 'error');
      return;
    }

    const selectedVoice = voices.find((v) => String(v.id) === String(selectedVoiceId));
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
        script: string;
      }>('/api/voiceover/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          script,
          voiceId: selectedVoiceId,
          voiceName: selectedVoice?.name || 'Studio Voice',
          gender: selectedVoice?.gender || 'male',
          tone,
          speed,
          pitch,
          format: exportFormat,
        }),
      });

      if (res.ok && res.data) {
        const generatedItem = {
          id: res.data.id,
          voiceoverId: res.data.voiceoverId,
          audioUrl: res.data.audioUrl,
          durationSeconds: res.data.durationSeconds,
          format: res.data.format,
          voiceName: res.data.voiceName,
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
          voiceGender: selectedVoice?.gender || 'male',
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

        showToast('Voiceover synthesized and added to Recordings!');
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
            accent: cloneAccent,
            description: cloneDescription,
            audioBase64,
            durationSeconds: cloneDuration || 15,
          }),
        }
      );

      if (res.ok && res.data?.voice) {
        showToast('Voice cloned and saved successfully!');
        setCloneName('');
        setCloneDescription('');
        setCloneAudioBlob(null);
        setCloneAudioUrl(null);
        fetchVoices();
        setActiveSubTab('tts');
        setSelectedVoiceId(res.data.voice.id);
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
              ? 'bg-[#181818] border-[#1ed760] text-white'
              : 'bg-[#181818] border-red-500 text-white'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#1ed760]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#282828]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-white tracking-tight font-display">
              AI Voiceover Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1ed760]/20 text-[#1ed760] border border-[#1ed760]/30 uppercase tracking-wider">
              Voice Clone & Studio TTS
            </span>
          </div>
          <p className="text-xs text-[#b3b3b3] mt-1">
            Professional AI voice cloning, studio text-to-speech, and direct audio export in WAV, MP3, and OGG formats
          </p>
        </div>

        {/* Sub-tab Navigation (Spotify Pill Bar) */}
        <div className="flex items-center p-1 bg-[#181818] rounded-full border border-[#282828] text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('tts')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              activeSubTab === 'tts'
                ? 'bg-[#282828] text-white font-bold shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#1ed760]" />
            <span>Voiceover Studio</span>
          </button>

          <button
            onClick={() => setActiveSubTab('clone')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              activeSubTab === 'clone'
                ? 'bg-[#282828] text-white font-bold shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Clone Voice</span>
          </button>

          <button
            onClick={() => setActiveSubTab('record')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              activeSubTab === 'record'
                ? 'bg-[#282828] text-white font-bold shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-rose-400" />
            <span>Live Recorder</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-[#282828] text-white font-bold shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5 text-amber-400" />
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1ed760]" />
                  <h3 className="text-sm font-bold text-white">Voiceover Script Text</h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Option A: Use Platform Subtitles */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPlatformSubtitles}
                    className="text-xs h-7 gap-1.5 border-[#3e3e3e] text-[#1ed760] hover:bg-[#282828] hover:border-[#1ed760]/50 cursor-pointer"
                    title="Import subtitles created in this platform"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Use Platform Subtitles</span>
                  </Button>

                  {/* Option B: Import External SRT / VTT */}
                  <label
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs h-7 rounded-md border border-[#3e3e3e] text-white hover:border-blue-400/60 hover:text-blue-300 bg-[#242424] hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                    title="Upload external .SRT, .VTT, or text file"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
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
                  className="w-full bg-[#121212] border border-[#282828] rounded-xl p-3.5 text-sm text-white placeholder-[#535353] focus:border-[#1ed760] focus:ring-1 focus:ring-[#1ed760] outline-none transition-all resize-y leading-relaxed"
                />
              </div>

              {/* Word & Duration Readout */}
              <div className="flex items-center justify-between text-xs text-[#878787] pt-1 font-mono">
                <div className="flex items-center gap-3">
                  <span>{wordCount} words</span>
                  <span>·</span>
                  <span>{charCount} characters</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#1ed760]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Est. Duration: ~{estimatedSeconds}s</span>
                </div>
              </div>
            </Card>

            {/* Vocal Modulation & Output Format Card */}
            <Card className="p-5 bg-[#181818] border-[#282828] space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#1ed760]" />
                <h3 className="text-sm font-bold text-white">Audio Tuning & Format</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Speech Delivery Tone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Delivery Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as VoiceTone)}
                    className="w-full bg-[#242424] border border-[#3e3e3e] text-xs text-white rounded-lg p-2 outline-none focus:border-[#1ed760]"
                  >
                    <option value="natural">Natural Conversational</option>
                    <option value="broadcast">Professional Broadcast / News</option>
                    <option value="storytelling">Storytelling & Narrative</option>
                    <option value="energetic">Energetic Promo / High CTR</option>
                  </select>
                </div>

                {/* Speech Speed */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#b3b3b3]">
                    <span>Speed</span>
                    <span className="font-mono text-[#1ed760]">{speed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full accent-[#1ed760] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#535353] font-mono">
                    <span>0.75x</span>
                    <span>1.0x</span>
                    <span>1.5x</span>
                  </div>
                </div>

                {/* Export Audio Format */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Export Format</label>
                  <div className="grid grid-cols-3 gap-1 bg-[#121212] p-1 rounded-lg border border-[#282828]">
                    {(['wav', 'mp3', 'ogg'] as AudioExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setExportFormat(fmt)}
                        className={`py-1 text-xs font-bold rounded uppercase transition-colors cursor-pointer ${
                          exportFormat === fmt
                            ? 'bg-[#1ed760] text-black shadow'
                            : 'text-[#b3b3b3] hover:text-white'
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
                  className="w-full h-11 bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.01] text-black font-extrabold text-sm rounded-xl transition-all shadow-[0_4px_16px_rgba(30,215,96,0.3)] cursor-pointer flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Synthesizing Voiceover Audio ({exportFormat.toUpperCase()})...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-black" />
                      <span>Generate Voiceover ({exportFormat.toUpperCase()})</span>
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Live Waveform Preview Player for Synthesized Voiceover */}
            {currentVoiceover && (
              <Card className="p-5 bg-gradient-to-br from-[#181818] to-[#121212] border border-[#1ed760]/40 rounded-xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1ed760] animate-pulse" />
                    <div>
                      <h4 className="text-sm font-bold text-white font-display">
                        Ready: {currentVoiceover.voiceName}
                      </h4>
                      <p className="text-[11px] text-[#b3b3b3] font-mono">
                        Format: {currentVoiceover.format.toUpperCase()} · Duration: ~
                        {formatPlayerTime(audioDuration || currentVoiceover.durationSeconds)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Direct Download in Chosen Audio Format */}
                    <a
                      href={`${currentVoiceover.audioUrl}&download=1`}
                      download={`scriby-voiceover-${currentVoiceover.voiceoverId}.${currentVoiceover.format}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#282828] hover:bg-[#333333] hover:text-[#1ed760] text-white text-xs font-bold rounded-lg border border-[#3e3e3e] transition-all cursor-pointer"
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
                      className="text-xs h-8 gap-1.5 bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold cursor-pointer"
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
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#282828] hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold rounded-lg border border-rose-500/30 hover:border-rose-500/50 transition-all cursor-pointer"
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
                    className="h-2 bg-[#333333] rounded-full cursor-pointer relative overflow-hidden group hover:h-2.5 transition-all"
                  >
                    <div
                      className="h-full bg-[#1ed760] rounded-full transition-all"
                      style={{
                        width: `${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] font-mono text-[#878787]">
                    <span className="text-[#1ed760] font-semibold">{formatPlayerTime(currentTime)}</span>
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
                      className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
                      title="Restart"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={togglePlayGenerated}
                      className="w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] text-black flex items-center justify-center font-bold shadow-md hover:scale-105 transition-all cursor-pointer"
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
                      className="text-[#b3b3b3] hover:text-white"
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
                      className="w-20 accent-[#1ed760] cursor-pointer"
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
                <h3 className="text-sm font-bold text-white">Select Voice Persona</h3>
                <p className="text-xs text-[#878787]">
                  Default voices or your custom voice clones
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveSubTab('clone')}
                className="h-7 text-xs border-[#1ed760]/40 text-[#1ed760] hover:bg-[#1ed760]/10 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Clone Voice</span>
              </Button>
            </div>

            {/* Voices Grid */}
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {isLoadingVoices && (
                <div className="text-center py-8 text-xs text-[#b3b3b3]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1ed760]" />
                  Loading voice profiles...
                </div>
              )}

              {voices.map((voice) => {
                const isSelected = String(selectedVoiceId) === String(voice.id);
                const isSamplePlaying = playingSampleVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    onClick={() => setSelectedVoiceId(voice.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#242424] border-[#1ed760] shadow-[0_0_12px_rgba(30,215,96,0.15)]'
                        : 'bg-[#181818] border-[#282828] hover:border-[#3e3e3e]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {/* Voice Avatar Badge */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            voice.gender === 'female'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : voice.isCustom
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {voice.gender === 'female' ? 'F' : voice.isCustom ? 'C' : 'M'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{voice.name}</span>
                            {voice.isCustom ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                Cloned Voice
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#1ed760]/10 text-[#1ed760]">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#b3b3b3] mt-0.5 line-clamp-2">
                            {voice.description}
                          </p>
                        </div>
                      </div>

                      {/* Sample Play Button & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => togglePlaySample(voice, e)}
                          className={`p-2 rounded-full transition-colors cursor-pointer ${
                            isSamplePlaying
                              ? 'bg-[#1ed760] text-black animate-pulse'
                              : 'bg-[#282828] text-[#b3b3b3] hover:text-white hover:bg-[#333333]'
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
                            className="p-1.5 text-[#535353] hover:text-red-400 rounded-lg hover:bg-[#282828] transition-colors"
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
              <h2 className="text-lg font-bold text-white tracking-tight font-display">
                Clone Your Voice
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-1">
                Record your voice for 15-30 seconds or upload a clean voice sample to clone your personal voice for automatic AI voiceovers.
              </p>
            </div>

            {/* Step 1: Voice Sample Source (Record Mic or Upload File) */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                Step 1: Provide Voice Sample (15-30 Seconds)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Live Microphone Recorder Box */}
                <div
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-3 transition-all ${
                    isRecording
                      ? 'bg-red-500/10 border-red-500/50'
                      : 'bg-[#121212] border-[#282828]'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#282828] text-[#1ed760]'
                    }`}
                  >
                    <Mic className="w-6 h-6" />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {isRecording ? `Recording... (${recordingSeconds}s)` : 'Record from Microphone'}
                    </h4>
                    <p className="text-[11px] text-[#878787] mt-0.5">
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
                      className="text-xs gap-1.5 border-[#3e3e3e] text-[#1ed760] hover:bg-[#282828]"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Start Voice Recording</span>
                    </Button>
                  )}
                </div>

                {/* File Upload Box */}
                <div className="p-4 rounded-xl border bg-[#121212] border-[#282828] flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#282828] text-blue-400 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">Upload Audio Sample</h4>
                    <p className="text-[11px] text-[#878787] mt-0.5">
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[#3e3e3e] text-white hover:bg-[#282828] transition-colors">
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Choose Audio File</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Sample Reading Prompt Helper */}
              <div className="p-3 bg-[#121212] rounded-xl border border-[#242424] text-xs text-[#b3b3b3] space-y-1">
                <span className="font-bold text-white">Recommended sample reading text (any language):</span>
                <p className="italic text-[#878787]">
                  &quot;I am recording this audio sample to clone my personal voice in Scriby AI. This recording will capture my natural cadence, tone, and pronunciation for automated voiceovers.&quot;
                </p>
              </div>

              {/* Sample Audio Player Preview */}
              {cloneAudioUrl && (
                <div className="p-3 bg-[#242424] rounded-xl border border-[#1ed760]/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1ed760]" />
                    <span className="text-xs font-bold text-white">
                      Sample Captured (~{cloneDuration || 15}s)
                    </span>
                  </div>
                  <audio controls src={cloneAudioUrl} className="h-8 max-w-[200px]" />
                </div>
              )}
            </div>

            {/* Step 2: Voice Profile Information */}
            <div className="space-y-4 pt-2 border-t border-[#282828]">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                Step 2: Voice Profile Details
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Voice Name</label>
                  <Input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="e.g., My Studio Narrator Voice"
                    className="bg-[#121212] border-[#282828] text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Gender / Timbre</label>
                  <select
                    value={cloneGender}
                    onChange={(e) => setCloneGender(e.target.value as VoiceGender)}
                    className="w-full bg-[#121212] border border-[#282828] text-xs text-white rounded-lg p-2.5 outline-none focus:border-[#1ed760]"
                  >
                    <option value="male">Male (Deep Studio Voice)</option>
                    <option value="female">Female (Clear Narrative Voice)</option>
                    <option value="custom">Custom Voice Timbre</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Primary Language</label>
                  <select
                    value={cloneLanguage}
                    onChange={(e) => setCloneLanguage(e.target.value as any)}
                    className="w-full bg-[#121212] border border-[#282828] text-xs text-white rounded-lg p-2.5 outline-none focus:border-[#1ed760]"
                  >
                    <option value="multilingual">Universal Multilingual (All Languages)</option>
                    <option value="en">English</option>
                    <option value="bn">Bengali (বাংলা)</option>
                    <option value="es">Spanish (Español)</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="ar">Arabic (العربية)</option>
                    <option value="fr">French (Français)</option>
                    <option value="de">German (Deutsch)</option>
                    <option value="pt">Portuguese (Português)</option>
                    <option value="ja">Japanese (日本語)</option>
                    <option value="zh">Chinese (中文)</option>
                    <option value="other">Other Global Language</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Accent / Style</label>
                  <Input
                    type="text"
                    value={cloneAccent}
                    onChange={(e) => setCloneAccent(e.target.value)}
                    placeholder="e.g., Standard Studio / Neutral / Clear"
                    className="bg-[#121212] border-[#282828] text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#b3b3b3]">Description (Optional)</label>
                <Input
                  type="text"
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  placeholder="e.g., Warm documentary narrator voice for tech reviews"
                  className="bg-[#121212] border-[#282828] text-white"
                />
              </div>

              {/* Submit Clone Button */}
              <div className="pt-2">
                <Button
                  onClick={handleSaveVoiceClone}
                  disabled={isCloning || !cloneName.trim() || !cloneAudioBlob}
                  className="w-full h-11 bg-[#1ed760] hover:bg-[#1fdf64] text-black font-extrabold text-sm rounded-xl transition-all shadow-[0_4px_16px_rgba(30,215,96,0.3)] cursor-pointer flex items-center justify-center gap-2"
                >
                  {isCloning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Cloning Voice Profile into PostgreSQL Cloud SQL...</span>
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
              <h2 className="text-lg font-bold text-white tracking-tight font-display">
                Studio Audio Recorder & Exporter
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-1">
                Record your voice directly in the browser with studio quality and download in WAV, MP3, or OGG format.
              </p>
            </div>

            {/* Big Record Button & Timer */}
            <div className="py-6 flex flex-col items-center justify-center gap-4">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse shadow-red-500/30'
                    : 'bg-[#1ed760] text-black shadow-[#1ed760]/30 hover:scale-105'
                }`}
              >
                {isRecording ? <Mic className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
              </div>

              <div className="font-mono tabular-nums text-2xl font-bold text-white">
                {formatPlayerTime(recordingSeconds)}
              </div>

              {isRecording ? (
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={stopRecording}
                  className="rounded-full px-8 font-bold gap-2"
                >
                  <MicOff className="w-4 h-4" />
                  <span>Stop Recording</span>
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={startRecording}
                  className="rounded-full px-8 bg-[#1ed760] hover:bg-[#1fdf64] text-black font-extrabold gap-2"
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
                    <CheckCircle2 className="w-4 h-4 text-[#1ed760]" />
                    <span className="text-xs font-bold text-white">
                      Recording Ready ({formatPlayerTime(recordingSeconds)})
                    </span>
                  </div>
                  <audio controls src={liveRecordedUrl} className="h-8 max-w-[220px]" />
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#242424]">
                  {/* Download Direct */}
                  <a
                    href={liveRecordedUrl}
                    download={`scriby-recording-${Date.now()}.wav`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#282828] hover:bg-[#333333] hover:text-[#1ed760] text-white text-xs font-bold rounded-lg border border-[#3e3e3e] transition-colors"
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
                      className="text-xs h-8 gap-1.5 border-[#3e3e3e] text-white hover:border-[#1ed760] hover:text-[#1ed760] cursor-pointer"
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
                      className="text-xs h-8 gap-1.5 bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold cursor-pointer"
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
                      className="p-1.5 text-[#535353] hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
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
              <h3 className="text-sm font-bold text-white font-display">
                Generated Voiceover Archive
              </h3>
              <p className="text-xs text-[#878787]">
                Saved audio recordings and speech synthesis sessions
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchSavedVoiceovers}
              disabled={isLoadingHistory}
              className="text-xs h-7 gap-1 border-[#3e3e3e] text-[#b3b3b3]"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>

          {savedVoiceovers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Headphones className="w-8 h-8 text-[#535353] mx-auto" />
              <p className="text-xs text-[#878787]">No generated voiceovers yet.</p>
              <Button
                size="sm"
                onClick={() => setActiveSubTab('tts')}
                className="text-xs bg-[#1ed760] text-black font-bold"
              >
                Synthesize First Voiceover
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {savedVoiceovers.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-[#121212] border border-[#282828] rounded-xl flex items-center justify-between gap-4 hover:border-[#3e3e3e] transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-8 h-8 rounded-full bg-[#282828] text-[#1ed760] flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4" />
                    </div>

                    <div className="truncate">
                      <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                      <p className="text-[11px] text-[#878787] flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-[#1ed760]">{item.voiceName}</span>
                        <span>·</span>
                        <span className="uppercase">{item.format}</span>
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
                      className="p-1.5 bg-[#242424] hover:bg-[#333333] hover:text-[#1ed760] text-white rounded-lg border border-[#3e3e3e] transition-colors"
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
                      className="text-[11px] h-7 bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold cursor-pointer"
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
                      className="p-1.5 text-[#535353] hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeletingVoiceover) setItemToDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-[#181818] border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-display">
                  Delete Voice Recording?
                </h3>
                <p className="text-xs text-[#b3b3b3] leading-relaxed">
                  Are you sure you want to delete this voiceover recording? This will permanently remove the audio file from your recordings archive and voice generation workspace.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#121212] border border-[#282828] rounded-xl space-y-1.5 text-xs">
              <div className="font-semibold text-white line-clamp-2">
                {itemToDelete.title || itemToDelete.voiceName || 'Voiceover Clip'}
              </div>
              <div className="text-[11px] text-[#878787] flex items-center gap-2">
                <span className="text-[#1ed760] font-semibold">{itemToDelete.voiceName || 'Studio Voice'}</span>
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
                className="border-[#3e3e3e] text-[#b3b3b3] hover:text-white hover:bg-[#282828] text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeletingVoiceover}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-md shadow-rose-950/40 cursor-pointer"
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
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
                <Layers className="w-5 h-5 text-[#1ed760]" />
                <h3 className="text-base font-bold text-white font-display">
                  Import Platform Subtitles
                </h3>
              </div>
              <button
                onClick={() => setShowPlatformSubtitlesModal(false)}
                className="p-1 text-[#878787] hover:text-white rounded-lg hover:bg-[#282828] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#b3b3b3]">
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
                  className="p-3.5 bg-[#121212] border border-[#1ed760]/40 hover:border-[#1ed760] rounded-xl cursor-pointer transition-all hover:bg-[#1a1a1a] group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
                      Current Subtitle Editor Transcript
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/30">
                      Active Session
                    </span>
                  </div>
                  <p className="text-xs text-[#b3b3b3] line-clamp-2 italic">
                    "{currentSubtitleText}"
                  </p>
                  <div className="text-[11px] text-[#878787] mt-2 flex items-center gap-2">
                    <span>{currentSubtitleText.split(/\s+/).filter(Boolean).length} words</span>
                    <span>·</span>
                    <span className="text-[#1ed760] group-hover:underline">Click to load into script</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#121212] border border-[#282828] rounded-xl text-xs text-[#878787]">
                  No active subtitle session open in editor. Choose from your saved transcripts below or type a script.
                </div>
              )}

              {/* Option 2: Saved Platform Transcripts from Cloud SQL */}
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#878787] uppercase tracking-wider mb-2">
                  Saved Platform Transcripts ({platformTranscripts.length})
                </div>

                {isLoadingPlatformTranscripts && (
                  <div className="py-6 text-center text-xs text-[#878787]">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#1ed760] mx-auto mb-1.5" />
                    Loading saved platform transcripts...
                  </div>
                )}

                {!isLoadingPlatformTranscripts && platformTranscripts.length === 0 && (
                  <div className="p-3 text-center text-xs text-[#878787] bg-[#121212] rounded-xl border border-[#282828]">
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
                      className="p-3 bg-[#121212] border border-[#282828] hover:border-[#1ed760]/60 rounded-xl cursor-pointer transition-all hover:bg-[#1a1a1a] mb-2 group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white group-hover:text-[#1ed760] transition-colors truncate max-w-[300px]">
                          {t.title}
                        </span>
                        <span className="text-[10px] text-[#878787] font-mono">
                          ~{Math.round(t.duration || 30)}s
                        </span>
                      </div>
                      <p className="text-[11px] text-[#878787] line-clamp-2">
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
                className="border-[#3e3e3e] text-[#b3b3b3] hover:text-white hover:bg-[#282828] text-xs h-8 px-4 cursor-pointer"
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
