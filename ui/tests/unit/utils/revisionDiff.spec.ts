import {describe, it, expect} from "vitest"
import {computeRevisionDiff} from "../../../src/utils/revisionDiff"

const FLOW_A = `
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

const FLOW_B_ADDED = `
id: my_flow
namespace: company.team
tasks:
  - id: task_a
    type: io.kestra.plugin.core.log.Log
    message: Hello
  - id: task_b
    type: io.kestra.plugin.core.log.Log
    message: World
  - id: task_c
    type: io.kestra.plugin.core.log.Log
    message: New task
`.trim()

const FLOW_B_REMOVED = `
id: my_flow
namespace: company.team
tasks:
  - id: task_a
    type: io.kestra.plugin.core.log.Log
    message: Hello
`.trim()

const FLOW_B_MODIFIED = `
id: my_flow
namespace: company.team
tasks:
  - id: task_a
    type: io.kestra.plugin.core.log.Log
    message: Hello changed
  - id: task_b
    type: io.kestra.plugin.core.log.Log
    message: World
`.trim()

const FLOW_WITH_TRIGGERS = `
id: my_flow
namespace: company.team
tasks:
  - id: log
    type: io.kestra.plugin.core.log.Log
    message: ok
triggers:
  - id: webhook
    type: io.kestra.plugin.core.trigger.Webhook
    key: abc
`.trim()

const FLOW_WITH_TRIGGERS_MODIFIED = `
id: my_flow
namespace: company.team
tasks:
  - id: log
    type: io.kestra.plugin.core.log.Log
    message: ok
triggers:
  - id: webhook
    type: io.kestra.plugin.core.trigger.Webhook
    key: xyz
`.trim()

const FLOW_WITH_ERRORS = `
id: my_flow
namespace: company.team
tasks:
  - id: log
    type: io.kestra.plugin.core.log.Log
    message: ok
errors:
  - id: error_handler
    type: io.kestra.plugin.core.log.Log
    message: error
`.trim()

const FLOW_WITH_FINALLY = `
id: my_flow
namespace: company.team
tasks:
  - id: log
    type: io.kestra.plugin.core.log.Log
    message: ok
finally:
  - id: cleanup
    type: io.kestra.plugin.core.log.Log
    message: cleanup
`.trim()

describe("computeRevisionDiff", () => {
    describe("identical revisions", () => {
        it("shouldReturnNoChangesWhenSourcesAreIdentical", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_A, FLOW_A)

            // Then
            expect(result.hasChanges).toBe(false)
            expect(result.blockDiffs.every(d => d.changeType === "unchanged")).toBe(true)
        })
    })

    describe("added blocks", () => {
        it("shouldDetectAddedTaskByIdInRightSource", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_A, FLOW_B_ADDED)

            // Then
            expect(result.hasChanges).toBe(true)
            const addedBlock = result.blockDiffs.find(d => d.id === "task_c")
            expect(addedBlock).toBeDefined()
            expect(addedBlock?.changeType).toBe("added")
            expect(addedBlock?.section).toBe("tasks")
            expect(addedBlock?.type).toBe("io.kestra.plugin.core.log.Log")
        })

        it("shouldMarkExistingBlocksAsUnchangedWhenOnlyAddedOne", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_A, FLOW_B_ADDED)

            // Then
            const taskA = result.blockDiffs.find(d => d.id === "task_a")
            const taskB = result.blockDiffs.find(d => d.id === "task_b")
            expect(taskA?.changeType).toBe("unchanged")
            expect(taskB?.changeType).toBe("unchanged")
        })
    })

    describe("removed blocks", () => {
        it("shouldDetectRemovedTaskByIdInLeftSource", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_A, FLOW_B_REMOVED)

            // Then
            expect(result.hasChanges).toBe(true)
            const removedBlock = result.blockDiffs.find(d => d.id === "task_b")
            expect(removedBlock).toBeDefined()
            expect(removedBlock?.changeType).toBe("removed")
            expect(removedBlock?.type).toBe("io.kestra.plugin.core.log.Log")
        })
    })

    describe("modified blocks", () => {
        it("shouldDetectModifiedFieldsForChangedBlock", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_A, FLOW_B_MODIFIED)

            // Then
            expect(result.hasChanges).toBe(true)
            const modifiedBlock = result.blockDiffs.find(d => d.id === "task_a")
            expect(modifiedBlock?.changeType).toBe("modified")
            expect(modifiedBlock?.fieldChanges).toHaveLength(1)
            expect(modifiedBlock?.fieldChanges[0].field).toBe("message")
            expect(modifiedBlock?.fieldChanges[0].oldValue).toBe("Hello")
            expect(modifiedBlock?.fieldChanges[0].newValue).toBe("Hello changed")
        })

        it("shouldNotIncludeUnchangedFieldsInFieldChanges", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_A, FLOW_B_MODIFIED)

            // Then
            const modifiedBlock = result.blockDiffs.find(d => d.id === "task_a")
            const changedFields = modifiedBlock?.fieldChanges.map(c => c.field)
            expect(changedFields).not.toContain("id")
            expect(changedFields).not.toContain("type")
        })
    })

    describe("triggers section", () => {
        it("shouldDetectModifiedTrigger", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_WITH_TRIGGERS, FLOW_WITH_TRIGGERS_MODIFIED)

            // Then
            const triggerDiff = result.blockDiffs.find(d => d.id === "webhook")
            expect(triggerDiff?.section).toBe("triggers")
            expect(triggerDiff?.changeType).toBe("modified")
            expect(triggerDiff?.fieldChanges[0].field).toBe("key")
        })
    })

    describe("errors section", () => {
        it("shouldDetectBlocksInErrorsSection", () => {
            // Given
            const flowWithRemovedErrorHandler = FLOW_WITH_ERRORS.replace(/errors:[\s\S]*$/, "").trim()

            // When
            const result = computeRevisionDiff(FLOW_WITH_ERRORS, flowWithRemovedErrorHandler)

            // Then
            const errorHandlerDiff = result.blockDiffs.find(d => d.id === "error_handler")
            expect(errorHandlerDiff?.section).toBe("errors")
            expect(errorHandlerDiff?.changeType).toBe("removed")
        })
    })

    describe("finally section", () => {
        it("shouldDetectBlocksInFinallySection", () => {
            // Given
            const flowWithoutFinally = FLOW_WITH_FINALLY.replace(/finally:[\s\S]*$/, "").trim()

            // When
            const result = computeRevisionDiff(flowWithoutFinally, FLOW_WITH_FINALLY)

            // Then
            const cleanupDiff = result.blockDiffs.find(d => d.id === "cleanup")
            expect(cleanupDiff?.section).toBe("finally")
            expect(cleanupDiff?.changeType).toBe("added")
        })
    })

    describe("hasChanges flag", () => {
        it("shouldBeTrueWhenAnyBlockChanged", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_A, FLOW_B_MODIFIED)

            // Then
            expect(result.hasChanges).toBe(true)
        })

        it("shouldBeFalseWhenAllBlocksUnchanged", () => {
            // Given / When
            const result = computeRevisionDiff(FLOW_A, FLOW_A)

            // Then
            expect(result.hasChanges).toBe(false)
        })
    })
})
