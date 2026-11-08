// Sprint Timeline: the Timeline tab of the Sprints page. It reads the team's sprints, its working
// days and its saved steps, draws the sprint the page shows, and redraws when the page moves to
// another sprint. "Edit steps" saves the team's steps for everyone on the team.

import * as SDK from "azure-devops-extension-sdk"
import { CommonServiceIds, getClient, type IExtensionDataManager, type IExtensionDataService, type IHostNavigationService, type IProjectPageService } from "azure-devops-extension-api"
import { WorkRestClient } from "azure-devops-extension-api/Work"

import { pickSprint, sprintHint, stepSprint, teamHint, type TeamSprint } from "./context"
import { editorHtml, readEditor } from "./editor"
import { DEFAULT_CADENCE, DEFAULT_WORKING_DAYS, dayOf, isYmd, nextSprint, readCadence, sprintTimeline, type TeamCadence, type Weekday } from "./model"
import { escapeHtml, timelineHtml } from "./render"

/** The collection that holds one document for each team, keyed by the team's id. */
const COLLECTION = "team-cadence"
/** The object the host calls when the page moves to another sprint (vss-extension.json, registeredObjectId). */
const REGISTERED_OBJECT = "sprint-timeline-tab"

interface TeamData {
  project: { id: string; name: string }
  team: { id: string; name: string }
  sprints: TeamSprint[]
  workingDays: Weekday[]
  cadence: TeamCadence
  cadenceProblems: string[]
  etag: number | undefined
}

const root = (): HTMLElement => document.getElementById("root") as HTMLElement
let data: TeamData | null = null
let shown: TeamSprint | null = null
let lastHint: unknown = null

/** Today in the reader's own time zone. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function showMessage(text: string): void {
  root().innerHTML = `<p class="st-status" role="alert">${escapeHtml(text)}</p>`
  SDK.resize()
}

let manager: Promise<IExtensionDataManager> | null = null

/** The data manager, made once and kept, so a save does not wait for a new handshake. */
function dataManager(): Promise<IExtensionDataManager> {
  manager ??= (async () => {
    const service = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService)
    return service.getExtensionDataManager(SDK.getExtensionContext().id, await SDK.getAccessToken())
  })()
  manager.catch(() => { manager = null })
  return manager
}

/** A save that takes longer than this shows an error, so Save never looks like it did nothing. */
const SAVE_TIMEOUT_MS = 15_000

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Azure DevOps did not answer within ${ms / 1000} seconds.`)), ms)
    work.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
  })
}

async function routeValues(): Promise<Record<string, string>> {
  try {
    const nav = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService)
    const [route, query] = await Promise.all([nav.getPageRoute(), nav.getQueryParams()])
    return { ...(query ?? {}), ...(route?.routeValues ?? {}) }
  } catch {
    return {}
  }
}

async function loadTeam(route: Record<string, string>): Promise<TeamData> {
  const web = SDK.getWebContext()
  const config = SDK.getConfiguration()
  const projectPage = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService)
  const project = web.project ?? (await projectPage.getProject())
  if (!project) throw new Error("This page has no project, so the tab cannot find its sprints.")
  const hint = teamHint(web, config, route)
  const teamRef = hint.id ?? hint.name
  if (!teamRef) throw new Error("This page names no team, so the tab cannot find its sprints.")

  const work = getClient(WorkRestClient)
  const ctx = { project: project.name, projectId: project.id, team: hint.name ?? "", teamId: hint.id ?? "" }
  const [iterations, settings] = await Promise.all([work.getTeamIterations(ctx), work.getTeamSettings(ctx)])
  const sprints: TeamSprint[] = iterations.flatMap(it => {
    const start = it.attributes?.startDate ? dayOf(it.attributes.startDate as unknown as string | Date) : null
    const finish = it.attributes?.finishDate ? dayOf(it.attributes.finishDate as unknown as string | Date) : null
    return isYmd(start) && isYmd(finish) ? [{ id: it.id, name: it.name, path: it.path, start, finish }] : []
  })
  // The page names the team by its id on the Sprints page. A page that gives only its name keys the saved steps by the name.
  const teamId = hint.id ?? `name-${hint.name}`
  const workingDays = ((settings.workingDays ?? []) as unknown as number[]).filter((d): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6)

  let saved: unknown = undefined
  try {
    saved = await (await dataManager()).getDocument(COLLECTION, teamId, { defaultValue: undefined })
  } catch {
    saved = undefined
  }
  const { cadence, problems } = readCadence(saved)
  const etag = (saved as { __etag?: number } | undefined)?.__etag
  return {
    project: { id: project.id, name: project.name },
    team: { id: teamId, name: web.team?.name ?? hint.name ?? "this team" },
    sprints, workingDays: workingDays.length > 0 ? workingDays : [...DEFAULT_WORKING_DAYS], cadence, cadenceProblems: problems, etag,
  }
}

function draw(): void {
  if (!data) return
  if (!shown) {
    showMessage("This team has no sprint with dates. Set the dates of the team's sprints in Project settings, then open this tab again.")
    return
  }
  const before = stepSprint(data.sprints, shown, -1)
  const after = stepSprint(data.sprints, shown, 1)
  const timeline = sprintTimeline(shown, data.cadence, data.workingDays)
  const notes = data.cadenceProblems.length > 0
    ? `<p class="st-help" role="alert">The saved steps could not be read, so the default steps show: ${escapeHtml(data.cadenceProblems.join(" "))}</p>`
    : ""
  root().innerHTML = [
    `<div class="st-bar-top">`,
    `<button type="button" class="st-link" data-go="-1"${before ? "" : " disabled"}>&#8592; ${escapeHtml(before?.name ?? "Earlier")}</button>`,
    `<h2 class="st-title">${escapeHtml(shown.name)}</h2>`,
    `<button type="button" class="st-link" data-go="1"${after ? "" : " disabled"}>${escapeHtml(after?.name ?? "Later")} &#8594;</button>`,
    `<span class="st-grow"></span>`,
    `<button type="button" class="st-button" data-edit>Edit steps</button>`,
    `</div>`,
    notes,
    timelineHtml({ timeline, next: nextSprint(data.sprints, shown), today: today(), workingDays: data.workingDays, locale: navigator.language }),
  ].join("")
  SDK.resize()
}

