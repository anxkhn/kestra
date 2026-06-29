<template>
    <div class="block-editor" data-test="block-editor">
        <KsEmpty v-if="!hasContent" :description="t('block_editor.empty')" />

        <template v-else>
            <section v-if="parsedTasks.length > 0" class="block-editor-section">
                <p class="block-editor-section-label">
                    {{ t("no_code.sections.tasks") }}
                </p>

                <div class="block-editor-list" data-test="block-editor-task-list">
                    <BlockCard
                        v-for="(task, index) in parsedTasks"
                        :key="String(task.id ?? index)"
                        :block="task"
                        :selected="selectedId === String(task.id)"
                        :icons="pluginsStore.icons"
                        @select="selectBlock(task.id)"
                        @delete="onDelete('tasks', task.id)"
                        @duplicate="onDuplicate('tasks', task.id)"
                    />
                </div>

                <button
                    class="block-editor-add-btn"
                    type="button"
                    data-test="block-editor-add-task"
                    @click="openTaskPicker('tasks')"
                >
                    <PlusCircleOutline class="block-editor-add-icon" />
                    {{ t("block_editor.add_task") }}
                </button>
            </section>

            <section v-if="parsedTriggers.length > 0" class="block-editor-section">
                <p class="block-editor-section-label">
                    {{ t("no_code.sections.triggers") }}
                </p>

                <div class="block-editor-list" data-test="block-editor-trigger-list">
                    <BlockCard
                        v-for="(trigger, index) in parsedTriggers"
                        :key="String(trigger.id ?? index)"
                        :block="trigger"
                        :selected="selectedId === String(trigger.id)"
                        :icons="pluginsStore.icons"
                        @select="selectBlock(trigger.id)"
                        @delete="onDelete('triggers', trigger.id)"
                        @duplicate="onDuplicate('triggers', trigger.id)"
                    />
                </div>
            </section>
        </template>

        <div v-if="!hasContent || parsedTasks.length === 0" class="block-editor-add-section">
            <button
                class="block-editor-add-btn"
                type="button"
                data-test="block-editor-add-task"
                @click="openTaskPicker('tasks')"
            >
                <PlusCircleOutline class="block-editor-add-icon" />
                {{ t("block_editor.add_task") }}
            </button>
        </div>

        <KsDialog
            v-model="taskPickerVisible"
            :title="t('block_editor.pick_task_type')"
        >
            <div class="block-editor-picker">
                <KsInput
                    v-model="taskPickerSearch"
                    :placeholder="t('block_editor.search_task_placeholder')"
                    clearable
                    data-test="block-editor-picker-search"
                />

                <div class="block-editor-picker-list" data-test="block-editor-picker-list">
                    <button
                        v-for="type in filteredCommonTypes"
                        :key="type.fqcn"
                        class="block-editor-picker-row"
                        type="button"
                        @click="insertTask(type.fqcn, type.label)"
                    >
                        <KsTaskIcon
                            :cls="type.fqcn"
                            :icons="pluginsStore.icons"
                            :onlyIcon="true"
                        />
                        <span class="block-editor-picker-label">{{ type.label }}</span>
                        <span class="block-editor-picker-fqcn">{{ type.fqcn }}</span>
                    </button>

                    <p v-if="filteredCommonTypes.length === 0" class="block-editor-picker-empty">
                        {{ t("block_editor.no_task_results") }}
                    </p>
                </div>
            </div>
        </KsDialog>
    </div>
</template>

