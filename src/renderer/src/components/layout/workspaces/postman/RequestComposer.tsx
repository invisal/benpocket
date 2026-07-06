import React from 'react';
import { RefreshCw, Send } from 'lucide-react';

interface RequestComposerProps {
  httpMethod: string;
  setHttpMethod: (method: string) => void;
  requestUrl: string;
  setRequestUrl: (url: string) => void;
  isPostmanLoading: boolean;
  onSend: () => void;
}

export const RequestComposer: React.FC<RequestComposerProps> = ({
  httpMethod,
  setHttpMethod,
  requestUrl,
  setRequestUrl,
  isPostmanLoading,
  onSend
}) => {
  return (
    <div className="flex gap-2 shrink-0">
      <select
        value={httpMethod}
        onChange={(e) => setHttpMethod(e.target.value)}
        className="bg-sidebar-bg border border-border-dark text-xs rounded px-3 py-1.5 focus:outline-none focus:border-accent text-emerald-400 font-extrabold cursor-pointer"
      >
        <option value="GET" className="text-emerald-500">
          GET
        </option>
        <option value="POST" className="text-amber-500">
          POST
        </option>
        <option value="PUT" className="text-sky-500">
          PUT
        </option>
        <option value="DELETE" className="text-red-500">
          DELETE
        </option>
      </select>
      <input
        type="text"
        placeholder="Enter API Endpoint..."
        value={requestUrl}
        onChange={(e) => setRequestUrl(e.target.value)}
        className="flex-1 bg-sidebar-bg border border-border-dark text-xs rounded px-3 py-1.5 focus:outline-none focus:border-accent text-zinc-200"
      />
      <button
        onClick={onSend}
        className="px-4 py-1.5 bg-accent/80 hover:bg-accent text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        {isPostmanLoading ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
        <span>Send</span>
      </button>
    </div>
  );
};
