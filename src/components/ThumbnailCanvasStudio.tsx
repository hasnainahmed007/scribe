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
  Lock,
  Unlock,
  Settings2,
  X,
  Ratio,
  Monitor,
  Smartphone,
  Square,
  FileImage,
} from 'lucide-react';
import { ThumbnailConfig } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { AiQuotaNotice } from './AiQuotaNotice';

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

const AI_STYLES = [
  {
    id: 'cinematic',
    name: 'Cinematic Studio',
    desc: 'Volumetric studio rim lights, dramatic atmosphere',
    icon: '🎬',
    colors: ['#080C14', '#F59E0B'],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    desc: 'Deep violet with electric cyan & hot magenta glow',
    icon: '⚡',
    colors: ['#0B031E', '#06B6D4'],
  },
  {
    id: '3d-render',
    name: '3D Isometric Tech',
    desc: 'Glossy floating glass orbs & high-tech octane render',
    icon: '🎨',
    colors: ['#0A0F1D', '#6366F1'],
  },
  {
    id: 'minimalist',
    name: 'Minimalist Dark',
    desc: 'Obsidian charcoal with subtle green audio wave contours',
    icon: '🌌',
    colors: ['#090D16', '#1ed760'],
  },
  {
    id: 'viral',
    name: 'High-Energy Viral',
    desc: 'Explosive red-gold starburst rays & particle burst',
    icon: '💥',
    colors: ['#180404', '#FACC15'],
  },
  {
    id: 'photorealistic',
    name: 'Clean Photography',
    desc: 'Soft studio bokeh, premium lighting, crisp HDR',
    icon: '📸',
    colors: ['#111827', '#E2E8F0'],
  },
];

const DIMENSION_PRESETS = [
  { id: '1280x720', name: 'YouTube Standard (HD)', width: 1280, height: 720, ratio: '16:9', icon: Monitor },
  { id: '1920x1080', name: 'YouTube Full HD (1080p)', width: 1920, height: 1080, ratio: '16:9', icon: Monitor },
  { id: '3840x2160', name: 'YouTube 4K Ultra HD', width: 3840, height: 2160, ratio: '16:9', icon: Monitor },
  { id: '1080x1920', name: 'Shorts / Reels / TikTok', width: 1080, height: 1920, ratio: '9:16', icon: Smartphone },
  { id: '1080x1080', name: 'Instagram / Square Post', width: 1080, height: 1080, ratio: '1:1', icon: Square },
  { id: '1200x630', name: 'Twitter / Facebook Card', width: 1200, height: 630, ratio: '1.91:1', icon: Ratio },
];

