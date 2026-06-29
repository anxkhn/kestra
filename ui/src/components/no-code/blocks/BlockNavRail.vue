<template>
    <div class="block-nav-rail" data-test="block-nav-rail">
        <p class="block-nav-rail-title" aria-hidden="true">
            {{ t("block_editor.nav_rail_title") }}
        </p>

        <KsTree
            ref="treeRef"
            :data="treeData"
            nodeKey="id"
            :props="TREE_PROPS"
            :defaultExpandAll="true"
            class="block-nav-rail-tree"
            data-test="block-nav-rail-tree"
            @nodeClick="onNodeClick"
        >
            <template #default="{data: nodeData}">
                <span
                    class="block-nav-rail-node"
                    :class="{'block-nav-rail-node--selected': selectedId === nodeData.id}"
                    :data-test="`nav-rail-node-${nodeData.id}`"
                >
                    <KsTaskIcon
                        class="block-nav-rail-icon"
                        :cls="nodeData.type"
                        :icons="icons"
                        :onlyIcon="true"
                    />
                    <span class="block-nav-rail-label">{{ nodeData.label }}</span>
                </span>
            </template>
        </KsTree>

        <KsEmpty
            v-if="treeData.length === 0"
            class="block-nav-rail-empty"
            :description="t('block_editor.nav_rail_empty')"
        />
    </div>
</template>

<script setup lang="ts">
    import {computed, ref, watch} from "vue"
    import {useI18n} from "vue-i18n"
    import {KsTree, KsTaskIcon, KsEmpty} from "@kestra-io/design-system"

    const {t} = useI18n()

    const TREE_PROPS = {label: "label", children: "children"}

    interface TreeNode {
        id: string
        label: string
        type: string
        children?: TreeNode[]
    }

    const props = defineProps<{
        tasks: Record<string, unknown>[]
        triggers: Record<string, unknown>[]
        icons?: Record<string, {icon: string; flowable: boolean}>
        selectedId?: string
    }>()

    const emit = defineEmits<{
        (e: "select", id: string): void
    }>()

    const treeRef = ref()

    function buildNodes(items: Record<string, unknown>[]): TreeNode[] {
        return items.flatMap(item => {
            if (!item.id) return []
            const id = String(item.id)
            const type = String(item.type ?? "")
            const label = id
            const children: TreeNode[] = []

            for (const key of ["tasks", "then", "else", "errors", "finally", "defaults"]) {
                const val = item[key]
                if (Array.isArray(val) && val.length > 0) {
                    children.push(...buildNodes(val as Record<string, unknown>[]))
                }
            }

            const casesObj = item.cases
            if (casesObj && typeof casesObj === "object" && !Array.isArray(casesObj)) {
                for (const caseVal of Object.values(casesObj as Record<string, unknown>)) {
                    if (Array.isArray(caseVal)) {
                        children.push(...buildNodes(caseVal as Record<string, unknown>[]))
                    }
                }
            }

            return [{id, label, type, children: children.length > 0 ? children : undefined}]
        })
    }

    const treeData = computed<TreeNode[]>(() => {
        const nodes: TreeNode[] = []
        const taskNodes = buildNodes(props.tasks)
        if (taskNodes.length > 0) nodes.push(...taskNodes)
        const triggerNodes = buildNodes(props.triggers)
        if (triggerNodes.length > 0) nodes.push(...triggerNodes)
        return nodes
    })

    function onNodeClick(nodeData: TreeNode) {
        emit("select", nodeData.id)
    }

    watch(() => props.selectedId, (id) => {
        if (id && treeRef.value) {
            treeRef.value.setCurrentKey(id)
        }
    })
</script>

<style scoped lang="scss">
    .block-nav-rail {
        display: flex;
        flex-direction: column;
        width: var(--block-nav-rail-width, 220px);
        flex-shrink: 0;
        border-right: 1px solid var(--ks-border-default);
        overflow-y: auto;
        padding: var(--ks-spacing-3) 0;
        background: var(--ks-bg-surface);
    }

    .block-nav-rail-title {
        font-size: var(--ks-font-size-xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ks-text-muted);
        margin: 0 0 var(--ks-spacing-2) 0;
        padding: 0 var(--ks-spacing-3);
    }

    .block-nav-rail-tree {
        flex: 1;
    }

    .block-nav-rail-node {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-2);
        padding: var(--ks-spacing-1) var(--ks-spacing-2);
        border-radius: var(--ks-radius-base);
        cursor: pointer;
        transition: background-color 0.15s;
        width: 100%;

        &--selected {
            background: var(--ks-bg-active);
        }
    }

    .block-nav-rail-icon {
        flex-shrink: 0;
    }

    .block-nav-rail-label {
        font-size: var(--ks-font-size-sm);
        color: var(--ks-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .block-nav-rail-empty {
        padding: var(--ks-spacing-3);
    }
</style>
