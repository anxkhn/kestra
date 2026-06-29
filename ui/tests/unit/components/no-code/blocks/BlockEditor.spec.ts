import {describe, it, expect, vi, beforeEach} from "vitest"
import {ref} from "vue"
import {mount} from "@vue/test-utils"
import {createI18n} from "vue-i18n"
import {createPinia} from "pinia"

// --- YAML fixtures ---

const SIMPLE_YAML = `
id: my_flow
namespace: company.team
tasks:
  - id: log_task
    type: io.kestra.plugin.core.log.Log
    message: Hello
  - id: http_task
    type: io.kestra.plugin.core.http.Request
    uri: https://example.com
`.trim()

const YAML_WITH_FLOWABLE = `
id: my_flow
namespace: company.team
tasks:
  - id: leaf
    type: io.kestra.plugin.core.log.Log
    message: ok
  - id: if_block
    type: io.kestra.plugin.core.flow.If
    condition: "{{ true }}"
    then:
      - id: nested_a
        type: io.kestra.plugin.core.log.Log
        message: in then
    else:
      - id: nested_b
        type: io.kestra.plugin.core.log.Log
        message: in else
`.trim()

const YAML_WITH_SWITCH = `
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
`.trim()

const YAML_WITH_TRIGGERS = `
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

const EMPTY_YAML = "id: my_flow\nnamespace: company.team"

// --- Shared reactive state for store mock ---

const mockFlowYaml = ref(SIMPLE_YAML)
const mockOnEdit = vi.fn()

// --- Store and UI mocks ---
// vi.mock factories are hoisted before imports. Keep factories self-contained.

vi.mock("../../../../../src/stores/flow", () => ({
    useFlowStore: () => ({
        get flowYaml() { return mockFlowYaml.value },
        set flowYaml(v: string) { mockFlowYaml.value = v },
        flow: {id: "my_flow", namespace: "company.team"},
        onEdit: mockOnEdit,
    }),
}))

vi.mock("../../../../../src/stores/plugins", () => ({
    usePluginsStore: () => ({
        icons: {},
    }),
}))

vi.mock("@kestra-io/design-system", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@kestra-io/design-system")>()
    return {
        ...actual,
        KsTaskIcon: {template: "<span data-test='task-icon' />"},
    }
})

// inheritAttrs: false prevents BlockEditor's data-test="block-card" attr from
// overwriting the stub's own data-test="flowable-cluster-card" attr.
vi.mock("../../../../../src/components/no-code/blocks/FlowableClusterCard.vue", () => ({
    default: {
        name: "FlowableClusterCard",
        inheritAttrs: false,
        props: {
            block: {type: Object, required: true},
            path: {type: String, required: true},
            icons: Object,
            selectedId: String,
            depth: Number,
        },
        emits: ["select", "delete", "duplicate", "add-at-path"],
        template: `
            <div data-test="flowable-cluster-card" :data-block-id="block.id">
                <span data-test="block-card-id">{{ block.id }}</span>
                <span data-test="block-card-type">{{ String(block.type).split('.').pop() }}</span>
                <div v-if="block.then" data-test="branch-lane-then">
                    <span v-for="t in block.then" :key="t.id" data-test="nested-block-card">{{ t.id }}</span>
                </div>
                <div v-if="block.else" data-test="branch-lane-else">
                    <span v-for="t in block.else" :key="t.id" data-test="nested-block-card">{{ t.id }}</span>
                </div>
                <div v-if="block.cases && block.cases.prod" data-test="branch-lane-cases.prod">
                    <span v-for="t in block.cases.prod" :key="t.id">{{ t.id }}</span>
                </div>
                <div v-if="block.cases && block.cases.dev" data-test="branch-lane-cases.dev">
                    <span v-for="t in block.cases.dev" :key="t.id">{{ t.id }}</span>
                </div>
                <button data-test="block-card-delete" @click="$emit('delete', path)">Delete</button>
                <button data-test="block-card-duplicate" @click="$emit('duplicate', path)">Dup</button>
                <button data-test="cluster-add-btn" @click="$emit('add-at-path', path + '.then', -1)">Add</button>
            </div>
        `,
    },
}))

vi.mock("../../../../../src/components/no-code/blocks/BranchLane.vue", () => ({
    default: {
        name: "BranchLane",
        inheritAttrs: false,
        props: ["laneName", "tasks", "parentPath", "icons", "selectedId", "depth"],
        template: "<div data-test='branch-lane'><slot /></div>",
    },
}))

// TaskEdit stub: expose({open}) references taskEditOpenSpy, but vi.mock factories
// are hoisted before const declarations. Work around by NOT using expose/spy —
// instead verify rendering and state changes from the parent vm.
vi.mock("../../../../../src/components/flows/TaskEdit.vue", () => ({
    default: {
        name: "TaskEdit",
        inheritAttrs: false,
        props: ["task", "section", "flowId", "namespace", "isHidden"],
        emits: ["update:task", "close"],
        setup(_: unknown, {expose}: {expose: (o: Record<string, unknown>) => void}) {
            expose({open: () => undefined})
        },
        template: "<div data-test='block-editor-task-edit' />",
    },
}))

// --- i18n messages ---

const messages = {
    en: {
        block_editor: {
            add_switch_case: "Add case",
            add_task: "Add task",
            add_to_lane: "Add to {lane}",
            card_aria_label: "Block {id} of type {type}",
            cluster_collapse_aria: "Collapse {id}",
            cluster_expand_aria: "Expand {id} ({count} tasks)",
            collapsed_summary: "{count} tasks",
            delete: "Delete",
            depth_pill: "Depth {depth}",
            duplicate: "Duplicate",
            empty: "No tasks or triggers yet.",
            flowable_todo: "Nested tasks (editing coming soon)",
            lane_case: "Case: {key}",
            lane_defaults: "Default",
            lane_else: "Else",
            lane_empty: "No tasks in {lane}",
            lane_errors: "Errors",
            lane_finally: "Finally",
            lane_tasks: "Tasks",
            lane_then: "Then",
            nested_count: "{count} nested tasks",
            no_task_results: "No matching task types.",
            pick_task_type: "Choose a task type",
            search_task_placeholder: "Search task types...",
            switch_case_key_placeholder: "New case key",
            then_required_warning: "Then branch is required",
        },
        no_code: {
            sections: {tasks: "Tasks", triggers: "Triggers"},
        },
        add: "Add",
        copy: "Copy",
        delete: "Delete",
    },
}

// --- Import component under test (after all vi.mock calls) ---

import BlockEditor from "../../../../../src/components/no-code/blocks/BlockEditor.vue"

// --- Global mount config ---

const makeConfig = () => ({
    global: {
        plugins: [
            createI18n({legacy: false, locale: "en", messages}),
            createPinia(),
        ],
        stubs: {
            KsEmpty: {template: "<div data-test='ks-empty'><slot /></div>"},
            KsDialog: {
                template: "<div v-if='modelValue' data-test='ks-dialog'><slot /></div>",
                props: ["modelValue", "title"],
                emits: ["update:modelValue"],
            },
            KsInput: {template: "<input data-test='ks-input' />"},
            KsIconButton: {
                inheritAttrs: false,
                template: "<button v-bind='$attrs'><slot /></button>",
            },
        },
    },
})

// --- Tests ---

describe("BlockEditor", () => {
    beforeEach(() => {
        mockFlowYaml.value = SIMPLE_YAML
        mockOnEdit.mockClear()
    })

    describe("rendering blocks from YAML", () => {
        it("renders task block cards from the flow YAML", () => {
            // Given

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            const cards = wrapper.findAll("[data-test='block-card']")
            expect(cards.length).toBeGreaterThanOrEqual(2)
        })

        it("shows task ids in block cards", () => {
            // Given

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            const ids = wrapper.findAll("[data-test='block-card-id']").map(el => el.text())
            expect(ids).toContain("log_task")
            expect(ids).toContain("http_task")
        })

        it("shows short task type in block cards", () => {
            // Given

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            const types = wrapper.findAll("[data-test='block-card-type']").map(el => el.text())
            expect(types).toContain("Log")
            expect(types).toContain("Request")
        })

        it("renders trigger cards when triggers exist", () => {
            // Given
            mockFlowYaml.value = YAML_WITH_TRIGGERS

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            const triggerList = wrapper.find("[data-test='block-editor-trigger-list']")
            expect(triggerList.exists()).toBe(true)
            const ids = triggerList.findAll("[data-test='block-card-id']").map(el => el.text())
            expect(ids).toContain("webhook")
        })

        it("shows empty state when flow has no tasks or triggers", () => {
            // Given
            mockFlowYaml.value = EMPTY_YAML

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            expect(wrapper.find("[data-test='ks-empty']").exists()).toBe(true)
        })

        it("renders a FlowableClusterCard for flowable tasks instead of a plain BlockCard", () => {
            // Given
            mockFlowYaml.value = YAML_WITH_FLOWABLE

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            const clusters = wrapper.findAll("[data-test='flowable-cluster-card']")
            expect(clusters.length).toBeGreaterThan(0)
            const clusterIds = clusters.map(c => c.find("[data-test='block-card-id']").text())
            expect(clusterIds).toContain("if_block")
        })

        it("still renders a plain BlockCard for leaf tasks alongside a flowable", () => {
            // Given
            mockFlowYaml.value = YAML_WITH_FLOWABLE

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            const leafCards = wrapper.findAll("[data-test='block-card']")
            const leafIds = leafCards.map(c => c.find("[data-test='block-card-id']")?.text())
            expect(leafIds).toContain("leaf")
        })

        it("renders both then and else lanes inside the flowable cluster for an If task", () => {
            // Given
            mockFlowYaml.value = YAML_WITH_FLOWABLE

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then — stub renders lane divs keyed by lane name
            const cluster = wrapper.find("[data-test='flowable-cluster-card']")
            expect(cluster.exists()).toBe(true)
            expect(cluster.find("[data-test='branch-lane-then']").exists()).toBe(true)
            expect(cluster.find("[data-test='branch-lane-else']").exists()).toBe(true)
        })

        it("renders case lanes for Switch tasks", () => {
            // Given
            mockFlowYaml.value = YAML_WITH_SWITCH

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            const cluster = wrapper.find("[data-test='flowable-cluster-card']")
            expect(cluster.exists()).toBe(true)
            expect(cluster.find("[data-test='branch-lane-cases.prod']").exists()).toBe(true)
            expect(cluster.find("[data-test='branch-lane-cases.dev']").exists()).toBe(true)
        })
    })

    describe("block selection", () => {
        it("selects a block when clicked", async () => {
            // Given
            const wrapper = mount(BlockEditor, makeConfig())
            const firstCard = wrapper.find("[data-test='block-card']")

            // When
            await firstCard.trigger("click")

            // Then
            expect(firstCard.classes()).toContain("block-card--selected")
        })

        it("deselects a block when clicked again", async () => {
            // Given
            const wrapper = mount(BlockEditor, makeConfig())
            const firstCard = wrapper.find("[data-test='block-card']")
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // When
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            expect(wrapper.find("[data-test='block-card']").classes()).not.toContain("block-card--selected")
        })

        it("mounts TaskEdit when a leaf block is clicked", async () => {
            // Given
            const wrapper = mount(BlockEditor, makeConfig())
            const firstCard = wrapper.find("[data-test='block-card']")

            // When
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            expect(wrapper.find("[data-test='block-editor-task-edit']").exists()).toBe(true)
        })

        it("passes the correct section and task data to TaskEdit", async () => {
            // Given
            const wrapper = mount(BlockEditor, makeConfig())

            // When
            await wrapper.find("[data-test='block-card']").trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            const taskEdit = wrapper.find("[data-test='block-editor-task-edit']")
            expect(taskEdit.exists()).toBe(true)
            const vm = wrapper.vm as unknown as {editingBlock: {section: string; data: Record<string, unknown>}}
            expect(vm.editingBlock.section).toBe("tasks")
            expect(vm.editingBlock.data.id).toBe("log_task")
        })
    })

    describe("edit operation", () => {
        it("writes the updated YAML back to the store when TaskEdit emits update:task", async () => {
            // Given
            const wrapper = mount(BlockEditor, makeConfig())
            await wrapper.find("[data-test='block-card']").trigger("click")
            await wrapper.vm.$nextTick()
            await wrapper.vm.$nextTick()

            // When
            const updatedTaskYaml = "id: log_task\ntype: io.kestra.plugin.core.log.Log\nmessage: Updated message"
            const taskEditEl = wrapper.findComponent({name: "TaskEdit"})
            await taskEditEl.vm.$emit("update:task", updatedTaskYaml)
            await wrapper.vm.$nextTick()

            // Then
            const {flowYamlUtils} = await import("@kestra-io/topology")
            const parsed = flowYamlUtils.parse(mockFlowYaml.value)
            expect(parsed.tasks).toHaveLength(2)
            expect(parsed.tasks[0].message).toBe("Updated message")
            expect(parsed.tasks[1].id).toBe("http_task")
        })

        it("deselects the block after a successful edit", async () => {
            // Given
            const wrapper = mount(BlockEditor, makeConfig())
            await wrapper.find("[data-test='block-card']").trigger("click")
            await wrapper.vm.$nextTick()
            await wrapper.vm.$nextTick()

            // When
            const updatedTaskYaml = "id: log_task\ntype: io.kestra.plugin.core.log.Log\nmessage: Updated"
            const taskEditEl = wrapper.findComponent({name: "TaskEdit"})
            await taskEditEl.vm.$emit("update:task", updatedTaskYaml)
            await wrapper.vm.$nextTick()

            // Then
            expect(wrapper.find("[data-test='block-card']").classes()).not.toContain("block-card--selected")
        })
    })

    describe("delete operation", () => {
        it("removes a leaf task from the store when delete is clicked", async () => {
            // Given
            const wrapper = mount(BlockEditor, makeConfig())
            const deleteBtns = wrapper.findAll("[data-test='block-card-delete']")

            // When
            await deleteBtns[0].trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            const {flowYamlUtils} = await import("@kestra-io/topology")
            const parsed = flowYamlUtils.parse(mockFlowYaml.value)
            expect(parsed.tasks).toHaveLength(1)
        })

        it("deletes a nested block when FlowableClusterCard emits delete with a path", async () => {
            // Given
            mockFlowYaml.value = YAML_WITH_FLOWABLE
            const wrapper = mount(BlockEditor, makeConfig())
            const cluster = wrapper.findComponent({name: "FlowableClusterCard"})

            // When
            await cluster.vm.$emit("delete", "tasks[1].then[0]")
            await wrapper.vm.$nextTick()

            // Then
            const {flowYamlUtils} = await import("@kestra-io/topology")
            const parsed = flowYamlUtils.parse(mockFlowYaml.value)
            const thenLen = Array.isArray(parsed.tasks[1].then) ? parsed.tasks[1].then.length : 0
            expect(thenLen).toBe(0)
            expect(parsed.tasks[1].else[0].id).toBe("nested_b")
        })
    })

    describe("duplicate operation", () => {
        it("adds a copy of a leaf task when duplicate is clicked", async () => {
            // Given
            const wrapper = mount(BlockEditor, makeConfig())
            const duplicateBtns = wrapper.findAll("[data-test='block-card-duplicate']")

            // When
            await duplicateBtns[0].trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            const {flowYamlUtils} = await import("@kestra-io/topology")
            const parsed = flowYamlUtils.parse(mockFlowYaml.value)
            expect(parsed.tasks).toHaveLength(3)
            expect(parsed.tasks.some((t: Record<string, unknown>) =>
                String(t.id).startsWith("log_task_copy"),
            )).toBe(true)
        })

        it("duplicates a nested block when FlowableClusterCard emits duplicate with a path", async () => {
            // Given
            mockFlowYaml.value = YAML_WITH_FLOWABLE
            const wrapper = mount(BlockEditor, makeConfig())
            const cluster = wrapper.findComponent({name: "FlowableClusterCard"})

            // When
            await cluster.vm.$emit("duplicate", "tasks[1].then[0]")
            await wrapper.vm.$nextTick()

            // Then
            const {flowYamlUtils} = await import("@kestra-io/topology")
            const parsed = flowYamlUtils.parse(mockFlowYaml.value)
            expect(parsed.tasks[1].then).toHaveLength(2)
            expect(String(parsed.tasks[1].then[1].id)).toMatch(/^nested_a_copy/)
        })
    })

    describe("add task", () => {
        it("shows the add task button", () => {
            // Given

            // When
            const wrapper = mount(BlockEditor, makeConfig())

            // Then
            expect(wrapper.find("[data-test='block-editor-add-task']").exists()).toBe(true)
        })

        it("inserts a nested task when FlowableClusterCard requests add-at-path then user calls insertTask", async () => {
            // Given
            mockFlowYaml.value = YAML_WITH_FLOWABLE
            const wrapper = mount(BlockEditor, makeConfig())
            const cluster = wrapper.findComponent({name: "FlowableClusterCard"})

            // When — cluster signals insert into then lane
            await cluster.vm.$emit("add-at-path", "tasks[1].then", -1)
            await wrapper.vm.$nextTick()

            // Then — insertTask uses the primed parentPath
            const vm = wrapper.vm as unknown as {insertTask: (fqcn: string, label: string) => void}
            vm.insertTask("io.kestra.plugin.core.log.Log", "Log")
            await wrapper.vm.$nextTick()

            const {flowYamlUtils} = await import("@kestra-io/topology")
            const parsed = flowYamlUtils.parse(mockFlowYaml.value)
            expect(parsed.tasks[1].then).toHaveLength(2)
        })
    })
})
