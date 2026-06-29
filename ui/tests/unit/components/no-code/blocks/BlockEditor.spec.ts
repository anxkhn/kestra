import {describe, it, expect, vi, beforeEach} from "vitest"
import {defineComponent, ref} from "vue"
import {mount} from "@vue/test-utils"
import {createI18n} from "vue-i18n"
import {createPinia} from "pinia"

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

const mockFlowYaml = ref(SIMPLE_YAML)
const mockOnEdit = vi.fn()

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

const taskEditOpenSpy = vi.fn()

const TaskEditStub = defineComponent({
    name: "TaskEdit",
    props: ["task", "section", "flowId", "namespace", "isHidden"],
    emits: ["update:task", "close"],
    setup(_, {expose}) {
        expose({open: taskEditOpenSpy})
    },
    template: "<div data-test='block-editor-task-edit' />",
})

const messages = {
    en: {
        "block_editor": {
            "add_task": "Add task",
            "card_aria_label": "Block {id} of type {type}",
            "delete": "Delete",
            "duplicate": "Duplicate",
            "empty": "No tasks or triggers yet.",
            "flowable_todo": "Nested tasks (editing coming soon)",
            "nested_count": "{count} nested tasks",
            "no_task_results": "No matching task types.",
            "pick_task_type": "Choose a task type",
            "search_task_placeholder": "Search task types...",
        },
        "no_code": {
            "sections": {
                "tasks": "Tasks",
                "triggers": "Triggers",
            },
        },
        "add": "Add",
        "copy": "Copy",
        "delete": "Delete",
    },
}

const globalConfig = {
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
                template: "<button v-bind='$attrs'><slot /></button>",
                inheritAttrs: false,
            },
            TaskEdit: TaskEditStub,
        },
    },
}

import BlockEditor from "../../../../../src/components/no-code/blocks/BlockEditor.vue"

