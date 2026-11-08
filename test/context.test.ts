// Which team and which sprint the tab shows (src/context.ts). The sources are shapes a host can send;
// Microsoft documents none of them, so each test names the shape it stands for.

import { describe, expect, it } from "vitest"

import { pickSprint, sprintHint, stepSprint, teamHint, type TeamSprint } from "../src/context"

const ID_22 = "0b4f3c6e-2d1a-4b8e-9f00-1a2b3c4d5e22"
const SPRINTS: TeamSprint[] = [
  { id: "0b4f3c6e-2d1a-4b8e-9f00-1a2b3c4d5e23", name: "Sprint 23", path: "Fabrikam\\2026\\Q4\\Sprint 23", start: "2026-11-23", finish: "2026-12-04" },
  { id: ID_22, name: "Sprint 22", path: "Fabrikam\\2026\\Q4\\Sprint 22", start: "2026-11-09", finish: "2026-11-20" },
  { id: "0b4f3c6e-2d1a-4b8e-9f00-1a2b3c4d5e21", name: "Sprint 21", path: "Fabrikam\\2026\\Q4\\Sprint 21", start: "2026-10-26", finish: "2026-11-06" },
]

describe("the sprint a source names", () => {
  it("reads an iteration id from the handshake configuration", () => {
    expect(sprintHint({ iterationId: ID_22 })).toEqual({ id: ID_22 })
  })

  it("reads an iteration object from a tab context", () => {
    expect(sprintHint({ iteration: { id: ID_22, name: "Sprint 22", path: "Fabrikam\\2026\\Q4\\Sprint 22" } })).toEqual({
      id: ID_22, name: "Sprint 22", path: "Fabrikam\\2026\\Q4\\Sprint 22",
    })
  })

  it("reads a sprint path from a route value of any name", () => {
    expect(sprintHint({ teamName: "Platform", iterationPath: "2026/Q4/Sprint 22" })).toEqual({ path: "2026/Q4/Sprint 22" })
    expect(sprintHint({ sprintPath: "2026\\Q4\\Sprint 22" })).toEqual({ path: "2026\\Q4\\Sprint 22" })
  })

  it("takes the first source first, and ignores what is not an object", () => {
    expect(sprintHint(null, "x", { iterationId: ID_22 }, { iterationId: "other" })).toEqual({ id: ID_22 })
  })
})

describe("the team a source names", () => {
  it("reads the team of the web context, then of the route", () => {
    expect(teamHint({ team: { id: "t1", name: "Mobile" } }, { teamName: "Platform" })).toEqual({ id: "t1", name: "Mobile" })
    expect(teamHint(undefined, { teamName: "Platform" })).toEqual({ name: "Platform" })
  })
})

describe("picking the sprint", () => {
  it("matches by id, then by path, then by name", () => {
    expect(pickSprint(SPRINTS, { id: ID_22.toUpperCase() }, "2027-01-01").sprint?.name).toBe("Sprint 22")
    expect(pickSprint(SPRINTS, { path: "2026/Q4/Sprint 22" }, "2027-01-01")).toMatchObject({ matched: true, sprint: { name: "Sprint 22" } })
    expect(pickSprint(SPRINTS, { name: "sprint 21" }, "2027-01-01").sprint?.name).toBe("Sprint 21")
  })

  it("does not take Sprint 2 for Sprint 22 by a path that only shares its end", () => {
    const two = [...SPRINTS, { id: "x2", name: "Sprint 2", path: "Fabrikam\\2026\\Q1\\Sprint 2", start: "2026-01-12", finish: "2026-01-23" }]
    expect(pickSprint(two, { path: "Q4\\Sprint 22" }, "2027-01-01").sprint?.name).toBe("Sprint 22")
    expect(pickSprint(two, { path: "Sprint 2" }, "2027-01-01").sprint?.name).toBe("Sprint 2")
  })

  it("shows the sprint of today when nothing matches", () => {
    expect(pickSprint(SPRINTS, { path: "Nowhere" }, "2026-11-12")).toMatchObject({ matched: false, sprint: { name: "Sprint 22" } })
    expect(pickSprint([], {}, "2026-11-12")).toEqual({ matched: false, sprint: null })
  })

  it("steps to the sprint before and after", () => {
    expect(stepSprint(SPRINTS, SPRINTS[1], -1)?.name).toBe("Sprint 21")
    expect(stepSprint(SPRINTS, SPRINTS[1], 1)?.name).toBe("Sprint 23")
    expect(stepSprint(SPRINTS, SPRINTS[0], 1)).toBeNull()
  })
})
