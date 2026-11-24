import React, { useState } from 'react';
import { SlackStatus } from '../types';
import { api } from '../services/api';
import { X, Slack, CheckCircle2, AlertCircle, Send, Unlink } from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackStatus: SlackStatus | null;
  onRefresh: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackStatus,
  onRefresh,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#reachinbox-alerts');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleOAuthConnect = () => {
    window.location.href = 'http://localhost:5000/api/slack/oauth/start';
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      setMessage({ type: 'error', text: 'Please enter a valid Slack Incoming Webhook URL' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await api.saveSlackWebhook(webhookUrl.trim(), channel.trim());
      setMessage({ type: 'success', text: 'Webhook saved and verified with a welcome notification!' });
      onRefresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save Slack webhook' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setTesting(true);
    setMessage(null);
    try {
      await api.testSlackAlert();
      setMessage({ type: 'success', text: 'Test alert successfully delivered to Slack!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to dispatch test alert' });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectSlack();
      setMessage({ type: 'success', text: 'Slack disconnected successfully' });
      onRefresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#11131c] border border-[#232738] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1f2330] flex items-center justify-between bg-[#0e1018]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Slack className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Slack Rate Limit Alerts</h2>
              <p className="text-[11px] text-slate-400">Receive live alerts when hourly send thresholds are hit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1d28] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {message && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Current Status Box */}
          <div className="p-4 rounded-xl bg-[#141722] border border-[#212536] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">Integration Status</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {slackStatus?.connected ? (
                  <span className="text-emerald-400 font-medium">
                    Connected to {slackStatus.integration?.teamName || 'Workspace'} (
                    {slackStatus.integration?.channel || '#general'})
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium">Not Connected (Rate limit alerts will not notify)</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {slackStatus?.connected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded border border-rose-500/20 transition flex items-center gap-1"
                >
                  <Unlink className="w-3 h-3" />
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* OAuth One-Click Option */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleOAuthConnect}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#4a154b] hover:bg-[#611f69] border border-[#74277d] shadow-sm transition"
            >
              <Slack className="w-4 h-4" />
              <span>Connect with Slack OAuth</span>
            </button>
            <p className="text-[10px] text-slate-500 mt-1">Requires SLACK_CLIENT_ID configured in .env</p>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#1f2330]"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Or Configure Webhook Directly</span>
            <div className="flex-grow border-t border-[#1f2330]"></div>
          </div>

          {/* Webhook Form */}
          <form onSubmit={handleSaveWebhook} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Incoming Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full bg-[#181b26] border border-[#262a3c] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Alerts Channel Name
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="#reachinbox-alerts"
                className="w-full bg-[#181b26] border border-[#262a3c] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Saving & Verifying...' : 'Save & Verify Webhook'}
            </button>
          </form>

          {/* Live Test Alert Button */}
          {slackStatus?.connected && (
            <div className="pt-2 border-t border-[#1f2330]">
              <button
                type="button"
                onClick={handleTestAlert}
                disabled={testing}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testing ? 'Sending live test...' : 'Send Live Test Notification to Slack'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
