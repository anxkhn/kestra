import {computed, reactive} from "vue"
import {useI18n} from "vue-i18n"
import type {RecipeState, TriggerType} from "../utils/recipeToYaml"

export type {RecipeState, TriggerType}

const DEFAULT_STATE: RecipeState = {
    triggerType: "execution",
    watchNamespace: "",
    includeSub: true,
    states: ["FAILED", "WARNING"],
    cron: "0 9 * * *",
    timezone: "",
    webhookKey: "",
    otherTriggerType: "",
    notify: {
        slack: false,
        teams: false,
        email: false,
    },
    slackChannel: "#alerts",
    teamsWebhook: "",
    emailTo: "",
}

export function useFlowRecipe() {
    const {t} = useI18n()

    const recipe = reactive<RecipeState>({...DEFAULT_STATE, notify: {...DEFAULT_STATE.notify}})

    const hasNotifyChannel = computed(() =>
        recipe.notify.slack || recipe.notify.teams || recipe.notify.email,
    )

    const isValid = computed(() => {
        if (!hasNotifyChannel.value) return false

        switch (recipe.triggerType) {
        case "execution":
            return recipe.states.length > 0
        case "schedule":
            return Boolean(recipe.cron)
        case "webhook":
            return Boolean(recipe.webhookKey)
        case "other":
            return Boolean(recipe.otherTriggerType)
        default:
            return false
        }
    })

    const summary = computed(() => {
        const channels: string[] = []
        if (recipe.notify.slack) channels.push("Slack")
        if (recipe.notify.teams) channels.push("Microsoft Teams")
        if (recipe.notify.email) channels.push(t("email"))

        const channelText = channels.length > 0
            ? channels.join(", ")
            : t("recipe.summary.no_channel")

        switch (recipe.triggerType) {
        case "execution": {
            const ns = recipe.watchNamespace || t("recipe.summary.any_namespace")
            const scope = recipe.includeSub
                ? t("recipe.summary.including_sub")
                : t("recipe.summary.exact_match")
            const stateText = recipe.states.length > 0
                ? recipe.states.join(", ")
                : "FAILED, WARNING"
            return t("recipe.summary.execution", {ns, scope, states: stateText, channels: channelText})
        }
        case "schedule":
            return t("recipe.summary.schedule", {cron: recipe.cron || "0 9 * * *", channels: channelText})
        case "webhook":
            return t("recipe.summary.webhook", {channels: channelText})
        case "other":
            return t("recipe.summary.other", {trigger: recipe.otherTriggerType || t("recipe.summary.selected_trigger"), channels: channelText})
        default:
            return ""
        }
    })

    function reset() {
        Object.assign(recipe, {...DEFAULT_STATE, notify: {...DEFAULT_STATE.notify}})
    }

    return {recipe, isValid, hasNotifyChannel, summary, reset}
}
