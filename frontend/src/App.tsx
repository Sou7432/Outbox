import React, { useState, useEffect, useCallback } from 'react';
import { User, EmailRecord, Sender, SlackStatus, SystemMetrics } from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { MetricsCards } from './components/MetricsCards';
import { ScheduledTable } from './components/ScheduledTable';
import { SentTable } from './components/SentTable';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { LoginModal } from './components/LoginModal';
import { Clock, CheckCircle2, Send, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // Authentication
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('reachinbox_user');
    return saved ? JSON.parse(saved) : null;
  });

  // UI Navigation
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);

  // Data States
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledTotalPages, setScheduledTotalPages] = useState(1);
  const [scheduledSearch, setScheduledSearch] = useState('');
  const [scheduledLoading, setScheduledLoading] = useState(false);

  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(1);
  const [sentTotalPages, setSentTotalPages] = useState(1);
  const [sentSearch, setSentSearch] = useState('');
  const [sentLoading, setSentLoading] = useState(false);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  // Fetch Scheduled Emails
  const loadScheduled = useCallback(async (page = scheduledPage, search = scheduledSearch) => {
    setScheduledLoading(true);
    try {
      const data = await api.getScheduledEmails(page, 20, search);
      setScheduledEmails(data.emails);
      setScheduledTotal(data.total);
      setScheduledTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.warn('Could not load scheduled emails:', err.message);
    } finally {
      setScheduledLoading(false);
    }
  }, [scheduledPage, scheduledSearch]);

  // Fetch Sent Emails
  const loadSent = useCallback(async (page = sentPage, search = sentSearch) => {
    setSentLoading(true);
    try {
      const data = await api.getSentEmails(page, 20, search);
      setSentEmails(data.emails);
      setSentTotal(data.total);
      setSentTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.warn('Could not load sent emails:', err.message);
    } finally {
      setSentLoading(false);
    }
  }, [sentPage, sentSearch]);

  // Fetch Metadata (Senders, Slack, Metrics)
  const loadMetadata = useCallback(async () => {
    try {
      const [sendersRes, slackRes, metricsRes] = await Promise.allSettled([
        api.getSenders(),
        api.getSlackStatus(),
        api.getMetrics(),
      ]);

      if (sendersRes.status === 'fulfilled') setSenders(sendersRes.value.senders);
      if (slackRes.status === 'fulfilled') setSlackStatus(slackRes.value);
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value);
    } catch (e: any) {
      console.warn('Failed loading metadata:', e.message);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadScheduled();
    loadSent();
    loadMetadata();
  }, [loadScheduled, loadSent, loadMetadata]);

  // Real-time live polling (every 4 seconds) to update statuses and metrics automatically
  useEffect(() => {
    const timer = setInterval(() => {
      loadScheduled();
      loadSent();
      loadMetadata();
    }, 4000);
    return () => clearInterval(timer);
  }, [loadScheduled, loadSent, loadMetadata]);

  // Debounced search for Scheduled
  useEffect(() => {
    const handler = setTimeout(() => {
      loadScheduled(1, scheduledSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [scheduledSearch, loadScheduled]);

  // Debounced search for Sent
  useEffect(() => {
    const handler = setTimeout(() => {
      loadSent(1, sentSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [sentSearch, loadSent]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('reachinbox_user', JSON.stringify(loggedInUser));
    api.googleAuth(loggedInUser).catch(() => {});
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('reachinbox_user');
  };

  const handleCancelEmail = async (id: string) => {
    try {
      await api.cancelEmail(id);
      loadScheduled();
      loadMetadata();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel email');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c12] text-slate-100 flex flex-col font-sans">
      {/* Google Login Overlay if not signed in */}
      <LoginModal isOpen={!user} onLoginSuccess={handleLoginSuccess} />

      {/* Top Header */}
      <Header
        user={user}
        slackStatus={slackStatus}
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Row */}
        <MetricsCards metrics={metrics} />

        {/* Navigation Tabs & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[#1f2330] pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-[#141622] text-slate-400 hover:text-slate-200 border border-[#212435]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Scheduled Emails</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'scheduled' ? 'bg-indigo-700/60 text-white' : 'bg-[#202434] text-slate-400'
                }`}
              >
                {scheduledTotal}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-[#141622] text-slate-400 hover:text-slate-200 border border-[#212435]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sent Emails</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'sent' ? 'bg-indigo-700/60 text-white' : 'bg-[#202434] text-slate-400'
                }`}
              >
                {sentTotal}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadScheduled();
                loadSent();
                loadMetadata();
              }}
              className="p-2 rounded-lg bg-[#141622] hover:bg-[#1a1d2c] border border-[#212435] text-slate-400 hover:text-white transition"
              title="Refresh queue status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsComposeOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Schedule Email</span>
            </button>
          </div>
        </div>

        {/* Tab View */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={scheduledEmails}
            loading={scheduledLoading}
            search={scheduledSearch}
            onSearchChange={setScheduledSearch}
            onCancel={handleCancelEmail}
            page={scheduledPage}
            totalPages={scheduledTotalPages}
            onPageChange={setScheduledPage}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentTable
            emails={sentEmails}
            loading={sentLoading}
            search={sentSearch}
            onSearchChange={setSentSearch}
            page={sentPage}
            totalPages={sentTotalPages}
            onPageChange={setSentPage}
          />
        )}
      </main>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onSuccess={() => {
          loadScheduled();
          loadMetadata();
          setActiveTab('scheduled');
        }}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackStatus={slackStatus}
        onRefresh={loadMetadata}
      />
    </div>
  );
};

export default App;
