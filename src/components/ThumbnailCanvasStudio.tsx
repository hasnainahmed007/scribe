import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Image as ImageIcon,
  Type,
  Palette,
  Sparkles,
  Upload,
  Play,
  Check,
  Loader2,
  Sliders,
  RotateCcw,
  Layers,
  Wand2,
  Maximize2,
  Eye,
  Trash2,
} from 'lucide-react';
import { ThumbnailConfig } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

interface ThumbnailCanvasStudioProps {
  initialTitle?: string;
}

const PRESET_TEMPLATES = [
  {
    name: 'Breaking News Style',
    headline: 'EXPOSED: The Secret Behind AI Audio',
    subhead: 'Master 2026 Multimodal Workflows Today',
    badge: 'URGENT',
    badgeColor: '#EF4444',
    bg1: '#0F172A',
    bg2: '#7F1D1D',
    textColor: '#FACC15',
    strokeColor: '#000000',
  },
  {
    name: 'Tech Review Studio',
    headline: 'Top 5 AI Tools You Need Right Now',
    subhead: 'The Ultimate Guide for Digital Creators',
    badge: '4K ULTRA',
    badgeColor: '#1ed760',
    bg1: '#090D16',
    bg2: '#064E3B',
    textColor: '#FFFFFF',
    strokeColor: '#022C22',
  },
  {
    name: 'Podcast & Storytelling',
    headline: 'The Real Secret to Viral Success',
    subhead: 'Special In-Depth Creator Interview',
    badge: 'NEW EPISODE',
    badgeColor: '#8B5CF6',
    bg1: '#1E1B4B',
    bg2: '#31104B',
    textColor: '#E0E7FF',
    strokeColor: '#0F172A',
  },
  {
    name: 'Tutorial & Masterclass',
    headline: 'Generate Auto Subtitles in 1 Click',
    subhead: 'Full Walkthrough for Web & Mobile',
    badge: '100% FREE',
    badgeColor: '#F59E0B',
    bg1: '#18181B',
    bg2: '#451A03',
    textColor: '#FDE047',
    strokeColor: '#000000',
  },
];

const QUICK_PALETTES = [
  { name: 'Emerald Dark', bg1: '#0A0F1D', bg2: '#042F2E', text: '#FACC15', accent: '#1ed760' },
  { name: 'Cyber Blue', bg1: '#080E1A', bg2: '#1E1B4B', text: '#38BDF8', accent: '#0284C7' },
  { name: 'Crimson Fire', bg1: '#180404', bg2: '#7F1D1D', text: '#FDE047', accent: '#EF4444' },
  { name: 'Royal Purple', bg1: '#1A0B2E', bg2: '#4C1D95', text: '#F472B6', accent: '#A855F7' },
  { name: 'Slate Gold', bg1: '#0F172A', bg2: '#334155', text: '#FBBF24', accent: '#F59E0B' },
];

