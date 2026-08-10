import { useState, useEffect } from 'react';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import type { HelmCheckResult } from '../../../../../../preload/kuberneter/api';
import { HelmStatus } from './HelmStatus';
import { HelmPathConfig } from './HelmPathConfig';
import { HelmRepoManagement } from './HelmRepoManagement';
import { HelmInstallGuide } from './HelmInstallGuide';

export function HelmSettings() {
  const helmPath = useKuberneterStore((s) => s.kuberneterHelmPath);
  const setHelmPath = useKuberneterStore((s) => s.setKuberneterHelmPath);

  const [inputPath, setInputPath] = useState(helmPath);
  const [checkResult, setCheckResult] = useState<HelmCheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    window.kuberneter
      .checkHelm(helmPath)
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
  }, [helmPath]);

  async function runCheck(pathToCheck?: string) {
    setLoading(true);
    try {
      const res = await window.kuberneter.checkHelm(pathToCheck);
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
      const selected = await window.kuberneter.selectHelmFile();
      if (selected) {
        setInputPath(selected);
        setHelmPath(selected);
      }
    } catch (err) {
      console.warn('Failed to select file:', err);
    }
  }

  function handleSavePath() {
    setHelmPath(inputPath.trim());
  }

  function handleReset() {
    setInputPath('');
    setHelmPath('');
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <HelmStatus
        loading={loading}
        checkResult={checkResult}
        inputPath={inputPath}
        onRunCheck={runCheck}
      />
      <HelmPathConfig
        inputPath={inputPath}
        helmPath={helmPath}
        loading={loading}
        actualPath={checkResult?.path}
        setInputPath={setInputPath}
        onBrowse={handleBrowse}
        onSavePath={handleSavePath}
        onReset={handleReset}
      />
      <HelmInstallGuide />
      {checkResult?.available && <HelmRepoManagement />}
    </div>
  );
}