function drawEditor(cadence: TeamCadence, problems: string[] = []): void {
  if (!data) return
  root().innerHTML = editorHtml(cadence, data.team.name, problems)
  SDK.resize()
}

function formValues(form: HTMLFormElement): { values: Map<string, string>; count: number } {
  const values = new Map<string, string>()
  new FormData(form).forEach((value, key) => values.set(key, String(value)))
  return { values, count: form.querySelectorAll(".st-step").length }
}

let saving = false

async function save(cadence: TeamCadence, form: HTMLFormElement): Promise<void> {
  if (!data || saving) return
  saving = true
  // Save shows that it is working, and a second press waits for the first.
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (button) {
    button.disabled = true
    button.textContent = "Saving"
  }
  const doc = { id: data.team.id, ...cadence, ...(data.etag !== undefined ? { __etag: data.etag } : {}) }
  try {
    const savedDoc = (await withTimeout(dataManager().then(m => m.setDocument(COLLECTION, doc)), SAVE_TIMEOUT_MS)) as { __etag?: number }
    data.cadence = cadence
    data.cadenceProblems = []
    data.etag = savedDoc?.__etag
    draw()
  } catch (error) {
    const conflict = /etag|conflict|409/i.test(String(error))
    drawEditor(cadence, [conflict
      ? "Someone else saved this team's steps after you opened them. Cancel to see theirs, then edit again."
      : `The steps were not saved: ${error instanceof Error ? error.message : String(error)}`])
  } finally {
    saving = false
  }
}

function onClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest("button")
  if (!target || !data) return
  const form = target.closest("form") as HTMLFormElement | null
  if (target.dataset.go && shown) {
    shown = stepSprint(data.sprints, shown, Number(target.dataset.go) as -1 | 1) ?? shown
    draw()
  } else if (target.hasAttribute("data-edit")) {
    drawEditor(data.cadence)
  } else if (target.hasAttribute("data-cancel")) {
    draw()
  } else if (target.hasAttribute("data-defaults")) {
    drawEditor(DEFAULT_CADENCE)
  } else if (form && target.hasAttribute("data-add")) {
    const { values, count } = formValues(form)
    const { cadence } = readEditor(values, count)
    drawEditor({ version: 1, steps: [...cadence.steps, { name: "New step", startsAfter: 1, days: 1, color: "gray" }] })
  } else if (form && target.dataset.remove !== undefined) {
    const { values, count } = formValues(form)
    const { cadence } = readEditor(values, count)
    drawEditor({ version: 1, steps: cadence.steps.filter((_, i) => i !== Number(target.dataset.remove)) })
  }
}

function onSubmit(event: SubmitEvent): void {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  const { values, count } = formValues(form)
  const { cadence, problems } = readEditor(values, count)
  if (problems.length > 0) drawEditor(cadence, problems)
  else void save(cadence, form)
}

/** The host calls this when the page moves to another sprint. */
function showFor(context: unknown): void {
  lastHint = context
  if (!data) return
  shown = pickSprint(data.sprints, sprintHint(context, SDK.getConfiguration()), today()).sprint ?? shown
  draw()
}

async function main(): Promise<void> {
  await SDK.init({ loaded: false, applyTheme: true })
  SDK.register(REGISTERED_OBJECT, {
    pageTitle: () => "Timeline",
    updateContext: (context: unknown) => showFor(context),
    isInvisible: () => false,
    isDisabled: () => false,
  })
  await SDK.ready()
  document.addEventListener("click", onClick)
  document.addEventListener("submit", onSubmit as EventListener)
  try {
    const route = await routeValues()
    data = await loadTeam(route)
    shown = pickSprint(data.sprints, sprintHint(lastHint, SDK.getConfiguration(), route), today()).sprint
    draw()
    await SDK.notifyLoadSucceeded()
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    showMessage(`The timeline could not load: ${text}`)
    await SDK.notifyLoadFailed(text)
  }
}

void main()
