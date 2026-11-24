import React, { useState, useRef } from 'react';
import { Sender } from '../types';
import { api } from '../services/api';
import { X, Upload, CheckCircle2, AlertCircle, Clock, Send, Users, Sparkles } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  onSuccess,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedSender, setSelectedSender] = useState(senders[0]?.email || 'outreach@reachinbox.test');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [activeLeadTab, setActiveLeadTab] = useState<'upload' | 'manual'>('upload');
  
  // Delivery Settings
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000); // 5 mins from now
    return d.toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  // States
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const res = await api.uploadLeadsFile(file);
      setRecipients(res.emails);
      setUploadedFileName(`${file.name} (${res.count} leads found)`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse uploaded leads file');
    } finally {
      setUploading(false);
    }
  };

  const handleManualAdd = () => {
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const matches = manualInput.match(emailRegex);
    if (!matches || matches.length === 0) {
      setError('No valid email addresses found in text');
      return;
    }
    const unique = Array.from(new Set([...recipients, ...matches.map((m) => m.toLowerCase().trim())]));
    setRecipients(unique);
    setManualInput('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      setError('Please add at least one recipient lead (via file upload or manual entry)');
      return;
    }
    if (!subject.trim()) {
      setError('Subject line is required');
      return;
    }
    if (!body.trim()) {
      setError('Email message body is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const startTime = scheduleType === 'now' ? new Date().toISOString() : new Date(scheduledDateTime).toISOString();

      await api.scheduleEmails({
        recipients,
        subject,
        body,
        senderEmail: selectedSender,
        startTime,
        delayBetweenEmailsSeconds: delaySeconds,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to schedule campaign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#11131c] border border-[#232738] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1f2330] flex items-center justify-between bg-[#0e1018]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Compose & Schedule Campaign</h2>
              <p className="text-[11px] text-slate-400">Configure multi-lead scheduling with BullMQ delayed queue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1d28] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Send As (Sender Profile)</label>
            <select
              value={selectedSender}
              onChange={(e) => setSelectedSender(e.target.value)}
              className="w-full bg-[#181b26] border border-[#262a3c] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.email}>
                  {s.name} ({s.email}) — Limit: {s.hourlyLimit} emails/hr
                </option>
              ))}
            </select>
          </div>

          {/* Leads Section */}
          <div className="p-4 rounded-xl bg-[#141722] border border-[#212536] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Target Recipients</span>
              </div>
              <div className="flex gap-1 text-[11px] bg-[#1a1d29] p-0.5 rounded-lg border border-[#282d40]">
                <button
                  type="button"
                  onClick={() => setActiveLeadTab('upload')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    activeLeadTab === 'upload' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeadTab('manual')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    activeLeadTab === 'manual' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Manual Entry
                </button>
              </div>
            </div>

            {activeLeadTab === 'upload' ? (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#2b3045] hover:border-indigo-500/50 rounded-xl p-5 text-center cursor-pointer bg-[#171a26]/50 transition group"
                >
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 mx-auto mb-1.5 transition" />
                  <p className="text-xs text-slate-200 font-medium">
                    {uploading ? 'Parsing leads...' : 'Click to upload CSV or TXT lead file'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supports CSV columns or raw text lists</p>
                </div>
                {uploadedFileName && (
                  <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{uploadedFileName}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Paste comma or newline separated email addresses..."
                  className="w-full bg-[#181b26] border border-[#262a3c] rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleManualAdd}
                  className="px-3 py-1 rounded bg-[#202434] text-slate-200 text-xs hover:bg-[#282d42] transition font-medium"
                >
                  + Add Emails
                </button>
              </div>
            )}

            {/* Leads detected badge */}
            <div className="pt-2 border-t border-[#1f2332] flex items-center justify-between text-xs">
              <span className="text-slate-400">Total detected recipients:</span>
              <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {recipients.length} leads
              </span>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Accelerate your outreach with ReachInbox AI"
              className="w-full bg-[#181b26] border border-[#262a3c] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Body (HTML / Text)</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi there,\n\nI noticed your team is expanding sales outreach..."
              className="w-full bg-[#181b26] border border-[#262a3c] rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Delivery & Concurrency Controls */}
          <div className="p-4 rounded-xl bg-[#141722] border border-[#212536] space-y-3">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Scheduling & Throttling Rules</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Start time */}
              <div>
                <label className="block text-slate-400 mb-1">Start Sending At</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType('now')}
                    className={`flex-1 py-1.5 rounded-lg border text-center transition ${
                      scheduleType === 'now'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-medium'
                        : 'border-[#262a3c] text-slate-400 hover:bg-[#1a1d29]'
                    }`}
                  >
                    Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('later')}
                    className={`flex-1 py-1.5 rounded-lg border text-center transition ${
                      scheduleType === 'later'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-medium'
                        : 'border-[#262a3c] text-slate-400 hover:bg-[#1a1d29]'
                    }`}
                  >
                    Future Date
                  </button>
                </div>
                {scheduleType === 'later' && (
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full mt-2 bg-[#181b26] border border-[#262a3c] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Delay between emails */}
              <div>
                <label className="block text-slate-400 mb-1">
                  Delay Between Sends (Throttle)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                    className="w-20 bg-[#181b26] border border-[#262a3c] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-slate-400">seconds</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Staggers each lead to mimic human sending</p>
              </div>
            </div>

            {/* Hourly limit */}
            <div className="pt-2 border-t border-[#1f2332] flex items-center justify-between text-xs">
              <span className="text-slate-400">Hourly Rate Limit:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 50)}
                  className="w-20 bg-[#181b26] border border-[#262a3c] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400">emails / hr</span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#1f2330] bg-[#0e1018] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Scheduling...' : `Schedule ${recipients.length} Email(s)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