describe("BlockEditor", () => {
    beforeEach(() => {
        mockFlowYaml.value = SIMPLE_YAML
        taskEditOpenSpy.mockClear()
        mockOnEdit.mockClear()
    })

    describe("rendering blocks from YAML", () => {
        it("renders task block cards from the flow YAML", () => {
            // Given

            // When
            const wrapper = mount(BlockEditor, globalConfig)

            // Then
            const cards = wrapper.findAll("[data-test='block-card']")
            expect(cards.length).toBeGreaterThanOrEqual(2)
        })

        it("shows task ids in block cards", () => {
            // Given

            // When
            const wrapper = mount(BlockEditor, globalConfig)

            // Then
            const ids = wrapper.findAll("[data-test='block-card-id']").map(el => el.text())
            expect(ids).toContain("log_task")
            expect(ids).toContain("http_task")
        })

        it("shows short task type in block cards", () => {
            // Given

            // When
            const wrapper = mount(BlockEditor, globalConfig)

            // Then
            const types = wrapper.findAll("[data-test='block-card-type']").map(el => el.text())
            expect(types).toContain("Log")
            expect(types).toContain("Request")
        })

        it("renders trigger cards when triggers exist", () => {
            // Given
            mockFlowYaml.value = YAML_WITH_TRIGGERS

            // When
            const wrapper = mount(BlockEditor, globalConfig)

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
            const wrapper = mount(BlockEditor, globalConfig)

            // Then
            expect(wrapper.find("[data-test='ks-empty']").exists()).toBe(true)
        })

        it("shows flowable hint for flowable tasks", () => {
            // Given
            mockFlowYaml.value = YAML_WITH_FLOWABLE

            // When
            const wrapper = mount(BlockEditor, globalConfig)

            // Then
            const hints = wrapper.findAll("[data-test='block-card-flowable-hint']")
            expect(hints.length).toBeGreaterThan(0)
        })

        it("shows nested count for flowable tasks with children", () => {
            // Given
            mockFlowYaml.value = YAML_WITH_FLOWABLE

            // When
            const wrapper = mount(BlockEditor, globalConfig)

            // Then
            const nestedHints = wrapper.findAll("[data-test='block-card-nested']")
            expect(nestedHints.length).toBeGreaterThan(0)
        })
    })

    describe("block selection", () => {
        it("selects a block when clicked", async () => {
            // Given
            const wrapper = mount(BlockEditor, globalConfig)
            const firstCard = wrapper.find("[data-test='block-card']")

            // When
            await firstCard.trigger("click")

            // Then
            expect(firstCard.classes()).toContain("block-card--selected")
        })

        it("deselects a block when clicked again", async () => {
            // Given
            const wrapper = mount(BlockEditor, globalConfig)
            const firstCard = wrapper.find("[data-test='block-card']")
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // When
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            expect(firstCard.classes()).not.toContain("block-card--selected")
        })

        it("mounts the TaskEdit stub and calls open() when a block is clicked", async () => {
            // Given
            const wrapper = mount(BlockEditor, globalConfig)
            const firstCard = wrapper.find("[data-test='block-card']")

            // When
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            expect(wrapper.find("[data-test='block-editor-task-edit']").exists()).toBe(true)
            expect(taskEditOpenSpy).toHaveBeenCalledOnce()
        })

        it("passes the correct section and block data to TaskEdit", async () => {
            // Given
            const wrapper = mount(BlockEditor, globalConfig)
            const firstCard = wrapper.find("[data-test='block-card']")

            // When
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            const taskEdit = wrapper.findComponent(TaskEditStub)
            expect(taskEdit.props("section")).toBe("tasks")
            expect((taskEdit.props("task") as Record<string, unknown>).id).toBe("log_task")
        })
    })

    describe("edit operation", () => {
        it("writes the updated YAML back to the store when TaskEdit emits update:task", async () => {
            // Given
            const wrapper = mount(BlockEditor, globalConfig)
            const firstCard = wrapper.find("[data-test='block-card']")
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // When
            const updatedTaskYaml = "id: log_task\ntype: io.kestra.plugin.core.log.Log\nmessage: Updated message"
            await wrapper.findComponent(TaskEditStub).vm.$emit("update:task", updatedTaskYaml)
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
            const wrapper = mount(BlockEditor, globalConfig)
            const firstCard = wrapper.find("[data-test='block-card']")
            await firstCard.trigger("click")
            await wrapper.vm.$nextTick()

            // When
            const updatedTaskYaml = "id: log_task\ntype: io.kestra.plugin.core.log.Log\nmessage: Updated"
            await wrapper.findComponent(TaskEditStub).vm.$emit("update:task", updatedTaskYaml)
            await wrapper.vm.$nextTick()

            // Then
            expect(firstCard.classes()).not.toContain("block-card--selected")
        })
    })

    describe("delete operation", () => {
        it("emits a YAML update when a block is deleted", async () => {
            // Given
            const wrapper = mount(BlockEditor, globalConfig)
            const deleteBtns = wrapper.findAll("[data-test='block-card-delete']")

            // When
            await deleteBtns[0].trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            const {flowYamlUtils} = await import("@kestra-io/topology")
            const parsed = flowYamlUtils.parse(mockFlowYaml.value)
            expect(parsed.tasks).toHaveLength(1)
        })
    })

    describe("duplicate operation", () => {
        it("adds a copy of the task when duplicate is clicked", async () => {
            // Given
            const wrapper = mount(BlockEditor, globalConfig)
            const duplicateBtns = wrapper.findAll("[data-test='block-card-duplicate']")

            // When
            await duplicateBtns[0].trigger("click")
            await wrapper.vm.$nextTick()

            // Then
            const {flowYamlUtils} = await import("@kestra-io/topology")
            const parsed = flowYamlUtils.parse(mockFlowYaml.value)
            expect(parsed.tasks).toHaveLength(3)
            const copyId = parsed.tasks.find((t: Record<string, unknown>) =>
                String(t.id).startsWith("log_task_copy"),
            )
            expect(copyId).toBeDefined()
        })
    })

    describe("add task", () => {
        it("shows the add task button", () => {
            // Given

            // When
            const wrapper = mount(BlockEditor, globalConfig)

            // Then
            const btn = wrapper.find("[data-test='block-editor-add-task']")
            expect(btn.exists()).toBe(true)
        })
    })
})
