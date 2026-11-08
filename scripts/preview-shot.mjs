// Takes screenshots of static/preview.html in a headless browser: the timeline on a UAT day, the
// timeline on a development day, and the step form. They go to out/preview/, and the Marketplace
// screenshots in images/ are copied from them by hand.
//
//   npm run preview
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { chromium } from "playwright"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "out", "preview")
mkdirSync(outDir, { recursive: true })
const page = pathToFileURL(join(root, "static", "preview.html")).href

const shots = [
  { name: "uat-day", query: "?today=2026-11-24" },
  { name: "development-day", query: "?today=2026-11-13" },
  { name: "editor", query: "?show=editor" },
]

// The installed Google Chrome, headless with a profile of its own, so no browser download is needed.
const browser = await chromium.launch({ channel: "chrome" })
try {
  const tab = await browser.newPage({ viewport: { width: 1040, height: 900 } })
  const errors = []
  tab.on("pageerror", error => errors.push(String(error)))
  for (const shot of shots) {
    await tab.goto(page + shot.query)
    for (const theme of ["light", "dark"]) {
      const file = join(outDir, `${shot.name}-${theme}.png`)
      await tab.locator(`#${theme}`).screenshot({ path: file })
      console.log(file)
    }
  }
  if (errors.length > 0) {
    console.error(`Page errors:\n${errors.join("\n")}`)
    process.exitCode = 1
  }
} finally {
  await browser.close()
}
