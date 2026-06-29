import {describe, test, expect, vi} from "vitest"
import {mount} from "@vue/test-utils"
import {createI18n} from "vue-i18n"
import {createPinia} from "pinia"

const pushMock = vi.fn()

vi.mock("vue-router", () => ({
    useRouter: () => ({push: pushMock}),
    useRoute: () => ({params: {}, query: {}}),
}))

vi.mock("override/stores/misc", () => ({
    useMiscStore: () => ({configs: {systemNamespace: "kestra.system"}}),
}))

vi.mock("../../../../../src/composables/useNamespaces", () => ({
    default: () => ({all: vi.fn().mockResolvedValue([{id: "company.team"}, {id: "dev"}])}),
    defaultNamespace: () => undefined,
}))

const messages = {
    en: {
        "new_flow_landing.title": "Create a new flow",
        "new_flow_landing.subtitle": "Start from a blank canvas, explore blueprints, or import an existing YAML.",
        "new_flow_landing.blank.title": "Blank flow",
        "new_flow_landing.blank.subtitle": "Start with a hello-world starter and build from scratch.",
        "new_flow_landing.blank.id_label": "Flow id",
        "new_flow_landing.blank.id_placeholder": "my-flow",
        "new_flow_landing.blank.namespace_placeholder": "Select a namespace",
        "new_flow_landing.blank.open_editor": "Open editor",
        "new_flow_landing.blueprints.title": "Browse blueprints",
        "new_flow_landing.blueprints.subtitle": "Pick a ready-made flow from the community catalog.",
        "new_flow_landing.system.title": "Create a system flow",
        "new_flow_landing.system.subtitle": "Build an alert or automation flow for your platform.",
        "new_flow_landing.system.badge": "SYSTEM",
        "new_flow_landing.import.title": "Import YAML",
        "new_flow_landing.import.subtitle": "Paste or upload an existing flow definition.",
        "new_flow_landing.import.back": "Back",
        "new_flow_landing.import.paste_label": "Paste YAML",
        "new_flow_landing.import.upload_label": "Or upload a file",
        "new_flow_landing.import.upload_button": "Upload .yml / .yaml",
        "new_flow_landing.import.upload_tip": "Accepts .yml and .yaml files.",
        "new_flow_landing.import.submit": "Import flow",
        "new_flow_landing.import.read_error": "Could not read the file.",
        namespace: "namespace",
    },
}

const globalConfig = {
    global: {
        plugins: [
            createI18n({legacy: false, locale: "en", messages}),
            createPinia(),
        ],
        stubs: {
            KsText: {template: "<span><slot /></span>"},
            KsIcon: {template: "<span />"},
            KsTag: {template: "<span><slot /></span>"},
            KsCard: {template: "<div><slot /></div>"},
            KsAlert: {template: "<div><slot /></div>"},
            KsFormItem: {template: "<div><slot /></div>"},
            KsInput: {
                template: "<input :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
                props: ["modelValue"],
                emits: ["update:modelValue"],
            },
            KsSelect: {
                template: "<select :value='modelValue' @change=\"$emit('update:modelValue', $event.target.value)\"><slot /></select>",
                props: ["modelValue"],
                emits: ["update:modelValue"],
            },
            KsOption: {template: "<option :value='value'>{{label}}</option>", props: ["value", "label"]},
            KsButton: {
                template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
                props: ["disabled"],
                emits: ["click"],
            },
        },
    },
}

import NewFlowLanding from "../../../../../src/components/flows/create/NewFlowLanding.vue"

describe("NewFlowLanding", () => {
    test("renders primary blank-flow card and three secondary rows", () => {
        // Given / When
        const wrapper = mount(NewFlowLanding, globalConfig)

        // Then
        expect(wrapper.find("[data-test='blank-flow-card']").exists()).toBe(true)
        expect(wrapper.find("[data-test='browse-blueprints-card']").exists()).toBe(true)
        expect(wrapper.find("[data-test='system-flow-card']").exists()).toBe(true)
        expect(wrapper.find("[data-test='import-yaml-card']").exists()).toBe(true)
    })

    test("Open editor button is disabled when id or namespace is empty", async () => {
        // Given
        const wrapper = mount(NewFlowLanding, globalConfig)

        // Then — no id or namespace filled
        const btn = wrapper.find("[data-test='blank-flow-open-editor']")
        expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    })

    test("emits proceed with id and namespace when Open editor is clicked", async () => {
        // Given
        const wrapper = mount(NewFlowLanding, globalConfig)

        // When — fill id and namespace
        const idInput = wrapper.find("[data-test='blank-flow-id']")
        await idInput.setValue("my-flow")

        const nsSelect = wrapper.find("[data-test='blank-flow-namespace']")
        await nsSelect.setValue("company.team")

        // When — click Open editor
        const btn = wrapper.find("[data-test='blank-flow-open-editor']")
        await btn.trigger("click")

        // Then
        expect(wrapper.emitted("proceed")).toBeTruthy()
        const [payload] = wrapper.emitted("proceed")![0] as [{id: string; namespace: string}]
        expect(payload.id).toBe("my-flow")
        expect(payload.namespace).toBe("company.team")
    })

    test("Browse blueprints navigates to the blueprints route", async () => {
        // Given
        const wrapper = mount(NewFlowLanding, globalConfig)
        pushMock.mockReset()

        // When
        await wrapper.find("[data-test='browse-blueprints-card']").trigger("click")

        // Then
        expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({name: "blueprints"}))
    })

    test("Create a system flow navigates to the system namespace blueprints tab", async () => {
        // Given
        const wrapper = mount(NewFlowLanding, globalConfig)
        pushMock.mockReset()

        // When
        await wrapper.find("[data-test='system-flow-card']").trigger("click")

        // Then — must use the config value, not a hardcoded 'system' literal
        expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
            name: "namespaces/update",
            params: expect.objectContaining({id: "kestra.system"}),
            query: expect.objectContaining({tab: "blueprints"}),
        }))
    })

    test("Import YAML card emits import event", async () => {
        // Given
        const wrapper = mount(NewFlowLanding, globalConfig)

        // When
        await wrapper.find("[data-test='import-yaml-card']").trigger("click")

        // Then
        expect(wrapper.emitted("import")).toBeTruthy()
    })
})