interface GeneratedImageItem {
  id: string;
  url: string;
  prompt: string;
  style: string;
  timestamp: string;
}

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
    bgImageOpacity: 0.75,
    bgImageBlur: 0,
    overlayVignette: true,
    accentBarColor: '#1ed760',
    showAccentBar: true,
  });

  const [bgImageElement, setBgImageElement] = useState<HTMLImageElement | null>(null);
  const [activeBgImageUrl, setActiveBgImageUrl] = useState<string | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Active Editor Section Tab: 'text' | 'ai' | 'style' | 'badge'
  const [editorTab, setEditorTab] = useState<'text' | 'ai' | 'style' | 'badge'>('ai');

  // AI Generation State
  const [aiPrompt, setAiPrompt] = useState<string>(initialTitle);
  const [selectedAiStyle, setSelectedAiStyle] = useState<string>('cinematic');
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState<boolean>(false);
  const [isGeneratingAiConcept, setIsGeneratingAiConcept] = useState<boolean>(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [isAiQuotaError, setIsAiQuotaError] = useState<boolean>(false);
  const [recentAiImages, setRecentAiImages] = useState<GeneratedImageItem[]>([]);

  // Export Suite Modal & Custom Dimension State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportTarget, setExportTarget] = useState<'full' | 'background_only'>('full');
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [exportWidth, setExportWidth] = useState<number>(1280);
  const [exportHeight, setExportHeight] = useState<number>(720);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [aspectRatioValue, setAspectRatioValue] = useState<number>(1280 / 720);
  const [exportQuality, setExportQuality] = useState<number>(0.95);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    if (initialTitle) {
      setConfig((prev) => ({ ...prev, headline: initialTitle }));
      setAiPrompt(initialTitle);
    }
  }, [initialTitle]);

  // Master Canvas Renderer (Live 1280x720 Base Preview)
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

    // 2. Draw Background Image (Custom Upload or AI Generated) with aspect cover
    if (bgImageElement) {
      ctx.save();
      ctx.globalAlpha = config.bgImageOpacity;
      if (config.bgImageBlur > 0) {
        ctx.filter = `blur(${config.bgImageBlur}px)`;
      }

      const imgW = bgImageElement.naturalWidth || bgImageElement.width || width;
      const imgH = bgImageElement.naturalHeight || bgImageElement.height || height;
      const imgRatio = imgW / imgH;
      const targetRatio = width / height;

      let drawW = width;
      let drawH = height;
      let drawX = 0;
      let drawY = 0;

      if (imgRatio > targetRatio) {
        drawW = height * imgRatio;
        drawX = (width - drawW) / 2;
      } else {
        drawH = width / imgRatio;
        drawY = (height - drawH) / 2;
      }

      ctx.drawImage(bgImageElement, drawX, drawY, drawW, drawH);
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

    // 9. HD Watermark
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

  // Apply Image to Live Preview Canvas
  const applyImageToCanvas = (imageUrl: string, promptUsed: string = aiPrompt, styleUsed: string = selectedAiStyle) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBgImageElement(img);
      setActiveBgImageUrl(imageUrl);
      renderCanvas();

      // Add to session history gallery (keep unique by url)
      setRecentAiImages((prev) => {
        const filtered = prev.filter((item) => item.url !== imageUrl);
        return [
          {
            id: `img_${Date.now()}`,
            url: imageUrl,
            prompt: promptUsed,
            style: styleUsed,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...filtered,
        ].slice(0, 8);
      });
    };
    img.src = imageUrl;
  };

  // 1. Generate Pure AI Image based on Title or Topic
  const handleGenerateAiImageOnly = async (styleOverride?: string) => {
    const promptToUse = aiPrompt.trim() || config.headline.trim();
    if (!promptToUse) return;

    const styleToUse = styleOverride || selectedAiStyle;
    setIsGeneratingAiImage(true);
    setAiSuccessMessage(null);
    setAiErrorMessage(null);
    setIsAiQuotaError(false);

    try {
      const res = await safeFetchJson<{
        success: boolean;
        imageUrl?: string;
        source?: string;
        error?: string;
      }>('/api/generate-ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          style: styleToUse,
          aspectRatio: '16:9',
        }),
      });

      if (res.isQuotaExceeded || res.status === 429) {
        setIsAiQuotaError(true);
      }

      if (!res.ok || !res.data?.success || !res.data?.imageUrl) {
        if (res.isQuotaExceeded) setIsAiQuotaError(true);
        throw new Error(res.error || res.data?.error || 'AI image generation failed.');
      }

      applyImageToCanvas(res.data.imageUrl, promptToUse, styleToUse);
      setAiSuccessMessage('AI image generated and applied to live preview!');
      setTimeout(() => setAiSuccessMessage(null), 3500);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to generate AI image.');
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // 2. Generate Full AI Concept (Headline + Subhead + Palette + Background Image)
  const handleGenerateAiConcept = async () => {
    const titleToUse = aiPrompt.trim() || config.headline.trim();
    if (!titleToUse) return;

    setIsGeneratingAiConcept(true);
    setAiSuccessMessage(null);
    setAiErrorMessage(null);
    setIsAiQuotaError(false);

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
          title: titleToUse,
          style: selectedAiStyle,
          badge: config.badge || 'NEW',
          generateImage: true,
          aspectRatio: '16:9',
        }),
      });

      if (res.isQuotaExceeded || res.status === 429) {
        setIsAiQuotaError(true);
      }

      if (!res.ok || !res.data?.success || !res.data?.data) {
        if (res.isQuotaExceeded) setIsAiQuotaError(true);
        throw new Error(res.error || res.data?.error || 'AI thumbnail concept generation failed.');
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
        applyImageToCanvas(generated.bgImageDataUrl, titleToUse, selectedAiStyle);
      }

      setAiSuccessMessage('AI concept & background image applied live!');
      setTimeout(() => setAiSuccessMessage(null), 3500);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to generate thumbnail concept.');
    } finally {
      setIsGeneratingAiConcept(false);
    }
  };

  // Upload Custom Image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        if (dataUrl) {
          applyImageToCanvas(dataUrl, file.name, 'custom-upload');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Render Export at ANY Target Resolution & Format (Lossless Mathematical Scaling)
  const renderExportCanvasAtResolution = (
    targetWidth: number,
    targetHeight: number,
    mode: 'full' | 'background_only'
  ): HTMLCanvasElement => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return exportCanvas;

    // 1. Draw Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, targetWidth, targetHeight);
    gradient.addColorStop(0, config.customBgColor1);
    gradient.addColorStop(1, config.customBgColor2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // 2. Draw Background Image with Cover Math
    if (bgImageElement) {
      ctx.save();
      ctx.globalAlpha = config.bgImageOpacity;
      if (config.bgImageBlur > 0) {
        const scaledBlur = config.bgImageBlur * (targetWidth / 1280);
        ctx.filter = `blur(${scaledBlur}px)`;
      }

      const imgW = bgImageElement.naturalWidth || bgImageElement.width || targetWidth;
      const imgH = bgImageElement.naturalHeight || bgImageElement.height || targetHeight;
      const imgRatio = imgW / imgH;
      const targetRatio = targetWidth / targetHeight;

      let drawW = targetWidth;
      let drawH = targetHeight;
      let drawX = 0;
      let drawY = 0;

      if (imgRatio > targetRatio) {
        drawW = targetHeight * imgRatio;
        drawX = (targetWidth - drawW) / 2;
      } else {
        drawH = targetWidth / imgRatio;
        drawY = (targetHeight - drawH) / 2;
      }

      ctx.drawImage(bgImageElement, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // If pure background was requested, exit here
    if (mode === 'background_only') {
      return exportCanvas;
    }

    // Scale overlays & text relative to base 1280x720
    const scale = Math.min(targetWidth / 1280, targetHeight / 720);

    // 3. Contrast Vignette Scrim
    if (config.overlayVignette) {
      const scrim = ctx.createLinearGradient(0, 0, targetWidth, targetHeight);
      scrim.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      scrim.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
      scrim.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    // 4. Accent Bar
    if (config.showAccentBar) {
      ctx.fillStyle = config.accentBarColor;
      ctx.fillRect(0, 0, Math.max(8, 16 * scale), targetHeight);
    }

    // 5. Badge Overlay
    let textStartY = 270 * scale;
    if (config.showBadge && config.badge.trim()) {
      ctx.save();
      const badgeText = config.badge.toUpperCase();
      const badgeFontSize = Math.round(28 * scale);
      ctx.font = `bold ${badgeFontSize}px ${config.fontFamily}, sans-serif`;
      const textMetrics = ctx.measureText(badgeText);
      const badgeWidth = textMetrics.width + 48 * scale;
      const badgeHeight = 52 * scale;
      const badgeX = 64 * scale;
      const badgeY = 64 * scale;

      ctx.fillStyle = config.accentBarColor;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 12 * scale);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
      ctx.restore();

      textStartY = 230 * scale;
    }

    // 6. Play Button Watermark
    if (showPlayOverlay) {
      ctx.save();
      const playX = targetWidth - 130 * scale;
      const playY = 110 * scale;
      const playRadius = 54 * scale;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 20 * scale;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      ctx.beginPath();
      ctx.arc(playX, playY, playRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(playX - 16 * scale, playY - 24 * scale);
      ctx.lineTo(playX + 28 * scale, playY);
      ctx.lineTo(playX - 16 * scale, playY + 24 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 7. Headline Text
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const scaledHeadlineSize = Math.round(config.headlineSize * scale);
    ctx.font = `800 ${scaledHeadlineSize}px ${config.fontFamily}, sans-serif`;

    const maxWidth = targetWidth - 180 * scale;
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

    const lineHeight = scaledHeadlineSize * 1.25;
    const textLeft = 64 * scale;

    lines.forEach((line, index) => {
      const lineY = textStartY + index * lineHeight;

      ctx.shadowColor = config.shadowColor;
      ctx.shadowBlur = config.shadowBlur * scale;
      ctx.shadowOffsetX = 4 * scale;
      ctx.shadowOffsetY = 6 * scale;

      if (config.strokeWidth > 0) {
        ctx.strokeStyle = config.strokeColor;
        ctx.lineWidth = config.strokeWidth * scale;
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 2;
        ctx.strokeText(line, textLeft, lineY);
      }

      ctx.fillStyle = config.headlineColor;
      ctx.fillText(line, textLeft, lineY);
    });
    ctx.restore();

    // 8. Subhead Text
    if (config.subhead.trim()) {
      ctx.save();
      const subheadY = textStartY + lines.length * lineHeight + 24 * scale;
      const scaledSubheadSize = Math.round(30 * scale);
      ctx.font = `600 ${scaledSubheadSize}px ${config.fontFamily}, sans-serif`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10 * scale;
      ctx.shadowOffsetX = 2 * scale;
      ctx.shadowOffsetY = 3 * scale;
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(config.subhead, textLeft, subheadY);
      ctx.restore();
    }

    return exportCanvas;
  };

  // Perform Download of Current Custom Settings
  const handleExecuteDownload = (
    width: number = exportWidth,
    height: number = exportHeight,
    format: 'png' | 'jpeg' | 'webp' = exportFormat,
    mode: 'full' | 'background_only' = exportTarget
  ) => {
    setIsExporting(true);

    try {
      const canvas = renderExportCanvasAtResolution(width, height, mode);
      const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      const quality = format === 'png' ? 1.0 : exportQuality;
      const dataUrl = canvas.toDataURL(mime, quality);

      const a = document.createElement('a');
      a.href = dataUrl;
      const label = mode === 'background_only' ? 'ai_background' : 'youtube_thumbnail';
      a.download = `scriby_${label}_${width}x${height}_${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Download error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Quick 1-Click Standard HD Download
  const handleQuickDownload = (format: 'png' | 'jpeg' | 'webp' = 'png') => {
    handleExecuteDownload(1280, 720, format, 'full');
  };

  // Handle Preset Dimension Selection
  const applyDimensionPreset = (preset: typeof DIMENSION_PRESETS[0]) => {
    setExportWidth(preset.width);
    setExportHeight(preset.height);
    setAspectRatioValue(preset.width / preset.height);
  };

  // Handle Width change with optional aspect ratio lock
  const handleWidthChange = (val: number) => {
    const safeW = Math.max(100, Math.min(4096, val || 1280));
    setExportWidth(safeW);
    if (lockAspectRatio && aspectRatioValue > 0) {
      setExportHeight(Math.round(safeW / aspectRatioValue));
    }
  };

  // Handle Height change with optional aspect ratio lock
  const handleHeightChange = (val: number) => {
    const safeH = Math.max(100, Math.min(4096, val || 720));
    setExportHeight(safeH);
    if (lockAspectRatio && aspectRatioValue > 0) {
      setExportWidth(Math.round(safeH * aspectRatioValue));
    }
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
      bgImageOpacity: 0.75,
      bgImageBlur: 0,
      overlayVignette: true,
      accentBarColor: '#1ed760',
      showAccentBar: true,
    });
    setBgImageElement(null);
    setActiveBgImageUrl(null);
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
              AI Style & 16:9 Canvas
            </span>
          </div>
          <p className="text-xs text-[#b3b3b3] mt-0.5">
            Real-time live visual editor with AI image generation and multi-format custom dimension downloads
          </p>
        </div>

        {/* Action Buttons & Export Suite Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => setIsExportModalOpen(true)}
            size="sm"
            className="bg-[#1ed760] hover:bg-[#1fdf64] text-black font-extrabold shadow-[0_4px_12px_rgba(30,215,96,0.25)] gap-1.5 cursor-pointer text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export & Custom Sizes</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickDownload('png')}
            className="border-[#3e3e3e] text-white hover:bg-[#282828] text-xs cursor-pointer"
            title="Download standard 1280x720 PNG"
          >
            Quick PNG
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickDownload('jpeg')}
            className="border-[#3e3e3e] text-white hover:bg-[#282828] text-xs cursor-pointer"
            title="Download standard 1280x720 JPG"
          >
            Quick JPG
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
            className="text-xs text-[#878787] hover:text-white p-2 cursor-pointer"
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

              <div className="flex items-center gap-2">
                {bgImageElement && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI Image Active
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1 font-mono text-[11px] text-[#1ed760] bg-[#1ed760]/10 hover:bg-[#1ed760]/20 px-2 py-0.5 rounded-md border border-[#1ed760]/20 cursor-pointer transition-colors"
                  title="Click to customize dimensions and format"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>1280 × 720 HD</span>
                </button>
              </div>
            </div>

            {/* Canvas Stage (16:9 Aspect Video) */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#333333] shadow-[0_12px_36px_rgba(0,0,0,0.85)] bg-black group select-none">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain block"
              />

              {/* Hover guide overlay */}
              <div className="absolute top-2 left-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-2 py-1 bg-black/75 backdrop-blur-md rounded text-[10px] text-[#b3b3b3] border border-white/10 font-mono">
                  16:9 Standard YouTube Canvas
                </span>
              </div>
            </div>

            {/* Active AI Background Layer Quick Controls */}
            {bgImageElement && (
              <div className="p-3 bg-[#121212] border border-[#282828] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-7 rounded border border-[#3e3e3e] overflow-hidden bg-black shrink-0">
                    <img
                      src={activeBgImageUrl || ''}
                      alt="AI Background thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-white text-[11px] block">
                      AI Background Image Layer
                    </span>
                    <span className="text-[10px] text-[#878787]">
                      Opacity: {Math.round(config.bgImageOpacity * 100)}% · Blur: {config.bgImageBlur}px
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleExecuteDownload(1280, 720, 'png', 'background_only')}
                    className="px-2.5 py-1 bg-[#242424] hover:bg-[#303030] border border-[#383838] rounded-lg text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer transition-colors"
                    title="Download pure background image without text"
                  >
                    <Download className="w-3 h-3 text-[#1ed760]" />
                    <span>Download Raw Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBgImageElement(null);
                      setActiveBgImageUrl(null);
                    }}
                    className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                    title="Remove background image layer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

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
        {/* RIGHT COLUMN: SCROLLABLE TABBED EDITING SUITE                            */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4">
          {/* Segmented Control Bar for Editing Sections */}
          <div className="flex items-center p-1 bg-[#181818] rounded-xl border border-[#282828] grid grid-cols-4 gap-1 text-xs font-bold">
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
          {/* TAB 1: AI STYLE & VISUAL ART GENERATOR (KEY PROMPT REQUIREMENT)     */}
          {/* =================================================================== */}
          {editorTab === 'ai' && (
            <Card className="p-5 bg-[#181818] border-[#282828] space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>AI Style Image Generator</span>
                </div>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-500/10 rounded border border-blue-500/20">
                  Live Preview
                </span>
              </div>

              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Generate high-impact YouTube background artwork tailored to your title or topic. The image is instantly applied to the live preview canvas.
              </p>

              {/* Title / Topic Prompt Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">Video Title or Visual Prompt</label>
                  <button
                    type="button"
                    onClick={() => setAiPrompt(config.headline)}
                    className="text-[10px] text-[#1ed760] hover:underline cursor-pointer"
                  >
                    Sync with Headline
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Turn Any Audio into Subtitles in 1 Click..."
                  className="w-full bg-[#121212] border border-[#282828] focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded-xl p-3 text-xs text-white focus:outline-none transition-all leading-relaxed"
                />
              </div>

              {/* AI Visual Aesthetic Styles Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white">Choose Visual Aesthetic</label>
                <div className="grid grid-cols-2 gap-2">
                  {AI_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedAiStyle(st.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        selectedAiStyle === st.id
                          ? 'border-blue-400 bg-blue-500/10 shadow-sm'
                          : 'border-[#282828] bg-[#121212] hover:border-[#3e3e3e]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base">{st.icon}</span>
                        <div className="flex items-center gap-1">
                          {st.colors.map((c, i) => (
                            <span
                              key={i}
                              className="w-2 h-2 rounded-full border border-black/30"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <div className="text-xs font-bold text-white truncate">{st.name}</div>
                        <div className="text-[10px] text-[#878787] line-clamp-1">{st.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generation Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={() => handleGenerateAiImageOnly()}
                  disabled={isGeneratingAiImage || isGeneratingAiConcept || !aiPrompt.trim()}
                  className="w-full h-11 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isGeneratingAiImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating AI Image & Applying Live...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>Generate AI Background Image</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleGenerateAiConcept}
                  disabled={isGeneratingAiConcept || isGeneratingAiImage || !aiPrompt.trim()}
                  variant="outline"
                  className="w-full h-9 border-[#3e3e3e] hover:bg-[#242424] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isGeneratingAiConcept ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1ed760]" />
                      <span>Designing Full Concept (Text + Colors + Image)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#1ed760]" />
                      <span>Generate Complete Thumbnail Concept</span>
                    </>
                  )}
                </Button>
              </div>

              {aiSuccessMessage && (
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{aiSuccessMessage}</span>
                </div>
              )}

              {aiErrorMessage && (
                isAiQuotaError ? (
                  <AiQuotaNotice
                    message={aiErrorMessage}
                    onRetry={() => handleGenerateAiImageOnly()}
                    onDismiss={() => {
                      setAiErrorMessage(null);
                      setIsAiQuotaError(false);
                    }}
                    compact
                  />
                ) : (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                    {aiErrorMessage}
                  </div>
                )
              )}

              {/* Active Image Layer Adjustments */}
              {bgImageElement && (
                <div className="pt-3 border-t border-[#242424] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Live Layer Controls</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBgImageElement(null);
                        setActiveBgImageUrl(null);
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Image</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                </div>
              )}

              {/* Gallery of Session AI Generated Images */}
              {recentAiImages.length > 0 && (
                <div className="pt-3 border-t border-[#242424] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Recent AI Images</span>
                    <span className="text-[10px] text-[#878787]">Click to apply live</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {recentAiImages.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => applyImageToCanvas(item.url, item.prompt, item.style)}
                        className={`relative aspect-video rounded-lg overflow-hidden border transition-all cursor-pointer group ${
                          activeBgImageUrl === item.url
                            ? 'border-[#1ed760] ring-2 ring-[#1ed760]/30'
                            : 'border-[#333333] hover:border-[#666666]'
                        }`}
                        title={`Apply image for: "${item.prompt}" (${item.style})`}
                      >
                        <img
                          src={item.url}
                          alt={item.prompt}
                          className="w-full h-full object-cover"
                        />
                        {activeBgImageUrl === item.url && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#1ed760] flex items-center justify-center text-black">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* =================================================================== */}
          {/* TAB 2: TEXT & TYPOGRAPHY CUSTOMIZER                                 */}
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
                    Upload Custom Photo / Background
                  </label>
                  {bgImageElement && (
                    <button
                      type="button"
                      onClick={() => {
                        setBgImageElement(null);
                        setActiveBgImageUrl(null);
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Image</span>
                    </button>
                  )}
                </div>

                <label className="flex items-center justify-center gap-2 p-3 bg-[#121212] hover:bg-[#1a1a1a] border border-dashed border-[#3e3e3e] hover:border-[#1ed760] rounded-xl text-xs text-white font-bold cursor-pointer transition-all">
                  <Upload className="w-4 h-4 text-[#1ed760]" />
                  <span>{bgImageElement ? 'Change Photo Image' : 'Upload Local Image File'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
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

      {/* ========================================================================= */}
      {/* EXPORT SUITE MODAL: MANY FORMATS & CUSTOM HEIGHT/WIDTH (USER REQUIREMENT) */}
      {/* ========================================================================= */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-5 text-white max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#282828]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1ed760]/10 border border-[#1ed760]/20 flex items-center justify-center text-[#1ed760]">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Export Studio: Formats & Custom Dimensions
                  </h3>
                  <p className="text-xs text-[#878787]">
                    Download in PNG, JPEG, or WEBP with custom width & height
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-lg text-[#878787] hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Export Target */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider text-[#b3b3b3]">
                1. Select Export Content
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportTarget('full')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    exportTarget === 'full'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                      : 'border-[#282828] bg-[#121212] text-[#878787] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-white">
                    <FileImage className="w-4 h-4 text-[#1ed760]" />
                    <span>Full Rendered Thumbnail</span>
                  </div>
                  <p className="text-[10px] text-[#878787] mt-1">
                    Complete artwork with bold title, badge, scrim & styling
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportTarget('background_only')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    exportTarget === 'background_only'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                      : 'border-[#282828] bg-[#121212] text-[#878787] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-white">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Pure AI Background Only</span>
                  </div>
                  <p className="text-[10px] text-[#878787] mt-1">
                    Raw AI generated background image without text overlays
                  </p>
                </button>
              </div>
            </div>

            {/* Step 2: File Format Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider text-[#b3b3b3]">
                2. Select File Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'png', name: 'PNG Image', desc: 'Lossless & Crisp (.png)' },
                  { id: 'jpeg', name: 'JPEG Image', desc: 'Lightweight Web (.jpg)' },
                  { id: 'webp', name: 'WEBP Image', desc: 'Modern High-Efficiency' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setExportFormat(fmt.id as any)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      exportFormat === fmt.id
                        ? 'border-[#1ed760] bg-[#1ed760]/10 text-white font-bold'
                        : 'border-[#282828] bg-[#121212] text-[#878787] hover:border-[#3e3e3e]'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{fmt.name}</div>
                    <div className="text-[10px] text-[#878787] mt-0.5">{fmt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Resolution Presets & Custom Dimensions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider text-[#b3b3b3]">
                  3. Dimensions & Aspect Ratio
                </label>
                <span className="text-[11px] font-mono text-[#1ed760]">
                  {exportWidth} × {exportHeight} px
                </span>
              </div>

              {/* Quick Dimension Preset Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {DIMENSION_PRESETS.map((preset) => {
                  const isSelected = exportWidth === preset.width && exportHeight === preset.height;
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyDimensionPreset(preset)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                        isSelected
                          ? 'border-[#1ed760] bg-[#1ed760]/10'
                          : 'border-[#282828] bg-[#121212] hover:border-[#3e3e3e]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-[#1ed760] shrink-0" />
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold text-white truncate">
                          {preset.width} × {preset.height}
                        </div>
                        <div className="text-[9px] text-[#878787] truncate">
                          {preset.ratio} · {preset.name.split(' ')[0]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Width & Height Inputs */}
              <div className="p-3 bg-[#121212] border border-[#282828] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-[#1ed760]" />
                    <span>Custom Pixel Dimensions</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setLockAspectRatio(!lockAspectRatio)}
                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      lockAspectRatio
                        ? 'bg-[#1ed760]/15 text-[#1ed760]'
                        : 'bg-[#282828] text-[#878787]'
                    }`}
                  >
                    {lockAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{lockAspectRatio ? 'Ratio Locked' : 'Ratio Free'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#878787]">Width (px)</label>
                    <Input
                      type="number"
                      min="100"
                      max="4096"
                      value={exportWidth}
                      onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
                      className="bg-[#181818] border-[#333333] text-xs font-mono text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#878787]">Height (px)</label>
                    <Input
                      type="number"
                      min="100"
                      max="4096"
                      value={exportHeight}
                      onChange={(e) => handleHeightChange(parseInt(e.target.value, 10))}
                      className="bg-[#181818] border-[#333333] text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Slider for JPEG / WEBP */}
            {exportFormat !== 'png' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#b3b3b3]">Compression Quality</span>
                  <span className="font-mono text-[#1ed760] font-bold">
                    {Math.round(exportQuality * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.70"
                  max="1.0"
                  step="0.05"
                  value={exportQuality}
                  onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                  className="w-full accent-[#1ed760] cursor-pointer"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#282828]">
              <div className="text-[11px] text-[#878787]">
                Will download <span className="text-white font-mono">{exportWidth}×{exportHeight}</span> as{' '}
                <span className="text-[#1ed760] font-bold uppercase">{exportFormat}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExportModalOpen(false)}
                  className="border-[#3e3e3e] text-white hover:bg-[#282828] text-xs cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  onClick={() => handleExecuteDownload()}
                  disabled={isExporting}
                  size="sm"
                  className="bg-[#1ed760] hover:bg-[#1fdf64] text-black font-extrabold text-xs px-4 gap-1.5 cursor-pointer shadow-lg"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {exportFormat.toUpperCase()}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
