// Sprint Timeline: the dates of a sprint and of the steps a team runs after it.
//
// An Azure DevOps iteration holds only a start date and a finish date. Many teams run steps after
// development ends: UAT, a release, a close-out. A team names those steps once, each as a number
// of working days after the sprint's last day, and this module turns them into dates.
//
// Pure: no SDK, no DOM and no clock. Dates are days, "2026-11-20", read at noon UTC so no time
// zone or daylight change moves them.

/** A day, "2026-11-20". */
export type Ymd = string

/** Day of the week as Azure DevOps numbers it: 0 is Sunday, 6 is Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const STEP_COLORS = ["blue", "teal", "green", "orange", "purple", "red", "gray"] as const
export type StepColor = (typeof STEP_COLORS)[number]

/** One step a team runs after development, as the team set it. */
export interface StepConfig {
  name: string
  /** Working days after the sprint's last day that the step starts: 0 is the last day itself, 1 the next working day. */
  startsAfter: number
  /** Working days the step lasts, 1 or more. */
  days: number
  color: StepColor
}

export interface TeamCadence {
  version: 1
  steps: StepConfig[]
}

/** The steps a team sees before it sets its own: UAT on the first two working days, then the release, then the close-out. */
export const DEFAULT_CADENCE: TeamCadence = {
  version: 1,
  steps: [
    { name: "UAT", startsAfter: 1, days: 2, color: "orange" },
    { name: "Release", startsAfter: 3, days: 1, color: "green" },
    { name: "Close-out", startsAfter: 4, days: 1, color: "purple" },
  ],
}

export const LIMITS = { steps: 8, name: 40, startsAfter: 30, days: 30 } as const

/** Monday to Friday, the Azure DevOps default. */
export const DEFAULT_WORKING_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5]

/** A sprint as Azure DevOps gives it. */
export interface SprintInput {
  id: string
  name: string
  start: Ymd
  finish: Ymd
}

export interface Span {
  start: Ymd
  end: Ymd
}

export interface TimelineStep extends Span {
  name: string
  color: StepColor
}

export interface SprintTimeline {
  sprint: SprintInput
  development: Span
  steps: TimelineStep[]
  /** The last day of the sprint or of any step. */
  end: Ymd
}

/** Where a day falls in a timeline. */
export type DayPlace =
  | { kind: "before" }
  | { kind: "development"; day: number; of: number }
  | { kind: "steps"; steps: Array<{ name: string; day: number; of: number }> }
  | { kind: "between"; next: string | null }
  | { kind: "after" }

const DAY_MS = 86_400_000

const noon = (ymd: Ymd): number => Date.parse(`${ymd}T12:00:00Z`)
const toYmd = (ms: number): Ymd => new Date(ms).toISOString().slice(0, 10)

export const isYmd = (value: unknown): value is Ymd => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(noon(value))

/** The day of a date that Azure DevOps gives as midnight UTC, "2026-11-20T00:00:00Z". */
export function dayOf(iso: string | Date): Ymd {
  return typeof iso === "string" ? iso.slice(0, 10) : iso.toISOString().slice(0, 10)
}

export const addDays = (ymd: Ymd, days: number): Ymd => toYmd(noon(ymd) + days * DAY_MS)

export const weekdayOf = (ymd: Ymd): Weekday => new Date(noon(ymd)).getUTCDay() as Weekday

const workingSet = (workingDays: readonly Weekday[]): ReadonlySet<Weekday> =>
  new Set(workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS)

export function isWorkingDay(ymd: Ymd, workingDays: readonly Weekday[]): boolean {
  return workingSet(workingDays).has(weekdayOf(ymd))
}

/** The working day `count` working days after `ymd`. A count of 0 gives `ymd` itself. */
export function addWorkingDays(ymd: Ymd, count: number, workingDays: readonly Weekday[]): Ymd {
  const set = workingSet(workingDays)
  let day = ymd
  for (let left = Math.max(0, Math.floor(count)); left > 0; ) {
    day = addDays(day, 1)
    if (set.has(weekdayOf(day))) left -= 1
  }
  return day
}

/** The working days from `start` to `end`, both counted. */
export function workingDaysIn(span: Span, workingDays: readonly Weekday[]): Ymd[] {
  const set = workingSet(workingDays)
  const out: Ymd[] = []
  for (let day = span.start; day <= span.end; day = addDays(day, 1)) if (set.has(weekdayOf(day))) out.push(day)
  return out
}

