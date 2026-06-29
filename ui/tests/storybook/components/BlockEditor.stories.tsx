import type {Meta, StoryObj} from "@storybook/vue3-vite"
import BlockEditor from "../../../src/components/no-code/blocks/BlockEditor.vue"

const EMPTY_YAML = "id: my_flow\nnamespace: company.team"

const SIMPLE_YAML = `id: my_flow
namespace: company.team
tasks:
  - id: log_task
    type: io.kestra.plugin.core.log.Log
    message: Hello World
  - id: http_request
    type: io.kestra.plugin.core.http.Request
    uri: https://example.com
  - id: script_task
    type: io.kestra.plugin.core.runner.Script
    script: echo "done"
`

const YAML_WITH_FLOWABLE = `id: my_flow
namespace: company.team
tasks:
  - id: start_log
    type: io.kestra.plugin.core.log.Log
    message: Starting
  - id: branch_if
    type: io.kestra.plugin.core.flow.If
    condition: "{{ true }}"
    then:
      - id: then_log
        type: io.kestra.plugin.core.log.Log
        message: In then branch
    else:
      - id: else_log
        type: io.kestra.plugin.core.log.Log
        message: In else branch
  - id: parallel_block
    type: io.kestra.plugin.core.flow.Parallel
    tasks:
      - id: parallel_a
        type: io.kestra.plugin.core.log.Log
        message: Parallel A
      - id: parallel_b
        type: io.kestra.plugin.core.log.Log
        message: Parallel B
  - id: end_log
    type: io.kestra.plugin.core.log.Log
    message: Done
`

const YAML_WITH_TRIGGERS = `id: my_flow
namespace: company.team
tasks:
  - id: notify
    type: io.kestra.plugin.core.log.Log
    message: Triggered
triggers:
  - id: on_schedule
    type: io.kestra.plugin.core.trigger.Schedule
    cron: "0 9 * * *"
  - id: on_webhook
    type: io.kestra.plugin.core.trigger.Webhook
    key: my-key
`

const meta: Meta<typeof BlockEditor> = {
    title: "Components/BlockEditor",
    component: BlockEditor,
    parameters: {
        layout: "fullscreen",
    },
}

export default meta
type Story = StoryObj<typeof BlockEditor>

const makeRender = (_yaml: string): Story["render"] => () => ({
    setup() {
        return () => (
            <div style="height: 600px; border: 1px solid var(--ks-border-default); border-radius: var(--ks-radius-base); overflow: hidden;">
                <BlockEditor />
            </div>
        )
    },
})

export const Empty: Story = {
    render: makeRender(EMPTY_YAML),
    parameters: {
        docs: {description: {story: "Empty flow — no tasks or triggers yet."}},
    },
}

export const WithTasks: Story = {
    render: makeRender(SIMPLE_YAML),
    parameters: {
        docs: {description: {story: "Flow with three flat tasks."}},
    },
}

export const WithFlowableTasks: Story = {
    render: makeRender(YAML_WITH_FLOWABLE),
    parameters: {
        docs: {description: {story: "Flow containing flowable/nested tasks. Each flowable is rendered as a card with a nested-count hint and a TODO marker — full branch editing is deferred."}},
    },
}

export const WithTasksAndTriggers: Story = {
    render: makeRender(YAML_WITH_TRIGGERS),
    parameters: {
        docs: {description: {story: "Flow with both tasks and triggers."}},
    },
}
