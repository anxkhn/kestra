<template>
    <div class="notify-grid" data-test="recipe-notify-grid">
        <div
            v-for="channel in channels"
            :key="channel.key"
            class="notify-card"
            :class="{selected: recipe.notify[channel.key as keyof typeof recipe.notify]}"
            role="checkbox"
            :aria-checked="recipe.notify[channel.key as keyof typeof recipe.notify]"
            :aria-label="channel.label"
            tabindex="0"
            @click="toggleChannel(channel.key)"
            @keydown.enter="toggleChannel(channel.key)"
            @keydown.space.prevent="toggleChannel(channel.key)"
        >
            <div class="card-header">
                <div class="icon-wrap">
                    <KsIcon :name="channel.icon" class="channel-icon" />
                </div>
                <KsCheckbox
                    :modelValue="recipe.notify[channel.key as keyof typeof recipe.notify]"
                    style="pointer-events: none;"
                    :aria-hidden="true"
                />
            </div>
            <span class="channel-label">{{ channel.label }}</span>
            <span class="channel-sub">{{ channel.sub }}</span>

            <div v-if="recipe.notify[channel.key as keyof typeof recipe.notify]" class="channel-config" @click.stop>
                <KsInput
                    v-if="channel.key === 'slack'"
                    v-model="recipe.slackChannel"
                    :placeholder="$t('recipe.notify.slack_channel_placeholder')"
                    size="small"
                    data-test="recipe-slack-channel"
                />
                <KsInput
                    v-else-if="channel.key === 'teams'"
                    v-model="recipe.teamsWebhook"
                    :placeholder="$t('recipe.notify.teams_webhook_placeholder')"
                    size="small"
                    data-test="recipe-teams-webhook"
                />
                <KsInput
                    v-else-if="channel.key === 'email'"
                    v-model="recipe.emailTo"
                    :placeholder="$t('recipe.notify.email_to_placeholder')"
                    size="small"
                    data-test="recipe-email-to"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import {useI18n} from "vue-i18n"
    import type {RecipeState} from "../../../composables/useFlowRecipe"

    const props = defineProps<{
        recipe: RecipeState
    }>()

    const {t} = useI18n()

    const channels = [
        {
            key: "slack",
            label: "Slack",
            sub: t("recipe.notify.slack_sub"),
            icon: "slack",
        },
        {
            key: "teams",
            label: "Microsoft Teams",
            sub: t("recipe.notify.teams_sub"),
            icon: "microsoft-teams",
        },
        {
            key: "email",
            label: t("recipe.notify.email_label"),
            sub: t("recipe.notify.email_sub"),
            icon: "email-outline",
        },
    ]

    const toggleChannel = (key: string) => {
        const k = key as keyof typeof props.recipe.notify
        props.recipe.notify[k] = !props.recipe.notify[k]
    }
</script>

<style scoped lang="scss">
    .notify-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
        gap: var(--ks-spacing-3);
    }

    .notify-card {
        display: flex;
        flex-direction: column;
        gap: var(--ks-spacing-2);
        padding: var(--ks-spacing-3);
        border: 1px solid var(--ks-border-default);
        border-radius: var(--ks-radius-base);
        cursor: pointer;
        transition: border-color 0.15s, background-color 0.15s;

        &:hover {
            border-color: var(--ks-border-strong);
            background-color: var(--ks-bg-hover);
        }

        &.selected {
            border-color: var(--ks-border-focus);
            background-color: var(--ks-bg-tag-active);
        }
    }

    .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .icon-wrap {
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--ks-radius-sm);
        background-color: var(--ks-bg-badge);
    }

    .channel-icon {
        color: var(--ks-text-primary);
    }

    .channel-label {
        display: block;
        font-weight: var(--ks-font-weight-medium);
    }

    .channel-sub {
        display: block;
        font-size: var(--ks-font-size-sm);
        color: var(--ks-text-secondary);
    }

    .channel-config {
        margin-top: var(--ks-spacing-1);
    }
</style>
