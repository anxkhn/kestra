import {describe, it, expect, vi} from "vitest"
import {mount} from "@vue/test-utils"
import {createI18n} from "vue-i18n"

vi.mock("@kestra-io/design-system", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@kestra-io/design-system")>()
    return {
        ...actual,
        KsTaskIcon: {template: "<span data-test='task-icon' />"},
    }
})

import RevisionStructuredDiff from "../../../src/components/layout/RevisionStructuredDiff.vue"

const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: {
        en: {
            revision_diff: {
                structured: "Structured",
                text: "Text",
                added: "Added",
                removed: "Removed",
                modified: "Modified",
                no_changes: "No changes between these two revisions.",
                unchanged_count: "{count} unchanged block(s) not shown.",
            },
        },
    },
})

const FLOW_LEFT = `
id: my_flow
namespace: company.team
tasks:
  - id: task_a
    type: io.kestra.plugin.core.log.Log
    message: Hello
  - id: task_b
    type: io.kestra.plugin.core.log.Log
    message: World
`.trim()

const FLOW_RIGHT_MODIFIED = `
id: my_flow
namespace: company.team
tasks:
  - id: task_a
    type: io.kestra.plugin.core.log.Log
    message: Hello changed
  - id: task_b
    type: io.kestra.plugin.core.log.Log
    message: World
  - id: task_c
    type: io.kestra.plugin.core.log.Log
    message: New
`.trim()

const FLOW_IDENTICAL = FLOW_LEFT

function mountDiff(leftSource: string, rightSource: string) {
    return mount(RevisionStructuredDiff, {
        props: {leftSource, rightSource},
        global: {plugins: [i18n]},
    })
}

describe("RevisionStructuredDiff", () => {
    it("shouldRenderEmptyStateWhenSourcesAreIdentical", () => {
        // Given / When
        const wrapper = mountDiff(FLOW_IDENTICAL, FLOW_IDENTICAL)

        // Then
        expect(wrapper.text()).toContain("No changes between these two revisions.")
        expect(wrapper.find(".diff-card").exists()).toBe(false)
    })

    it("shouldRenderDiffCardsForChangedBlocks", () => {
        // Given / When
        const wrapper = mountDiff(FLOW_LEFT, FLOW_RIGHT_MODIFIED)

        // Then
        const cards = wrapper.findAll(".diff-card")
        expect(cards.length).toBeGreaterThan(0)
    })

    it("shouldShowAddedBadgeForNewBlock", () => {
        // Given / When
        const wrapper = mountDiff(FLOW_LEFT, FLOW_RIGHT_MODIFIED)

        // Then
        const addedBadges = wrapper.findAll(".diff-card-badge--added")
        expect(addedBadges.length).toBe(1)
        expect(addedBadges[0].text()).toContain("Added")
    })

    it("shouldShowModifiedBadgeForChangedField", () => {
        // Given / When
        const wrapper = mountDiff(FLOW_LEFT, FLOW_RIGHT_MODIFIED)

        // Then
        const modifiedBadges = wrapper.findAll(".diff-card-badge--modified")
        expect(modifiedBadges.length).toBe(1)
        expect(modifiedBadges[0].text()).toContain("Modified")
    })

    it("shouldShowFieldChangesForModifiedBlock", () => {
        // Given / When
        const wrapper = mountDiff(FLOW_LEFT, FLOW_RIGHT_MODIFIED)

        // Then
        const fieldRows = wrapper.findAll(".diff-field-row")
        expect(fieldRows.length).toBeGreaterThan(0)
        const fieldNames = fieldRows.map(r => r.find(".diff-field-name").text())
        expect(fieldNames).toContain("message")
    })

    it("shouldShowUnchangedSummaryWhenSomeBlocksUnchanged", () => {
        // Given / When
        const wrapper = mountDiff(FLOW_LEFT, FLOW_RIGHT_MODIFIED)

        // Then
        const summary = wrapper.find(".diff-unchanged-summary")
        expect(summary.exists()).toBe(true)
        expect(summary.text()).toContain("unchanged")
    })
})
