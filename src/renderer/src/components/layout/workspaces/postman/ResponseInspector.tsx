import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ResponseInspectorProps {
  postmanResponse: any;
  isPostmanLoading: boolean;
}

export const ResponseInspector: React.FC<ResponseInspectorProps> = ({
  postmanResponse,
  isPostmanLoading
}) => {
  return (
    <div className="flex-1 bg-sidebar-bg border border-border-dark rounded-lg overflow-hidden flex flex-col min-h-0">
      <div className="bg-editor-bg border-b border-border-dark px-3 py-2 flex items-center justify-between text-xs shrink-0 select-none">
        <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
          Response Body
        </span>
        {postmanResponse && (
          <div className="flex gap-3 text-[10px]">
            <span className="text-emerald-500 font-bold">STATUS: 200 OK</span>
            <span className="text-zinc-500">TIME: 124 ms</span>
            <span className="text-zinc-550">SIZE: 1.1 KB</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 font-mono text-xs text-zinc-400 overflow-auto select-text">
        {isPostmanLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-650">
            <RefreshCw size={24} className="animate-spin" />
            <span>Loading endpoint payload...</span>
          </div>
        ) : postmanResponse ? (
          <pre className="text-zinc-400 leading-relaxed">
            &#123;
            <br />
            &nbsp;&nbsp;<span className="text-emerald-400">"id"</span>: {postmanResponse.id},
            <br />
            &nbsp;&nbsp;<span className="text-emerald-400">"node_id"</span>:{' '}
            <span className="text-amber-500">"{postmanResponse.node_id}"</span>,
            <br />
            &nbsp;&nbsp;<span className="text-emerald-400">"name"</span>:{' '}
            <span className="text-amber-500">"{postmanResponse.name}"</span>,
            <br />
            &nbsp;&nbsp;<span className="text-emerald-400">"full_name"</span>:{' '}
            <span className="text-amber-500">"{postmanResponse.full_name}"</span>,
            <br />
            &nbsp;&nbsp;<span className="text-emerald-400">"private"</span>:{' '}
            {String(postmanResponse.private)},
            <br />
            &nbsp;&nbsp;<span className="text-emerald-400">"owner"</span>: &#123;
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-emerald-400">"login"</span>:{' '}
            <span className="text-amber-500">"{postmanResponse.owner.login}"</span>,
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-emerald-400">"id"</span>:{' '}
            {postmanResponse.owner.id},
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-emerald-400">"type"</span>:{' '}
            <span className="text-amber-500">"{postmanResponse.owner.type}"</span>
            <br />
            &nbsp;&nbsp;&#125;,
            <br />
            &nbsp;&nbsp;<span className="text-emerald-400">"stargazers_count"</span>:{' '}
            <span className="text-sky-400">{postmanResponse.stargazers_count}</span>,
            <br />
            &nbsp;&nbsp;<span className="text-emerald-400">"description"</span>:{' '}
            <span className="text-amber-500">"{postmanResponse.description}"</span>
            <br />
            &#125;
          </pre>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650">
            <AlertCircle size={20} />
            <span>Enter request parameters and click Send to inspect results.</span>
          </div>
        )}
      </div>
    </div>
  );
};
