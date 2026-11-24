import React from 'react';
import { User, SlackStatus } from '../types';
import { Send, LogOut, ExternalLink, Slack, Activity, Mail } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  slackStatus: SlackStatus | null;
  onOpenCompose: () => void;
  onOpenSlackModal: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  slackStatus,
  onOpenCompose,
  onOpenSlackModal,
  onLogout,
}) => {
  return (
    <header className="border-b border-[#1f2330] bg-[#0f1118]/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">ReachInbox</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none">Email Job Scheduler & Dispatcher</p>
          </div>
        </div>

        {/* Center/Actions */}
        <div className="flex items-center gap-3">
          {/* BullMQ Live Board Link */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161922] hover:bg-[#1d2230] text-slate-300 border border-[#262a3b] transition"
            title="Open BullMQ Live Queue Monitoring Dashboard"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>BullMQ Live Board</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>

          {/* Slack Status / Connect Pill */}
          <button
            onClick={onOpenSlackModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              slackStatus?.connected
                ? 'bg-emerald-950/30 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
                : 'bg-[#161922] text-slate-300 border-[#262a3b] hover:bg-[#1d2230]'
            }`}
          >
            <Slack className={`w-3.5 h-3.5 ${slackStatus?.connected ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>{slackStatus?.connected ? 'Slack Connected' : 'Connect Slack'}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                slackStatus?.connected ? 'bg-emerald-400' : 'bg-amber-400/80'
              }`}
            />
          </button>

          {/* Compose Email Primary Action */}
          <button
            onClick={onOpenCompose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/25 transition active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Compose New Email</span>
          </button>

          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-[#1f2330]">
              <div className="relative group">
                <img
                  src={
                    user.picture ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                  }
                  alt={user.name}
                  className="w-9 h-9 rounded-full ring-2 ring-indigo-500/30 object-cover"
                />
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</div>
                <div className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">
                  {user.email}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-[#1d2230] transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
