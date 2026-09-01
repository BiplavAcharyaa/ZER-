const os = require('os');

/**
 * Takes a snapshot of cumulative CPU tick counts across all cores.
 */
function snapshotCpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  return { idle, total };
}

/**
 * Computes CPU usage percentage by comparing two snapshots taken
 * `sampleMs` apart. This avoids adding a native dependency just to
 * read CPU load.
 */
function getCpuUsagePercent(sampleMs = 200) {
  return new Promise((resolve) => {
    const start = snapshotCpuTimes();

    setTimeout(() => {
      const end = snapshotCpuTimes();
      const idleDelta = end.idle - start.idle;
      const totalDelta = end.total - start.total;

      const usage = totalDelta > 0 ? 1 - idleDelta / totalDelta : 0;
      resolve(Math.round(Math.max(0, Math.min(1, usage)) * 100));
    }, sampleMs);
  });
}

function getMemoryStats() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usedPercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
    totalGB: Number((totalBytes / 1024 ** 3).toFixed(2)),
    usedGB: Number((usedBytes / 1024 ** 3).toFixed(2)),
  };
}

function getUptimeSeconds() {
  return os.uptime();
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
}

async function getSystemStatus() {
  const [cpuPercent, memory] = await Promise.all([
    getCpuUsagePercent(),
    Promise.resolve(getMemoryStats()),
  ]);

  const uptimeSeconds = getUptimeSeconds();

  return {
    cpu: { usagePercent: cpuPercent },
    memory,
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    timestamp: Date.now(),
  };
}

module.exports = { getSystemStatus, getCpuUsagePercent, getMemoryStats, getUptimeSeconds };