<script setup lang="ts">
    import {computed, ref} from "vue"
    import {useI18n} from "vue-i18n"
    import PlusCircleOutline from "vue-material-design-icons/PlusCircleOutline.vue"

    import {KsTaskIcon} from "@kestra-io/design-system"
    import {flowYamlUtils} from "@kestra-io/topology"

    import {useFlowStore} from "../../../stores/flow"
    import {usePluginsStore} from "../../../stores/plugins"
    import {addBlock, deleteBlock, duplicateBlock, type BlockSection} from "../../../utils/flowableBlockOps"
    import BlockCard from "./BlockCard.vue"

    const {t} = useI18n()
    const flowStore = useFlowStore()
    const pluginsStore = usePluginsStore()

    const flowYaml = computed<string>(() => flowStore.flowYaml ?? "")

    const parsedFlow = computed(() => {
        try {
            return flowYamlUtils.parse<Record<string, unknown>>(flowYaml.value)
        } catch {
            return undefined
        }
    })

    const parsedTasks = computed<Record<string, unknown>[]>(() => {
        const tasks = parsedFlow.value?.tasks
        return Array.isArray(tasks) ? tasks : []
    })

    const parsedTriggers = computed<Record<string, unknown>[]>(() => {
        const triggers = parsedFlow.value?.triggers
        return Array.isArray(triggers) ? triggers : []
    })

    const hasContent = computed(() => parsedTasks.value.length > 0 || parsedTriggers.value.length > 0)

    const selectedId = ref<string | undefined>(undefined)

    function selectBlock(id: unknown) {
        const strId = id != null ? String(id) : undefined
        selectedId.value = selectedId.value === strId ? undefined : strId
    }

    const onEditTimeout = ref<ReturnType<typeof setTimeout>>()

    function applyYaml(newYaml: string) {
        flowStore.flowYaml = newYaml
        clearTimeout(onEditTimeout.value)
        onEditTimeout.value = setTimeout(() => {
            flowStore.onEdit({source: newYaml, topologyVisible: true})
        }, 1000)
    }

    function onDelete(section: BlockSection, id: unknown) {
        if (typeof id !== "string") return
        const newYaml = deleteBlock(flowYaml.value, section, id)
        if (selectedId.value === id) selectedId.value = undefined
        applyYaml(newYaml)
    }

    function onDuplicate(section: BlockSection, id: unknown) {
        if (typeof id !== "string") return
        applyYaml(duplicateBlock(flowYaml.value, section, id))
    }

    const taskPickerVisible = ref(false)
    const taskPickerSearch = ref("")
    const taskPickerSection = ref<BlockSection>("tasks")

    function openTaskPicker(section: BlockSection) {
        taskPickerSection.value = section
        taskPickerSearch.value = ""
        taskPickerVisible.value = true
    }

    const COMMON_TASK_TYPES = [
        {fqcn: "io.kestra.plugin.core.log.Log", label: "Log"},
        {fqcn: "io.kestra.plugin.core.http.Request", label: "HTTP Request"},
        {fqcn: "io.kestra.plugin.core.runner.Script", label: "Script"},
        {fqcn: "io.kestra.plugin.core.flow.Subflow", label: "Subflow"},
        {fqcn: "io.kestra.plugin.core.flow.If", label: "If"},
        {fqcn: "io.kestra.plugin.core.flow.Switch", label: "Switch"},
        {fqcn: "io.kestra.plugin.core.flow.EachSequential", label: "For Each"},
        {fqcn: "io.kestra.plugin.core.flow.Parallel", label: "Parallel"},
        {fqcn: "io.kestra.plugin.core.flow.Sequential", label: "Sequential"},
        {fqcn: "io.kestra.plugin.core.flow.Dag", label: "DAG"},
    ]

    const filteredCommonTypes = computed(() => {
        const search = taskPickerSearch.value.trim().toLowerCase()
        if (!search) return COMMON_TASK_TYPES
        return COMMON_TASK_TYPES.filter(
            entry => entry.label.toLowerCase().includes(search) || entry.fqcn.toLowerCase().includes(search),
        )
    })

    function insertTask(fqcn: string, label: string) {
        const id = label.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now().toString(36)
        const block: Record<string, unknown> = {id, type: fqcn}

        const lastId = parsedTasks.value.length > 0
            ? String(parsedTasks.value[parsedTasks.value.length - 1].id ?? "")
            : undefined

        applyYaml(addBlock(flowYaml.value, taskPickerSection.value, block, lastId))
        taskPickerVisible.value = false
    }
</script>

<style scoped lang="scss">
    .block-editor {
        height: 100%;
        overflow-y: auto;
        padding: var(--ks-spacing-4);
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-4);
    }

    .block-editor-section {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-2);
    }

    .block-editor-section-label {
        font-size: var(--ks-font-size-xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ks-text-muted);
        margin: 0;
    }

    .block-editor-list {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-2);
    }

    .block-editor-add-section {
        display: flex;
    }

    .block-editor-add-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--ks-spacing-2);
        background: transparent;
        border: 1px dashed var(--ks-border-default);
        border-radius: var(--ks-radius-base);
        color: var(--ks-text-secondary);
        font-size: var(--ks-font-size-sm);
        padding: var(--ks-spacing-2) var(--ks-spacing-3);
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;

        &:hover {
            color: var(--ks-text-link);
            border-color: var(--ks-text-link);
        }
    }

    .block-editor-add-icon {
        font-size: 1rem;
        display: flex;
    }

    .block-editor-picker {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-3);
    }

    .block-editor-picker-list {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-1);
        max-height: 320px;
        overflow-y: auto;
    }

    .block-editor-picker-row {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-3);
        padding: var(--ks-spacing-2) var(--ks-spacing-3);
        border: none;
        border-radius: var(--ks-radius-base);
        background: transparent;
        cursor: pointer;
        text-align: left;
        transition: background-color 0.15s;

        &:hover {
            background: var(--ks-bg-hover);
        }
    }

    .block-editor-picker-label {
        font-size: var(--ks-font-size-sm);
        font-weight: 500;
        color: var(--ks-text-primary);
        min-width: 80px;
    }

    .block-editor-picker-fqcn {
        font-size: var(--ks-font-size-xs);
        color: var(--ks-text-muted);
        font-family: var(--ks-font-family-mono);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .block-editor-picker-empty {
        color: var(--ks-text-muted);
        font-size: var(--ks-font-size-sm);
        text-align: center;
        padding: var(--ks-spacing-4);
        margin: 0;
    }
</style>
