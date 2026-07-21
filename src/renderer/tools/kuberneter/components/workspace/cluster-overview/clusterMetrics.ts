import { parseCpu, parseMemoryToMiB } from '../../../utils/parseQuantity';
import type { NodeResource, NodeMetric, PodResource } from './types';

export function getCapacitySums(nodes: NodeResource[]) {
  let capacityCpu = 0;
  let capacityMem = 0;
  let capacityPods = 0;

  let allocatableCpu = 0;
  let allocatableMem = 0;
  let allocatablePods = 0;

  nodes.forEach((node) => {
    const cap = node.status?.capacity || {};
    const alloc = node.status?.allocatable || {};

    capacityCpu += parseCpu(cap.cpu);
    capacityMem += parseMemoryToMiB(cap.memory);
    capacityPods += parseInt(cap.pods || '0', 10);

    allocatableCpu += parseCpu(alloc.cpu);
    allocatableMem += parseMemoryToMiB(alloc.memory);
    allocatablePods += parseInt(alloc.pods || '0', 10);
  });

  return {
    capacityCpu: capacityCpu / 1000, // milli-cores → cores
    capacityMem: capacityMem / 1024, // MiB → GiB
    capacityPods,
    allocatableCpu: allocatableCpu / 1000,
    allocatableMem: allocatableMem / 1024,
    allocatablePods
  };
}

export function getWorkloadMetrics(pods: PodResource[], selectedNamespace: string) {
  let requestsCpu = 0;
  let requestsMem = 0;
  let limitsCpu = 0;
  let limitsMem = 0;

  const podsStatus = {
    total: 0,
    running: 0,
    failed: 0,
    pending: 0,
    succeeded: 0,
    unknown: 0
  };

  pods.forEach((pod) => {
    if (selectedNamespace === 'All Namespaces' || pod.metadata?.namespace === selectedNamespace) {
      podsStatus.total++;
      const phase = (pod.status?.phase || 'unknown').toLowerCase();
      if (phase === 'running') podsStatus.running++;
      else if (phase === 'failed') podsStatus.failed++;
      else if (phase === 'pending') podsStatus.pending++;
      else if (phase === 'succeeded') podsStatus.succeeded++;
      else podsStatus.unknown++;

      // Sum container limits and requests
      const containers = pod.spec?.containers || [];
      containers.forEach((c) => {
        const res = c.resources || {};
        const req = res.requests || {};
        const lim = res.limits || {};

        requestsCpu += parseCpu(req.cpu);
        requestsMem += parseMemoryToMiB(req.memory);
        limitsCpu += parseCpu(lim.cpu);
        limitsMem += parseMemoryToMiB(lim.memory);
      });
    }
  });

  return {
    requestsCpu: requestsCpu / 1000, // milli-cores → cores
    requestsMem: requestsMem / 1024, // MiB → GiB
    limitsCpu: limitsCpu / 1000,
    limitsMem: limitsMem / 1024,
    podsStatus
  };
}

export function getLiveMetrics(
  nodeMetrics: Record<string, NodeMetric>,
  capacityCpu: number,
  capacityMem: number
) {
  let liveCpuMillicores = 0;
  let liveMemMiB = 0;

  Object.values(nodeMetrics).forEach((metric) => {
    liveCpuMillicores += parseCpu(metric.cpu);
    liveMemMiB += parseMemoryToMiB(metric.memory);
  });

  // CPU: milli-cores → cores
  const usageCpu = liveCpuMillicores / 1000;
  // Memory: MiB → GiB
  const usageMem = liveMemMiB / 1024;

  const cpuPct = capacityCpu > 0 ? (usageCpu / capacityCpu) * 100 : 0;
  const memPct = capacityMem > 0 ? (usageMem / capacityMem) * 100 : 0;

  return { usageCpu, usageMem, cpuPct, memPct };
}
