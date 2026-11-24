import React, { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  group?: string;
  style?: React.CSSProperties;
}

export interface SelectProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  size?: 'compact' | 'md' | 'default';
  menuWidth?: 'trigger' | 'auto';
  placement?: 'auto' | 'top' | 'bottom';
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxWidth: number;
  openDirection: 'top' | 'bottom';
}

export const Select: React.FC<SelectProps> = ({
  id,
  ariaLabel,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  leadingIcon,
  size = 'default',
  menuWidth = 'trigger',
  placement = 'auto',
  className = '',
  triggerClassName = '',
  menuClassName = '',
}) => {
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const computeCoords = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const edgeMargin = 12;
    const gap = 6;
    const estimatedMenuHeight = Math.min(272, Math.max(88, options.length * 36 + 24));

    const spaceBelow = viewportH - rect.bottom - edgeMargin;
    const spaceAbove = rect.top - edgeMargin;

    const openDirection: 'top' | 'bottom' =
      placement === 'top'
        ? 'top'
        : placement === 'bottom'
        ? 'bottom'
        : spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow
        ? 'top'
        : 'bottom';

    const minW =
      menuWidth === 'auto'
        ? Math.min(Math.max(rect.width, 210), viewportW - edgeMargin * 2)
        : rect.width;
    const maxW =
      menuWidth === 'auto'
        ? Math.min(340, viewportW - edgeMargin * 2)
        : Math.max(rect.width, viewportW - edgeMargin * 2);

    const clampedLeft = Math.max(
      edgeMargin,
      Math.min(rect.left, viewportW - minW - edgeMargin)
    );

    if (openDirection === 'top') {
      setCoords({
        bottom: viewportH - rect.top + gap,
        left: clampedLeft,
        minWidth: minW,
        maxWidth: maxW,
        openDirection,
      });
    } else {
      setCoords({
        top: rect.bottom + gap,
        left: clampedLeft,
        minWidth: minW,
        maxWidth: maxW,
        openDirection,
      });
    }
  }, [options.length, menuWidth, placement]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    computeCoords();
    const currentIdx = options.findIndex((o) => o.value === value && !o.disabled);
    const fallbackIdx = options.findIndex((o) => !o.disabled);
    setHighlightedIndex(currentIdx >= 0 ? currentIdx : fallbackIdx);
    setIsOpen(true);
  }, [disabled, computeCoords, options, value]);

  const closeMenu = useCallback((returnFocus = false) => {
    setIsOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  const selectIndex = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
      closeMenu(true);
    },
    [options, onChange, closeMenu]
  );

  // Sync position & handle outside click / scroll / escape
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu(false);
    };

    const handleScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) {
        return; // Allow scrolling inside the dropdown list itself
      }
      computeCoords();
    };

    const handleResize = () => computeCoords();

    document.addEventListener('mousedown', handleOutsideMouseDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, closeMenu, computeCoords]);

  // Keep highlighted item scrolled smoothly into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
    const itemEl = listRef.current.querySelector<HTMLElement>(
      `[data-option-index="${highlightedIndex}"]`
    );
    itemEl?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightedIndex]);

  const findNextEnabledIndex = (start: number, step: 1 | -1): number => {
    if (options.length === 0) return -1;
    let idx = start;
    for (let i = 0; i < options.length; i++) {
      idx = (idx + step + options.length) % options.length;
      if (!options[idx].disabled) return idx;
    }
    return -1;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      closeMenu(e.key === 'Escape');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const base = highlightedIndex >= 0 ? highlightedIndex : -1;
      setHighlightedIndex(findNextEnabledIndex(base, 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const base = highlightedIndex >= 0 ? highlightedIndex : 0;
      setHighlightedIndex(findNextEnabledIndex(base, -1));
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      const first = options.findIndex((o) => !o.disabled);
      if (first >= 0) setHighlightedIndex(first);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setHighlightedIndex(i);
          break;
        }
      }
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        selectIndex(highlightedIndex);
      }
    }
  };

  const sizeClasses =
    size === 'compact'
      ? 'h-7 px-2.5 rounded-lg text-xs gap-1.5'
      : size === 'md'
      ? 'h-9 px-3 rounded-xl text-xs gap-2'
      : 'h-10 px-3 rounded-xl text-xs gap-2';

  // Render grouped items cleanly while preserving flat option indices
  const renderedRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    let currentGroup: string | undefined = undefined;

    options.forEach((opt, idx) => {
      if (opt.group && opt.group !== currentGroup) {
        currentGroup = opt.group;
        rows.push(
          <div
            key={`group-${opt.group}-${idx}`}
            className={`px-2.5 py-1.5 text-[11px] font-semibold text-[#7b8290] select-none ${
              idx > 0 ? 'mt-1 pt-2 border-t border-[#262a33]' : ''
            }`}
          >
            {opt.group}
          </div>
        );
      }

      const isSelected = opt.value === value;
      const isHighlighted = idx === highlightedIndex;

      rows.push(
        <button
          key={`${opt.value}-${idx}`}
          type="button"
          role="option"
          data-option-index={idx}
          aria-selected={isSelected}
          aria-disabled={opt.disabled || undefined}
          disabled={opt.disabled}
          onMouseEnter={() => {
            if (!opt.disabled) setHighlightedIndex(idx);
          }}
          onClick={() => selectIndex(idx)}
          className={`w-full text-left rounded-lg px-2.5 py-2 text-xs flex items-center justify-between gap-2.5 transition-colors duration-100 ${
            opt.disabled
              ? 'opacity-45 cursor-not-allowed text-[#6f7682]'
              : isSelected
              ? 'bg-[#1db954]/14 text-[#e4e7ec] font-medium cursor-pointer'
              : isHighlighted
              ? 'bg-[#242833] text-[#f3f4f6] cursor-pointer'
              : 'text-[#cfd5df] hover:bg-[#242833] hover:text-[#f3f4f6] cursor-pointer'
          }`}
        >
          <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
            <span className="truncate" style={opt.style}>
              {opt.label}
            </span>
            {opt.sublabel && (
              <span className="text-[11px] text-[#7b8290] shrink-0 whitespace-nowrap">
                {opt.sublabel}
              </span>
            )}
          </div>
          {isSelected && <Check className="w-3.5 h-3.5 text-[#4cc37c] shrink-0" />}
        </button>
      );
    });

    return rows;
  }, [options, value, highlightedIndex, selectIndex]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between bg-[#15171c] border text-[#e4e7ec] transition-all duration-150 outline-none select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${
          isOpen
            ? 'border-[#1db954]/65 ring-2 ring-[#1db954]/15 bg-[#191c22]'
            : 'border-[#2c303a] hover:border-[#3d424f] hover:bg-[#191b20] focus-visible:border-[#1db954]/65 focus-visible:ring-2 focus-visible:ring-[#1db954]/15'
        } ${triggerClassName}`}
      >
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          {leadingIcon && <span className="shrink-0 flex items-center">{leadingIcon}</span>}
          <span
            className={`truncate text-left font-medium ${
              selectedOption ? 'text-[#e4e7ec]' : 'text-[#7b8290]'
            }`}
            style={selectedOption?.style}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#4cc37c]' : 'text-[#8b929e]'
          }`}
        />
      </button>

      {typeof document !== 'undefined' &&
        isOpen &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            style={{
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              minWidth: `${coords.minWidth}px`,
              maxWidth: `${coords.maxWidth}px`,
            }}
            className={`fixed z-[9999] rounded-xl bg-[#191c22]/96 backdrop-blur-md border border-[#323744] shadow-[0_14px_38px_rgba(0,0,0,0.75)] p-1.5 animate-in fade-in zoom-in-95 duration-150 ${menuClassName}`}
          >
            <div ref={listRef} className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
              {renderedRows}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
