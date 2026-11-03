# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Bengali content creators, YouTubers, podcasters, video editors, media agencies, journalists, and educators who produce Bengali audiovisual content and require accurate transcription, synchronized captions, and publishing optimization.

## Product Purpose
BanglaScribe is a Bengali automatic speech recognition (ASR) studio and caption editor. It allows creators to upload or record Bengali audio/video, receive time-aligned transcript segments, edit and proofread captions in real time with an interactive media player, export subtitles into industry formats (SRT, VTT, DOCX, TXT, JSON), and generate tailored YouTube SEO metadata.

## Positioning
Generic transcription services struggle with Bengali phonetics, compound characters (যুক্তবর্ণ), and colloquial dialect variations. BanglaScribe delivers a specialized Bengali transcription workflow coupled with synchronized timecode scrubbing and creator-focused publishing exports.

## Operating Context
Used during post-production and media distribution: users upload voice recordings or video clips, verify and correct timestamped Bengali subtitle segments using keyboard shortcuts and synchronized playback, and download standard subtitle files directly ready for YouTube, Premiere Pro, DaVinci Resolve, or social media distribution.

## Capabilities and Constraints
- High-accuracy Bengali speech-to-text with start/end timecode synchronization.
- Interactive audio playback controller with scrub bar, waveform representation, playback speed adjustment, and timecode jumping.
- Timestamped subtitle block editor with live segment search, time adjustment, text correction, and segment addition.
- Multi-format subtitle and document exports: SRT (SubRip), WebVTT, Microsoft Word (DOCX), plain text (TXT), and JSON.
- Creator SEO Toolkit: AI-generated Bengali and bilingual YouTube video titles, descriptions, and searchable tags.
- Persistent transcription and session data stored in PostgreSQL Cloud SQL via Drizzle ORM.
- Spotify Design System aesthetic: `#121212` near-black canvas, `#181818` dark surfaces, `#1ed760` functional green highlights, and pill geometry.

## Brand Commitments
- Name: BanglaScribe
- Visual World: Spotify Design System (defined in `DESIGN.md`), featuring deep dark immersion, circular controls, pill-shaped action buttons, and disciplined high-contrast typography.

## Evidence on Hand
- Full-stack working React 19 + TypeScript + Vite applet with Express backend in `server.ts`.
- Complete Spotify-tokenized UI with shadcn/ui components in `src/components/ui/`.
- Interactive audio player (`src/components/AudioPlayerController.tsx`) and transcript editor (`src/components/TranscriptEditor.tsx`).
- Connected Cloud SQL PostgreSQL database with Drizzle schema and API routes.

## Product Principles
1. Bengali Linguistic Precision: Clean rendering of Bengali typography and compound characters without encoding corruption or misalignment.
2. Synchronized Scrubbing: Immediate, fluid alignment between playback position and transcript segment focus.
3. Content-Dense Dark Immersion: Near-black theme optimized for prolonged editorial work without eye fatigue.
4. Production-Ready Export: Strictly compliant SRT/VTT formatting for zero-friction importing into video editing suites and streaming platforms.

## Accessibility & Inclusion
High contrast text (#ffffff and #b3b3b3 against #121212 and #181818), keyboard accessible media controls, visible focus rings, and clear visual and auditory states.
