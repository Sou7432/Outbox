import React from 'react';
import { SystemMetrics } from '../types';
import { Clock, CheckCircle2, AlertTriangle, Database } from 'lucide-react';

interface MetricsCardsProps {
  metrics: SystemMetrics | null;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ metrics }) => {
  const scheduled = metrics?.stats.scheduled ?? 0;
  const sent = metrics?.stats.sent ?? 0;
  const delayed = metrics?.stats.delayed ?? 0;
  const elastic = metrics?.elasticsearch ?? false;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Scheduled */}
      <div className="p-4 rounded-xl bg-[#12141c] border border-[#1f2330] hover:border-[#2a2f42] transition shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Scheduled Queue</span>
          <Clock className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">{scheduled}</span>
          <span className="text-xs text-slate-400">emails pending</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          BullMQ Delayed Jobs
        </div>
      </div>

      {/* Sent */}
      <div className="p-4 rounded-xl bg-[#12141c] border border-[#1f2330] hover:border-[#2a2f42] transition shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Sent Successfully</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">{sent}</span>
          <span className="text-xs text-emerald-400/90 font-medium">via Ethereal SMTP</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          With Live Web Preview URLs
        </div>
      </div>

      {/* Rate Limited / Delayed */}
      <div className="p-4 rounded-xl bg-[#12141c] border border-[#1f2330] hover:border-[#2a2f42] transition shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Rate Limit Postponed</span>
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">{delayed}</span>
          <span className="text-xs text-amber-400/90 font-medium">jobs delayed</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Hourly window protected (No loss)
        </div>
      </div>

      {/* Elasticsearch / Indexing */}
      <div className="p-4 rounded-xl bg-[#12141c] border border-[#1f2330] hover:border-[#2a2f42] transition shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Search Engine</span>
          <Database className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-base font-bold ${elastic ? 'text-purple-300' : 'text-slate-300'}`}>
            {elastic ? 'Elasticsearch 8' : 'PostgreSQL Hybrid'}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${elastic ? 'bg-purple-400' : 'bg-slate-400'}`}></span>
          {elastic ? 'Full-text indexing active' : 'Elasticsearch sync fallback'}
        </div>
      </div>
    </div>
  );
};
