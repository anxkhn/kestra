<template>
    <div class="new-flow-landing" data-test="new-flow-landing">
        <div class="landing-header">
            <KsText tag="h1" class="landing-title">{{ $t("new_flow_landing.title") }}</KsText>
            <KsText class="landing-sub">{{ $t("new_flow_landing.subtitle") }}</KsText>
        </div>

        <div class="landing-body">
            <KsCard class="primary-card" shadow="never" data-test="blank-flow-card">
                <div class="primary-card-header">
                    <div class="primary-icon">
                        <KsIcon name="plus" />
                    </div>
                    <div>
                        <KsText tag="h2" class="card-title">{{ $t("new_flow_landing.blank.title") }}</KsText>
                        <KsText class="card-sub">{{ $t("new_flow_landing.blank.subtitle") }}</KsText>
                    </div>
                </div>

                <div class="primary-card-fields">
                    <KsFormItem :label="$t('new_flow_landing.blank.id_label')" class="field-item">
                        <KsInput
                            v-model="flowId"
                            :placeholder="$t('new_flow_landing.blank.id_placeholder')"
                            data-test="blank-flow-id"
                        />
                    </KsFormItem>

                    <KsFormItem :label="$t('namespace')" class="field-item">
                        <KsSelect
                            v-model="selectedNamespace"
                            filterable
                            :placeholder="$t('new_flow_landing.blank.namespace_placeholder')"
                            data-test="blank-flow-namespace"
                        >
                            <KsOption
                                v-for="ns in namespaceOptions"
                                :key="ns"
                                :label="ns"
                                :value="ns"
                            />
                        </KsSelect>
                    </KsFormItem>
                </div>

                <KsButton
                    type="primary"
                    :disabled="!flowId || !selectedNamespace"
                    data-test="blank-flow-open-editor"
                    @click="openEditor"
                >
                    {{ $t("new_flow_landing.blank.open_editor") }}
                </KsButton>
            </KsCard>

            <div class="secondary-rows">
                <KsCard
                    class="secondary-card"
                    shadow="never"
                    role="button"
                    tabindex="0"
                    data-test="browse-blueprints-card"
                    @click="browseBluprints"
                    @keydown.enter="browseBluprints"
                    @keydown.space.prevent="browseBluprints"
                >
                    <div class="secondary-card-icon">
                        <KsIcon name="view-grid-outline" />
                    </div>
                    <div class="secondary-card-body">
                        <KsText class="secondary-card-title">{{ $t("new_flow_landing.blueprints.title") }}</KsText>
                        <KsText class="secondary-card-sub">{{ $t("new_flow_landing.blueprints.subtitle") }}</KsText>
                    </div>
                    <KsIcon name="chevron-right" class="secondary-card-arrow" />
                </KsCard>

                <KsCard
                    class="secondary-card"
                    shadow="never"
                    role="button"
                    tabindex="0"
                    data-test="system-flow-card"
                    @click="createSystemFlow"
                    @keydown.enter="createSystemFlow"
                    @keydown.space.prevent="createSystemFlow"
                >
                    <div class="secondary-card-icon">
                        <KsIcon name="cog-outline" />
                    </div>
                    <div class="secondary-card-body">
                        <KsText class="secondary-card-title">
                            {{ $t("new_flow_landing.system.title") }}
                        </KsText>
                        <KsText class="secondary-card-sub">{{ $t("new_flow_landing.system.subtitle") }}</KsText>
                    </div>
                    <KsTag size="small" class="system-badge">{{ $t("new_flow_landing.system.badge") }}</KsTag>
                    <KsIcon name="chevron-right" class="secondary-card-arrow" />
                </KsCard>

                <KsCard
                    class="secondary-card"
                    shadow="never"
                    role="button"
                    tabindex="0"
                    data-test="import-yaml-card"
                    @click="emit('import')"
                    @keydown.enter="emit('import')"
                    @keydown.space.prevent="emit('import')"
                >
                    <div class="secondary-card-icon">
                        <KsIcon name="tray-arrow-down" />
                    </div>
                    <div class="secondary-card-body">
                        <KsText class="secondary-card-title">{{ $t("new_flow_landing.import.title") }}</KsText>
                        <KsText class="secondary-card-sub">{{ $t("new_flow_landing.import.subtitle") }}</KsText>
                    </div>
                    <KsIcon name="chevron-right" class="secondary-card-arrow" />
                </KsCard>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import {ref, onMounted} from "vue"
    import {useRouter, useRoute} from "vue-router"
    import {useMiscStore} from "override/stores/misc"
    import useNamespaces from "../../../composables/useNamespaces"

    const emit = defineEmits<{
        proceed: [{id: string; namespace: string}]
        import: []
    }>()

    const router = useRouter()
    const route = useRoute()
    const miscStore = useMiscStore()

    const flowId = ref("")
    const selectedNamespace = ref("")
    const namespaceOptions = ref<string[]>([])

    onMounted(async () => {
        try {
            const ns = await useNamespaces(500).all()
            namespaceOptions.value = ns.map(n => n.id)
        } catch {
            namespaceOptions.value = []
        }
    })

    const openEditor = () => {
        emit("proceed", {id: flowId.value, namespace: selectedNamespace.value})
    }

    const browseBluprints = () => {
        router.push({
            name: "blueprints",
            params: {tenant: route.params.tenant, kind: "flow", tab: "community"},
        })
    }

    const createSystemFlow = () => {
        const systemNs = miscStore.configs?.systemNamespace ?? "system"
        router.push({
            name: "namespaces/update",
            params: {tenant: route.params.tenant, id: systemNs},
            query: {tab: "blueprints"},
        })
    }
