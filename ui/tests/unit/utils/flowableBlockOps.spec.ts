import {describe, it, expect} from "vitest"
import {flowYamlUtils} from "@kestra-io/topology"
import {addBlock, deleteBlock, duplicateBlock} from "../../../src/utils/flowableBlockOps"

const SIMPLE_FLOW = `
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

const FLOW_WITH_FLOWABLE = `
id: my_flow
namespace: company.team
tasks:
  - id: leaf_task
    type: io.kestra.plugin.core.log.Log
    message: Before
  - id: if_task
    type: io.kestra.plugin.core.flow.If
    condition: "{{ true }}"
    then:
      - id: nested_a
        type: io.kestra.plugin.core.log.Log
        message: In then
    else:
      - id: nested_b
        type: io.kestra.plugin.core.log.Log
        message: In else
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

describe("flowableBlockOps", () => {
    describe("addBlock", () => {
        it("appends a task to the end of the tasks section", () => {
            // Given
            const newTask = {id: "task_c", type: "io.kestra.plugin.core.log.Log", message: "New"}

            // When
            const result = addBlock(SIMPLE_FLOW, "tasks", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(3)
            expect(parsed.tasks[2].id).toBe("task_c")
        })

        it("appends after a specific task when afterId is provided", () => {
            // Given
            const newTask = {id: "task_between", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlock(SIMPLE_FLOW, "tasks", newTask, "task_a")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(3)
            expect(parsed.tasks[1].id).toBe("task_between")
            expect(parsed.tasks[2].id).toBe("task_b")
        })

        it("creates the tasks section if it does not exist", () => {
            // Given
            const emptyFlow = "id: my_flow\nnamespace: company.team"
            const newTask = {id: "first", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlock(emptyFlow, "tasks", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(1)
            expect(parsed.tasks[0].id).toBe("first")
        })
    })

    describe("deleteBlock", () => {
        it("removes a task by id", () => {
            // Given

            // When
            const result = deleteBlock(SIMPLE_FLOW, "tasks", "task_a")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(1)
            expect(parsed.tasks[0].id).toBe("task_b")
        })

        it("removes a trigger by id", () => {
            // Given

            // When
            const result = deleteBlock(FLOW_WITH_TRIGGERS, "triggers", "webhook")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.triggers).toBeUndefined()
        })

        it("returns source unchanged when id is not found", () => {
            // Given

            // When
            const result = deleteBlock(SIMPLE_FLOW, "tasks", "nonexistent")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
        })
    })

    describe("duplicateBlock", () => {
        it("creates a copy of a task with a new id", () => {
            // Given

            // When
            const result = duplicateBlock(SIMPLE_FLOW, "tasks", "task_a")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(3)
            const copy = parsed.tasks.find((t: Record<string, unknown>) => String(t.id).startsWith("task_a_copy"))
            expect(copy).toBeDefined()
            expect(copy.type).toBe("io.kestra.plugin.core.log.Log")
        })

        it("appends the copy after the original", () => {
            // Given

            // When
            const result = duplicateBlock(SIMPLE_FLOW, "tasks", "task_a")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].id).toBe("task_a")
            expect(String(parsed.tasks[1].id)).toMatch(/^task_a_copy/)
            expect(parsed.tasks[2].id).toBe("task_b")
        })

        it("avoids id collision by incrementing suffix", () => {
            // Given
            const flowWithCopy = `
id: my_flow
namespace: company.team
tasks:
  - id: task_a
    type: io.kestra.plugin.core.log.Log
  - id: task_a_copy
    type: io.kestra.plugin.core.log.Log
`.trim()

            // When
            const result = duplicateBlock(flowWithCopy, "tasks", "task_a")

            // Then
            const parsed = flowYamlUtils.parse(result)
            const ids = parsed.tasks.map((t: Record<string, unknown>) => t.id)
            expect(ids).toContain("task_a")
            expect(ids).toContain("task_a_copy")
            expect(ids).toContain("task_a_copy_2")
        })

        it("returns source unchanged when id is not found", () => {
            // Given

            // When
            const result = duplicateBlock(SIMPLE_FLOW, "tasks", "nonexistent")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
        })
    })

    describe("round-trip safety: nested flowable content is preserved", () => {
        it("deleting a leaf task does not affect the flowable nested branches", () => {
            // Given

            // When
            const result = deleteBlock(FLOW_WITH_FLOWABLE, "tasks", "leaf_task")

            // Then
            const parsed = flowYamlUtils.parse(result)
            const ifTask = parsed.tasks.find((t: Record<string, unknown>) => t.id === "if_task")
            expect(ifTask).toBeDefined()
            expect(ifTask.then).toHaveLength(1)
            expect(ifTask.else).toHaveLength(1)
            expect(ifTask.then[0].id).toBe("nested_a")
            expect(ifTask.else[0].id).toBe("nested_b")
        })

        it("parse(stringify(x)) round-trip produces stable output", () => {
            // Given

            // When
            const parsed1 = flowYamlUtils.parse(FLOW_WITH_FLOWABLE)
            const stringified = flowYamlUtils.stringify(parsed1)
            const parsed2 = flowYamlUtils.parse(stringified)

            // Then
            expect(parsed2.tasks[1].then[0].id).toBe("nested_a")
            expect(parsed2.tasks[1].else[0].id).toBe("nested_b")
        })
    })
})
