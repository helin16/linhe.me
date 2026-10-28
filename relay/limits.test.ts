import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressCounter, addressKey, tokenBucket } from './limits.ts';

test('token bucket allows rate per second, then refills', () => {
  let now = 0;
  const take = tokenBucket(3, () => now);
  assert.deepEqual([take(), take(), take(), take()], [true, true, true, false]);
  now = 500;
  assert.equal(take(), true); // half a second refills 1.5 tokens
  assert.equal(take(), false);
  now = 10_000;
  assert.deepEqual([take(), take(), take(), take()], [true, true, true, false]); // never more than the burst
});

test('address counter refuses past the limit and forgets free addresses', () => {
  const a = addressCounter(2);
  assert.deepEqual([a.add('x'), a.add('x'), a.add('x'), a.add('y')], [true, true, false, true]);
  a.remove('x');
  assert.equal(a.add('x'), true);
  a.remove('x'); a.remove('x'); a.remove('y');
  assert.equal(a.size(), 0); // nothing kept about addresses with no connections
  a.remove('never-seen'); // harmless
  assert.equal(a.size(), 0);
});

test('addresses count per IPv4 address and per IPv6 /64', () => {
  assert.equal(addressKey('203.0.113.9'), '203.0.113.9');
  assert.equal(addressKey('::ffff:203.0.113.9'), '203.0.113.9');
  assert.equal(addressKey('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.equal(addressKey('2001:db8:1:2:ffff:ffff:ffff:ffff'), '2001:db8:1:2::/64');
  assert.equal(addressKey('2001:0db8:0001:0002::'), '2001:db8:1:2::/64');
  assert.equal(addressKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(addressKey('::1'), '0:0:0:0::/64');
});

test("malformed addresses can't crash the counter", () => {
  for (const bad of ['1:2:3:4:5:6:7:8::9', ':::', '::::::::::', 'zz::1', '']) assert.equal(typeof addressKey(bad), 'string', bad);
});
