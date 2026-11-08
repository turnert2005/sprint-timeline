// Sprint Timeline: the drawing. It turns a sprint's timeline into the HTML of the tab: a status
// line, a chart with one lane for development, one lane for each step and one for the next sprint,
// a line for today, and a table of the same dates for a screen reader.
//
// Pure: it returns a string, and every text from Azure DevOps or from a team is escaped.

import {
  addDays, isWorkingDay, placeOf, workingDaysIn, type DayPlace, type SprintInput, type SprintTimeline, type StepColor, type Weekday, type Ymd,
} from "./model"

export interface TimelineView {
  timeline: SprintTimeline
  /** The sprint after this one, drawn from its start to the right edge. */
  next: SprintInput | null
  today: Ymd
  workingDays: readonly Weekday[]
  /** The locale for dates, such as "en-US". */
  locale?: string
}

export const LAYOUT = { label: 236, day: 36, lane: 34, bar: 20, header: 44, gap: 4, tail: 3 } as const

export const COLOR_FILL: Record<StepColor | "development" | "next", string> = {
  development: "#0078D4",
  next: "#8A8886",
  blue: "#2B88D8",
  teal: "#038387",
  green: "#107C10",
  orange: "#CA5010",
  purple: "#8764B8",
  red: "#D13438",
  gray: "#69797E",
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, c => ESCAPES[c])

const at = (ymd: Ymd): Date => new Date(`${ymd}T12:00:00Z`)

/** "Mon 11/23" in en-US: the short day every line of the tab uses. */
export function shortDay(ymd: Ymd, locale = "en-US"): string {
  const d = at(ymd)
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(d)
  const date = new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", timeZone: "UTC" }).format(d)
  return `${weekday} ${date}`
}

