// The rules of src/model.ts. The sprints are real ones of a Monday-to-Friday team with UAT on the
// Monday and Tuesday after the sprint, the release on the Wednesday and the close-out on the
// Thursday: Sprint 22 runs 2026-11-09 to 2026-11-20, and Sprint 25 ends on 2027-01-01.

import { describe, expect, it } from "vitest"

import {
  DEFAULT_CADENCE, addWorkingDays, nextSprint, placeOf, readCadence, sprintFor, sprintTimeline, stepProblems, workingDaysIn,
  type SprintInput, type Weekday,
} from "../src/model"

const MON_FRI: Weekday[] = [1, 2, 3, 4, 5]
const SUN_THU: Weekday[] = [0, 1, 2, 3, 4]
const S21: SprintInput = { id: "21", name: "Sprint 21", start: "2026-10-26", finish: "2026-11-06" }
const S22: SprintInput = { id: "22", name: "Sprint 22", start: "2026-11-09", finish: "2026-11-20" }
const S23: SprintInput = { id: "23", name: "Sprint 23", start: "2026-11-23", finish: "2026-12-04" }
const S25: SprintInput = { id: "25", name: "Sprint 25", start: "2026-12-21", finish: "2027-01-01" }

describe("working days", () => {
  it("skips the weekend and gives the day itself for 0", () => {
    expect(addWorkingDays("2026-11-20", 0, MON_FRI)).toBe("2026-11-20")
    expect(addWorkingDays("2026-11-20", 1, MON_FRI)).toBe("2026-11-23")
    expect(addWorkingDays("2026-11-20", 3, MON_FRI)).toBe("2026-11-25")
  })

  it("follows a team week of Sunday to Thursday", () => {
    // Thursday 2026-11-19, then Sunday 2026-11-22.
    expect(addWorkingDays("2026-11-19", 1, SUN_THU)).toBe("2026-11-22")
  })

  it("reads an empty working week as Monday to Friday", () => {
    expect(addWorkingDays("2026-11-20", 1, [])).toBe("2026-11-23")
  })

  it("counts back over the weekend for a negative count", () => {
    // Monday 2026-11-09 back to Friday 11/6, then to Wednesday 11/4.
    expect(addWorkingDays("2026-11-09", -1, MON_FRI)).toBe("2026-11-06")
    expect(addWorkingDays("2026-11-09", -3, MON_FRI)).toBe("2026-11-04")
    expect(addWorkingDays("2026-11-20", -2, MON_FRI)).toBe("2026-11-18")
  })

  it("counts the ten working days of a two-week sprint", () => {
    expect(workingDaysIn({ start: S22.start, end: S22.finish }, MON_FRI)).toHaveLength(10)
  })
})

describe("the timeline of a sprint", () => {
  it("puts UAT on Monday and Tuesday, the release on Wednesday and the close-out on Thursday", () => {
    const t = sprintTimeline(S22, DEFAULT_CADENCE, MON_FRI)
    expect(t.development).toEqual({ start: "2026-11-09", end: "2026-11-20" })
    expect(t.steps).toEqual([
      { name: "UAT", color: "orange", start: "2026-11-23", end: "2026-11-24" },
      { name: "Release", color: "green", start: "2026-11-25", end: "2026-11-25" },
      { name: "Close-out", color: "purple", start: "2026-11-26", end: "2026-11-26" },
    ])
    expect(t.start).toBe("2026-11-09")
    expect(t.end).toBe("2026-11-26")
  })

  it("carries a sprint that ends on a holiday Friday into the next year", () => {
    const t = sprintTimeline(S25, DEFAULT_CADENCE, MON_FRI)
    expect(t.steps.map(s => [s.name, s.start, s.end])).toEqual([
      ["UAT", "2027-01-04", "2027-01-05"],
      ["Release", "2027-01-06", "2027-01-06"],
      ["Close-out", "2027-01-07", "2027-01-07"],
    ])
  })

  it("shows only development for a team with no steps", () => {
    const t = sprintTimeline(S22, { version: 1, steps: [] }, MON_FRI)
    expect(t.steps).toEqual([])
    expect(t.end).toBe("2026-11-20")
  })

  it("lets a step start on the sprint's last day", () => {
    const t = sprintTimeline(S22, { version: 1, steps: [{ name: "Demo", startsAfter: 0, days: 1, color: "blue" }] }, MON_FRI)
    expect(t.steps[0]).toMatchObject({ start: "2026-11-20", end: "2026-11-20" })
  })

  it("starts planning three working days before the sprint and runs it to the Thursday of the first week", () => {
    const t = sprintTimeline(S22, { version: 1, steps: [{ name: "Planning", startsAfter: -3, from: "start", days: 7, color: "teal" }] }, MON_FRI)
    expect(t.steps[0]).toMatchObject({ start: "2026-11-04", end: "2026-11-12" })
    expect(t.start).toBe("2026-11-04")
    expect(t.end).toBe("2026-11-20")
  })

  it("counts a step back from the sprint's last day", () => {
    const t = sprintTimeline(S22, { version: 1, steps: [{ name: "Code freeze", startsAfter: -2, days: 3, color: "red" }] }, MON_FRI)
    expect(t.steps[0]).toMatchObject({ start: "2026-11-18", end: "2026-11-20" })
  })

  it("counts a step forward from the sprint's first day", () => {
    const t = sprintTimeline(S22, { version: 1, steps: [{ name: "Kickoff", startsAfter: 0, from: "start", days: 1, color: "blue" }] }, MON_FRI)
    expect(t.steps[0]).toMatchObject({ start: "2026-11-09", end: "2026-11-09" })
  })
})

