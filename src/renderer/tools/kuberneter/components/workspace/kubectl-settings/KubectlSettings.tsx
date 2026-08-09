import { useState, useEffect } from 'react';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import type { KubectlCheckResult } from '../../../../../../preload/kuberneter/api';
import { KubectlStatus } from './KubectlStatus';
import { KubectlPathConfig } from './KubectlPathConfig';
import { KubectlInstallGuide } from './KubectlInstallGuide';

export function KubectlSettings() {
  const kubectlPath = useKuberneterStore((s) => s.kuberneterKubectlPath);
  const setKubectlPath = useKuberneterStore((s) => s.setKuberneterKubectlPath);

  const [inputPath, setInputPath] = useState(kubectlPath);
  const [checkResult, setCheckResult] = useState<KubectlCheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    window.kuberneter
      .checkKubectl(kubectlPath)
      .then((res) => {
        if (isMounted) {
          setCheckResult(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setCheckResult({
            available: false,
            error: err instanceof Error ? err.message : String(err)
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [kubectlPath]);

  async function runCheck(pathToCheck?: string) {
    setLoading(true);
    try {
      const res = await window.kuberneter.checkKubectl(pathToCheck);
      setCheckResult(res);
    } catch (err) {
      setCheckResult({
        available: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleBrowse() {
    try {
      const selected = await window.kuberneter.selectKubectlFile();
      if (selected) {
        setInputPath(selected);
        setKubectlPath(selected);
      }
    } catch (err) {
      console.warn('Failed to select file:', err);
    }
  }

  function handleSavePath() {
    setKubectlPath(inputPath.trim());
  }

  function handleReset() {
    setInputPath('');
    setKubectlPath('');
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <KubectlStatus
        loading={loading}
        checkResult={checkResult}
        inputPath={inputPath}
        onRunCheck={runCheck}
      />
      <KubectlPathConfig
        inputPath={inputPath}
        kubectlPath={kubectlPath}
        loading={loading}
        actualPath={checkResult?.path}
        setInputPath={setInputPath}
        onBrowse={handleBrowse}
        onSavePath={handleSavePath}
        onReset={handleReset}
      />
      <KubectlInstallGuide />
    </div>
  );
}
