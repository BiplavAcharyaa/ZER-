const os = require('os');

/**
 * Detects the machine's primary LAN IPv4 address.
 * Skips internal/loopback interfaces and virtual adapters where possible.
 * Never hardcodes an address — always derived dynamically at runtime.
 */
function getLanIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue;

    for (const addr of addresses) {
      if (addr.family !== 'IPv4' || addr.internal) continue;

      // Deprioritize common virtual adapter names (VPNs, Hyper-V, VMware, WSL, etc.)
      const lowerName = name.toLowerCase();
      const looksVirtual =
        lowerName.includes('vethernet') ||
        lowerName.includes('vmware') ||
        lowerName.includes('virtualbox') ||
        lowerName.includes('hyper-v') ||
        lowerName.includes('wsl') ||
        lowerName.includes('loopback') ||
        lowerName.includes('tailscale') ||
        lowerName.includes('vpn');

      candidates.push({ name, address: addr.address, looksVirtual });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const preferred = candidates.find((c) => !c.looksVirtual);
  return (preferred || candidates[0]).address;
}

module.exports = { getLanIpAddress };
