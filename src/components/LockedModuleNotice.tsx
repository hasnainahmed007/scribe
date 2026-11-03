import React from 'react';
import { Lock, ArrowRight, Check } from 'lucide-react';
import { PlanModule } from '../types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface LockedModuleNoticeProps {
  module: PlanModule;
  title: string;
  description: string;
  requiredPlanName?: string;
  benefits?: string[];
  onOpenPricing: () => void;
  onBackToStudio: () => void;
}

export const LockedModuleNotice: React.FC<LockedModuleNoticeProps> = ({
  title,
  description,
  requiredPlanName = 'Pro Creator',
  benefits = [
    'Unlimited AI-generated Bengali YouTube titles & chapter timestamps',
    'High-resolution 16:9 thumbnail canvas studio with custom fonts',
    'Word (.docx) table and structured JSON subtitle exports',
    'Priority processing queue and higher monthly audio minutes',
  ],
  onOpenPricing,
  onBackToStudio,
}) => {
  return (
    <div className="max-w-xl mx-auto py-12 px-4 text-center">
      <Card className="p-8 sm:p-10 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-5 h-5 text-amber-400" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2.5">
          <Badge variant="amber" className="font-mono">
            Requires {requiredPlanName}
          </Badge>
        </div>

        <h2 className="text-xl font-bold text-white font-display mb-2">
          {title}
        </h2>

        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed mb-6">
          {description}
        </p>

        {/* Benefits list */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-left max-w-sm mx-auto mb-7 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Capabilities Included:
          </div>
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{b}</span>
            </div>
          ))}
        </div>

        {/* Actions with shadcn Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={onOpenPricing}
            size="default"
            className="w-full sm:w-auto"
          >
            <span>Upgrade to {requiredPlanName}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="outline"
            onClick={onBackToStudio}
            size="default"
            className="w-full sm:w-auto"
          >
            Back to Editor
          </Button>
        </div>
      </Card>
    </div>
  );
};
