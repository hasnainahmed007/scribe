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
} from 'lucide-react';
import { ThumbnailConfig } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

interface ThumbnailCanvasStudioProps {
  initialTitle?: string;
}

const PRESET_TEMPLATES = [
  {
    name: 'Breaking News Style',
    headline: 'সব তথ্য ফাঁস! কীভাবে তৈরি করবেন?',
    subhead: '২০২৬ সালের সেরা আপডেট ও গোপন ট্রিকস',
    badge: 'URGENT',
    badgeColor: '#EF4444',
    bg1: '#0F172A',
    bg2: '#7F1D1D',
    textColor: '#FACC15',
    strokeColor: '#000000',
  },
  {
    name: 'Tech Review Studio',
    headline: 'সেরা ৫টি AI টুলস যা সবার প্রয়োজন',
    subhead: 'কন্টেন্ট ক্রিয়েটরদের জন্য আলটিমেট গাইড',
    badge: '4K ULTRA',
    badgeColor: '#1ed760',
    bg1: '#090D16',
    bg2: '#064E3B',
    textColor: '#FFFFFF',
    strokeColor: '#022C22',
  },
  {
    name: 'Podcast & Storytelling',
    headline: 'সফলতার আসল রহস্য কী ছিল?',
    subhead: 'তাহসিন ও রাফিনের বিশেষ আলোচনা পর্ব',
    badge: 'NEW EPISODE',
    badgeColor: '#8B5CF6',
    bg1: '#1E1B4B',
    bg2: '#31104B',
    textColor: '#E0E7FF',
    strokeColor: '#0F172A',
  },
  {
    name: 'Tutorial & Masterclass',
    headline: '১ ক্লিকে স্বয়ংক্রিয় সাবটাইটেল বানান',
    subhead: 'মোবাইল ও কম্পিউটারে সম্পূর্ণ বিনামূল্যে',
    badge: '১০০% ফ্রি',
    badgeColor: '#F59E0B',
    bg1: '#18181B',
    bg2: '#451A03',
    textColor: '#FDE047',
    strokeColor: '#000000',
  },
];