export const ThumbnailCanvasStudio: React.FC<ThumbnailCanvasStudioProps> = ({
  initialTitle = 'Turn Any Audio into Subtitles in 1 Click',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [config, setConfig] = useState<ThumbnailConfig>({
    headline: initialTitle,
    subhead: 'High-Converting YouTube Thumbnails with Clean Bold Typography',
    badge: 'NEW UPDATE',
    showBadge: true,
    fontFamily: 'Inter, system-ui, sans-serif',
    headlineSize: 68,
    headlineColor: '#FACC15',
    strokeColor: '#000000',
    strokeWidth: 8,
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    shadowBlur: 16,
    backgroundTheme: 'emerald',
    customBgColor1: '#0A0F1D',
    customBgColor2: '#042F2E',
    bgImageOpacity: 0.65,
    bgImageBlur: 0,
    overlayVignette: true,
    accentBarColor: '#1ed760',
    showAccentBar: true,
  });

  const [bgImageElement, setBgImageElement] = useState<HTMLImageElement | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Active Editor Section Tab: 'text' | 'ai' | 'style' | 'badge'
  const [editorTab, setEditorTab] = useState<'text' | 'ai' | 'style' | 'badge'>('text');

  // AI Thumbnail Generation State
  const [aiPrompt, setAiPrompt] = useState<string>(initialTitle);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialTitle) {
      setConfig((prev) => ({ ...prev, headline: initialTitle }));
      setAiPrompt(initialTitle);
    }
  }, [initialTitle]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1280;
    const height = 720;
    canvas.width = width;
    canvas.height = height;

    // 1. Draw Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, config.customBgColor1);
    gradient.addColorStop(1, config.customBgColor2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Background Image (Custom Upload or AI Generated)
    if (bgImageElement) {
      ctx.save();
      ctx.globalAlpha = config.bgImageOpacity;
      if (config.bgImageBlur > 0) {
        ctx.filter = `blur(${config.bgImageBlur}px)`;
      }
      ctx.drawImage(bgImageElement, 0, 0, width, height);
      ctx.restore();
    }

    // 3. Draw Contrast Vignette Scrim (Ensures text readability on all backgrounds)
    if (config.overlayVignette) {
      const scrim = ctx.createLinearGradient(0, 0, width, height);
      scrim.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      scrim.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
      scrim.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, width, height);
    }

    // 4. Draw Left Accent Color Bar
    if (config.showAccentBar) {
      ctx.fillStyle = config.accentBarColor;
      ctx.fillRect(0, 0, 16, height);
    }

    // 5. Draw Badge Overlay
    let textStartY = 270;
    if (config.showBadge && config.badge.trim()) {
      ctx.save();
      const badgeText = config.badge.toUpperCase();
      ctx.font = `bold 28px ${config.fontFamily}, sans-serif`;
      const textMetrics = ctx.measureText(badgeText);
      const badgeWidth = textMetrics.width + 48;
      const badgeHeight = 52;
      const badgeX = 64;
      const badgeY = 64;

      ctx.fillStyle = config.accentBarColor;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 12);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
      ctx.restore();

      textStartY = 230;
    }

    // 6. Draw Play Button Emblem Overlay (Optional YouTube Watermark)
    if (showPlayOverlay) {
      ctx.save();
      const playX = width - 130;
      const playY = 110;
      const playRadius = 54;

      // Circle Background with glowing shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)'; // YouTube Red
      ctx.beginPath();
      ctx.arc(playX, playY, playRadius, 0, Math.PI * 2);
      ctx.fill();

      // Play Triangle
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(playX - 16, playY - 24);
      ctx.lineTo(playX + 28, playY);
      ctx.lineTo(playX - 16, playY + 24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 7. Draw Headline Text with High-Contrast Multi-Line Stroke
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `800 ${config.headlineSize}px ${config.fontFamily}, sans-serif`;

    const maxWidth = width - 180;
    const words = config.headline.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = config.headlineSize * 1.25;
    lines.forEach((line, index) => {
      const lineY = textStartY + index * lineHeight;

      ctx.shadowColor = config.shadowColor;
      ctx.shadowBlur = config.shadowBlur;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 6;

      if (config.strokeWidth > 0) {
        ctx.strokeStyle = config.strokeColor;
        ctx.lineWidth = config.strokeWidth;
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 2;
        ctx.strokeText(line, 64, lineY);
      }

      ctx.fillStyle = config.headlineColor;
      ctx.fillText(line, 64, lineY);
    });
    ctx.restore();

    // 8. Draw Subhead Text
    if (config.subhead.trim()) {
      ctx.save();
      const subheadY = textStartY + lines.length * lineHeight + 24;
      ctx.font = `600 30px ${config.fontFamily}, sans-serif`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(config.subhead, 64, subheadY);
      ctx.restore();
    }

    // 9. Standard 1280x720 HD Label
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('1280x720 HD', width - 40, height - 36);
    ctx.restore();
  };

  useEffect(() => {
    renderCanvas();
  }, [config, bgImageElement, showPlayOverlay]);

  // AI Thumbnail Background & Layout Generator
  const handleGenerateAiThumbnail = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiSuccessMessage(null);
    setAiErrorMessage(null);

    try {
      const res = await safeFetchJson<{
        success: boolean;
        data?: {
          headline: string;
          subhead: string;
          badge: string;
          customBgColor1: string;
          customBgColor2: string;
          headlineColor: string;
          strokeColor: string;
          accentBarColor: string;
          bgImageDataUrl?: string | null;
        };
        error?: string;
      }>('/api/generate-thumbnail-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiPrompt.trim(),
          style: 'high-ctr-bold',
          badge: config.badge || 'NEW',
        }),
      });

      if (!res.ok || !res.data?.success || !res.data?.data) {
        throw new Error(res.error || res.data?.error || 'AI thumbnail generation failed.');
      }

      const generated = res.data.data;
      setConfig((prev) => ({
        ...prev,
        headline: generated.headline || prev.headline,
        subhead: generated.subhead || prev.subhead,
        badge: generated.badge || prev.badge,
        customBgColor1: generated.customBgColor1 || prev.customBgColor1,
        customBgColor2: generated.customBgColor2 || prev.customBgColor2,
        headlineColor: generated.headlineColor || prev.headlineColor,
        strokeColor: generated.strokeColor || prev.strokeColor,
        accentBarColor: generated.accentBarColor || prev.accentBarColor,
      }));

      if (generated.bgImageDataUrl) {
        const img = new Image();
        img.onload = () => {
          setBgImageElement(img);
          renderCanvas();
        };
        img.src = generated.bgImageDataUrl;
      }

      setAiSuccessMessage('AI thumbnail concept applied live!');
      setTimeout(() => setAiSuccessMessage(null), 3000);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to generate thumbnail.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        setBgImageElement(img);
        renderCanvas();
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const handleDownloadThumbnail = (format: 'png' | 'jpeg') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `scriby_thumbnail_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  const applyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setConfig((prev) => ({
      ...prev,
      headline: preset.headline,
      subhead: preset.subhead,
      badge: preset.badge,
      customBgColor1: preset.bg1,
      customBgColor2: preset.bg2,
      headlineColor: preset.textColor,
      strokeColor: preset.strokeColor,
      accentBarColor: preset.badgeColor,
    }));
  };

  const applyPalette = (palette: typeof QUICK_PALETTES[0]) => {
    setConfig((prev) => ({
      ...prev,
      customBgColor1: palette.bg1,
      customBgColor2: palette.bg2,
      headlineColor: palette.text,
      accentBarColor: palette.accent,
    }));
  };

  const handleResetToDefault = () => {
    setConfig({
      headline: initialTitle || 'Turn Any Audio into Subtitles in 1 Click',
      subhead: 'High-Converting YouTube Thumbnails with Clean Bold Typography',
      badge: 'NEW UPDATE',
      showBadge: true,
      fontFamily: 'Inter, system-ui, sans-serif',
      headlineSize: 68,
      headlineColor: '#FACC15',
      strokeColor: '#000000',
      strokeWidth: 8,
      shadowColor: 'rgba(0, 0, 0, 0.85)',
      shadowBlur: 16,
      backgroundTheme: 'emerald',
      customBgColor1: '#0A0F1D',
      customBgColor2: '#042F2E',
      bgImageOpacity: 0.65,
      bgImageBlur: 0,
      overlayVignette: true,
      accentBarColor: '#1ed760',
      showAccentBar: true,
    });
    setBgImageElement(null);
    setShowPlayOverlay(true);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#282828]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-white tracking-tight font-display">
              YouTube Thumbnail Studio
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1ed760]/20 text-[#1ed760] border border-[#1ed760]/30 uppercase tracking-wider">
              16:9 Canvas
            </span>
          </div>
          <p className="text-xs text-[#b3b3b3] mt-0.5">
            Real-time live visual editor with side-by-side instant feedback and AI styling
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => handleDownloadThumbnail('png')}
            size="sm"
            className="bg-[#1ed760] hover:bg-[#1fdf64] text-black font-extrabold shadow-[0_4px_12px_rgba(30,215,96,0.25)] gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadSuccess ? 'Downloaded!' : 'Download HD PNG'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadThumbnail('jpeg')}
            className="border-[#3e3e3e] text-white hover:bg-[#282828] text-xs cursor-pointer"
          >
            JPEG
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
            className="text-xs text-[#878787] hover:text-white p-2"
            title="Reset to default settings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN 2-COLUMN STUDIO LAYOUT: STICKY CANVAS ON LEFT, CONTROLS ON RIGHT       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: STICKY LIVE CANVAS PREVIEW (ALWAYS VISIBLE WHILE EDITING)   */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 xl:col-span-7 lg:sticky lg:top-20 z-20 space-y-4">
          <Card className="p-4 bg-[#181818] border-[#282828] shadow-2xl rounded-2xl space-y-3">
            {/* Canvas Stage Header */}
            <div className="flex items-center justify-between text-xs text-[#b3b3b3] pb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1ed760] animate-pulse" />
                <span className="font-bold text-white font-mono text-[11px] tracking-wide">
                  LIVE CANVAS PREVIEW
                </span>
                <span className="text-[#535353]">·</span>
                <span className="text-[#878787] text-[11px]">Updates instantly on edit</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#1ed760] bg-[#1ed760]/10 px-2 py-0.5 rounded-md border border-[#1ed760]/20">
                <Maximize2 className="w-3 h-3" />
                <span>1280 × 720 HD (16:9)</span>
              </div>
            </div>

            {/* Canvas Stage */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#333333] shadow-[0_12px_36px_rgba(0,0,0,0.85)] bg-black group select-none">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain block"
              />

              {/* Subtle hover guide overlay */}
              <div className="absolute top-2 left-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-2 py-1 bg-black/75 backdrop-blur-md rounded text-[10px] text-[#b3b3b3] border border-white/10 font-mono">
                  YouTube Standard Thumbnail
                </span>
              </div>
            </div>

            {/* Quick Color Palette Swatches (1-Click Application) */}
            <div className="pt-2 border-t border-[#242424] flex items-center justify-between gap-2 overflow-x-auto">
              <span className="text-[11px] font-semibold text-[#878787] shrink-0">
                Quick Themes:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {QUICK_PALETTES.map((pal, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPalette(pal)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#2e2e2e] bg-[#121212] hover:border-[#1ed760] transition-all cursor-pointer shrink-0"
                    title={`Apply ${pal.name} theme`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/40 shadow-sm shrink-0"
                      style={{ background: `linear-gradient(135deg, ${pal.bg1}, ${pal.bg2})` }}
                    />
                    <span className="text-[11px] font-medium text-white">{pal.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Quick Style Presets Bar (Directly Under Canvas) */}
          <Card className="p-4 bg-[#181818] border-[#282828] rounded-2xl space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Layers className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Instant Style Presets</span>
              </div>
              <span className="text-[10px] text-[#878787]">Click any preset to apply live</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_TEMPLATES.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="p-2.5 text-left rounded-xl bg-[#121212] border border-[#282828] hover:border-[#1ed760] hover:bg-[#1a1a1a] transition-all group cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-white group-hover:text-[#1ed760] truncate">
                    {preset.name}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/30"
                      style={{ backgroundColor: preset.badgeColor }}
                    />
                    <span className="text-[10px] text-[#878787] truncate">
                      {preset.badge}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: SCROLLABLE ACCORDION / TABBED EDITING SUITE                */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4">
          {/* Segmented Control Bar for Editing Sections */}
          <div className="flex items-center p-1 bg-[#181818] rounded-xl border border-[#282828] grid grid-cols-4 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setEditorTab('text')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all cursor-pointer ${
                editorTab === 'text'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5 text-[#1ed760]" />
              <span className="truncate">Text</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('ai')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all cursor-pointer ${
                editorTab === 'ai'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="truncate">AI Style</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('style')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all cursor-pointer ${
                editorTab === 'style'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              <span className="truncate">Theme</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('badge')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all cursor-pointer ${
                editorTab === 'badge'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span className="truncate">Overlays</span>
            </button>
          </div>

          {/* =================================================================== */}
          {/* TAB 1: TEXT & TYPOGRAPHY CUSTOMIZER                                 */}
          {/* =================================================================== */}
          {editorTab === 'text' && (
            <Card className="p-5 bg-[#181818] border-[#282828] space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Type className="w-4 h-4 text-[#1ed760]" />
                  <span>Headline & Text Elements</span>
                </div>
                <span className="text-[11px] text-[#1ed760]">Updates live</span>
              </div>

              {/* Main Headline */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">
                    Primary Headline
                  </label>
                  <span className="text-[10px] text-[#878787]">
                    Supports English & Bengali (বাংলা)
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={config.headline}
                  onChange={(e) => setConfig({ ...config, headline: e.target.value })}
                  className="w-full bg-[#121212] border border-[#282828] focus:border-[#1ed760] focus:ring-1 focus:ring-[#1ed760] rounded-xl p-3 text-xs text-white focus:outline-none transition-all leading-relaxed"
                  placeholder="Enter high-CTR thumbnail headline..."
                />
              </div>

              {/* Secondary Subheadline */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white">
                  Secondary Hook / Subheadline
                </label>
                <Input
                  type="text"
                  value={config.subhead}
                  onChange={(e) => setConfig({ ...config, subhead: e.target.value })}
                  className="bg-[#121212] border-[#282828] text-xs focus:border-[#1ed760]"
                  placeholder="Supporting topic or teaser..."
                />
              </div>

              {/* Font Size & Stroke Sliders */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#b3b3b3]">Headline Size</span>
                    <span className="font-mono text-[#1ed760] font-bold">{config.headlineSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="110"
                    value={config.headlineSize}
                    onChange={(e) => setConfig({ ...config, headlineSize: parseInt(e.target.value, 10) })}
                    className="w-full accent-[#1ed760] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#535353] font-mono">
                    <span>40px</span>
                    <span>110px</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#b3b3b3]">Outline Stroke</span>
                    <span className="font-mono text-[#1ed760] font-bold">{config.strokeWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="18"
                    value={config.strokeWidth}
                    onChange={(e) => setConfig({ ...config, strokeWidth: parseInt(e.target.value, 10) })}
                    className="w-full accent-[#1ed760] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#535353] font-mono">
                    <span>None</span>
                    <span>18px</span>
                  </div>
                </div>
              </div>

              {/* Text & Stroke Colors */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#242424]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Text Fill Color</label>
                  <div className="flex items-center gap-2 bg-[#121212] border border-[#282828] p-2 rounded-xl">
                    <input
                      type="color"
                      value={config.headlineColor}
                      onChange={(e) => setConfig({ ...config, headlineColor: e.target.value })}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-white font-semibold">
                      {config.headlineColor.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Outline Color</label>
                  <div className="flex items-center gap-2 bg-[#121212] border border-[#282828] p-2 rounded-xl">
                    <input
                      type="color"
                      value={config.strokeColor}
                      onChange={(e) => setConfig({ ...config, strokeColor: e.target.value })}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-white font-semibold">
                      {config.strokeColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* =================================================================== */}
          {/* TAB 2: AI THUMBNAIL GENERATOR & VISUAL PROMPTING                     */}
          {/* =================================================================== */}
          {editorTab === 'ai' && (
            <Card className="p-5 bg-[#181818] border-[#282828] space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>AI Concept & Palette Generator</span>
                </div>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                  Gemini Powered
                </span>
              </div>

              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Enter your video topic or title. AI will generate an optimized high-CTR visual headline, color harmony, and background concept directly on the canvas.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white">Video Title or Topic</label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Master Bengali Audio Transcription with AI in 5 minutes..."
                  className="w-full bg-[#121212] border border-[#282828] focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded-xl p-3 text-xs text-white focus:outline-none transition-all leading-relaxed"
                />
              </div>

              <Button
                onClick={handleGenerateAiThumbnail}
                disabled={isGeneratingAi || !aiPrompt.trim()}
                className="w-full h-10 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Designing High-CTR Concept...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Generate AI Thumbnail Concept</span>
                  </>
                )}
              </Button>

              {aiSuccessMessage && (
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{aiSuccessMessage}</span>
                </div>
              )}

              {aiErrorMessage && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                  {aiErrorMessage}
                </div>
              )}
            </Card>
          )}

          {/* =================================================================== */}
          {/* TAB 3: THEME, GRADIENTS & BACKGROUND IMAGES                          */}
          {/* =================================================================== */}
          {editorTab === 'style' && (
            <Card className="p-5 bg-[#181818] border-[#282828] space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Palette className="w-4 h-4 text-purple-400" />
                  <span>Theme & Background Colors</span>
                </div>
                <span className="text-[11px] text-[#1ed760]">Live rendering</span>
              </div>

              {/* Gradient Color Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Gradient Start</label>
                  <div className="flex items-center gap-2 bg-[#121212] border border-[#282828] p-2 rounded-xl">
                    <input
                      type="color"
                      value={config.customBgColor1}
                      onChange={(e) => setConfig({ ...config, customBgColor1: e.target.value })}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-white font-semibold">
                      {config.customBgColor1.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#b3b3b3]">Gradient End</label>
                  <div className="flex items-center gap-2 bg-[#121212] border border-[#282828] p-2 rounded-xl">
                    <input
                      type="color"
                      value={config.customBgColor2}
                      onChange={(e) => setConfig({ ...config, customBgColor2: e.target.value })}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-white font-semibold">
                      {config.customBgColor2.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Image Upload & Controls */}
              <div className="space-y-3 pt-2 border-t border-[#242424]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">
                    Background Photo Layer
                  </label>
                  {bgImageElement && (
                    <button
                      type="button"
                      onClick={() => setBgImageElement(null)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Image</span>
                    </button>
                  )}
                </div>

                <label className="flex items-center justify-center gap-2 p-3 bg-[#121212] hover:bg-[#1a1a1a] border border-dashed border-[#3e3e3e] hover:border-[#1ed760] rounded-xl text-xs text-white font-bold cursor-pointer transition-all">
                  <Upload className="w-4 h-4 text-[#1ed760]" />
                  <span>{bgImageElement ? 'Change Photo Image' : 'Upload Custom Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                {bgImageElement && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-[#b3b3b3]">
                        <span>Opacity</span>
                        <span className="font-mono text-[#1ed760]">
                          {Math.round(config.bgImageOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={config.bgImageOpacity}
                        onChange={(e) => setConfig({ ...config, bgImageOpacity: parseFloat(e.target.value) })}
                        className="w-full accent-[#1ed760] cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-[#b3b3b3]">
                        <span>Blur</span>
                        <span className="font-mono text-[#1ed760]">{config.bgImageBlur}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        value={config.bgImageBlur}
                        onChange={(e) => setConfig({ ...config, bgImageBlur: parseInt(e.target.value, 10) })}
                        className="w-full accent-[#1ed760] cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Contrast Vignette Scrim Toggle */}
              <div className="pt-2 border-t border-[#242424]">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#121212] border border-[#282828] text-xs text-white cursor-pointer hover:border-[#3e3e3e] transition-colors">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#1ed760]" />
                    <span>Contrast Dark Vignette Scrim</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.overlayVignette}
                    onChange={(e) => setConfig({ ...config, overlayVignette: e.target.checked })}
                    className="w-4 h-4 rounded accent-[#1ed760] cursor-pointer"
                  />
                </label>
              </div>
            </Card>
          )}

          {/* =================================================================== */}
          {/* TAB 4: BADGES, ACCENT BARS & WATERMARKS                             */}
          {/* =================================================================== */}
          {editorTab === 'badge' && (
            <Card className="p-5 bg-[#181818] border-[#282828] space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Badges & Overlay Accents</span>
                </div>
                <span className="text-[11px] text-[#1ed760]">Live visual</span>
              </div>

              {/* Highlight Badge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">Top Corner Badge</label>
                  <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showBadge}
                      onChange={(e) => setConfig({ ...config, showBadge: e.target.checked })}
                      className="w-4 h-4 rounded accent-[#1ed760]"
                    />
                    <span>Show Badge</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={config.badge}
                    onChange={(e) => setConfig({ ...config, badge: e.target.value })}
                    className="text-xs flex-1 bg-[#121212] border-[#282828]"
                    placeholder="e.g. NEW, 4K ULTRA, URGENT, 100% FREE..."
                  />
                  <div className="flex items-center gap-1 bg-[#121212] border border-[#282828] p-1.5 rounded-xl">
                    <input
                      type="color"
                      value={config.accentBarColor}
                      onChange={(e) => setConfig({ ...config, accentBarColor: e.target.value })}
                      className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                      title="Badge and Accent Color"
                    />
                  </div>
                </div>
              </div>

              {/* YouTube Play Watermark & Accent Bar */}
              <div className="space-y-2 pt-2 border-t border-[#242424]">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#121212] border border-[#282828] text-xs text-white cursor-pointer hover:border-[#3e3e3e] transition-colors">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-red-500 fill-current" />
                    <span>YouTube Play Button Emblem Overlay</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showPlayOverlay}
                    onChange={(e) => setShowPlayOverlay(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#1ed760] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#121212] border border-[#282828] text-xs text-white cursor-pointer hover:border-[#3e3e3e] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-[#1ed760]" />
                    <span>Left Edge Contrast Accent Stripe</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.showAccentBar}
                    onChange={(e) => setConfig({ ...config, showAccentBar: e.target.checked })}
                    className="w-4 h-4 rounded accent-[#1ed760] cursor-pointer"
                  />
                </label>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
