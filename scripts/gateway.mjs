// `npm run gateway` — runs a Fletcher gateway bridging Nexus's DDS domain to
// the viewer (ws://localhost:9090). Downloads the pinned release on first
// run and caches it under ~/.cache/fletcher-gateway/<version>/.
//
// Environment:
//   FLETCHER_DOMAIN_ID  DDS domain Nexus publishes on (default 0)
//   GATEWAY_PORT        port to listen on (default 9090; match VITE_GATEWAY_URL)
//   GATEWAY_PROVIDER_CONFIG  Fast DDS profiles file (default gateway-profiles.xml
//                       next to this script: best-effort readers, which Nexus's
//                       best-effort live points need to match at all)
//
// Ctrl+C, or typing `stop`, shuts the gateway down cleanly.
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Matches @eiva/fletcher-gateway-client in package.json.
const VERSION = '0.5.0-alpha'
const ASSETS = { win32: 'gateway-windows.zip', linux: 'gateway-linux.tar.gz' }
const EXE = process.platform === 'win32' ? 'gateway.exe' : 'gateway'

const domainId = process.env.FLETCHER_DOMAIN_ID ?? '0'
const port = process.env.GATEWAY_PORT ?? '9090'
const providerConfig =
  process.env.GATEWAY_PROVIDER_CONFIG ?? join(dirname(fileURLToPath(import.meta.url)), 'gateway-profiles.xml')

function findExe(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isFile() && entry.name === EXE) return path
    if (entry.isDirectory()) {
      const found = findExe(path)
      if (found) return found
    }
  }
  return null
}

async function install(dir) {
  const asset = ASSETS[process.platform]
  if (!asset) throw new Error(`No Fletcher gateway release for ${process.platform}`)
  const url = `https://github.com/eivacom/Fletcher/releases/download/gateway-v${VERSION}/${asset}`
  console.log(`[gateway] downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  // Into a fresh folder, so a half-finished earlier attempt can't linger.
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const archive = join(dir, asset)
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()))
  // tar unpacks both: Windows 10+ ships bsdtar, which reads zip too. Named
  // by path there, as Git Bash puts its own GNU tar (no zip, and it reads
  // "C:" as a host name) first on PATH.
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
  execFileSync(tar, ['-xf', archive, '-C', dir], { stdio: 'inherit' })
  rmSync(archive)
}

const dir = join(homedir(), '.cache', 'fletcher-gateway', VERSION)
let exe = existsSync(dir) ? findExe(dir) : null
if (!exe) {
  await install(dir)
  exe = findExe(dir)
  if (!exe) throw new Error(`No ${EXE} in the ${VERSION} release archive`)
}

const args = ['--port', port, '--bind-address', '127.0.0.1', '--provider', 'fastdds', '--domain-id', domainId, '--provider-config', providerConfig]
console.log(`[gateway] ${exe} ${args.join(' ')}`)
const child = spawn(exe, args, { stdio: ['pipe', 'inherit', 'inherit'] })

// The gateway stops on a `stop` line on stdin: the same on every platform.
const stop = () => child.stdin.write('stop\n')
// end: false — the gateway also stops when its stdin ends, which would make
// it quit at once wherever this script's own stdin is empty.
process.stdin.pipe(child.stdin, { end: false })
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('exit', code => process.exit(code ?? 0))
