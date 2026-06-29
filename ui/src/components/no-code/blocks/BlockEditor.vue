<template>
    <div
        class="block-editor"
        data-test="block-editor"
        tabindex="-1"
        @keydown="onEditorKeydown"
    >
        <KsEmpty v-if="!hasContent" :description="t('block_editor.empty')" />

        <template v-else>
            <section v-if="parsedTasks.length > 0" class="block-editor-section">
                <p class="block-editor-section-label">
                    {{ t("no_code.sections.tasks") }}
                </p>

                <div class="block-editor-list" data-test="block-editor-task-list">
                    <template v-for="(task, index) in parsedTasks" :key="String(task.id ?? index)">
                        <FlowableClusterCard
                            v-if="isFlowable(task)"
                            :block="task"
                            :path="`tasks[${index}]`"
                            :icons="pluginsStore.icons"
                            :selectedId="selectedId"
                            :depth="0"
                            data-test="block-card"
                            @select="openNestedEdit"
                            @delete="onDeleteAtPath"
                            @duplicate="onDuplicateAtPath"
                            @add-at-path="openTaskPickerAtPath"
                        />
                        <BlockCard
                            v-else
                            :block="task"
                            :selected="selectedId === String(task.id)"
                            :draggable="true"
                            :dragOver="taskDragOverIndex === index"
                            :icons="pluginsStore.icons"
                            @select="selectBlock('tasks', task)"
                            @delete="onDelete('tasks', task.id)"
                            @duplicate="onDuplicate('tasks', task.id)"
                            @drag-start="handleTaskDragStart($event, index)"
                            @drag-over="handleTaskDragOver($event, index)"
                            @drop="handleTaskDrop($event, index)"
                            @drag-end="handleTaskDragEnd"
                        />
                    </template>
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

            <section v-if="flowLevelErrors.length > 0 || flowLevelFinally.length > 0" class="block-editor-section">
                <BranchLane
                    v-if="flowLevelErrors.length > 0"
                    laneName="errors"
                    :tasks="flowLevelErrors"
                    parentPath="errors"
                    :icons="pluginsStore.icons"
                    :selectedId="selectedId"
                    :depth="0"
                    @select="openNestedEdit"
                    @delete="onDeleteAtPath"
                    @duplicate="onDuplicateAtPath"
                    @add-at-path="openTaskPickerAtPath"
                    @reorder="onReorderAtPath"
                />
                <BranchLane
                    v-if="flowLevelFinally.length > 0"
                    laneName="finally"
                    :tasks="flowLevelFinally"
                    parentPath="finally"
                    :icons="pluginsStore.icons"
                    :selectedId="selectedId"
                    :depth="0"
                    @select="openNestedEdit"
                    @delete="onDeleteAtPath"
                    @duplicate="onDuplicateAtPath"
                    @add-at-path="openTaskPickerAtPath"
                    @reorder="onReorderAtPath"
                />
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
                        :draggable="true"
                        :dragOver="triggerDragOverIndex === index"
                        :icons="pluginsStore.icons"
                        @select="selectBlock('triggers', trigger)"
                        @delete="onDelete('triggers', trigger.id)"
                        @duplicate="onDuplicate('triggers', trigger.id)"
                        @drag-start="handleTriggerDragStart($event, index)"
                        @drag-over="handleTriggerDragOver($event, index)"
                        @drop="handleTriggerDrop($event, index)"
                        @drag-end="handleTriggerDragEnd"
                    />
                </div>
            </section>
        </template>

        <div v-if="!hasContent || parsedTasks.length === 0" class="block-editor-add-section">
            <button
                class="block-editor-add-btn"
                type="button"
                data-test="block-editor-add-task-fallback"
                @click="openTaskPicker('tasks')"
            >
                <PlusCircleOutline class="block-editor-add-icon" />
                {{ t("block_editor.add_task") }}
            </button>
        </div>

        <TaskEdit
            v-if="editingBlock"
            :key="editingBlock.id"
            ref="taskEditRef"
            :task="editingBlock.data"
            :section="editingBlock.section"
            :flowId="flowId"
            :namespace="namespace"
            :isHidden="true"
            data-test="block-editor-task-edit"
            @update:task="onTaskEdited"
            @close="onEditorClose"
        />

        <KsDialog
            v-model="taskPickerVisible"
            :title="t('block_editor.pick_task_type')"
        >
            <div class="block-editor-picker" @keydown="onPickerKeydown">
                <KsInput
                    v-model="taskPickerSearch"
                    :placeholder="t('block_editor.search_task_placeholder')"
                    :aria-label="t('block_editor.search_task_placeholder')"
                    aria-controls="block-editor-picker-listbox"
                    :aria-activedescendant="pickerFocusedIndex >= 0 ? `block-editor-picker-option-${pickerFocusedIndex}` : undefined"
                    clearable
                    autofocus
                    data-test="block-editor-picker-search"
                />

                <div
                    id="block-editor-picker-listbox"
                    v-ks-loading="pluginsLoading"
                    class="block-editor-picker-list"
                    :class="{'block-editor-picker-list--loading': pluginsLoading}"
                    :aria-label="t('block_editor.pick_task_type')"
                    data-test="block-editor-picker-list"
                    role="listbox"
                >
                    <button
                        v-for="(type, idx) in filteredCommonTypes"
                        :id="`block-editor-picker-option-${idx}`"
                        :key="type.fqcn"
                        class="block-editor-picker-row"
                        :class="{'block-editor-picker-row--focused': pickerFocusedIndex === idx}"
                        type="button"
                        role="option"
                        :aria-selected="pickerFocusedIndex === idx"
                        @click="insertTask(type.fqcn)"
                        @mouseenter="pickerFocusedIndex = idx"
                    >
                        <KsTaskIcon
                            :cls="type.fqcn"
                            :icons="pluginsStore.icons"
                            :onlyIcon="true"
                        />
                        <span class="block-editor-picker-label">{{ type.label }}</span>
                        <span class="block-editor-picker-fqcn">{{ type.fqcn }}</span>
                    </button>

                    <p v-if="!pluginsLoading && filteredCommonTypes.length === 0" class="block-editor-picker-empty">
                        {{ t("block_editor.no_task_results") }}
                    </p>
                </div>
            </div>
        </KsDialog>
    </div>
