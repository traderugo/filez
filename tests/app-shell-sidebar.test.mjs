/**
 * Pins that the station shell actually mounts its sidebar.
 *
 * StationSidebar shipped complete and unreachable: AppShell imported it, declared
 * `drawerOpen`, and then returned Header + main with neither used. The hamburger was
 * missing for the same reason — Header draws it only when handed `onMenu`, and AppShell
 * passed no props at all.
 *
 * Both failures are silent. An unused import is legal, a guarded button simply does not
 * draw, and nothing throws. The only signal was a person looking for a sidebar that was
 * never there, which is why this is pinned in a test rather than left to the eye.
 *
 * This reads the source instead of rendering it: the defect is whether the wiring is
 * written, so a source assertion catches it with no DOM and no React test runner.
 *
 * Run: node tests/app-shell-sidebar.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8')

const shell = read('components', 'AppShell.js')
const header = read('components', 'Header.js')
const sidebar = read('components', 'StationSidebar.js')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

console.log('AppShell mounts the station sidebar')

check('renders <StationSidebar', /<StationSidebar/.test(shell),
  'imported but never rendered is exactly the bug this pins')

check('drives it with the drawer state', /<StationSidebar[^>]*open=\{drawerOpen\}/s.test(shell))

check('gives the drawer a way to close', /<StationSidebar[^>]*onClose=\{/s.test(shell))

check('hands Header onMenu so the hamburger draws', /<Header\s+onMenu=\{/.test(shell))

// useSearchParams suspends. Header is already wrapped for this reason; the sidebar calls it
// too, so an unwrapped mount would opt the whole route out of static rendering.
check('wraps the sidebar in Suspense', /<Suspense[^>]*>\s*<StationSidebar/s.test(shell))

// The desktop aside is `shrink-0` in normal flow, so its parent has to be a row and the
// content column has to be allowed to shrink. Without min-w-0 a wide table pushes the
// sidebar off screen instead of scrolling inside its own column.
check('lays the shell out as a row', /className="flex min-h-screen"/.test(shell))
check('lets the content column shrink', /flex-1 min-w-0/.test(shell))

console.log('\nThe pieces it depends on still look the way it assumes')

check('Header still gates the hamburger on onMenu', /onMenu\s*&&/.test(header),
  'if this guard goes, the assertion above stops proving anything')

check('StationSidebar still takes { open, onClose }',
  /export default function StationSidebar\(\{\s*open,\s*onClose\s*\}\)/.test(sidebar))

check('StationSidebar still self-hides off-station', /if \(!stationId\) return null/.test(sidebar),
  'this is what keeps it out of non-station pages without AppShell branching')

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
