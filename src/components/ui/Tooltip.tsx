import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
export type TooltipTone = 'default' | 'accent' | 'danger';

interface TooltipProps {
  content: React.ReactNode;
  sublabel?: string;
  side?: TooltipSide;
  tone?: TooltipTone;
  disabled?: boolean;
  delayMs?: number;
  className?: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  sublabel,
  side = 'top',
  tone = 'default',
  disabled = false,
  delayMs = 80,
  className = 'inline-flex',
  children,
}) => {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const computeCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    if (side === 'top') {
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
    } else if (side === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
    } else if (side === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
    } else {
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
    }

    setCoords({ top, left });
  }, [side]);

  const handleOpen = useCallback(() => {
    if (disabled || !content) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    computeCoords();
    timerRef.current = window.setTimeout(() => {
      computeCoords();
      setVisible(true);
    }, delayMs);
  }, [disabled, content, delayMs, computeCoords]);

  const handleClose = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const closeOnScroll = () => handleClose();
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [visible, handleClose]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const toneClasses =
    tone === 'danger'
      ? 'bg-[#211519]/95 border-rose-500/35 text-rose-200'
      : tone === 'accent'
      ? 'bg-[#15201a]/95 border-[#1db954]/40 text-[#e4e7ec]'
      : 'bg-[#191c22]/95 border-[#323744] text-[#e4e7ec]';

  const arrowToneClasses =
    tone === 'danger'
      ? 'bg-[#211519] border-rose-500/35'
      : tone === 'accent'
      ? 'bg-[#15201a] border-[#1db954]/40'
      : 'bg-[#191c22] border-[#323744]';

  const positionTransform =
    side === 'top'
      ? '-translate-x-1/2 -translate-y-full'
      : side === 'bottom'
      ? '-translate-x-1/2'
      : side === 'left'
      ? '-translate-x-full -translate-y-1/2'
      : '-translate-y-1/2';

  const arrowPosition =
    side === 'top'
      ? 'left-1/2 -translate-x-1/2 -bottom-1 border-r border-b'
      : side === 'bottom'
      ? 'left-1/2 -translate-x-1/2 -top-1 border-l border-t'
      : side === 'left'
      ? 'top-1/2 -translate-y-1/2 -right-1 border-r border-t'
      : 'top-1/2 -translate-y-1/2 -left-1 border-l border-b';

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
      onMouseDown={handleClose}
      className={className}
    >
      {children}
      {typeof document !== 'undefined' &&
        visible &&
        coords &&
        !disabled &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
            className={`fixed z-[9999] pointer-events-none ${positionTransform}`}
          >
            <div
              className={`relative rounded-xl border backdrop-blur-md px-3 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.68)] animate-in fade-in zoom-in-95 duration-150 ${toneClasses}`}
            >
              <div className="text-xs font-medium whitespace-nowrap leading-tight">
                {content}
              </div>
              {sublabel && (
                <div className="text-[11px] text-[#9ca3af] max-w-[220px] truncate mt-0.5 leading-tight">
                  {sublabel}
                </div>
              )}
              <span
                className={`absolute w-2 h-2 rotate-45 ${arrowToneClasses} ${arrowPosition}`}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
