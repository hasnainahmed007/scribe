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
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white hover:text-[#1ed760] transition-colors whitespace-nowrap shrink-0 font-display cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#1ed760] text-black flex items-center justify-center font-extrabold text-sm tracking-normal shadow-[0_2px_8px_rgba(30,215,96,0.3)]">
            S
          </div>
          <span className="font-bold">Scriby</span>
        </button>
      </div>

      {/* Zone 2: Navigation Links (Spotify Typography & Pills) */}
      <nav className="hidden md:flex items-center gap-1 text-xs font-bold">
        {/* Visitor Navigation */}
        {!isAuthenticated && (
          <div className="flex items-center gap-6 text-[#b3b3b3]">
            <button
              onClick={() => handleLandingNav('home')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => handleLandingNav('about')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              onClick={() => handleLandingNav('pricing')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              onClick={() => handleLandingNav('contact')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Contact
            </button>
          </div>
        )}

        {/* SuperAdmin View Header Indicator */}
        {isAuthenticated && isSuperAdmin && (
          <div className="text-xs text-[#b3b3b3] font-medium">
            Platform Administration & SaaS Governance
          </div>
        )}

        {/* Creator Studio Workspace Navigation (Spotify Pill Segmented Control) */}
        {isAuthenticated && !isSuperAdmin && (
          <div className="flex items-center p-1 bg-[#181818] rounded-full border border-[#282828]">
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'studio'
                  ? 'bg-[#282828] text-white font-bold shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Subtitles</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#282828] text-white font-bold shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>

            <button
              onClick={() => setActiveTab('voiceover')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'voiceover'
                  ? 'bg-[#282828] text-white font-bold shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-[#1ed760]" />
              <span>Voiceover</span>
            </button>

            <button
              onClick={() => setActiveTab('youtube')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'youtube'
                  ? 'bg-[#282828] text-white font-bold shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>YouTube SEO</span>
              {!hasModule('youtube_seo') && (
                <Lock className="w-3 h-3 text-[#7c7c7c]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('thumbnail')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'thumbnail'
                  ? 'bg-[#282828] text-white font-bold shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Thumbnail</span>
              {!hasModule('thumbnail_canvas') && (
                <Lock className="w-3 h-3 text-[#7c7c7c]" />
              )}
            </button>

            <button
              onClick={onOpenPricing}
              className="px-3.5 py-1.5 rounded-full text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
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
              className="text-xs font-bold text-[#b3b3b3] hover:text-white hover:scale-104 px-3 py-2 transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-5 py-2 text-xs font-bold text-black bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-104 rounded-full transition-all cursor-pointer shadow-[0_4px_12px_rgba(30,215,96,0.25)]"
            >
              Get Started
            </button>
          </div>
        )}

        {/* SuperAdmin User Section */}
        {isAuthenticated && isSuperAdmin && user && (
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <span className="text-white font-bold">{user.name}</span>
              <span className="text-[#4d4d4d] mx-1.5">·</span>
              <span className="text-purple-400 font-mono">SuperAdmin</span>
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
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
              className="p-2 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
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
              <span className="text-white font-semibold truncate max-w-[120px] inline-block align-bottom">
                {user.name}
              </span>
              <span className="text-[#4d4d4d] mx-1.5">·</span>
              <span className="font-mono tabular-nums text-[#1ed760] font-bold">
                {user.creditsRemaining}m
              </span>
              <span className="text-[#b3b3b3] text-[11px]"> left</span>
            </div>


            <button
              onClick={onNewRecording}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-black bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-104 rounded-full transition-all cursor-pointer shadow-[0_4px_12px_rgba(30,215,96,0.25)]"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Transcribe</span>
            </button>

            {onOpenOnboarding && (
              <button
                onClick={onOpenOnboarding}
                className="p-2 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
                title="Product Tour"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
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
              className="p-2 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
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
