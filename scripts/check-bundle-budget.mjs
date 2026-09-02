// Fails the build when the client JS grows past budget. Run after `vite build`.
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const dir = ".output/public/assets"
const LARGEST_KB = 500 // the lazily loaded barcode scanner (zxing) is ~470 kB
const TOTAL_KB = 1700
const files = readdirSync(dir).filter((file) => file.endsWith(".js"))
const sizes = files.map((file) => [file, statSync(join(dir, file)).size / 1024])
const [largestName, largest] = sizes.sort((a, b) => b[1] - a[1])[0]
const total = sizes.reduce((sum, [, size]) => sum + size, 0)
console.log(
  `client js: ${total.toFixed(0)} kB total, largest ${largestName} ${largest.toFixed(0)} kB`
)
if (largest > LARGEST_KB || total > TOTAL_KB) {
  console.error(
    `bundle budget exceeded (largest ≤ ${LARGEST_KB} kB, total ≤ ${TOTAL_KB} kB)`
  )
  process.exit(1)
}
