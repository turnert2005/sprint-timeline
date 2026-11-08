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
    expect(html).toContain("Steps after development for Platform team")
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

  it("names what is wrong with an empty or out-of-range value", () => {
    const values = new Map([["name-0", ""], ["after-0", ""], ["days-0", "0"], ["color-0", "blue"]])
    expect(readEditor(values, 1).problems).toEqual([
      "Step 1 needs a name of 1 to 40 characters.",
      "Step 1 must start 0 to 30 working days after the sprint.",
      "Step 1 must last 1 to 30 working days.",
    ])
  })
})