/** "Mon 11/23" for one day, or "Mon 11/23 to Tue 11/24". */
export function spanWords(start: Ymd, end: Ymd, locale = "en-US"): string {
  return start === end ? shortDay(start, locale) : `${shortDay(start, locale)} to ${shortDay(end, locale)}`
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`

/** The status line: where today falls, in one sentence. */
export function statusWords(timeline: SprintTimeline, place: DayPlace, locale = "en-US"): string {
  const name = timeline.sprint.name
  switch (place.kind) {
    case "before":
      return `${name} starts ${shortDay(timeline.development.start, locale)}.`
    case "development":
      return `Today is working day ${place.day} of ${place.of} of development in ${name}.`
    case "steps":
      return `Today is ${place.steps.map(s => `day ${s.day} of ${s.of} of ${s.name}`).join(", and ")} for ${name}.`
    case "between": {
      const next = timeline.steps.find(s => s.name === place.next)
      return next ? `${name}: ${next.name} starts ${shortDay(next.start, locale)}.` : `${name} is between steps.`
    }
    case "after":
      return `${name} and its steps finished ${shortDay(timeline.end, locale)}.`
  }
}

interface Lane {
  label: string
  sub: string
  start: Ymd
  end: Ymd
  fill: string
  /** True when the bar runs past the right edge. */
  open: boolean
}

/** The first and last day the chart shows: the sprint's start to a few days past its last step or the next sprint's start. */
export function chartRange(view: TimelineView): { start: Ymd; end: Ymd } {
  const t = view.timeline
  const reach = view.next && view.next.start > t.end ? view.next.start : t.end
  return { start: t.development.start, end: addDays(reach, LAYOUT.tail) }
}

function lanes(view: TimelineView, range: { end: Ymd }): Lane[] {
  const t = view.timeline
  const locale = view.locale
  const dev = workingDaysIn(t.development, view.workingDays).length
  const out: Lane[] = [
    { label: "Development", sub: `${spanWords(t.development.start, t.development.end, locale)}, ${plural(dev, "working day")}`, start: t.development.start, end: t.development.end, fill: COLOR_FILL.development, open: false },
    ...t.steps.map(s => ({
      label: s.name,
      sub: `${spanWords(s.start, s.end, locale)}, ${plural(workingDaysIn(s, view.workingDays).length, "working day")}`,
      start: s.start, end: s.end, fill: COLOR_FILL[s.color], open: false,
    })),
  ]
  if (view.next) {
    const end = view.next.finish < range.end ? view.next.finish : range.end
    out.push({ label: view.next.name, sub: `Starts ${shortDay(view.next.start, locale)}`, start: view.next.start, end, fill: COLOR_FILL.next, open: view.next.finish > range.end })
  }
  return out
}

const dayIndex = (from: Ymd, day: Ymd): number => Math.round((at(day).getTime() - at(from).getTime()) / 86_400_000)

/** The chart as SVG. */
export function chartSvg(view: TimelineView): string {
  const range = chartRange(view)
  const days = dayIndex(range.start, range.end) + 1
  const rows = lanes(view, range)
  const { label, day, lane, bar, header } = LAYOUT
  const width = label + days * day
  const height = header + rows.length * lane + LAYOUT.gap
  const x = (d: Ymd): number => label + dayIndex(range.start, d) * day
  const locale = view.locale ?? "en-US"
  const parts: string[] = []

  // The day columns: a shade for each non-working day, and the weekday and date on top.
  for (let i = 0; i < days; i++) {
    const d = addDays(range.start, i)
    const cx = label + i * day
    if (!isWorkingDay(d, view.workingDays)) parts.push(`<rect class="st-off" x="${cx}" y="${header - 6}" width="${day}" height="${height - header + 6}"/>`)
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(at(d))
    const date = new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", timeZone: "UTC" }).format(at(d))
    parts.push(`<text class="st-axis" x="${cx + day / 2}" y="14" text-anchor="middle">${escapeHtml(weekday)}</text>`)
    parts.push(`<text class="st-axis" x="${cx + day / 2}" y="30" text-anchor="middle">${escapeHtml(date)}</text>`)
  }
  parts.push(`<line class="st-rule" x1="0" y1="${header - 6}" x2="${width}" y2="${header - 6}"/>`)

  rows.forEach((row, i) => {
    const top = header + i * lane
    const y = top + (lane - bar) / 2
    const x0 = x(row.start)
    const w = x(row.end) + day - x0
    parts.push(`<text class="st-lane" x="8" y="${top + 15}">${escapeHtml(row.label)}</text>`)
    parts.push(`<text class="st-sub" x="8" y="${top + 28}">${escapeHtml(row.sub)}</text>`)
    parts.push(`<rect class="st-bar" x="${x0 + 2}" y="${y}" width="${Math.max(4, w - 4)}" height="${bar}" rx="4" fill="${row.fill}"${row.open ? ' fill-opacity="0.55"' : ""}><title>${escapeHtml(`${row.label}: ${row.sub}`)}</title></rect>`)
    if (row.open) parts.push(`<text class="st-more" x="${x0 + w - 8}" y="${y + bar / 2 + 4}" text-anchor="end">&#8594;</text>`)
    if (i < rows.length - 1) parts.push(`<line class="st-grid" x1="0" y1="${top + lane}" x2="${width}" y2="${top + lane}"/>`)
  })

  // Today, when the chart holds it.
  if (view.today >= range.start && view.today <= range.end) {
    const tx = x(view.today) + day / 2
    parts.push(`<line class="st-today" x1="${tx}" y1="${header - 10}" x2="${tx}" y2="${height}"/>`)
    parts.push(`<circle class="st-today-dot" cx="${tx}" cy="${header - 10}" r="4"/>`)
  }

  return `<svg class="st-chart" role="img" aria-label="${escapeHtml(`Timeline of ${view.timeline.sprint.name}`)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`
}

/** The same dates as a table, for a screen reader and for copying. */
export function datesTable(view: TimelineView): string {
  const t = view.timeline
  const locale = view.locale
  const rows = [
    { name: "Development", start: t.development.start, end: t.development.end },
    ...t.steps.map(s => ({ name: s.name, start: s.start, end: s.end })),
  ].map(r => `<tr><th scope="row">${escapeHtml(r.name)}</th><td>${escapeHtml(spanWords(r.start, r.end, locale))}</td><td>${workingDaysIn(r, view.workingDays).length}</td></tr>`)
  return `<table class="st-table"><caption class="st-hidden">Dates of ${escapeHtml(t.sprint.name)}</caption><thead><tr><th scope="col">Step</th><th scope="col">Dates</th><th scope="col">Working days</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
}

/** The whole tab body for one sprint. */
export function timelineHtml(view: TimelineView): string {
  const place = placeOf(view.timeline, view.today, view.workingDays)
  return [
    `<p class="st-status" role="status">${escapeHtml(statusWords(view.timeline, place, view.locale))}</p>`,
    `<div class="st-scroll">${chartSvg(view)}</div>`,
    datesTable(view),
  ].join("")
}
