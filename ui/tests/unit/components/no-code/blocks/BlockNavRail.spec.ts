import {describe, it, expect, vi} from "vitest"
import {mount} from "@vue/test-utils"
import {createI18n} from "vue-i18n"
import {createPinia} from "pinia"

vi.mock("@kestra-io/design-system", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@kestra-io/design-system")>()
    return {
        ...actual,
        KsTaskIcon: {template: "<span data-test='task-icon' />"},
        KsTree: {
            name: "KsTree",
            props: ["data", "nodeKey", "props", "defaultExpandAll"],
            emits: ["nodeClick"],
            expose: ["setCurrentKey"],
            setup(_: unknown, {expose}: {expose: (o: Record<string, unknown>) => void}) {
                expose({setCurrentKey: () => undefined})
            },
            template: `
                <div data-test="ks-tree">
                    <template v-for="node in data" :key="node.id">
                        <div :data-test="'nav-rail-node-' + node.id" @click="$emit('nodeClick', node)">
                            <slot :data="node" :node="{}" />
                        </div>
                        <template v-if="node.children">
                            <div v-for="child in node.children" :key="child.id" :data-test="'nav-rail-node-' + child.id" @click="$emit('nodeClick', child)">
                                <slot :data="child" :node="{}" />
                            </div>
                        </template>
                    </template>
                </div>
            `,
        },
        KsEmpty: {template: "<div data-test='ks-empty'><slot /></div>"},
    }
})

const messages = {
    en: {
        block_editor: {
            drag_reorder: "Drag to reorder",
            nav_rail_empty: "No tasks or triggers yet.",
            nav_rail_title: "Outline",
        },
    },
}

import BlockNavRail from "../../../../../src/components/no-code/blocks/BlockNavRail.vue"

const makeConfig = () => ({
    global: {
        plugins: [
            createI18n({legacy: false, locale: "en", messages}),
            createPinia(),
        ],
    },
})

const FLAT_TASKS = [
    {id: "task_a", type: "io.kestra.plugin.core.log.Log"},
    {id: "task_b", type: "io.kestra.plugin.core.log.Log"},
]

const FLOWABLE_TASKS = [
    {
        id: "if_task",
        type: "io.kestra.plugin.core.flow.If",
        then: [
            {id: "nested_a", type: "io.kestra.plugin.core.log.Log"},
        ],
        else: [
            {id: "nested_b", type: "io.kestra.plugin.core.log.Log"},
        ],
    },
]

describe("BlockNavRail", () => {
    describe("rendering", () => {
        it("renders a tree node for each top-level task", () => {
            // Given

            // When
            const wrapper = mount(BlockNavRail, {
                ...makeConfig(),
                props: {tasks: FLAT_TASKS, triggers: []},
            })

            // Then
            expect(wrapper.find("[data-test='nav-rail-node-task_a']").exists()).toBe(true)
            expect(wrapper.find("[data-test='nav-rail-node-task_b']").exists()).toBe(true)
        })

        it("renders nested task nodes for flowable tasks", () => {
            // Given

            // When
            const wrapper = mount(BlockNavRail, {
                ...makeConfig(),
                props: {tasks: FLOWABLE_TASKS, triggers: []},
            })

            // Then
            expect(wrapper.find("[data-test='nav-rail-node-if_task']").exists()).toBe(true)
            expect(wrapper.find("[data-test='nav-rail-node-nested_a']").exists()).toBe(true)
            expect(wrapper.find("[data-test='nav-rail-node-nested_b']").exists()).toBe(true)
        })

        it("renders trigger nodes alongside task nodes", () => {
            // Given
            const triggers = [{id: "webhook", type: "io.kestra.plugin.core.trigger.Webhook"}]

            // When
            const wrapper = mount(BlockNavRail, {
                ...makeConfig(),
                props: {tasks: FLAT_TASKS, triggers},
            })

            // Then
            expect(wrapper.find("[data-test='nav-rail-node-task_a']").exists()).toBe(true)
            expect(wrapper.find("[data-test='nav-rail-node-webhook']").exists()).toBe(true)
        })

        it("shows the empty state when there are no tasks or triggers", () => {
            // Given

            // When
            const wrapper = mount(BlockNavRail, {
                ...makeConfig(),
                props: {tasks: [], triggers: []},
            })

            // Then
            expect(wrapper.find("[data-test='ks-empty']").exists()).toBe(true)
        })

        it("applies the selected class to the node matching selectedId", () => {
            // Given

            // When
            const wrapper = mount(BlockNavRail, {
                ...makeConfig(),
                props: {tasks: FLAT_TASKS, triggers: [], selectedId: "task_a"},
            })

            // Then
            const nodeA = wrapper.find("[data-test='nav-rail-node-task_a']")
            expect(nodeA.find(".block-nav-rail-node--selected").exists()).toBe(true)
        })
    })

    describe("interaction", () => {
        it("emits select with the node id when a tree node is clicked", async () => {
            // Given
            const wrapper = mount(BlockNavRail, {
                ...makeConfig(),
                props: {tasks: FLAT_TASKS, triggers: []},
            })

            // When
            await wrapper.find("[data-test='nav-rail-node-task_a']").trigger("click")

            // Then
            const emitted = wrapper.emitted("select")
            expect(emitted).toBeTruthy()
            expect(emitted![0][0]).toBe("task_a")
        })

        it("emits select for a nested task node when clicked", async () => {
            // Given
            const wrapper = mount(BlockNavRail, {
                ...makeConfig(),
                props: {tasks: FLOWABLE_TASKS, triggers: []},
            })

            // When
            await wrapper.find("[data-test='nav-rail-node-nested_a']").trigger("click")

            // Then
            const emitted = wrapper.emitted("select")
            expect(emitted).toBeTruthy()
            expect(emitted![0][0]).toBe("nested_a")
        })
    })
})