/** The timeline of one sprint: its development, then each step at its working days. */
export function sprintTimeline(sprint: SprintInput, cadence: TeamCadence, workingDays: readonly Weekday[]): SprintTimeline {
  const steps = cadence.steps.map(step => {
    const start = addWorkingDays(sprint.finish, step.startsAfter, workingDays)
    return { name: step.name, color: step.color, start, end: addWorkingDays(start, Math.max(1, step.days) - 1, workingDays) }
  })
  const end = [sprint.finish, ...steps.map(s => s.end)].sort().reverse()[0]
  return { sprint, development: { start: sprint.start, end: sprint.finish }, steps, end }
}

const placeIn = (span: Span, day: Ymd, workingDays: readonly Weekday[]): { day: number; of: number } | null => {
  if (day < span.start || day > span.end) return null
  const days = workingDaysIn(span, workingDays)
  // A weekend inside a span counts as the working day before it.
  const before = days.filter(d => d <= day).length
  return { day: Math.max(1, before), of: Math.max(1, days.length) }
}

/** Where `today` falls in a timeline, with the name of the next step when it falls between two. */
export function placeOf(timeline: SprintTimeline, today: Ymd, workingDays: readonly Weekday[]): DayPlace {
  if (today < timeline.development.start) return { kind: "before" }
  const dev = placeIn(timeline.development, today, workingDays)
  if (dev) return { kind: "development", ...dev }
  const active = timeline.steps.flatMap(step => {
    const at = placeIn(step, today, workingDays)
    return at ? [{ name: step.name, ...at }] : []
  })
  if (active.length > 0) return { kind: "steps", steps: active }
  if (today > timeline.end) return { kind: "after" }
  const next = timeline.steps.filter(s => s.start > today).sort((a, b) => (a.start < b.start ? -1 : 1))[0]
  return { kind: "between", next: next?.name ?? null }
}

/** The sprint after `sprint` among `sprints`: the first to start after its start. */
export function nextSprint(sprints: readonly SprintInput[], sprint: SprintInput): SprintInput | null {
  return [...sprints].filter(s => s.start > sprint.start).sort((a, b) => (a.start < b.start ? -1 : 1))[0] ?? null
}

/** The sprint a day falls in, or else the next to start, or else the last. */
export function sprintFor(sprints: readonly SprintInput[], today: Ymd): SprintInput | null {
  const sorted = [...sprints].sort((a, b) => (a.start < b.start ? -1 : 1))
  return sorted.find(s => s.start <= today && today <= s.finish) ?? sorted.find(s => s.start > today) ?? sorted[sorted.length - 1] ?? null
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max

/**
 * Reads a cadence that a team saved. A saved document can be old or edited by hand, so each step is
 * checked, and the reasons for a refusal are given in plain words. A refusal shows the default.
 */
export function readCadence(raw: unknown): { cadence: TeamCadence; problems: string[] } {
  const doc = raw as { version?: unknown; steps?: unknown } | null | undefined
  if (!doc || typeof doc !== "object") return { cadence: DEFAULT_CADENCE, problems: [] }
  const problems: string[] = []
  if (doc.version !== 1) problems.push(`The saved steps have version ${String(doc.version)}, and this version reads only version 1.`)
  if (!Array.isArray(doc.steps)) problems.push("The saved steps are not a list.")
  if (problems.length > 0) return { cadence: DEFAULT_CADENCE, problems }
  const steps = doc.steps as unknown[]
  if (steps.length > LIMITS.steps) problems.push(`A team can set at most ${LIMITS.steps} steps, and ${steps.length} are saved.`)
  steps.forEach((value, i) => problems.push(...stepProblems(value, i)))
  return problems.length > 0 ? { cadence: DEFAULT_CADENCE, problems } : { cadence: { version: 1, steps: steps as StepConfig[] }, problems: [] }
}

/** What is wrong with one step, each in one sentence. An empty list means the step is valid. */
export function stepProblems(value: unknown, index: number): string[] {
  const step = value as Partial<StepConfig> | null
  const n = index + 1
  if (!step || typeof step !== "object") return [`Step ${n} is not a step.`]
  const out: string[] = []
  if (typeof step.name !== "string" || step.name.trim().length === 0 || step.name.length > LIMITS.name) out.push(`Step ${n} needs a name of 1 to ${LIMITS.name} characters.`)
  if (!isInt(step.startsAfter, 0, LIMITS.startsAfter)) out.push(`Step ${n} must start 0 to ${LIMITS.startsAfter} working days after the sprint.`)
  if (!isInt(step.days, 1, LIMITS.days)) out.push(`Step ${n} must last 1 to ${LIMITS.days} working days.`)
  if (!(STEP_COLORS as readonly unknown[]).includes(step.color)) out.push(`Step ${n} has a color this version does not know.`)
  return out
}
