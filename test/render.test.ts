// The drawing of src/render.ts, on the same real sprints as model.test.ts.

import { describe, expect, it } from "vitest"

import { DEFAULT_CADENCE, sprintTimeline, type SprintInput, type Weekday } from "../src/model"
import { LAYOUT, chartRange, chartSvg, datesTable, escapeHtml, shortDay, spanWords, statusWords, timelineHtml, type TimelineView } from "../src/render"
import { placeOf } from "../src/model"

const MON_FRI: Weekday[] = [1, 2, 3, 4, 5]
const S22: SprintInput = { id: "22", name: "Sprint 22", start: "2026-11-09", finish: "2026-11-20" }
const S23: SprintInput = { id: "23", name: "Sprint 23", start: "2026-11-23", finish: "2026-12-04" }
const T22 = sprintTimeline(S22, DEFAULT_CADENCE, MON_FRI)
const view = (today: string, extra: Partial<TimelineView> = {}): TimelineView => ({ timeline: T22, next: S23, today, workingDays: MON_FRI, locale: "en-US", ...extra })

describe("dates in words", () => {
  it("writes a short day and a span", () => {
    expect(shortDay("2026-11-23")).toBe("Mon 11/23")
    expect(spanWords("2026-11-23", "2026-11-24")).toBe("Mon 11/23 to Tue 11/24")
    expect(spanWords("2026-11-25", "2026-11-25")).toBe("Wed 11/25")
  })

  it("uses no dash of any kind between two days", () => {
    expect(spanWords("2026-11-23", "2026-11-24")).not.toMatch(/[‒-―-]/)
  })
})

describe("the status line", () => {
  const status = (today: string) => statusWords(T22, placeOf(T22, today, MON_FRI))

  it("says where today falls in each part of the sprint", () => {
    expect(status("2026-11-06")).toBe("Sprint 22 starts Mon 11/9.")
    expect(status("2026-11-13")).toBe("Today is working day 5 of 10 of development in Sprint 22.")
    expect(status("2026-11-21")).toBe("Sprint 22: UAT starts Mon 11/23.")
    expect(status("2026-11-23")).toBe("Today is day 1 of 2 of UAT for Sprint 22.")
    expect(status("2026-11-25")).toBe("Today is day 1 of 1 of Release for Sprint 22.")
    expect(status("2026-11-30")).toBe("Sprint 22 and its steps finished Thu 11/26.")
  })
})

describe("the chart", () => {
  it("runs from the sprint's start to three days past its last step", () => {
    expect(chartRange(view("2026-11-13"))).toEqual({ start: "2026-11-09", end: "2026-11-29" })
  })

  it("draws one bar for development, each step and the next sprint", () => {
    const svg = chartSvg(view("2026-11-13"))
    expect(svg.match(/class="st-bar"/g)).toHaveLength(5)
    for (const name of ["Development", "UAT", "Release", "Close-out", "Sprint 23"]) expect(svg).toContain(`>${name}</text>`)
  })

  it("places the UAT bar on Monday 11/23, two weeks after the start", () => {
    const svg = chartSvg(view("2026-11-13"))
    const x = LAYOUT.label + 14 * LAYOUT.day + 2
    expect(svg).toContain(`<rect class="st-bar" x="${x}"`)
  })

  it("shades the weekends and draws today on its day", () => {
    const svg = chartSvg(view("2026-11-13"))
    // 2026-11-09 to 2026-11-29 holds three weekends.
    expect(svg.match(/class="st-off"/g)).toHaveLength(6)
    const tx = LAYOUT.label + 4 * LAYOUT.day + LAYOUT.day / 2
    expect(svg).toContain(`<line class="st-today" x1="${tx}"`)
  })

  it("draws no today line on a day outside the chart", () => {
    expect(chartSvg(view("2026-12-15"))).not.toContain("st-today")
  })

  it("draws the next sprint as open when it runs past the right edge", () => {
    const svg = chartSvg(view("2026-11-13"))
    expect(svg).toContain('fill-opacity="0.55"')
    expect(svg).toContain("&#8594;")
  })

  it("draws no next lane for the last sprint", () => {
    expect(chartSvg(view("2026-11-13", { next: null })).match(/class="st-bar"/g)).toHaveLength(4)
  })
})

describe("escaping", () => {
  it("escapes a sprint name and a step name from the team", () => {
    const evil = sprintTimeline({ ...S22, name: '<img src=x onerror="alert(1)">' }, { version: 1, steps: [{ name: "<b>UAT</b>", startsAfter: 1, days: 1, color: "red" }] }, MON_FRI)
    const html = timelineHtml({ timeline: evil, next: null, today: "2026-11-13", workingDays: MON_FRI })
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<b>")
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")
    expect(escapeHtml(`'&`)).toBe("&#39;&amp;")
  })
})

describe("the table", () => {
  it("lists each step with its dates and working days", () => {
    const table = datesTable(view("2026-11-13"))
    expect(table).toContain('<th scope="row">Development</th><td>Mon 11/9 to Fri 11/20</td><td>10</td>')
    expect(table).toContain('<th scope="row">UAT</th><td>Mon 11/23 to Tue 11/24</td><td>2</td>')
    expect(table).toContain('<th scope="row">Close-out</th><td>Thu 11/26</td><td>1</td>')
  })
})
