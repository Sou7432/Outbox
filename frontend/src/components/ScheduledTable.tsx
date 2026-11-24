import React from 'react';
import { EmailRecord } from '../types';
import { Search, Clock, AlertCircle, Trash2, Calendar, Send } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ScheduledTableProps {
  emails: EmailRecord[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onCancel: (id: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  search,
  onSearchChange,
  onCancel,
  page,
  totalPages,
  onPageChange,
  onOpenCompose,
}) => {
  const formatScheduledTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const isPast = date.getTime() < Date.now();
      const relative = isPast ? 'Due now' : formatDistanceToNow(date, { addSuffix: true });
      const exact = format(date, 'MMM d, yyyy • hh:mm:ss a');
      return { relative, exact };
    } catch {
      return { relative: 'Pending', exact: dateStr };
    }
  };

  return (
    <div className="bg-[#12141c] border border-[#1f2330] rounded-xl overflow-hidden shadow-lg">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-[#1f2330] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#10121a]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search scheduled emails..."
            className="w-full bg-[#181b24] border border-[#25293a] rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div className="text-xs text-slate-400 font-medium">
          Showing {emails.length} scheduled item{emails.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1f2330] bg-[#141620] text-slate-400 uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Sender</th>
              <th className="py-3 px-4">Scheduled For</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b1e2b]">
            {loading ? (
              // Loading Skeleton
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-4"><div className="h-4 bg-[#1f2330] rounded w-36"></div></td>
                  <td className="py-4 px-4"><div className="h-4 bg-[#1f2330] rounded w-48"></div></td>
                  <td className="py-4 px-4"><div className="h-4 bg-[#1f2330] rounded w-28"></div></td>
                  <td className="py-4 px-4"><div className="h-4 bg-[#1f2330] rounded w-32"></div></td>
                  <td className="py-4 px-4"><div className="h-5 bg-[#1f2330] rounded-full w-20"></div></td>
                  <td className="py-4 px-4 text-right"><div className="h-6 bg-[#1f2330] rounded w-8 ml-auto"></div></td>
                </tr>
              ))
            ) : emails.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#1b1e2a] border border-[#262a3d] flex items-center justify-center text-slate-400 mb-3">
                      <Clock className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200">No scheduled emails</h3>
                    <p className="text-xs text-slate-400 mt-1 mb-4">
                      {search ? 'No results matched your search query.' : 'You have no pending emails in the scheduler queue.'}
                    </p>
                    {!search && (
                      <button
                        onClick={onOpenCompose}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Schedule First Campaign
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              // Rows
              emails.map((email) => {
                const { relative, exact } = formatScheduledTime(email.scheduledAt);
                return (
                  <tr key={email.id} className="hover:bg-[#161822] transition">
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      <div className="truncate max-w-[200px]" title={email.recipient}>
                        {email.recipient}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="truncate max-w-[260px]" title={email.subject}>
                        {email.subject}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <div className="truncate max-w-[150px]" title={email.senderEmail}>
                        {email.senderEmail}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span>{relative}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{exact}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {email.status === 'DELAYED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          <AlertCircle className="w-3 h-3" />
                          Rate Limit Delayed
                        </span>
                      ) : email.status === 'PROCESSING' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 animate-pulse">
                          Sending...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          <Clock className="w-3 h-3" />
                          Scheduled
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onCancel(email.id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Cancel this scheduled email"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-[#1f2330] flex items-center justify-between text-xs text-slate-400 bg-[#10121a]">
          <div>Page {page} of {totalPages}</div>
          <div className="flex gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1 rounded bg-[#181b24] border border-[#262a3b] hover:bg-[#202433] disabled:opacity-40 transition"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1 rounded bg-[#181b24] border border-[#262a3b] hover:bg-[#202433] disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