</template>

<script setup lang="ts">
    import {computed, nextTick, ref, watch} from "vue"
    import {useI18n} from "vue-i18n"
    import PlusCircleOutline from "vue-material-design-icons/PlusCircleOutline.vue"

    import {KsTaskIcon, vKsLoading} from "@kestra-io/design-system"
    import {flowYamlUtils} from "@kestra-io/topology"

    import {useFlowStore} from "../../../stores/flow"
    import {usePluginsStore} from "../../../stores/plugins"
    import {isEntryAPluginElementPredicate, type PluginElement} from "../../../utils/pluginUtils"
    import {
        addBlock,
        addBlockAtPath,
        buildMinimalTask,
        collectAllIds,
        deleteBlock,
        deleteBlockAtPath,
        duplicateBlock,
        duplicateBlockAtPath,
        isFlowableType,
        moveBlockAtPath,
        reorderAtPath,
        updateBlock,
        updateBlockAtPath,
        type BlockSection,
    } from "../../../utils/flowableBlockOps"
    import {useDragAndDrop} from "../../../composables/useDragAndDrop"
    import BlockCard from "./BlockCard.vue"
    import BranchLane from "./BranchLane.vue"
    import FlowableClusterCard from "./FlowableClusterCard.vue"
    import TaskEdit from "../../flows/TaskEdit.vue"

    const {t} = useI18n()
    const flowStore = useFlowStore()
    const pluginsStore = usePluginsStore()

    const props = defineProps<{
        selectedId?: string
    }>()

    const emit = defineEmits<{
        (e: "update:selectedId", id: string | undefined): void
    }>()

    const flowYaml = computed<string>(() => flowStore.flowYaml ?? "")
    const flowId = computed<string>(() => flowStore.flow?.id ?? "")
    const namespace = computed<string>(() => flowStore.flow?.namespace ?? "")

    const parsedFlow = computed(() => {
        try {
            return flowYamlUtils.parse<Record<string, unknown>>(flowYaml.value)
        } catch {
            return undefined
        }
    })

    function isFlowable(task: Record<string, unknown>): boolean {
        return isFlowableType(String(task.type ?? ""), pluginsStore.icons)
    }

    const parsedTasks = computed<Record<string, unknown>[]>(() => {
        const tasks = parsedFlow.value?.tasks
        return Array.isArray(tasks) ? tasks : []
    })

    const parsedTriggers = computed<Record<string, unknown>[]>(() => {
        const triggers = parsedFlow.value?.triggers
        return Array.isArray(triggers) ? triggers : []
    })

    const flowLevelErrors = computed<Record<string, unknown>[]>(() => {
        const errors = parsedFlow.value?.errors
        return Array.isArray(errors) ? errors : []
    })

    const flowLevelFinally = computed<Record<string, unknown>[]>(() => {
        const fin = parsedFlow.value?.finally
        return Array.isArray(fin) ? fin : []
    })

    const hasContent = computed(() =>
        parsedTasks.value.length > 0 ||
        parsedTriggers.value.length > 0 ||
        flowLevelErrors.value.length > 0 ||
        flowLevelFinally.value.length > 0,
    )

    const localSelectedId = ref<string | undefined>(props.selectedId)

    const selectedId = computed({
        get: () => props.selectedId ?? localSelectedId.value,
        set: (v: string | undefined) => {
            localSelectedId.value = v
            emit("update:selectedId", v)
        },
    })

    watch(() => props.selectedId, (v) => {
        localSelectedId.value = v
    })

    interface EditingBlock {
        id: string
        section: BlockSection
        data: Record<string, unknown>
        path?: string
    }

    const editingBlock = ref<EditingBlock | undefined>(undefined)
    const taskEditRef = ref<InstanceType<typeof TaskEdit>>()

    async function selectBlock(section: BlockSection, block: Record<string, unknown>) {
        const strId = block.id != null ? String(block.id) : undefined
        if (!strId) return

        if (selectedId.value === strId) {
            selectedId.value = undefined
            editingBlock.value = undefined
            return
        }

        selectedId.value = strId
        editingBlock.value = {id: strId, section, data: block}
        await nextTick()
        taskEditRef.value?.open()
    }

    async function openNestedEdit(path: string) {
        const blockYaml = flowYamlUtils.extractBlockWithPath({source: flowYaml.value, path})
        if (!blockYaml) return

        const parsed = flowYamlUtils.parse<Record<string, unknown>>(blockYaml)
        if (!parsed || !parsed.id) return

        const strId = String(parsed.id)
        if (selectedId.value === strId) {
            selectedId.value = undefined
            editingBlock.value = undefined
            return
        }

        selectedId.value = strId
        const section: BlockSection = path.startsWith("errors") ? "errors" : path.startsWith("finally") ? "finally" : "tasks"
        editingBlock.value = {id: strId, section, data: parsed, path}
        await nextTick()
        taskEditRef.value?.open()
    }

    function onEditorClose() {
        selectedId.value = undefined
        editingBlock.value = undefined
    }

    const onEditTimeout = ref<ReturnType<typeof setTimeout>>()

    function applyYaml(newYaml: string) {
        flowStore.flowYaml = newYaml
        clearTimeout(onEditTimeout.value)
        onEditTimeout.value = setTimeout(() => {
            flowStore.onEdit({source: newYaml, topologyVisible: true})
        }, 1000)
    }

    function onTaskEdited(newContent: string) {
        if (!editingBlock.value) return
        const {section, id, path} = editingBlock.value
        if (path) {
            applyYaml(updateBlockAtPath(flowYaml.value, path, newContent))
        } else {
            applyYaml(updateBlock(flowYaml.value, section, id, newContent))
        }
        editingBlock.value = undefined
        selectedId.value = undefined
    }

    function onDelete(section: BlockSection, id: unknown) {
        if (typeof id !== "string") return
        const newYaml = deleteBlock(flowYaml.value, section, id)
        if (selectedId.value === id) {
            selectedId.value = undefined
            editingBlock.value = undefined
        }
        applyYaml(newYaml)
    }

    function onDeleteAtPath(path: string) {
        const newYaml = deleteBlockAtPath(flowYaml.value, path)
        const blockYaml = flowYamlUtils.extractBlockWithPath({source: flowYaml.value, path})
        if (blockYaml) {
            const parsed = flowYamlUtils.parse<Record<string, unknown>>(blockYaml)
            if (parsed?.id && selectedId.value === String(parsed.id)) {
                selectedId.value = undefined
                editingBlock.value = undefined
            }
        }
        applyYaml(newYaml)
    }

    function onDuplicate(section: BlockSection, id: unknown) {
        if (typeof id !== "string") return
        applyYaml(duplicateBlock(flowYaml.value, section, id))
    }

    function onDuplicateAtPath(path: string) {
        applyYaml(duplicateBlockAtPath(flowYaml.value, path))
    }

    const taskPickerVisible = ref(false)
    const taskPickerSearch = ref("")
    const taskPickerSection = ref<BlockSection>("tasks")
    const taskPickerParentPath = ref<string | undefined>(undefined)
    const taskPickerAfterIndex = ref<number | undefined>(undefined)
    const pluginsLoading = ref(false)
    const pickerFocusedIndex = ref(-1)

    function openTaskPicker(section: BlockSection) {
        taskPickerSection.value = section
        taskPickerParentPath.value = undefined
        taskPickerAfterIndex.value = undefined
        taskPickerSearch.value = ""
        pickerFocusedIndex.value = -1
        taskPickerVisible.value = true
        ensurePluginData()
    }

    function openTaskPickerAtPath(parentPath: string, afterIndex: number) {
        taskPickerParentPath.value = parentPath
        taskPickerAfterIndex.value = afterIndex >= 0 ? afterIndex : undefined
        taskPickerSearch.value = ""
        pickerFocusedIndex.value = -1
        taskPickerVisible.value = true
        ensurePluginData()
    }

    function ensurePluginData() {
        if (pluginsStore.plugins) return
        pluginsLoading.value = true
        pluginsStore.ensurePlugins().finally(() => {
            pluginsLoading.value = false
        })
    }

    interface PickerEntry {
        fqcn: string
        label: string
        group: string
    }

    const allPickerEntries = computed<PickerEntry[]>(() => {
        if (!pluginsStore.plugins) return []
        const entries: PickerEntry[] = []
        for (const plugin of pluginsStore.plugins) {
            for (const [key, value] of Object.entries(plugin)) {
                if (!isEntryAPluginElementPredicate(key, value)) continue
                for (const el of value as PluginElement[]) {
                    if (el.deprecated) continue
                    const parts = el.cls.split(".")
                    entries.push({
                        fqcn: el.cls,
                        label: el.title ?? parts[parts.length - 1] ?? el.cls,
                        group: plugin.title ?? plugin.name ?? "",
                    })
                }
            }
        }
        return entries
    })

    const filteredCommonTypes = computed<PickerEntry[]>(() => {
        const search = taskPickerSearch.value.trim().toLowerCase()
        const source = allPickerEntries.value
        if (!search) return source
        return source.filter(
            entry =>
                entry.label.toLowerCase().includes(search) ||
                entry.fqcn.toLowerCase().includes(search) ||
                entry.group.toLowerCase().includes(search),
        )
    })

    watch(filteredCommonTypes, () => {
        pickerFocusedIndex.value = -1
    })

    function onPickerKeydown(event: KeyboardEvent) {
        const list = filteredCommonTypes.value
        if (list.length === 0) return
        if (event.key === "ArrowDown") {
            event.preventDefault()
            pickerFocusedIndex.value = Math.min(pickerFocusedIndex.value + 1, list.length - 1)
        } else if (event.key === "ArrowUp") {
            event.preventDefault()
            pickerFocusedIndex.value = Math.max(pickerFocusedIndex.value - 1, 0)
        } else if (event.key === "Enter" && pickerFocusedIndex.value >= 0) {
            event.preventDefault()
            const entry = list[pickerFocusedIndex.value]
            if (entry) insertTask(entry.fqcn)
        }
    }

    function insertTask(fqcn: string) {
        const block = buildMinimalTask(fqcn, collectAllIds(flowYaml.value))

        if (taskPickerParentPath.value !== undefined) {
            applyYaml(addBlockAtPath(flowYaml.value, taskPickerParentPath.value, block, taskPickerAfterIndex.value))
        } else {
            const section = taskPickerSection.value
            const lastId = parsedTasks.value.length > 0
                ? String(parsedTasks.value[parsedTasks.value.length - 1].id ?? "")
                : undefined
            applyYaml(addBlock(flowYaml.value, section, block, lastId))
        }
        taskPickerVisible.value = false
    }

    const {
        dragOverIndex: taskDragOverIndex,
        handleDragStart: handleTaskDragStart,
        handleDragOver: handleTaskDragOver,
        handleDragEnd: handleTaskDragEnd,
        handleDrop: handleTaskDropBase,
    } = useDragAndDrop()

    function handleTaskDrop(event: DragEvent, targetIndex: number) {
        handleTaskDropBase(event, targetIndex, (from, to) => {
            applyYaml(reorderAtPath(flowYaml.value, "tasks", from, to))
        })
    }

    const {
        dragOverIndex: triggerDragOverIndex,
        handleDragStart: handleTriggerDragStart,
        handleDragOver: handleTriggerDragOver,
        handleDragEnd: handleTriggerDragEnd,
        handleDrop: handleTriggerDropBase,
    } = useDragAndDrop()

    function handleTriggerDrop(event: DragEvent, targetIndex: number) {
        handleTriggerDropBase(event, targetIndex, (from, to) => {
            applyYaml(reorderAtPath(flowYaml.value, "triggers", from, to))
        })
    }

    function onReorderAtPath(parentPath: string, fromIndex: number, toIndex: number) {
        applyYaml(reorderAtPath(flowYaml.value, parentPath, fromIndex, toIndex))
    }

    function onEditorKeydown(event: KeyboardEvent) {
        if (!selectedId.value) return
        const target = event.target as HTMLElement
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return

        if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault()
            deleteSelected()
        } else if (event.altKey && event.key === "ArrowUp") {
            event.preventDefault()
            moveSelected("up")
        } else if (event.altKey && event.key === "ArrowDown") {
            event.preventDefault()
            moveSelected("down")
        }
    }

    function deleteSelected() {
        if (!selectedId.value) return
        const id = selectedId.value
        if (editingBlock.value?.path) {
            onDeleteAtPath(editingBlock.value.path)
        } else {
            const section = editingBlock.value?.section ?? "tasks"
            onDelete(section, id)
        }
    }

    function moveSelected(direction: "up" | "down") {
        if (!selectedId.value || !editingBlock.value) return
        const path = editingBlock.value.path
        if (!path) {
            const section = editingBlock.value.section
            const list = section === "tasks" ? parsedTasks.value
                : section === "errors" ? flowLevelErrors.value
                    : section === "finally" ? flowLevelFinally.value
                        : parsedTriggers.value
            const idx = list.findIndex(item => String(item.id) === selectedId.value)
            if (idx < 0) return
            const syntheticPath = `${section}[${idx}]`
            applyYaml(moveBlockAtPath(flowYaml.value, syntheticPath, direction))
        } else {
            const newYaml = moveBlockAtPath(flowYaml.value, path, direction)
            if (newYaml === flowYaml.value) return
            const match = path.match(/^(.*)\[(\d+)\]$/)
            if (match) {
                const newIndex = direction === "up" ? parseInt(match[2], 10) - 1 : parseInt(match[2], 10) + 1
                editingBlock.value = {...editingBlock.value, path: `${match[1]}[${newIndex}]`}
            }
            applyYaml(newYaml)
        }
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
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-1);
        max-height: 320px;
        overflow-y: auto;

        &--loading {
            min-height: var(--ks-spacing-10);
        }
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

        &:hover,
        &--focused {
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
