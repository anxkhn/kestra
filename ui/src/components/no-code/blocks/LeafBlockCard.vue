<template>
    <div
        class="leaf-block-card"
        :class="{'leaf-block-card--selected': selected}"
        role="button"
        tabindex="0"
        :aria-pressed="selected"
        :aria-label="cardAriaLabel"
        data-test="block-card"
        @click="emit('select')"
        @keydown.enter.prevent="emit('select')"
        @keydown.space.prevent="emit('select')"
    >
        <KsTaskIcon
            class="leaf-block-card-icon"
            :cls="String(block.type ?? '')"
            :icons="icons"
            :onlyIcon="true"
        />

        <span class="leaf-block-card-id" data-test="block-card-id">{{ block.id }}</span>

        <span class="leaf-block-card-type" data-test="block-card-type">{{ shortType }}</span>

        <div class="leaf-block-card-actions">
            <KsIconButton
                class="leaf-block-card-action"
                :aria-label="t('block_editor.duplicate')"
                :tooltip="t('block_editor.duplicate')"
                data-test="block-card-duplicate"
                @click.stop="emit('duplicate')"
            >
                <ContentCopy />
            </KsIconButton>

            <KsIconButton
                class="leaf-block-card-action leaf-block-card-action--danger"
                :aria-label="t('block_editor.delete')"
                :tooltip="t('block_editor.delete')"
                data-test="block-card-delete"
                @click.stop="emit('delete')"
            >
                <DeleteOutline />
            </KsIconButton>
        </div>
    </div>
</template>

<script setup lang="ts">
    import {computed} from "vue"
    import {useI18n} from "vue-i18n"
    import ContentCopy from "vue-material-design-icons/ContentCopy.vue"
    import DeleteOutline from "vue-material-design-icons/DeleteOutline.vue"

    import {KsTaskIcon, KsIconButton} from "@kestra-io/design-system"

    const {t} = useI18n()

    const props = defineProps<{
        block: Record<string, unknown>
        path: string
        selected?: boolean
        icons?: Record<string, {icon: string; flowable: boolean}>
    }>()

    const emit = defineEmits<{
        (e: "select"): void
        (e: "delete"): void
        (e: "duplicate"): void
    }>()

    const shortType = computed(() => {
        const type = String(props.block.type ?? "")
        const parts = type.split(".")
        return parts[parts.length - 1] ?? type
    })

    const cardAriaLabel = computed(() =>
        t("block_editor.card_aria_label", {id: String(props.block.id ?? ""), type: shortType.value}),
    )
</script>

<style scoped lang="scss">
    .leaf-block-card {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-3);
        padding: var(--ks-spacing-2) var(--ks-spacing-3);
        border: 1px solid var(--ks-border-default);
        border-radius: var(--ks-radius-base);
        background: var(--ks-bg-surface);
        cursor: pointer;
        transition: border-color 0.15s, background-color 0.15s;
        outline: none;

        &:hover {
            background: var(--ks-bg-hover);
            border-color: var(--ks-border-strong);
        }

        &:focus-visible {
            border-color: var(--ks-border-focus);
            box-shadow: 0 0 0 2px var(--ks-border-focus);
        }

        &--selected {
            border-color: var(--ks-border-focus);
            background: var(--ks-bg-active);
        }
    }

    .leaf-block-card-icon {
        flex-shrink: 0;
    }

    .leaf-block-card-id {
        font-size: var(--ks-font-size-sm);
        font-weight: 500;
        color: var(--ks-text-primary);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .leaf-block-card-type {
        font-size: var(--ks-font-size-xs);
        color: var(--ks-text-secondary);
        font-family: var(--ks-font-family-mono);
        flex-shrink: 0;
    }

    .leaf-block-card-actions {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-1);
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.15s;

        .leaf-block-card:hover &,
        .leaf-block-card:focus-within & {
            opacity: 1;
        }
    }

    .leaf-block-card-action {
        &--danger:hover {
            color: var(--ks-text-error);
        }
    }
</style>
