// Sprint Timeline: which team and which sprint the tab shows.
//
// Microsoft documents no shape for what the Sprints page passes to a tab. So the tab reads every
// place a sprint can come from (the configuration of the handshake, the context the host sends on
// a change, and the route of the page) and matches what it finds against the team's sprints. When
// nothing matches, it shows the sprint of today.
//
// Pure: no SDK and no DOM.

import { sprintFor, type SprintInput, type Ymd } from "./model"

export interface SprintHint {
  id?: string
  path?: string
  name?: string
}

export interface TeamHint {
  id?: string
  name?: string
}

/** A sprint of the team, with its path as Azure DevOps gives it. */
export interface TeamSprint extends SprintInput {
  path: string
}

const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined)
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fromIteration(value: unknown): SprintHint {
  if (typeof value === "string") return GUID.test(value) ? { id: value } : { path: value }
  if (!value || typeof value !== "object") return {}
  const v = value as Record<string, unknown>
  return { id: text(v.id) ?? text(v.iterationId), path: text(v.path) ?? text(v.iterationPath), name: text(v.name) }
}

/**
 * The sprint that the sources name, the first source first. A source is an object of any shape: the
 * handshake configuration, a tab context, or the route values of the page.
 */
export function sprintHint(...sources: unknown[]): SprintHint {
  const hint: SprintHint = {}
  for (const source of sources) {
    if (!source || typeof source !== "object") continue
    const s = source as Record<string, unknown>
    const found: SprintHint[] = [
      fromIteration(s.iteration),
      { id: text(s.iterationId) },
      { path: text(s.iterationPath) },
      // A route value names the sprint by its path, as "Project\\2026\\Sprint 22" or "2026/Sprint 22".
      ...Object.entries(s).filter(([key]) => /iteration|sprint/i.test(key) && !/^iteration(Id)?$/.test(key) && key !== "iterationPath").map(([, value]) => fromIteration(value)),
    ]
    for (const f of found) {
      hint.id ??= f.id
      hint.path ??= f.path
      hint.name ??= f.name
    }
  }
  return hint
}

/** The team that the sources name, the first source first. */
export function teamHint(...sources: unknown[]): TeamHint {
  const hint: TeamHint = {}
  for (const source of sources) {
    if (!source || typeof source !== "object") continue
    const s = source as Record<string, unknown>
    const team = s.team
    if (team && typeof team === "object") {
      const t = team as Record<string, unknown>
      hint.id ??= text(t.id)
      hint.name ??= text(t.name)
    } else if (typeof team === "string") {
      if (GUID.test(team)) hint.id ??= team
      else hint.name ??= team
    }
    hint.id ??= text(s.teamId)
    hint.name ??= text(s.teamName)
  }
  return hint
}

const norm = (path: string): string => path.replace(/\//g, "\\").replace(/^\\+|\\+$/g, "").toLowerCase()

/** True when one path is the other, or ends the other: a route may leave out the project. */
function samePath(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  return x === y || x.endsWith(`\\${y}`) || y.endsWith(`\\${x}`)
}

/** The sprint a hint names, or the sprint of today. */
export function pickSprint(sprints: readonly TeamSprint[], hint: SprintHint, today: Ymd): { sprint: TeamSprint | null; matched: boolean } {
  const byId = hint.id ? sprints.find(s => s.id.toLowerCase() === hint.id!.toLowerCase()) : undefined
  const byPath = !byId && hint.path ? sprints.find(s => samePath(s.path, hint.path!)) : undefined
  const byName = !byId && !byPath && hint.name ? sprints.find(s => s.name.toLowerCase() === hint.name!.toLowerCase()) : undefined
  const found = byId ?? byPath ?? byName
  if (found) return { sprint: found, matched: true }
  return { sprint: (sprintFor(sprints, today) as TeamSprint | null) ?? null, matched: false }
}

/** The sprint before or after one, by start, or null at an end. */
export function stepSprint(sprints: readonly TeamSprint[], from: TeamSprint, by: -1 | 1): TeamSprint | null {
  const sorted = [...sprints].sort((a, b) => (a.start < b.start ? -1 : 1))
  const i = sorted.findIndex(s => s.id === from.id)
  return i < 0 ? null : sorted[i + by] ?? null
}
