import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { assertPublicUrl, fetchTextPinned, isPrivateAddress } from './url-guard'

describe('isPrivateAddress', () => {
  it.each([
    // IPv4 private / reserved / non-routable
    '0.0.0.0',
    '0.1.2.3',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1',
    '100.127.255.254',
    '127.0.0.1',
    '127.255.255.254',
    '169.254.169.254', // cloud metadata
    '172.16.0.1',
    '172.31.255.254',
    '192.0.0.5',
    '192.0.2.10',
    '192.168.1.1',
    '198.18.0.5',
    '198.19.255.1',
    '198.51.100.7',
    '203.0.113.9',
    '240.0.0.1',
    '255.255.255.255',
    // IPv6
    '::',
    '::1',
    '64:ff9b::1',
    '100::1',
    '2001:db8::1',
    '2002:0a00:0001::', // 6to4 embedding 10.0.0.1
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    // IPv4-mapped IPv6, dotted and hex forms
    '::ffff:10.0.0.1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:a00:1', // hex for 10.0.0.1
    '::ffff:7f00:1', // hex for 127.0.0.1
  ])('rejects %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1', // just outside 172.16/12
    '172.15.255.254',
    '192.169.1.1', // just outside 192.168/16
    '100.128.0.1', // just outside CGNAT 100.64/10
    '2606:4700:4700::1111',
    '2a00:1450:4001::1',
    '::ffff:8.8.8.8', // mapped, but a public v4
  ])('allows %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false)
  })
})

describe('assertPublicUrl', () => {
  it.each([
    'not a url',
    'ftp://example.com/file',
    'file:///etc/passwd',
    'http://127.0.0.1:8080/',
    'https://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[::ffff:10.0.0.1]/',
    'http://2130706433/', // integer-encoded 127.0.0.1
    'http://0177.0.0.1/', // octal-encoded 127.0.0.1
    'http://localhost:3000/',
    'http://printer.local/',
    'http://user:pass@example.com/',
  ])('rejects %s', async (raw) => {
    await expect(assertPublicUrl(raw)).rejects.toThrow()
  })

  it('allows a public IP literal and returns it as the pin', async () => {
    const validated = await assertPublicUrl('https://8.8.8.8/dns-query')
    expect(validated.url.hostname).toBe('8.8.8.8')
    expect(validated.address).toBe('8.8.8.8')
    expect(validated.family).toBe(4)
  })
})

describe('fetchTextPinned', () => {
  let server: Server
  let port: number
  let sawHost: string | null = null

  beforeAll(async () => {
    server = createServer((req, res) => {
      sawHost = req.headers.host ?? null
      if (req.url?.startsWith('/redirect')) {
        res.writeHead(302, { location: 'https://example.org/' })
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body>hello</body></html>')
    })
    await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
    port = (server.address() as { port: number }).port
  })

  afterAll(async () => {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()))
  })

  it('connects to the pinned address while preserving the real Host header', async () => {
    // example.test does not resolve to 127.0.0.1 — the only way this
    // fetch can succeed is the pin. A re-resolving implementation
    // would fail (or, in a rebinding attack, connect to the wrong host).
    const text = await fetchTextPinned(
      {
        url: new URL(`http://example.test:${port}/page`),
        address: '127.0.0.1',
        family: 4,
      },
      { timeoutMs: 3000, maxBytes: 10_000 },
    )
    expect(text).toContain('hello')
    expect(sawHost).toBe(`example.test:${port}`)
  })

  it('rejects redirects with an actionable error', async () => {
    await expect(
      fetchTextPinned(
        { url: new URL(`http://example.test:${port}/redirect`), address: '127.0.0.1', family: 4 },
        { timeoutMs: 3000, maxBytes: 10_000 },
      ),
    ).rejects.toThrow(/Redirects are not allowed/)
  })
})
