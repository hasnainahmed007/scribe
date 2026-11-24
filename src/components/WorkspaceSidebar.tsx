import React, { useState, useEffect, useRef } from 'react';
import {
  FileAudio,
  History,
  Mic,
  Youtube,
  Image as ImageIcon,
  CreditCard,
  Lock,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Download,
  Trash2,
  Pin,
  PinOff,
  Loader2,
  Zap,
  X,
} from 'lucide-react';
import { ActiveTab, SavedTranscript } from '../types';
import { useAuth } from '../context/AuthContext';

interface WorkspaceSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenPricing: () => void;
  transcripts: SavedTranscript[];
  isLoadingHistory: boolean;
  pinnedIds: number[];
  activeTranscriptId: number | null;
  onTogglePin: (id: number) => void;
  onLoadTranscript: (item: SavedTranscript) => void;
  onExportTranscript: (item: SavedTranscript) => void;
  onOpenInYouTube: (item: SavedTranscript) => void;
  onDeleteTranscript: (item: SavedTranscript) => Promise<void>;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface MenuAnchorState {
  item: SavedTranscript;
  top: number;
  left: number;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenPricing,
  transcripts,
  isLoadingHistory,
  pinnedIds,
  activeTranscriptId,
  onTogglePin,
  onLoadTranscript,
  onExportTranscript,
  onOpenInYouTube,
  onDeleteTranscript,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchorState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const hasModule = (modName: string) => {
    if (isSuperAdmin) return true;
    return Boolean(user?.planModules?.includes(modName as any));
  };

  // Close three-dot dropdown on outside click, escape key, or scroll
  useEffect(() => {
    if (!menuAnchor) return;

    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAnchor(null);
        setConfirmDeleteId(null);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuAnchor(null);
        setConfirmDeleteId(null);
      }
    };

    const handleScroll = () => {
      setMenuAnchor(null);
      setConfirmDeleteId(null);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuAnchor]);

  const pinnedSet = new Set(pinnedIds);
  const pinnedTranscripts = transcripts.filter((t) => pinnedSet.has(t.id));
  const recentTranscripts = transcripts.filter((t) => !pinnedSet.has(t.id));

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, item: SavedTranscript) => {
    e.stopPropagation();
    if (menuAnchor?.item.id === item.id) {
      setMenuAnchor(null);
      setConfirmDeleteId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 180;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const top =
      rect.bottom + 6 + menuHeight > viewportHeight
        ? Math.max(12, rect.top - menuHeight - 6)
        : rect.bottom + 4;
    const left =
      rect.left + menuWidth > viewportWidth
        ? Math.max(12, viewportWidth - menuWidth - 12)
        : Math.max(12, rect.right - menuWidth + 120 > viewportWidth ? rect.left - menuWidth + 24 : rect.left);

    setConfirmDeleteId(null);
    setMenuAnchor({ item, top, left });
  };

  const renderHistoryRow = (item: SavedTranscript, isPinned: boolean) => {
    const isActive = activeTranscriptId === item.id;
    const isMenuOpen = menuAnchor?.item.id === item.id;

    return (
      <div
        key={item.id}
        onClick={() => {
          onLoadTranscript(item);
          onCloseMobile();
        }}
        className={`group relative flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
          isActive
            ? 'bg-[#24272d] text-[#e4e7ec] font-medium'
            : 'text-[#b3bac5] hover:bg-[#1c1e22] hover:text-[#e4e7ec]'
        }`}
        title={item.title}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isPinned ? (
            <Pin className="w-3 h-3 text-[#3fb970] shrink-0" />
          ) : (
            <FileAudio className="w-3 h-3 text-[#6f7682] group-hover:text-[#9ca3af] shrink-0" />
          )}
          <span className="truncate">{item.title || item.audioName || 'Untitled audio'}</span>
        </div>

        <button
          type="button"
          onClick={(e) => handleOpenMenu(e, item)}
          aria-label={`Actions for ${item.title}`}
          className={`p-1 rounded-md text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#2c3038] transition-opacity shrink-0 cursor-pointer ${
            isMenuOpen
              ? 'opacity-100 bg-[#2c3038] text-[#e4e7ec]'
              : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const navItems: Array<{
    id: ActiveTab | 'plans';
    label: string;
    icon: React.ReactNode;
    locked?: boolean;
  }> = [
    {
      id: 'studio',
      label: 'Subtitles',
      icon: <FileAudio className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'history',
      label: 'History',
      icon: <History className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'voiceover',
      label: 'Voiceover',
      icon: <Mic className="w-4 h-4 shrink-0 text-[#34a866]" />,
      locked: !hasModule('voiceover_studio'),
    },
    {
      id: 'youtube',
      label: 'YouTube SEO',
      icon: <Youtube className="w-4 h-4 shrink-0" />,
      locked: !hasModule('youtube_seo'),
    },
    {
      id: 'thumbnail',
      label: 'Thumbnails',
      icon: <ImageIcon className="w-4 h-4 shrink-0" />,
      locked: !hasModule('thumbnail_canvas'),
    },
    {
      id: 'plans',
      label: 'Plans',
      icon: <CreditCard className="w-4 h-4 shrink-0" />,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#141414] border-r border-[#282828] select-none">
      {/* Mobile Drawer Header */}
      <div className="lg:hidden px-4 py-3 border-b border-[#282828] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#1db954] text-[#08100b] flex items-center justify-center font-bold text-xs">
            S
          </div>
          <span className="text-sm font-semibold text-[#e4e7ec] font-display">Scriby</span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-1.5 text-[#9ca3af] hover:text-[#e4e7ec] rounded-lg hover:bg-[#282828] cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Top Layer: Workspace Navigation */}
      <nav className="p-3 space-y-1 shrink-0" aria-label="Workspace Navigation">
        {navItems.map((nav) => {
          const isPlans = nav.id === 'plans';
          const isActive = !isPlans && activeTab === nav.id;

          return (
            <button
              key={nav.id}
              type="button"
              onClick={() => {
                if (isPlans) {
                  onOpenPricing();
                  onCloseMobile();
                } else {
                  handleNavClick(nav.id as ActiveTab);
                }
              }}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#23262c] text-[#e4e7ec] border border-[#32363f]'
                  : 'text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#1c1e22] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className={isActive ? 'text-[#3fb970]' : ''}>{nav.icon}</span>
                <span className="truncate">{nav.label}</span>
              </span>
              {nav.locked && <Lock className="w-3 h-3 text-[#6f7682] shrink-0" />}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#24262c] mx-3 shrink-0" />

      {/* Scrollable History Area: Pinned & Recent (Arrow-Based Minimizable) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3 space-y-4">
        {/* Pinned History Section */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setPinnedOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-semibold text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#1a1c20] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              {pinnedOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#6f7682]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#6f7682]" />
              )}
              <span>Pinned</span>
            </span>
            <span className="text-[11px] font-mono tabular-nums text-[#6f7682]">
              {pinnedTranscripts.length}
            </span>
          </button>

          {pinnedOpen && (
            <div className="space-y-0.5 pl-1">
              {pinnedTranscripts.length === 0 ? (
                <p className="px-2.5 py-1.5 text-[11px] text-[#6f7682]">
                  No pinned transcripts
                </p>
              ) : (
                pinnedTranscripts.map((item) => renderHistoryRow(item, true))
              )}
            </div>
          )}
        </div>

        {/* Recent History Section */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setRecentOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-semibold text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#1a1c20] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              {recentOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#6f7682]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#6f7682]" />
              )}
              <span>Recent</span>
            </span>
            <span className="text-[11px] font-mono tabular-nums text-[#6f7682]">
              {recentTranscripts.length}
            </span>
          </button>

          {recentOpen && (
            <div className="space-y-0.5 pl-1">
              {isLoadingHistory && transcripts.length === 0 ? (
                <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-[#6f7682]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading history...</span>
                </div>
              ) : recentTranscripts.length === 0 ? (
                <p className="px-2.5 py-1.5 text-[11px] text-[#6f7682]">
                  No recent transcripts
                </p>
              ) : (
                recentTranscripts.map((item) => renderHistoryRow(item, false))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Bottom Quota Summary */}
      {user && (
        <div className="p-3 border-t border-[#24262c] bg-[#121212]/70 shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#9ca3af] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400/90" />
              <span>Audio Minutes</span>
            </span>
            <span className="font-mono tabular-nums font-semibold text-[#3fb970]">
              {user.creditsRemaining}m
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#6f7682]">
            <span className="truncate">{user.planName}</span>
            <button
              type="button"
              onClick={() => {
                onOpenPricing();
                onCloseMobile();
              }}
              className="text-[#3fb970] hover:underline font-medium shrink-0 cursor-pointer"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-[57px] h-[calc(100vh-57px)] z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Floating Fixed Three-Dot Context Menu (escapes sidebar scroll clipping) */}
      {menuAnchor && (
        <div
          ref={menuRef}
          style={{ top: `${menuAnchor.top}px`, left: `${menuAnchor.left}px` }}
          className="fixed z-50 w-44 rounded-xl bg-[#1b1d21] border border-[#32363f] shadow-[0_12px_32px_rgba(0,0,0,0.75)] py-1.5 text-xs animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onTogglePin(menuAnchor.item.id);
              setMenuAnchor(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[#d0d5dd] hover:bg-[#262a31] hover:text-[#e4e7ec] transition-colors cursor-pointer"
          >
            {pinnedSet.has(menuAnchor.item.id) ? (
              <>
                <PinOff className="w-3.5 h-3.5 text-[#9ca3af]" />
                <span>Unpin</span>
              </>
            ) : (
              <>
                <Pin className="w-3.5 h-3.5 text-[#3fb970]" />
                <span>Pin</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              const target = menuAnchor.item;
              setMenuAnchor(null);
              onExportTranscript(target);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[#d0d5dd] hover:bg-[#262a31] hover:text-[#e4e7ec] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#9ca3af]" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = menuAnchor.item;
              setMenuAnchor(null);
              onOpenInYouTube(target);
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[#d0d5dd] hover:bg-[#262a31] hover:text-[#e4e7ec] transition-colors cursor-pointer"
          >
            <Youtube className="w-3.5 h-3.5 text-rose-400" />
            <span>YouTube SEO</span>
          </button>

          <div className="my-1 border-t border-[#2a2d34]" />

          {confirmDeleteId === menuAnchor.item.id ? (
            <button
              type="button"
              disabled={deletingId === menuAnchor.item.id}
              onClick={async () => {
                const target = menuAnchor.item;
                setDeletingId(target.id);
                try {
                  await onDeleteTranscript(target);
                } finally {
                  setDeletingId(null);
                  setConfirmDeleteId(null);
                  setMenuAnchor(null);
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-rose-300 bg-rose-950/50 hover:bg-rose-900/60 font-semibold transition-colors cursor-pointer"
            >
              {deletingId === menuAnchor.item.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>{deletingId === menuAnchor.item.id ? 'Deleting...' : 'Confirm Delete'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(menuAnchor.item.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-950/35 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}
    </>
  );
};
