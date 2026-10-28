/** Allows `rate` messages per second (and a burst of `rate`); returns a function that says whether one more may pass. */
export function tokenBucket(rate: number, now: () => number = Date.now) {
  let tokens = rate, last = now();
  return () => {
    const t = now();
    tokens = Math.min(rate, tokens + ((t - last) / 1000) * rate);
    last = t;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

/** The key an address counts under: IPv4 as is, IPv6 by its /64 (one household or host gets a whole /64). */
export function addressKey(address: string) {
  const ip = address.replace(/^::ffff:(?=\d+\.)/, ''); // IPv4 written as IPv6
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [], right = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return groups.slice(0, 4).map(g => (parseInt(g, 16) || 0).toString(16)).join(':') + '::/64';
}

/** Counts open connections per address; forgets an address as soon as it has none (nothing kept). */
export function addressCounter(max: number) {
  const open = new Map<string, number>();
  return {
    add(address: string) {
      const n = open.get(address) ?? 0;
      if (n >= max) return false;
      open.set(address, n + 1);
      return true;
    },
    remove(address: string) {
      const n = open.get(address);
      if (n === undefined) return;
      if (n <= 1) open.delete(address); else open.set(address, n - 1);
    },
    size: () => open.size,
  };
}
