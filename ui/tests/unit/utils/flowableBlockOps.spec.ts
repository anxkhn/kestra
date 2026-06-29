import {describe, it, expect} from "vitest"
import {flowYamlUtils} from "@kestra-io/topology"
import {
    addBlock,
    addBlockAtPath,
    buildMinimalTask,
    deleteBlock,
    deleteBlockAtPath,
    duplicateBlock,
    duplicateBlockAtPath,
    moveBlockAtPath,
    updateBlock,
    updateBlockAtPath,
} from "../../../src/utils/flowableBlockOps"

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

const FLOW_WITH_SWITCH = `
id: my_flow
namespace: company.team
tasks:
  - id: sw
    type: io.kestra.plugin.core.flow.Switch
    value: "{{ inputs.env }}"
    cases:
      prod:
        - id: prod_log
          type: io.kestra.plugin.core.log.Log
          message: Production
      dev:
        - id: dev_log
          type: io.kestra.plugin.core.log.Log
          message: Development
    defaults:
      - id: default_log
        type: io.kestra.plugin.core.log.Log
        message: Default
`.trim()

const FLOW_WITH_PARALLEL = `
id: my_flow
namespace: company.team
tasks:
  - id: parallel_task
    type: io.kestra.plugin.core.flow.Parallel
    tasks:
      - id: sub_a
        type: io.kestra.plugin.core.log.Log
        message: A
      - id: sub_b
        type: io.kestra.plugin.core.log.Log
        message: B
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

    describe("addBlockAtPath", () => {
        it("adds a task into If.then branch", () => {
            // Given
            const newTask = {id: "then_new", type: "io.kestra.plugin.core.log.Log", message: "Added to then"}

            // When
            const result = addBlockAtPath(FLOW_WITH_FLOWABLE, "tasks[1].then", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[1].then).toHaveLength(2)
            expect(parsed.tasks[1].then[1].id).toBe("then_new")
        })

        it("adds a task into If.else branch", () => {
            // Given
            const newTask = {id: "else_new", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlockAtPath(FLOW_WITH_FLOWABLE, "tasks[1].else", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[1].else).toHaveLength(2)
            expect(parsed.tasks[1].else[1].id).toBe("else_new")
        })

        it("auto-creates the else branch when adding the first task to an empty else", () => {
            // Given — no else branch on the If
            const flowNoElse = `
id: my_flow
namespace: company.team
tasks:
  - id: if_task
    type: io.kestra.plugin.core.flow.If
    condition: "{{ true }}"
    then:
      - id: then_a
        type: io.kestra.plugin.core.log.Log
`.trim()
            const newTask = {id: "else_first", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlockAtPath(flowNoElse, "tasks[0].else", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].else).toHaveLength(1)
            expect(parsed.tasks[0].else[0].id).toBe("else_first")
        })

        it("adds a task into a Switch case lane", () => {
            // Given
            const newTask = {id: "prod_second", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlockAtPath(FLOW_WITH_SWITCH, "tasks[0].cases.prod", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].cases.prod).toHaveLength(2)
            expect(parsed.tasks[0].cases.prod[1].id).toBe("prod_second")
        })

        it("auto-creates a new Switch case lane when adding the first task to cases.X", () => {
            // Given — staging case does not exist yet
            const newTask = {id: "staging_log", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlockAtPath(FLOW_WITH_SWITCH, "tasks[0].cases.staging", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].cases.staging).toHaveLength(1)
            expect(parsed.tasks[0].cases.staging[0].id).toBe("staging_log")
            expect(parsed.tasks[0].cases.prod).toHaveLength(1)
            expect(parsed.tasks[0].cases.dev).toHaveLength(1)
        })

        it("adds a task into Parallel.tasks branch", () => {
            // Given
            const newTask = {id: "sub_c", type: "io.kestra.plugin.core.log.Log", message: "C"}

            // When
            const result = addBlockAtPath(FLOW_WITH_PARALLEL, "tasks[0].tasks", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].tasks).toHaveLength(3)
            expect(parsed.tasks[0].tasks[2].id).toBe("sub_c")
        })

        it("adds a task into flow-level errors lane", () => {
            // Given
            const flowWithErrors = `