describe("where today falls", () => {
  const t = sprintTimeline(S22, DEFAULT_CADENCE, MON_FRI)

  it("names the working day of development", () => {
    expect(placeOf(t, "2026-11-08", MON_FRI)).toEqual({ kind: "before", next: null })
    expect(placeOf(t, "2026-11-13", MON_FRI)).toEqual({ kind: "development", day: 5, of: 10, steps: [] })
    expect(placeOf(t, "2026-11-20", MON_FRI)).toEqual({ kind: "development", day: 10, of: 10, steps: [] })
  })

  it("names planning before the sprint, and with development during it", () => {
    const cycle = sprintTimeline(S22, { version: 1, steps: [
      { name: "Planning", startsAfter: -3, from: "start", days: 7, color: "teal" },
      ...DEFAULT_CADENCE.steps,
    ] }, MON_FRI)
    expect(placeOf(cycle, "2026-11-03", MON_FRI)).toEqual({ kind: "before", next: "Planning" })
    expect(placeOf(cycle, "2026-11-04", MON_FRI)).toEqual({ kind: "steps", steps: [{ name: "Planning", day: 1, of: 7 }] })
    expect(placeOf(cycle, "2026-11-08", MON_FRI)).toEqual({ kind: "steps", steps: [{ name: "Planning", day: 3, of: 7 }] })
    expect(placeOf(cycle, "2026-11-12", MON_FRI)).toEqual({ kind: "development", day: 4, of: 10, steps: [{ name: "Planning", day: 7, of: 7 }] })
    expect(placeOf(cycle, "2026-11-13", MON_FRI)).toEqual({ kind: "development", day: 5, of: 10, steps: [] })
  })

  it("names development as next when a step before the sprint has ended", () => {
    const early = sprintTimeline(S22, { version: 1, steps: [{ name: "Prep", startsAfter: -5, from: "start", days: 2, color: "teal" }] }, MON_FRI)
    // Prep is Mon 11/2 and Tue 11/3, and development starts Mon 11/9.
    expect(placeOf(early, "2026-11-05", MON_FRI)).toEqual({ kind: "before", next: null })
  })

  it("names the step on its days, and the next step over a weekend between", () => {
    expect(placeOf(t, "2026-11-21", MON_FRI)).toEqual({ kind: "between", next: "UAT" })
    expect(placeOf(t, "2026-11-24", MON_FRI)).toEqual({ kind: "steps", steps: [{ name: "UAT", day: 2, of: 2 }] })
    expect(placeOf(t, "2026-11-25", MON_FRI)).toEqual({ kind: "steps", steps: [{ name: "Release", day: 1, of: 1 }] })
    expect(placeOf(t, "2026-11-27", MON_FRI)).toEqual({ kind: "after" })
  })

  it("names every step a day holds when two steps overlap", () => {
    const both = sprintTimeline(S22, { version: 1, steps: [
      { name: "UAT", startsAfter: 1, days: 3, color: "orange" },
      { name: "Docs", startsAfter: 2, days: 2, color: "teal" },
    ] }, MON_FRI)
    expect(placeOf(both, "2026-11-24", MON_FRI)).toEqual({ kind: "steps", steps: [{ name: "UAT", day: 2, of: 3 }, { name: "Docs", day: 1, of: 2 }] })
  })
})

describe("which sprint", () => {
  const all = [S23, S21, S22]

  it("finds the next sprint by its start", () => {
    expect(nextSprint(all, S22)).toBe(S23)
    expect(nextSprint(all, S23)).toBeNull()
  })

  it("picks the sprint of a day, else the next one, else the last", () => {
    expect(sprintFor(all, "2026-11-12")).toBe(S22)
    expect(sprintFor(all, "2026-11-07")).toBe(S22)
    expect(sprintFor(all, "2027-03-01")).toBe(S23)
    expect(sprintFor([], "2027-03-01")).toBeNull()
  })
})

describe("reading saved steps", () => {
  it("gives the default when nothing is saved", () => {
    expect(readCadence(undefined)).toEqual({ cadence: DEFAULT_CADENCE, problems: [] })
  })

  it("reads valid saved steps", () => {
    const saved = { version: 1, steps: [{ name: "Hardening", startsAfter: 1, days: 5, color: "teal" }] }
    expect(readCadence(saved)).toEqual({ cadence: saved, problems: [] })
  })

  it("refuses broken saved steps with a reason for each, and shows the default", () => {
    const { cadence, problems } = readCadence({ version: 1, steps: [{ name: "", startsAfter: -31, from: "middle", days: 0, color: "pink" }] })
    expect(cadence).toBe(DEFAULT_CADENCE)
    expect(problems).toEqual([
      "Step 1 needs a name of 1 to 40 characters.",
      "Step 1 must start 0 to 30 working days before or after the day it counts from.",
      "Step 1 counts from a day this version does not know.",
      "Step 1 must last 1 to 30 working days.",
      "Step 1 has a color this version does not know.",
    ])
  })

  it("reads a step that counts back from the sprint's first day", () => {
    const saved = { version: 1, steps: [{ name: "Planning", startsAfter: -3, from: "start", days: 7, color: "teal" }] }
    expect(readCadence(saved)).toEqual({ cadence: saved, problems: [] })
  })

  it("refuses a version it does not know and too many steps", () => {
    expect(readCadence({ version: 2, steps: [] }).problems).toEqual(["The saved steps have version 2, and this version reads only version 1."])
    const nine = Array.from({ length: 9 }, () => ({ name: "Step", startsAfter: 1, days: 1, color: "gray" }))
    expect(readCadence({ version: 1, steps: nine }).problems).toEqual(["A team can set at most 8 steps, and 9 are saved."])
  })

  it("accepts each step of the default", () => {
    DEFAULT_CADENCE.steps.forEach((step, i) => expect(stepProblems(step, i)).toEqual([]))
  })
})
