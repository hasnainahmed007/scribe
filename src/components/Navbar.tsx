import React from 'react';
import { ActiveTab } from '../types';
import {
  Mic,
  FileAudio,
  Youtube,
  Image as ImageIcon,
  LogOut,
  LogIn,
  History,
  Lock,
  Settings,
  HelpCircle,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNewRecording: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenPricing: () => void;
  onOpenSettings?: () => void;
  onOpenOnboarding?: () => void;
  onOpenInquiry?: () => void;
  hasSegments: boolean;
  onScrollToSection?: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onNewRecording,
  onOpenAuth,
  onOpenPricing,
  onOpenSettings,
  onOpenOnboarding,
  onOpenInquiry,
  hasSegments,
}) => {
  const { user, isAuthenticated, isSuperAdmin, logout } = useAuth();

  const handleLandingNav = (sectionId: string) => {
    if (activeTab !== 'landing') {
      setActiveTab('landing');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const hasModule = (modName: string) => {
    if (isSuperAdmin) return true;
    return Boolean(user?.planModules?.includes(modName as any));
  };

  return (
    <header className="sticky top-0 z-40 bg-[#121212]/95 backdrop-blur-md border-b border-[#282828] px-4 lg:px-8 py-3 flex items-center justify-between gap-8">
      {/* Zone 1: Clean Brand Wordmark (Spotify Circular Emblem) */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => {
            if (!isAuthenticated) setActiveTab('landing');
            else if (isSuperAdmin) setActiveTab('admin');
            else setActiveTab('studio');
          }}
          className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-[#e4e7ec] hover:text-[#4cc37c] transition-colors whitespace-nowrap shrink-0 font-display cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#1db954] text-[#08100b] flex items-center justify-center font-bold text-sm tracking-normal">
            S
          </div>
          <span className="font-semibold">Scriby</span>
        </button>
      </div>

      {/* Zone 2: Navigation Links (Spotify Typography & Pills) */}
      <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
        {/* Visitor Navigation */}
        {!isAuthenticated && (
          <div className="flex items-center gap-6 text-[#9ca3af]">
            <button
              onClick={() => handleLandingNav('home')}
              className="hover:text-[#e4e7ec] transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => handleLandingNav('about')}
              className="hover:text-[#e4e7ec] transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              onClick={() => handleLandingNav('pricing')}
              className="hover:text-[#e4e7ec] transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              onClick={() => handleLandingNav('contact')}
              className="hover:text-[#e4e7ec] transition-colors cursor-pointer"
            >
              Contact
            </button>
          </div>
        )}



        {/* Creator Studio Workspace Navigation (Pill Segmented Control) */}
        {isAuthenticated && !isSuperAdmin && (
          <div className="flex items-center p-1 bg-[#181818] rounded-full border border-[#282828]">
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'studio'
                  ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                  : 'text-[#9ca3af] hover:text-[#e4e7ec]'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Subtitles</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                  : 'text-[#9ca3af] hover:text-[#e4e7ec]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>

            <button
              onClick={() => setActiveTab('voiceover')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'voiceover'
                  ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                  : 'text-[#9ca3af] hover:text-[#e4e7ec]'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-[#34a866]" />
              <span>Voiceover</span>
              {!hasModule('voiceover_studio') && (
                <Lock className="w-3 h-3 text-[#6f7682]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('youtube')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'youtube'
                  ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                  : 'text-[#9ca3af] hover:text-[#e4e7ec]'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>YouTube SEO</span>
              {!hasModule('youtube_seo') && (
                <Lock className="w-3 h-3 text-[#6f7682]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('thumbnail')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'thumbnail'
                  ? 'bg-[#262930] text-[#e4e7ec] font-semibold shadow-sm'
                  : 'text-[#9ca3af] hover:text-[#e4e7ec]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Thumbnail</span>
              {!hasModule('thumbnail_canvas') && (
                <Lock className="w-3 h-3 text-[#6f7682]" />
              )}
            </button>

            <button
              onClick={onOpenPricing}
              className="px-3.5 py-1.5 rounded-full text-[#9ca3af] hover:text-[#e4e7ec] transition-colors cursor-pointer"
            >
              Plans
            </button>
          </div>
        )}
      </nav>

      {/* Zone 3: Primary Action & Profile (Spotify Pill Buttons) */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Visitor Actions */}
        {!isAuthenticated && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenAuth('login')}
              className="text-xs font-semibold text-[#9ca3af] hover:text-[#e4e7ec] px-3 py-2 transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-5 py-2 text-xs font-semibold text-[#08100b] bg-[#1db954] hover:bg-[#1aa34a] rounded-full transition-all cursor-pointer shadow-sm"
            >
              Get Started
            </button>
          </div>
        )}

        {/* SuperAdmin User Section */}
        {isAuthenticated && isSuperAdmin && user && (
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <span className="text-[#e4e7ec] font-semibold">{user.name}</span>
              <span className="text-[#4a4e57] mx-1.5">·</span>
              <span className="text-purple-300/90 font-mono">SuperAdmin</span>
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                logout();
                setActiveTab('landing');
              }}
              className="p-2 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Creator User Section */}
        {isAuthenticated && !isSuperAdmin && user && (
          <div className="flex items-center gap-3">
            {/* Unboxed Metadata with Typographic Separator */}
            <div className="hidden sm:block text-right text-xs">
              <span className="text-[#d0d5dd] font-semibold truncate max-w-[120px] inline-block align-bottom">
                {user.name}
              </span>
              <span className="text-[#4a4e57] mx-1.5">·</span>
              <span className="font-mono tabular-nums text-[#3fb970] font-semibold">
                {user.creditsRemaining}m
              </span>
              <span className="text-[#9ca3af] text-[11px]"> left</span>
            </div>


            <button
              onClick={onNewRecording}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#08100b] bg-[#1db954] hover:bg-[#1aa34a] rounded-full transition-all cursor-pointer shadow-sm"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Transcribe</span>
            </button>

            {onOpenInquiry && (
              <button
                onClick={onOpenInquiry}
                className="p-2 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
                title="Send Inquiry / Support"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}

            {onOpenOnboarding && (
              <button
                onClick={onOpenOnboarding}
                className="p-2 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
                title="Product Tour"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
                title="Studio Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                logout();
                setActiveTab('landing');
              }}
              className="p-2 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
