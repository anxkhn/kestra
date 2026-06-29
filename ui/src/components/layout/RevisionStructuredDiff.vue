<template>
    <div class="revision-structured-diff">
        <KsEmpty
            v-if="!diff.hasChanges"
            :description="t('revision_diff.no_changes')"
        />
        <div v-else class="diff-list">
            <div
                v-for="block in changedBlocks"
                :key="`${block.section}-${block.id}`"
                class="diff-card"
                :class="`diff-card--${block.changeType}`"
            >
                <div class="diff-card-header">
                    <div class="diff-card-identity">
                        <KsTaskIcon
                            :cls="block.type ?? ''"
                            :icons="pluginsStore.icons"
                            :onlyIcon="true"
                            class="diff-card-icon"
                        />
                        <span class="diff-card-id">{{ block.id }}</span>
                        <span class="diff-card-type">{{ shortType(block.type) }}</span>
                    </div>
                    <div class="diff-card-badge" :class="`diff-card-badge--${block.changeType}`" :aria-label="t(`revision_diff.${block.changeType}`)">
                        <component :is="changeIcon(block.changeType)" class="diff-card-badge-icon" :size="14" />
                        <span>{{ t(`revision_diff.${block.changeType}`) }}</span>
                    </div>
                </div>

                <div v-if="block.fieldChanges.length > 0" class="diff-fields">
                    <div
                        v-for="change in block.fieldChanges"
                        :key="change.field"
                        class="diff-field-row"
                    >
                        <span class="diff-field-name">{{ change.field }}</span>
                        <div class="diff-field-values">
                            <span class="diff-value diff-value--old">{{ formatValue(change.oldValue) }}</span>
                            <ArrowRight class="diff-arrow" :size="12" />
                            <span class="diff-value diff-value--new">{{ formatValue(change.newValue) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="unchangedBlocks.length > 0" class="diff-unchanged-summary">
                <span class="diff-unchanged-label">{{ t("revision_diff.unchanged_count", {count: unchangedBlocks.length}) }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import {computed, type Component} from "vue"
    import {useI18n} from "vue-i18n"
    import PlusCircleOutline from "vue-material-design-icons/PlusCircleOutline.vue"
    import MinusCircleOutline from "vue-material-design-icons/MinusCircleOutline.vue"
    import PencilOutline from "vue-material-design-icons/PencilOutline.vue"
    import ArrowRight from "vue-material-design-icons/ArrowRight.vue"
    import {KsEmpty, KsTaskIcon} from "@kestra-io/design-system"
    import {computeRevisionDiff, type BlockChangeType, type RevisionDiff} from "../../utils/revisionDiff"
    import {usePluginsStore} from "../../stores/plugins"

    const {t} = useI18n()
    const pluginsStore = usePluginsStore()

    const props = defineProps<{
        leftSource: string
        rightSource: string
    }>()

    const diff = computed<RevisionDiff>(() => computeRevisionDiff(props.leftSource, props.rightSource))

    const changedBlocks = computed(() => diff.value.blockDiffs.filter(b => b.changeType !== "unchanged"))
    const unchangedBlocks = computed(() => diff.value.blockDiffs.filter(b => b.changeType === "unchanged"))

    function changeIcon(changeType: BlockChangeType): Component {
        switch (changeType) {
        case "added": return PlusCircleOutline
        case "removed": return MinusCircleOutline
        default: return PencilOutline
        }
    }

    function shortType(fullType: string | undefined): string {
        if (!fullType) return ""
        const parts = fullType.split(".")
        return parts[parts.length - 1] ?? ""
    }

    function formatValue(value: unknown): string {
        if (value === undefined) return "—"
        if (value === null) return "null"
        if (typeof value === "string") return value.length > 60 ? value.slice(0, 57) + "..." : value
        return JSON.stringify(value, null, 0)
    }
</script>

<style scoped lang="scss">
    .revision-structured-diff {
        padding: var(--ks-spacing-3) 0;
        overflow-y: auto;
    }

    .diff-list {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-3);
    }

    .diff-card {
        border: 1px solid var(--ks-border-default);
        border-radius: var(--ks-radius-base);
        overflow: hidden;
    }

    .diff-card--added {
        border-color: var(--ks-border-success);
    }

    .diff-card--removed {
        border-color: var(--ks-border-error);
    }

    .diff-card--modified {
        border-color: var(--ks-border-warning);
    }

    .diff-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ks-spacing-2) var(--ks-spacing-3);
        background: var(--ks-bg-surface);
        gap: var(--ks-spacing-2);
    }

    .diff-card-identity {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-2);
        min-width: 0;
    }

    .diff-card-icon {
        flex-shrink: 0;
    }

    .diff-card-id {
        font-weight: 500;
        color: var(--ks-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .diff-card-type {
        color: var(--ks-text-secondary);
        white-space: nowrap;
    }

    .diff-card-badge {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-1);
        padding: var(--ks-spacing-1) var(--ks-spacing-2);
        border-radius: var(--ks-radius-base);
        font-size: var(--ks-font-size-xs);
        font-weight: 500;
        flex-shrink: 0;
    }

    .diff-card-badge--added {
        background: var(--ks-bg-success);
        color: var(--ks-text-success);
    }

    .diff-card-badge--removed {
        background: var(--ks-bg-error);
        color: var(--ks-text-error);
    }

    .diff-card-badge--modified {
        background: var(--ks-bg-warning);
        color: var(--ks-text-warning);
    }

    .diff-card-badge-icon {
        display: flex;
        align-items: center;
    }

    .diff-fields {
        border-top: 1px solid var(--ks-border-default);
        padding: var(--ks-spacing-2) var(--ks-spacing-3);
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-2);
    }

    .diff-field-row {
        display: flex;
        align-items: flex-start;
        gap: var(--ks-spacing-3);
        flex-wrap: wrap;
    }

    .diff-field-name {
        color: var(--ks-text-secondary);
        font-weight: 500;
        min-width: 10ch;
        flex-shrink: 0;
    }

    .diff-field-values {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-2);
        flex-wrap: wrap;
        min-width: 0;
    }

    .diff-value {
        font-family: var(--ks-font-family-mono);
        padding: 0 var(--ks-spacing-1);
        border-radius: var(--ks-radius-sm);
        max-width: 40ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .diff-value--old {
        background: var(--ks-bg-error);
        color: var(--ks-text-error);
        text-decoration: line-through;
    }

    .diff-value--new {
        background: var(--ks-bg-success);
        color: var(--ks-text-success);
    }

    .diff-arrow {
        color: var(--ks-text-secondary);
        flex-shrink: 0;
        display: flex;
        align-items: center;
    }

    .diff-unchanged-summary {
        padding: var(--ks-spacing-2) 0;
        text-align: center;
    }

    .diff-unchanged-label {
        color: var(--ks-text-secondary);
        font-size: var(--ks-font-size-sm);
    }
</style>
