import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { SectionLabel } from '../kubectl-settings/SectionLabel';

const PRESET_REPOS = [
  {
    name: 'bitnami',
    url: 'https://charts.bitnami.com/bitnami',
    label: 'Bitnami',
    description: 'Popular apps packaged for Kubernetes'
  },
  {
    name: 'prometheus-community',
    url: 'https://prometheus-community.github.io/helm-charts',
    label: 'Prometheus Community',
    description: 'Prometheus & monitoring stack charts'
  },
  {
    name: 'ingress-nginx',
    url: 'https://kubernetes.github.io/ingress-nginx',
    label: 'Ingress NGINX',
    description: 'NGINX Ingress Controller for Kubernetes'
  }
];

export const HelmRepoManagement: React.FC = () => {
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pendingRepo, setPendingRepo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.kuberneter.helmListRepos();
      if (Array.isArray(res)) {
        setAddedNames(new Set(res.map((r) => r.name)));
      } else {
        setAddedNames(new Set());
      }
    } catch {
      setAddedNames(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRepos();
  }, [fetchRepos]);

  const handleToggle = async (name: string, url: string, isAdded: boolean) => {
    setPendingRepo(name);
    setErrorMsg(null);
    try {
      if (isAdded) {
        const res = await window.kuberneter.helmRemoveRepo(name);
        if (res && 'error' in res && res.error) {
          setErrorMsg(res.error);
        } else {
          setAddedNames((prev) => {
            const next = new Set(prev);
            next.delete(name);
            return next;
          });
        }
      } else {
        const res = await window.kuberneter.helmAddRepo(name, url);
        if (res && 'error' in res && res.error) {
          setErrorMsg(res.error);
        } else {
          setAddedNames((prev) => new Set([...prev, name]));
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingRepo(null);
    }
  };

  const handleUpdateRepos = async () => {
    setUpdating(true);
    setErrorMsg(null);
    try {
      const res = await window.kuberneter.helmUpdateRepos();
      if (res && 'error' in res && res.error) {
        setErrorMsg(res.error);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <SectionLabel>Chart Repositories</SectionLabel>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUpdateRepos}
          disabled={updating || loading || addedNames.size === 0}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          title="Update all repository indexes (helm repo update)"
        >
          <RefreshCw className={`size-3 mr-1.5 ${updating ? 'animate-spin' : ''}`} />
          Update Indexes
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Enable repositories to make their charts available in the Charts view.
      </p>

      <div className="flex flex-col gap-1.5">
        {PRESET_REPOS.map((repo) => {
          const isAdded = addedNames.has(repo.name);
          const isPending = pendingRepo === repo.name;

          return (
            <label
              key={repo.name}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors select-none ${
                isAdded
                  ? 'bg-accent/5 border-accent/30 hover:bg-accent/10'
                  : 'bg-surface-2 border-border hover:bg-surface-3'
              } ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
            >
              {/* Checkbox */}
              <div className="relative shrink-0">
                {isPending ? (
                  <Loader2 className="size-4 animate-spin text-accent" />
                ) : (
                  <input
                    type="checkbox"
                    checked={isAdded}
                    disabled={loading}
                    onChange={() => handleToggle(repo.name, repo.url, isAdded)}
                    className="sr-only"
                  />
                )}
                {!isPending && (
                  <div
                    onClick={() => !loading && handleToggle(repo.name, repo.url, isAdded)}
                    className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${
                      isAdded
                        ? 'bg-accent border-accent'
                        : 'bg-transparent border-border-dark hover:border-accent/60'
                    }`}
                  >
                    {isAdded && (
                      <svg
                        viewBox="0 0 10 8"
                        className="size-2.5 text-white fill-none stroke-current stroke-2"
                      >
                        <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                )}
              </div>

              {/* Repo info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{repo.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {repo.name}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{repo.description}</p>
              </div>

              {/* Status badge */}
              {isAdded && !isPending && (
                <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                  Added
                </span>
              )}
            </label>
          );
        })}
      </div>

      {errorMsg && <p className="text-red-400 text-xs leading-relaxed">{errorMsg}</p>}
    </div>
  );
};
