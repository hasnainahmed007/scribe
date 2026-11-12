import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RefreshCw, Sparkles, X, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';

interface AiQuotaNoticeProps {
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  onOpenPricing?: () => void;
  compact?: boolean;
  initialCountdown?: number;
}

export const AiQuotaNotice: React.FC<AiQuotaNoticeProps> = ({
  message,
  onRetry,
  onDismiss,
  onOpenPricing,
  compact = false,
  initialCountdown = 25,
}) => {
  const [countdown, setCountdown] = useState<number>(initialCountdown);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleManualRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const displayMessage =
    message ||
    'Our cloud AI engine is currently processing an extraordinarily high volume of creator requests. Your request has been queued.';

  if (compact) {
    return (
      <div className="p-3 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-3 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span className="truncate">
            <strong className="text-amber-300 font-semibold">AI Peak Demand:</strong> {displayMessage}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {countdown > 0 ? (
            <span className="text-[11px] font-mono text-amber-300/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {countdown}s
            </span>
          ) : null}
          {onRetry && (
            <button
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="text-[11px] font-bold text-black bg-amber-400 hover:bg-amber-300 px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-amber-400/60 hover:text-amber-200 p-1 transition-colors cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-950/30 via-slate-900 to-purple-950/20 border border-amber-500/40 rounded-2xl shadow-xl text-slate-200 space-y-3.5 animate-in fade-in duration-200 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-white font-display">AI Engine at Peak Capacity</h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Temporary Rate Limit
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              {displayMessage}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          {countdown > 0 ? (
            <span>Auto-ready in <strong className="text-amber-300 font-bold">{countdown}s</strong></span>
          ) : (
            <span className="text-emerald-400 font-bold">Engine ready to process</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenPricing && (
            <button
              onClick={onOpenPricing}
              className="text-[11px] text-purple-300 hover:text-purple-200 hover:underline px-2 py-1 transition-colors cursor-pointer"
            >
              Priority Queue Info
            </button>
          )}

          {onRetry && (
            <Button
              size="sm"
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="text-xs h-7 gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold shadow-sm shadow-amber-950/50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Retrying...' : countdown > 0 ? 'Retry Anyway' : 'Retry Now'}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
