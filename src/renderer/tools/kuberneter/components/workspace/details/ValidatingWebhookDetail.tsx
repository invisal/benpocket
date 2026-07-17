import type React from 'react';
import { useState } from 'react';
import { type ValidatingWebhookConfigurationData } from '../../../types/ValidatingWebhookConfigurationData';

interface ValidatingWebhookDetailProps {
  payload: ValidatingWebhookConfigurationData;
  isTab?: boolean;
}

export const ValidatingWebhookDetail: React.FC<ValidatingWebhookDetailProps> = ({
  payload,
  isTab = false
}) => {
  const [labelsExpanded, setLabelsExpanded] = useState(false);
  const [annotationsExpanded, setAnnotationsExpanded] = useState(false);

  if (!payload) {
    return (
      <div className="p-4 text-xs text-zinc-500">
        No ValidatingWebhook Configuration details available.
      </div>
    );
  }

  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <div className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Created</span>
            <span className="font-mono text-zinc-300">
              {payload.age} ago ({payload.createdTime || 'N/A'})
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Name</span>
            <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
          </div>

          {/* Labels Collapsible */}
          <div className="flex flex-col gap-0.5">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setLabelsExpanded(!labelsExpanded)}
            >
              <span className="text-[10px] text-zinc-555 uppercase flex items-center gap-1">
                Labels
                <span className="text-[9px] text-zinc-600 font-normal">
                  {labelsExpanded ? '▲' : '▼'}
                </span>
              </span>
              <span className="text-xs text-zinc-400 font-medium">{labels.length} Labels</span>
            </div>
            {labelsExpanded && labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto">
                {labels.map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-300 break-all"
                  >
                    {k}: {v}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Annotations Collapsible */}
          <div className="flex flex-col gap-0.5">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setAnnotationsExpanded(!annotationsExpanded)}
            >
              <span className="text-[10px] text-zinc-555 uppercase flex items-center gap-1">
                Annotations
                <span className="text-[9px] text-zinc-600 font-normal">
                  {annotationsExpanded ? '▲' : '▼'}
                </span>
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                {annotations.length} Annotations
              </span>
            </div>
            {annotationsExpanded && annotations.length > 0 && (
              <div className="flex flex-col gap-1 mt-1.5 max-h-32 overflow-y-auto pr-1 select-text">
                {annotations.map(([k, v]) => (
                  <div
                    key={k}
                    className="font-mono text-[10px] text-zinc-400 bg-editor-bg px-2 py-1 rounded border border-border-dark/60 truncate"
                    title={`${k}=${v}`}
                  >
                    {k}={v}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
            <span className="text-[10px] text-zinc-555 uppercase">API Version</span>
            <span className="font-mono text-zinc-300">{payload.apiVersion}</span>
          </div>
        </div>
      </div>

      {/* Webhooks List */}
      <div className="flex flex-col gap-2.5 mt-2">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Webhooks
        </span>
        {payload.webhooks.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No webhooks defined.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {payload.webhooks.map((w, idx) => (
              <div
                key={w.name + idx}
                className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-zinc-555 uppercase">Name</span>
                  <span className="font-mono text-zinc-100 font-bold break-all select-text">
                    {w.name}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-zinc-555 uppercase">Client Config</span>
                  <div className="font-mono text-zinc-300 mt-0.5 bg-black/10 p-2 rounded border border-border-dark/40">
                    {w.clientConfig.url ? (
                      <div>URL: {w.clientConfig.url}</div>
                    ) : (
                      <>
                        <div>Name: {w.clientConfig.name || '—'}</div>
                        <div>Namespace: {w.clientConfig.namespace || '—'}</div>
                        {w.clientConfig.path && <div>Path: {w.clientConfig.path}</div>}
                        {w.clientConfig.port && <div>Port: {w.clientConfig.port}</div>}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/20 pt-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Match Policy</span>
                    <span className="font-mono text-zinc-300">{w.matchPolicy}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Failure Policy</span>
                    <span className="font-mono text-zinc-300">{w.failurePolicy}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Admission Review</span>
                    <span className="font-mono text-zinc-300">
                      {w.admissionReviewVersions.join(', ')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Reinvocation Policy</span>
                    <span className="font-mono text-zinc-300">{w.reinvocationPolicy}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Side Effects</span>
                    <span className="font-mono text-zinc-300">{w.sideEffects}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Timeout Seconds</span>
                    <span className="font-mono text-zinc-300">{w.timeoutSeconds}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
                  <span className="text-[10px] text-zinc-555 uppercase">Namespace Selector</span>
                  <span className="font-mono text-zinc-300 select-text break-all">
                    {w.namespaceSelector}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-zinc-555 uppercase">Object Selector</span>
                  <span className="font-mono text-zinc-300 select-text break-all">
                    {w.objectSelector}
                  </span>
                </div>

                {w.rules.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-border/20 pt-2">
                    <span className="text-[10px] text-zinc-555 uppercase">Rules</span>
                    <div className="flex flex-col gap-2 mt-1">
                      {w.rules.map((rule, ruleIdx) => (
                        <div
                          key={ruleIdx}
                          className="text-[11px] font-mono bg-surface-3 p-2 rounded border border-border text-zinc-350"
                        >
                          <div>
                            <span className="text-zinc-555">API Groups:</span>{' '}
                            {rule.apiGroups.join(', ') || '*'}
                          </div>
                          <div>
                            <span className="text-zinc-555">API Versions:</span>{' '}
                            {rule.apiVersions.join(', ') || '*'}
                          </div>
                          <div>
                            <span className="text-zinc-555">Operations:</span>{' '}
                            {rule.operations.join(', ')}
                          </div>
                          <div>
                            <span className="text-zinc-555">Resources:</span>{' '}
                            {rule.resources.join(', ')}
                          </div>
                          <div>
                            <span className="text-zinc-555">Scope:</span> {rule.scope}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
