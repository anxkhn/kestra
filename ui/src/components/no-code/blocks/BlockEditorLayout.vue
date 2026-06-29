<template>
    <div class="block-editor-layout" data-test="block-editor-layout">
        <BlockNavRail
            :tasks="parsedTasks"
            :triggers="parsedTriggers"
            :icons="pluginsStore.icons"
            :selectedId="selectedId"
            @select="onRailSelect"
        />

        <BlockEditor
            v-model:selectedId="selectedId"
            class="block-editor-layout-main"
        />
    </div>
</template>

<script setup lang="ts">
    import {computed, ref} from "vue"
    import {flowYamlUtils} from "@kestra-io/topology"

    import {useFlowStore} from "../../../stores/flow"
    import {usePluginsStore} from "../../../stores/plugins"
    import BlockEditor from "./BlockEditor.vue"
    import BlockNavRail from "./BlockNavRail.vue"

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

    const selectedId = ref<string | undefined>(undefined)

    function onRailSelect(id: string) {
        selectedId.value = selectedId.value === id ? undefined : id
    }
</script>

<style scoped lang="scss">
    .block-editor-layout {
        display: flex;
        height: 100%;
        overflow: hidden;
    }

    .block-editor-layout-main {
        flex: 1;
        overflow: hidden;
    }
</style>