id: my_flow
namespace: company.team
tasks:
  - id: log
    type: io.kestra.plugin.core.log.Log
errors:
  - id: err_log
    type: io.kestra.plugin.core.log.Log
`.trim()
            const newTask = {id: "err_notify", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlockAtPath(flowWithErrors, "errors", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.errors).toHaveLength(2)
            expect(parsed.errors[1].id).toBe("err_notify")
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

    describe("deleteBlockAtPath", () => {
        it("removes a nested task by full path and cleans up the empty array key", () => {
            // Given

            // When
            const result = deleteBlockAtPath(FLOW_WITH_FLOWABLE, "tasks[1].then[0]")

            // Then — the item is removed and the empty then key is stripped
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[1].then).toBeUndefined()
        })

        it("removes a task from a Switch case lane and cleans up empty case array", () => {
            // Given

            // When
            const result = deleteBlockAtPath(FLOW_WITH_SWITCH, "tasks[0].cases.prod[0]")

            // Then — prod case was the only item, its array is cleaned; dev is untouched
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].cases.prod).toBeUndefined()
            expect(parsed.tasks[0].cases.dev).toHaveLength(1)
        })

        it("preserves sibling branches when deleting from one, cleans up the emptied branch", () => {
            // Given

            // When
            const result = deleteBlockAtPath(FLOW_WITH_FLOWABLE, "tasks[1].then[0]")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[1].then).toBeUndefined()
            expect(parsed.tasks[1].else).toHaveLength(1)
            expect(parsed.tasks[1].else[0].id).toBe("nested_b")
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

        it("avoids cross-section id collision when duplicating a trigger whose copy id exists in tasks", () => {
            // Given — task already has id "webhook_copy"; trigger id "webhook" will produce "webhook_copy"
            const flowWithCrossCollision = `
id: my_flow
namespace: company.team
tasks:
  - id: webhook_copy
    type: io.kestra.plugin.core.log.Log
    message: same id as the upcoming trigger duplicate
triggers:
  - id: webhook
    type: io.kestra.plugin.core.trigger.Webhook
    key: abc
`.trim()

            // When
            const result = duplicateBlock(flowWithCrossCollision, "triggers", "webhook")

            // Then — "webhook_copy" is taken by the task so the trigger copy must get a different id
            const parsed = flowYamlUtils.parse(result)
            const triggerIds = parsed.triggers.map((t: Record<string, unknown>) => String(t.id))
            expect(triggerIds).toContain("webhook")
            expect(triggerIds).not.toContain("webhook_copy")
            expect(triggerIds.some((id: string) => id.startsWith("webhook_copy_"))).toBe(true)
        })

        it("renames all nested task IDs when duplicating a flowable block", () => {
            // Given — if_task has nested_a in then and nested_b in else
            const originalIds = new Set(["leaf_task", "if_task", "nested_a", "nested_b"])

            // When
            const result = duplicateBlock(FLOW_WITH_FLOWABLE, "tasks", "if_task")

            // Then — the duplicate has unique IDs for itself and all nested tasks
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(3)
            const copy = parsed.tasks[2]
            expect(String(copy.id)).toMatch(/^if_task_copy/)

            const copyThenId = String(copy.then[0].id)
            const copyElseId = String(copy.else[0].id)
            expect(originalIds.has(copyThenId)).toBe(false)
            expect(originalIds.has(copyElseId)).toBe(false)
            expect(copyThenId).not.toBe(copyElseId)

            const allIds = new Set([
                ...parsed.tasks.map((t: Record<string, unknown>) => String(t.id)),
                ...parsed.tasks.flatMap((t: Record<string, unknown>) =>
                    Array.isArray(t.then) ? (t.then as Record<string, unknown>[]).map(n => String(n.id)) : [],
                ),
                ...parsed.tasks.flatMap((t: Record<string, unknown>) =>
                    Array.isArray(t.else) ? (t.else as Record<string, unknown>[]).map(n => String(n.id)) : [],
                ),
            ])
            expect(allIds.size).toBe(parsed.tasks.length + copy.then.length + copy.else.length + 2)
        })

        it("renames nested IDs in a Switch block when duplicating, preserving all cases", () => {
            // Given — sw has prod_log, dev_log, default_log nested under cases/defaults
            const originalIds = new Set(["sw", "prod_log", "dev_log", "default_log"])

            // When
            const result = duplicateBlock(FLOW_WITH_SWITCH, "tasks", "sw")

            // Then — copy top-level ID is new
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
            const copy = parsed.tasks[1]
            expect(String(copy.id)).toMatch(/^sw_copy/)

            // All nested IDs are renamed and unique vs originals
            const copyProdId = String(copy.cases.prod[0].id)
            const copyDevId = String(copy.cases.dev[0].id)
            const copyDefaultId = String(copy.defaults[0].id)
            expect(originalIds.has(copyProdId)).toBe(false)
            expect(originalIds.has(copyDevId)).toBe(false)
            expect(originalIds.has(copyDefaultId)).toBe(false)
            expect(new Set([copyProdId, copyDevId, copyDefaultId]).size).toBe(3)
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

    describe("duplicateBlockAtPath", () => {
        it("duplicates a nested task within its lane by full path", () => {
            // Given

            // When
            const result = duplicateBlockAtPath(FLOW_WITH_FLOWABLE, "tasks[1].then[0]")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[1].then).toHaveLength(2)
            expect(String(parsed.tasks[1].then[1].id)).toMatch(/^nested_a_copy/)
        })

        it("avoids id collisions across nested branches when duplicating", () => {
            // Given — nested_a_copy already exists in else
            const flowWithCopy = `
