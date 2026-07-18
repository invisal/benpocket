import type React from 'react';
import { useCallback } from 'react';
import { type NetworkPolicyData } from '../../../types/NetworkPolicyData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { Age } from '../../Age';

interface NetworkPolicyDetailProps {
  payload: NetworkPolicyData;
  isTab?: boolean;
}

export const NetworkPolicyDetail: React.FC<NetworkPolicyDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  const handleNamespaceClick = useCallback(() => {
    if (payload?.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  }, [payload, activeInstanceId, setNamespace]);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Network Policy details available.</div>;
  }

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const podSelectors = payload.podSelectorStr
    ? payload.podSelectorStr.split(', ').filter((s) => s && s !== '{}' && s !== '—')
    : [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age timestamp={payload.creationTimestamp} /> ago ({payload.createdTime || 'N/A'})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {payload.ns}
        </span>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1 select-text w-full">
          {annotations.map(([k, v]) => (
            <div
              key={k}
              className="flex flex-col gap-0.5 bg-surface-3 border border-border/60 rounded p-1.5 font-mono text-[10px] w-full"
            >
              <span className="text-zinc-400 font-semibold break-all">{k}</span>
              <span className="text-zinc-350 break-all whitespace-normal">{v}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'podSelector',
      name: 'Pod Selector',
      value:
        podSelectors.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {podSelectors.map((sel) => (
              <span
                key={sel}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350"
              >
                {sel}
              </span>
            ))}
          </div>
        ) : (
          <span className="italic text-zinc-500">Selects all pods ({})</span>
        )
    }
  ];

  const showsIngress = payload.policyTypes.includes('Ingress');
  const showsEgress = payload.policyTypes.includes('Egress');

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Ingress Section */}
      {showsIngress && (
        <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            Ingress
          </span>

          {payload.ingressRules.length === 0 ? (
            <div className="text-xs text-zinc-400 pl-1 py-1 italic border-b border-border/10">
              Isolating Ingress traffic: No ingress allowed (block all incoming traffic)
            </div>
          ) : (
            <div className="flex flex-col border border-border/45 rounded overflow-hidden bg-surface-2/15 select-text">
              {payload.ingressRules.map((rule, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col text-xs text-zinc-300 p-2.5 ${
                    idx > 0 ? 'border-t border-border-dark/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between py-1 border-b border-border/10">
                    <span className="font-semibold text-zinc-400">Ports</span>
                    <span className="font-mono text-zinc-200">
                      {rule.ports && rule.ports.length > 0 ? rule.ports.join(', ') : 'All Ports'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    <span className="font-semibold text-zinc-450">From</span>
                    {rule.peers && rule.peers.length > 0 ? (
                      <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-accent/20">
                        {rule.peers.map((peer, pIdx) => {
                          const hasIpBlock = !!peer.ipBlock;
                          const hasNsSel = !!peer.namespaceSelector;
                          const hasPodSel = !!peer.podSelector;

                          return (
                            <div key={pIdx} className="flex flex-col gap-1">
                              {hasIpBlock && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">ipBlock</span>
                                  <span className="font-mono text-zinc-300">
                                    cidr: {peer.ipBlock?.cidr}
                                    {peer.ipBlock?.except && peer.ipBlock.except.length > 0
                                      ? `, except: ${peer.ipBlock.except.join(', ')}`
                                      : ''}
                                  </span>
                                </div>
                              )}
                              {hasNsSel && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">namespaceSelector</span>
                                  <span className="font-mono text-zinc-300">
                                    • {peer.namespaceSelector}
                                  </span>
                                </div>
                              )}
                              {hasPodSel && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">podSelector</span>
                                  <span className="font-mono text-zinc-300">
                                    • {peer.podSelector}
                                  </span>
                                </div>
                              )}
                              {!hasIpBlock && !hasNsSel && !hasPodSel && (
                                <span className="text-zinc-500 italic">All sources ({})</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic pl-2">All sources allowed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Egress Section */}
      {showsEgress && (
        <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            Egress
          </span>

          {payload.egressRules.length === 0 ? (
            <div className="text-xs text-zinc-400 pl-1 py-1 italic border-b border-border/10">
              Isolating Egress traffic: No egress allowed (block all outgoing traffic)
            </div>
          ) : (
            <div className="flex flex-col border border-border/45 rounded overflow-hidden bg-surface-2/15 select-text">
              {payload.egressRules.map((rule, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col text-xs text-zinc-300 p-2.5 ${
                    idx > 0 ? 'border-t border-border-dark/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between py-1 border-b border-border/10">
                    <span className="font-semibold text-zinc-400">Ports</span>
                    <span className="font-mono text-zinc-200">
                      {rule.ports && rule.ports.length > 0 ? rule.ports.join(', ') : 'All Ports'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    <span className="font-semibold text-zinc-450">To</span>
                    {rule.peers && rule.peers.length > 0 ? (
                      <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-accent/20">
                        {rule.peers.map((peer, pIdx) => {
                          const hasIpBlock = !!peer.ipBlock;
                          const hasNsSel = !!peer.namespaceSelector;
                          const hasPodSel = !!peer.podSelector;

                          return (
                            <div key={pIdx} className="flex flex-col gap-1">
                              {hasIpBlock && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">ipBlock</span>
                                  <span className="font-mono text-zinc-300">
                                    cidr: {peer.ipBlock?.cidr}
                                    {peer.ipBlock?.except && peer.ipBlock.except.length > 0
                                      ? `, except: ${peer.ipBlock.except.join(', ')}`
                                      : ''}
                                  </span>
                                </div>
                              )}
                              {hasNsSel && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">namespaceSelector</span>
                                  <span className="font-mono text-zinc-300">
                                    • {peer.namespaceSelector}
                                  </span>
                                </div>
                              )}
                              {hasPodSel && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">podSelector</span>
                                  <span className="font-mono text-zinc-300">
                                    • {peer.podSelector}
                                  </span>
                                </div>
                              )}
                              {!hasIpBlock && !hasNsSel && !hasPodSel && (
                                <span className="text-zinc-500 italic">All targets ({})</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic pl-2">All targets allowed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5 font-sans">No events found</div>
      </div>
    </div>
  );
};
