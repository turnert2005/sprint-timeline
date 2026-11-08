// The step form of src/editor.ts.

import { describe, expect, it } from "vitest"

import { editorHtml, readEditor } from "../src/editor"
import { DEFAULT_CADENCE } from "../src/model"

describe("the step form", () => {
  it("draws one row for each step, with its values", () => {
    const html = editorHtml(DEFAULT_CADENCE, "Platform team")
    expect(html.match(/class="st-step"/g)).toHaveLength(3)
    expect(html).toContain('name="name-0" maxlength="40" value="UAT"')
    expect(html).toContain('name="after-1" type="number" min="0" max="30" value="3"')
    expect(html).toContain('<option value="purple" selected>Purple</option>')
    expect(html).toContain('<select name="dir-1"><option value="after" selected>after</option><option value="before">before</option></select>')
    expect(html).toContain(`<select name="from-1"><option value="end" selected>the sprint's last day</option><option value="start">the sprint's first day</option></select>`)
    expect(html).toContain("Steps for Platform team")
  })

  it("shows a step that counts back from the sprint's first day as a count, before, and the first day", () => {
    const html = editorHtml({ version: 1, steps: [{ name: "Planning", startsAfter: -3, from: "start", days: 7, color: "teal" }] }, "T")
    expect(html).toContain('name="after-0" type="number" min="0" max="30" value="3"')
    expect(html).toContain('<option value="before" selected>before</option>')
    expect(html).toContain(`<option value="start" selected>the sprint's first day</option>`)
  })

  it("escapes the team name and the step names", () => {
    const html = editorHtml({ version: 1, steps: [{ name: '"><script>', startsAfter: 1, days: 1, color: "blue" }] }, "<Team>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;Team&gt;")
  })

  it("offers no Add button at the limit of 8 steps, and a note when there are none", () => {
    const eight = { version: 1 as const, steps: Array.from({ length: 8 }, () => DEFAULT_CADENCE.steps[0]) }
    expect(editorHtml(eight, "T")).not.toContain("data-add")
    expect(editorHtml({ version: 1, steps: [] }, "T")).toContain("The timeline shows development only.")
  })

  it("reads the values back into steps", () => {
    const values = new Map([["name-0", " Hardening "], ["after-0", "1"], ["days-0", "5"], ["color-0", "teal"]])
    expect(readEditor(values, 1)).toEqual({ cadence: { version: 1, steps: [{ name: "Hardening", startsAfter: 1, days: 5, color: "teal" }] }, problems: [] })
  })

  it("reads a count before the sprint's first day as a step back from it", () => {
    const values = new Map([["name-0", "Planning"], ["after-0", "3"], ["dir-0", "before"], ["from-0", "start"], ["days-0", "7"], ["color-0", "teal"]])
    expect(readEditor(values, 1)).toEqual({ cadence: { version: 1, steps: [{ name: "Planning", startsAfter: -3, from: "start", days: 7, color: "teal" }] }, problems: [] })
  })

  it("saves no starting point for a step that counts from the last day, and reads 0 before as the day itself", () => {
    const values = new Map([["name-0", "Demo"], ["after-0", "0"], ["dir-0", "before"], ["from-0", "end"], ["days-0", "1"], ["color-0", "blue"]])
    expect(readEditor(values, 1).cadence.steps[0]).toEqual({ name: "Demo", startsAfter: 0, days: 1, color: "blue" })
  })

  it("names what is wrong with an empty or out-of-range value", () => {
    const values = new Map([["name-0", ""], ["after-0", ""], ["days-0", "0"], ["color-0", "blue"]])
    expect(readEditor(values, 1).problems).toEqual([
      "Step 1 needs a name of 1 to 40 characters.",
      "Step 1 must start 0 to 30 working days before or after the day it counts from.",
      "Step 1 must last 1 to 30 working days.",
    ])
    const negative = new Map([["name-0", "X"], ["after-0", "-2"], ["days-0", "1"], ["color-0", "blue"]])
    expect(readEditor(negative, 1).problems).toEqual(["Step 1 must start 0 to 30 working days before or after the day it counts from."])
  })
})