id: my_flow
namespace: company.team
tasks:
  - id: if_task
    type: io.kestra.plugin.core.flow.If
    condition: "{{ true }}"
    then:
      - id: nested_a
        type: io.kestra.plugin.core.log.Log
    else:
      - id: nested_a_copy
        type: io.kestra.plugin.core.log.Log
`.trim()

            // When
            const result = duplicateBlockAtPath(flowWithCopy, "tasks[0].then[0]")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].then).toHaveLength(2)
            const copyId = String(parsed.tasks[0].then[1].id)
            expect(copyId).toMatch(/^nested_a_copy/)
            expect(copyId).not.toBe("nested_a_copy")
        })

        it("renames all nested IDs when duplicating a flowable block via path", () => {
            // Given — outer_if has inner_if in then, inner_if has deep_task
            const deepFlow = `
id: my_flow
namespace: company.team
tasks:
  - id: outer_if
    type: io.kestra.plugin.core.flow.If
    condition: "{{ true }}"
    then:
      - id: inner_if
        type: io.kestra.plugin.core.flow.If
        condition: "{{ false }}"
        then:
          - id: deep_task
            type: io.kestra.plugin.core.log.Log
`.trim()
            const originalIds = new Set(["outer_if", "inner_if", "deep_task"])

            // When — duplicate outer_if
            const result = duplicateBlockAtPath(deepFlow, "tasks[0]")

            // Then — the copy and all its nested IDs are unique vs originals
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
            const copy = parsed.tasks[1]
            expect(originalIds.has(String(copy.id))).toBe(false)
            const copyInner = copy.then[0]
            expect(originalIds.has(String(copyInner.id))).toBe(false)
            const copyDeep = copyInner.then[0]
            expect(originalIds.has(String(copyDeep.id))).toBe(false)
            expect(new Set([String(copy.id), String(copyInner.id), String(copyDeep.id)]).size).toBe(3)
        })

        it("duplicates a task within a Switch case lane", () => {
            // Given

            // When
            const result = duplicateBlockAtPath(FLOW_WITH_SWITCH, "tasks[0].cases.prod[0]")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].cases.prod).toHaveLength(2)
            expect(String(parsed.tasks[0].cases.prod[1].id)).toMatch(/^prod_log_copy/)
        })
    })

    describe("updateBlock", () => {
        it("replaces a task's content by id leaving siblings untouched", () => {
            // Given
            const updatedYaml = "id: task_a\ntype: io.kestra.plugin.core.log.Log\nmessage: Updated"

            // When
            const result = updateBlock(SIMPLE_FLOW, "tasks", "task_a", updatedYaml)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
            expect(parsed.tasks[0].message).toBe("Updated")
            expect(parsed.tasks[1].id).toBe("task_b")
            expect(parsed.tasks[1].message).toBe("World")
        })

        it("preserves nested branches of sibling flowable tasks when updating a leaf", () => {
            // Given
            const updatedYaml = "id: leaf_task\ntype: io.kestra.plugin.core.log.Log\nmessage: Changed"

            // When
            const result = updateBlock(FLOW_WITH_FLOWABLE, "tasks", "leaf_task", updatedYaml)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].message).toBe("Changed")
            const ifTask = parsed.tasks.find((t: Record<string, unknown>) => t.id === "if_task")
            expect(ifTask.then).toHaveLength(1)
            expect(ifTask.else).toHaveLength(1)
            expect(ifTask.then[0].id).toBe("nested_a")
            expect(ifTask.else[0].id).toBe("nested_b")
        })

        it("updates a trigger without affecting tasks", () => {
            // Given
            const updatedYaml = "id: webhook\ntype: io.kestra.plugin.core.trigger.Webhook\nkey: new-key"

            // When
            const result = updateBlock(FLOW_WITH_TRIGGERS, "triggers", "webhook", updatedYaml)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.triggers[0].key).toBe("new-key")
            expect(parsed.tasks[0].id).toBe("log")
        })

        it("renames the block id when new content has a different id, preserving position and siblings", () => {
            // Given
            const renamedYaml = "id: task_renamed\ntype: io.kestra.plugin.core.log.Log\nmessage: x"

            // When
            const result = updateBlock(SIMPLE_FLOW, "tasks", "task_a", renamedYaml)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
            expect(parsed.tasks[0].id).toBe("task_renamed")
            expect(parsed.tasks[1].id).toBe("task_b")
        })

        it("returns source unchanged when id is not found", () => {
            // Given

            // When
            const result = updateBlock(SIMPLE_FLOW, "tasks", "nonexistent", "id: nonexistent\ntype: io.kestra.plugin.core.log.Log")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
        })
    })

    describe("updateBlockAtPath", () => {
        it("updates a nested task by full path", () => {
            // Given
            const updatedYaml = "id: nested_a\ntype: io.kestra.plugin.core.log.Log\nmessage: Updated nested"

            // When
            const result = updateBlockAtPath(FLOW_WITH_FLOWABLE, "tasks[1].then[0]", updatedYaml)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[1].then[0].message).toBe("Updated nested")
            expect(parsed.tasks[1].else[0].id).toBe("nested_b")
        })
    })

    describe("Switch.cases map round-trip", () => {
        it("preserves all Switch cases through parse/stringify", () => {
            // Given

            // When
            const parsed1 = flowYamlUtils.parse(FLOW_WITH_SWITCH)
            const stringified = flowYamlUtils.stringify(parsed1)
            const parsed2 = flowYamlUtils.parse(stringified)

            // Then
            expect(parsed2.tasks[0].cases.prod).toHaveLength(1)
            expect(parsed2.tasks[0].cases.prod[0].id).toBe("prod_log")
            expect(parsed2.tasks[0].cases.dev).toHaveLength(1)
            expect(parsed2.tasks[0].cases.dev[0].id).toBe("dev_log")
            expect(parsed2.tasks[0].defaults[0].id).toBe("default_log")
        })

        it("adding a case to Switch preserves all other cases", () => {
            // Given
            const newTask = {id: "staging_log", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlockAtPath(FLOW_WITH_SWITCH, "tasks[0].cases.staging", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].cases.prod).toHaveLength(1)
            expect(parsed.tasks[0].cases.dev).toHaveLength(1)
            expect(parsed.tasks[0].cases.staging).toHaveLength(1)
            expect(parsed.tasks[0].cases.staging[0].id).toBe("staging_log")
        })
    })

    describe("moveBlockAtPath", () => {
        it("moves a task up by one position", () => {
            // Given

            // When
            const result = moveBlockAtPath(SIMPLE_FLOW, "tasks[1]", "up")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
            expect(parsed.tasks[0].id).toBe("task_b")
            expect(parsed.tasks[1].id).toBe("task_a")
        })

        it("moves a task down by one position", () => {
            // Given

            // When
            const result = moveBlockAtPath(SIMPLE_FLOW, "tasks[0]", "down")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(2)
            expect(parsed.tasks[0].id).toBe("task_b")
            expect(parsed.tasks[1].id).toBe("task_a")
        })

        it("is a no-op when moving the first item up", () => {
            // Given

            // When
            const result = moveBlockAtPath(SIMPLE_FLOW, "tasks[0]", "up")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].id).toBe("task_a")
            expect(parsed.tasks[1].id).toBe("task_b")
        })

        it("is a no-op when moving the last item down", () => {
            // Given

            // When
            const result = moveBlockAtPath(SIMPLE_FLOW, "tasks[1]", "down")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].id).toBe("task_a")
            expect(parsed.tasks[1].id).toBe("task_b")
        })

        it("moves a nested task within a lane", () => {
            // Given — tasks[1].then has nested_a at [0]; there is only one item; add another first
            const withTwo = addBlockAtPath(
                FLOW_WITH_FLOWABLE,
                "tasks[1].then",
                {id: "nested_c", type: "io.kestra.plugin.core.log.Log"},
            )

            // When
            const result = moveBlockAtPath(withTwo, "tasks[1].then[1]", "up")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[1].then[0].id).toBe("nested_c")
            expect(parsed.tasks[1].then[1].id).toBe("nested_a")
        })

        it("preserves the full content of the moved blocks (round-trip safety)", () => {
            // Given

            // When
            const result = moveBlockAtPath(FLOW_WITH_FLOWABLE, "tasks[0]", "down")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].id).toBe("if_task")
            expect(parsed.tasks[0].then[0].id).toBe("nested_a")
            expect(parsed.tasks[0].else[0].id).toBe("nested_b")
            expect(parsed.tasks[1].id).toBe("leaf_task")
        })

        it("returns source unchanged when path has no bracket index", () => {
            // Given

            // When
            const result = moveBlockAtPath(SIMPLE_FLOW, "tasks", "up")

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].id).toBe("task_a")
        })
    })

    describe("buildMinimalTask", () => {
        it("produces an object with the given type", () => {
            // Given

            // When
            const task = buildMinimalTask("io.kestra.plugin.core.log.Log")

            // Then
            expect(task.type).toBe("io.kestra.plugin.core.log.Log")
        })

        it("generates an id based on the short class name", () => {
            // Given

            // When
            const task = buildMinimalTask("io.kestra.plugin.core.log.Log")

            // Then
            expect(typeof task.id).toBe("string")
            expect(String(task.id)).toMatch(/^log_/)
        })

        it("generates a unique id on each call", () => {
            // Given

            // When
            const a = buildMinimalTask("io.kestra.plugin.core.log.Log")
            const b = buildMinimalTask("io.kestra.plugin.core.log.Log")

            // Then
            expect(a.id).not.toBe(b.id)
        })

        it("inserted task produces valid YAML that parses correctly", () => {
            // Given
            const task = buildMinimalTask("io.kestra.plugin.core.flow.If")

            // When
            const result = addBlock(SIMPLE_FLOW, "tasks", task)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks).toHaveLength(3)
            expect(parsed.tasks[2].type).toBe("io.kestra.plugin.core.flow.If")
            expect(typeof parsed.tasks[2].id).toBe("string")
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

        it("deeply nested structure is preserved through multiple ops", () => {
            // Given — 3 levels deep
            const deepFlow = `
id: my_flow
namespace: company.team
tasks:
  - id: outer_if
    type: io.kestra.plugin.core.flow.If
    condition: "{{ true }}"
    then:
      - id: inner_if
        type: io.kestra.plugin.core.flow.If
        condition: "{{ false }}"
        then:
          - id: deep_task
            type: io.kestra.plugin.core.log.Log
            message: Deep
`.trim()
            const newTask = {id: "deep_task_2", type: "io.kestra.plugin.core.log.Log"}

            // When
            const result = addBlockAtPath(deepFlow, "tasks[0].then[0].then", newTask)

            // Then
            const parsed = flowYamlUtils.parse(result)
            expect(parsed.tasks[0].then[0].then).toHaveLength(2)
            expect(parsed.tasks[0].then[0].then[1].id).toBe("deep_task_2")
        })
    })
})