</script>

<style scoped lang="scss">
    .new-flow-landing {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: var(--ks-spacing-8) var(--ks-spacing-4);
        min-height: 100%;
    }

    .landing-header {
        text-align: center;
        margin-bottom: var(--ks-spacing-6);
    }

    .landing-title {
        margin: 0 0 var(--ks-spacing-2);
        font-size: var(--ks-font-size-2xl);
        font-weight: var(--ks-font-weight-semibold);
    }

    .landing-sub {
        display: block;
        color: var(--ks-text-secondary);
    }

    .landing-body {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-4);
        width: 100%;
        max-width: 36rem;
    }

    .primary-card {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-4);
        padding: var(--ks-spacing-5);
        border: 1px solid var(--ks-border-default);
        border-radius: var(--ks-radius-base);
        background-color: var(--ks-bg-surface);
    }

    .primary-card-header {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-3);
    }

    .primary-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--ks-radius-base);
        background-color: var(--ks-bg-badge);
        flex-shrink: 0;
        color: var(--ks-text-primary);
    }

    .card-title {
        display: block;
        font-weight: var(--ks-font-weight-semibold);
        font-size: var(--ks-font-size-md);
        margin-bottom: var(--ks-spacing-1);
    }

    .card-sub {
        display: block;
        font-size: var(--ks-font-size-sm);
        color: var(--ks-text-secondary);
    }

    .primary-card-fields {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-3);
    }

    .field-item {
        margin-bottom: 0;
    }

    .secondary-rows {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-2);
    }

    .secondary-card {
        display: flex;
        align-items: center;
        gap: var(--ks-spacing-3);
        padding: var(--ks-spacing-4);
        border: 1px solid var(--ks-border-default);
        border-radius: var(--ks-radius-base);
        background-color: var(--ks-bg-surface);
        cursor: pointer;
        transition: border-color 0.15s, background-color 0.15s;

        &:hover {
            border-color: var(--ks-border-strong);
            background-color: var(--ks-bg-hover);
        }

        &:focus-visible {
            outline: 2px solid var(--ks-border-focus);
            outline-offset: 2px;
        }
    }

    .secondary-card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: var(--ks-radius-sm);
        background-color: var(--ks-bg-badge);
        flex-shrink: 0;
        color: var(--ks-text-primary);
    }

    .secondary-card-body {
        flex: 1;
        min-width: 0;
    }

    .secondary-card-title {
        display: block;
        font-weight: var(--ks-font-weight-medium);
    }

    .secondary-card-sub {
        display: block;
        font-size: var(--ks-font-size-sm);
        color: var(--ks-text-secondary);
    }

    .secondary-card-arrow {
        flex-shrink: 0;
        color: var(--ks-icon-muted);
    }

    .system-badge {
        flex-shrink: 0;
    }
</style>
