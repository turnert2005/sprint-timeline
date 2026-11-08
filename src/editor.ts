// Sprint Timeline: the form where a team sets its steps after development.
//
// Pure: one function draws the form, and one reads its values back and checks them.

import { LIMITS, STEP_COLORS, stepProblems, type StepColor, type StepConfig, type TeamCadence } from "./model"
import { escapeHtml } from "./render"

const COLOR_NAMES: Record<StepColor, string> = { blue: "Blue", teal: "Teal", green: "Green", orange: "Orange", purple: "Purple", red: "Red", gray: "Gray" }

function stepRow(step: StepConfig, i: number): string {
  const options = STEP_COLORS.map(c => `<option value="${c}"${c === step.color ? " selected" : ""}>${COLOR_NAMES[c]}</option>`).join("")
  return [
    `<fieldset class="st-step" data-index="${i}">`,
    `<legend class="st-hidden">Step ${i + 1}</legend>`,
    `<label>Name <input name="name-${i}" maxlength="${LIMITS.name}" value="${escapeHtml(step.name)}" required></label>`,
    `<label>Starts <input name="after-${i}" type="number" min="0" max="${LIMITS.startsAfter}" value="${step.startsAfter}" required> working days after the sprint</label>`,
    `<label>Lasts <input name="days-${i}" type="number" min="1" max="${LIMITS.days}" value="${step.days}" required> working days</label>`,
    `<label>Color <select name="color-${i}">${options}</select></label>`,
    `<button type="button" class="st-link" data-remove="${i}" aria-label="Remove step ${i + 1}">Remove</button>`,
    `</fieldset>`,
  ].join("")
}

/** The form for a team's steps. */
export function editorHtml(cadence: TeamCadence, teamName: string, problems: readonly string[] = []): string {
  const rows = cadence.steps.map(stepRow).join("")
  const errors = problems.length > 0 ? `<ul class="st-errors" role="alert">${problems.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""
  return [
    `<form class="st-editor" novalidate>`,
    `<h2 class="st-title">Steps after development for ${escapeHtml(teamName)}</h2>`,
    `<p class="st-help">A step starts a number of working days after the sprint's last day: 0 is the last day itself, and 1 is the next working day. Everyone on the team sees the same steps.</p>`,
    errors,
    rows || `<p class="st-help">No steps. The timeline shows development only.</p>`,
    `<div class="st-actions">`,
    cadence.steps.length < LIMITS.steps ? `<button type="button" class="st-button" data-add>Add a step</button>` : "",
    `<button type="submit" class="st-button st-primary">Save</button>`,
    `<button type="button" class="st-button" data-cancel>Cancel</button>`,
    `<button type="button" class="st-link" data-defaults>Use the default steps</button>`,
    `</div>`,
    `</form>`,
  ].join("")
}

/** The steps a form holds, read from its named values, with what is wrong in each. */
export function readEditor(values: ReadonlyMap<string, string>, count: number): { cadence: TeamCadence; problems: string[] } {
  const steps: StepConfig[] = []
  for (let i = 0; i < count; i++) {
    const after = values.get(`after-${i}`)
    const days = values.get(`days-${i}`)
    steps.push({
      name: (values.get(`name-${i}`) ?? "").trim(),
      startsAfter: after === undefined || after.trim() === "" ? Number.NaN : Number(after),
      days: days === undefined || days.trim() === "" ? Number.NaN : Number(days),
      color: (values.get(`color-${i}`) ?? "gray") as StepColor,
    })
  }
  const problems = steps.flatMap((s, i) => stepProblems(s, i))
  return { cadence: { version: 1, steps }, problems }
}