export const ThumbnailCanvasStudio: React.FC<ThumbnailCanvasStudioProps> = ({
  initialTitle = 'বাংলা অডিও থেকে ১ ক্লিকে সাবটাইটেল',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [config, setConfig] = useState<ThumbnailConfig>({
    headline: initialTitle,
    subhead: 'High-Converting YouTube Thumbnails with Native Bengali Typography',
    badge: 'NEW UPDATE',
    showBadge: true,
    fontFamily: 'Noto Sans Bengali',
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
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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

  // AI Thumbnail Generator Handler
  const handleGenerateAiThumbnail = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiSuccessMessage(null);
    setAiErrorMessage(null);

    try {
      const res = await safeFetchJson<{
        success: boolean;
        data: {
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

      // If AI generated an image background, load it onto the canvas
      if (generated.bgImageDataUrl) {
        const img = new Image();
        img.onload = () => {
          setBgImageElement(img);
          renderCanvas();
        };
        img.src = generated.bgImageDataUrl;
      }

      setAiSuccessMessage('AI thumbnail concept & visual palette applied!');
      setTimeout(() => setAiSuccessMessage(null), 3000);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to generate thumbnail.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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
    a.download = `banglascribe_thumbnail_${Date.now()}.${format}`;
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

  return (
    <div className="space-y-6">
      {/* Top AI Generation Toolbar */}
      <div className="bg-[#181818] border border-[#282828] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1ed760]" />
              <span>AI YouTube Thumbnail Generator & Visual Designer</span>
            </h3>
            <p className="text-xs text-[#b3b3b3]">
              Generate high-CTR Bengali thumbnail concepts with AI, then customize every detail.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleDownloadThumbnail('png')}
              size="sm"
              className="bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold shadow-[0_2px_8px_rgba(30,215,96,0.25)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadSuccess ? 'Downloaded!' : 'Download PNG (1280x720 HD)'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadThumbnail('jpeg')}
            >
              JPEG
            </Button>
          </div>
        </div>

        {/* AI Prompt Input Bar */}
        <div className="pt-3 border-t border-[#282828] flex flex-col sm:flex-row items-center gap-3">
          <Input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Video title or topic to design thumbnail for..."
            className="text-xs flex-1"
          />
          <Button
            onClick={handleGenerateAiThumbnail}
            disabled={isGeneratingAi || !aiPrompt.trim()}
            size="default"
            className="flex items-center gap-2 whitespace-nowrap"
          >
            {isGeneratingAi ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Designing Thumbnail...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>AI Generate Thumbnail</span>
              </>
            )}
          </Button>
        </div>

        {aiSuccessMessage && (
          <div className="text-xs text-[#1ed760] font-semibold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{aiSuccessMessage}</span>
          </div>
        )}

        {aiErrorMessage && (
          <div className="text-xs text-rose-400 font-semibold">
            {aiErrorMessage}
          </div>
        )}
      </div>

      {/* 16:9 Live Canvas Preview Stage */}
      <div className="bg-[#181818] border border-[#282828] rounded-2xl p-6 shadow-xl">
        <div className="relative aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-[#282828] shadow-[0_8px_32px_rgba(0,0,0,0.7)] bg-black">
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Curated Presets Bar */}
      <div className="bg-[#181818] border border-[#282828] rounded-2xl p-5 shadow-lg">
        <div className="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#1ed760]" />
          <span>Quick Thumbnail Style Presets:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_TEMPLATES.map((preset, i) => (
            <button
              key={i}
              onClick={() => applyPreset(preset)}
              className="p-3 text-left rounded-xl bg-[#141414] border border-[#282828] hover:border-[#1ed760] transition-all group cursor-pointer"
            >
              <div className="text-xs font-bold text-white group-hover:text-[#1ed760] mb-1">
                {preset.name}
              </div>
              <p className="text-[11px] text-[#b3b3b3] line-clamp-1">
                {preset.headline}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Editing Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Text & Typography Customizer */}
        <Card className="p-6 bg-[#181818] border-[#282828] space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#282828] text-sm font-bold text-white">
            <Type className="w-4 h-4 text-[#1ed760]" />
            <span>Headline & Text Customizer</span>
          </div>

          <div>
            <label className="text-xs text-[#b3b3b3] block mb-1 font-semibold">
              Main Headline (Bengali / English):
            </label>
            <textarea
              rows={2}
              value={config.headline}
              onChange={(e) => setConfig({ ...config, headline: e.target.value })}
              className="w-full bg-[#141414] border border-[#282828] focus:border-white rounded-xl p-3 text-xs text-white focus:outline-none"
              placeholder="Enter thumbnail headline..."
            />
          </div>

          <div>
            <label className="text-xs text-[#b3b3b3] block mb-1 font-semibold">
              Subheadline / Secondary Hook:
            </label>
            <Input
              type="text"
              value={config.subhead}
              onChange={(e) => setConfig({ ...config, subhead: e.target.value })}
              className="text-xs"
              placeholder="Enter subheadline..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#b3b3b3] block mb-1">
                Font Size ({config.headlineSize}px):
              </label>
              <input
                type="range"
                min="44"
                max="105"
                value={config.headlineSize}
                onChange={(e) => setConfig({ ...config, headlineSize: parseInt(e.target.value, 10) })}
                className="w-full accent-[#1ed760] cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs text-[#b3b3b3] block mb-1">
                Outline Thickness ({config.strokeWidth}px):
              </label>
              <input
                type="range"
                min="0"
                max="16"
                value={config.strokeWidth}
                onChange={(e) => setConfig({ ...config, strokeWidth: parseInt(e.target.value, 10) })}
                className="w-full accent-[#1ed760] cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs text-[#b3b3b3] block mb-1">Text Color:</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.headlineColor}
                  onChange={(e) => setConfig({ ...config, headlineColor: e.target.value })}
                  className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-white">{config.headlineColor}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#b3b3b3] block mb-1">Outline Color:</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.strokeColor}
                  onChange={(e) => setConfig({ ...config, strokeColor: e.target.value })}
                  className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-white">{config.strokeColor}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Background, Badges & Overlays Customizer */}
        <Card className="p-6 bg-[#181818] border-[#282828] space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#282828] text-sm font-bold text-white">
            <Palette className="w-4 h-4 text-[#1ed760]" />
            <span>Badges, Overlays & Backgrounds</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[#b3b3b3] font-semibold">Highlight Badge:</label>
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
                className="text-xs flex-1"
                placeholder="e.g. নতুন, URGENT, 4K..."
              />
              <input
                type="color"
                value={config.accentBarColor}
                onChange={(e) => setConfig({ ...config, accentBarColor: e.target.value })}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                title="Badge & Accent Color"
              />
            </div>
          </div>

          {/* Gradients */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#b3b3b3] block mb-1">Gradient Start:</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.customBgColor1}
                  onChange={(e) => setConfig({ ...config, customBgColor1: e.target.value })}
                  className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-white">{config.customBgColor1}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#b3b3b3] block mb-1">Gradient End:</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.customBgColor2}
                  onChange={(e) => setConfig({ ...config, customBgColor2: e.target.value })}
                  className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-white">{config.customBgColor2}</span>
              </div>
            </div>
          </div>

          {/* Overlays */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#141414] border border-[#282828] text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={showPlayOverlay}
                onChange={(e) => setShowPlayOverlay(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1ed760]"
              />
              <span>YouTube Play Button</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#141414] border border-[#282828] text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={config.overlayVignette}
                onChange={(e) => setConfig({ ...config, overlayVignette: e.target.checked })}
                className="w-4 h-4 rounded accent-[#1ed760]"
              />
              <span>Contrast Vignette</span>
            </label>
          </div>

          {/* Background Image Upload / Removal */}
          <div className="pt-2 border-t border-[#282828]">
            <label className="text-xs text-[#b3b3b3] block mb-1.5 font-semibold">
              Background Photo (Upload or AI Generated):
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 px-4 py-2 bg-[#141414] hover:bg-[#282828] text-white text-xs font-bold rounded-full border border-[#282828] cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Upload Custom Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {bgImageElement && (
                <button
                  onClick={() => setBgImageElement(null)}
                  className="text-xs text-rose-400 hover:underline cursor-pointer"
                >
                  Remove Image
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
