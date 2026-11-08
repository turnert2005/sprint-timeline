// A local preview of the tab with sample sprints, in light and dark, for a check on screen and for
// the Marketplace screenshots. It loads no SDK and calls nothing.

import { editorHtml } from "./editor"
import { DEFAULT_CADENCE, sprintTimeline, type SprintInput, type TeamCadence, type Weekday } from "./model"
import { escapeHtml, timelineHtml } from "./render"

const MON_FRI: Weekday[] = [1, 2, 3, 4, 5]
const S22: SprintInput = { id: "22", name: "Sprint 22", start: "2026-11-09", finish: "2026-11-20" }
const S23: SprintInput = { id: "23", name: "Sprint 23", start: "2026-11-23", finish: "2026-12-04" }

/** A whole cycle: planning that opens in the sprint before, then the steps after development. */
const CYCLE: TeamCadence = {
  version: 1,
  steps: [
    { name: "Planning", startsAfter: -3, from: "start", days: 7, color: "teal" },
    ...DEFAULT_CADENCE.steps,
    { name: "Release notes", startsAfter: 3, days: 2, color: "blue" },
    { name: "Retrospective", startsAfter: 5, days: 1, color: "gray" },
  ],
}

const params = new URLSearchParams(location.search)
const today = params.get("today") ?? "2026-11-24"
const mode = params.get("show") ?? "timeline"
const cadence = params.get("steps") === "cycle" ? CYCLE : DEFAULT_CADENCE

function panel(): string {
  if (mode === "editor") return editorHtml(cadence, "Platform team")
  const top = `<div class="st-bar-top"><button type="button" class="st-link">&#8592; Sprint 21</button><h2 class="st-title">${escapeHtml(S22.name)}</h2><button type="button" class="st-link">Sprint 23 &#8594;</button><span class="st-grow"></span><button type="button" class="st-button">Edit steps</button></div>`
  return top + timelineHtml({ timeline: sprintTimeline(S22, cadence, MON_FRI), next: S23, today, workingDays: MON_FRI, locale: "en-US" })
}

for (const id of ["light", "dark"]) {
  const el = document.getElementById(id)
  if (el) el.innerHTML = panel()
}
