import {describe, test, expect, vi} from "vitest"
import {mount} from "@vue/test-utils"
import {createI18n} from "vue-i18n"

vi.mock("@kestra-io/topology", () => ({
    flowYamlUtils: {
        parse: (s: string) => {
            if (s.trim().startsWith("INVALID")) throw new Error("invalid YAML")
            return {id: "test-flow", namespace: "company.team"}
        },
        stringify: (obj: unknown) => JSON.stringify(obj),
    },
}))

const messages = {
    en: {
        "new_flow_landing.import.title": "Import YAML",
        "new_flow_landing.import.back": "Back",
        "new_flow_landing.import.paste_label": "Paste YAML",
        "new_flow_landing.import.upload_label": "Or upload a file",
        "new_flow_landing.import.upload_button": "Upload .yml / .yaml",
        "new_flow_landing.import.upload_tip": "Accepts .yml and .yaml files.",
        "new_flow_landing.import.submit": "Import flow",
        "new_flow_landing.import.read_error": "Could not read the file.",
    },
}

const globalConfig = {
    global: {
        plugins: [
            createI18n({legacy: false, locale: "en", messages}),
        ],
        stubs: {
            KsText: {template: "<span><slot /></span>"},
            KsIcon: {template: "<span />"},
            KsAlert: {template: "<div class='ks-alert'><slot /></div>"},
            KsButton: {
                template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
                props: ["disabled"],
                emits: ["click"],
            },
            KsEditor: {
                template: "<textarea :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
                props: ["modelValue"],
                emits: ["update:modelValue"],
            },
            KsUpload: {
                template: "<div><slot /><slot name='tip' /></div>",
                emits: ["change"],
            },
        },
    },
}

import ImportYaml from "../../../../../src/components/flows/create/ImportYaml.vue"

const VALID_YAML = "id: my-flow\nnamespace: company.team\ntasks:\n  - id: hello\n    type: io.kestra.plugin.core.log.Log\n    message: Hello"

describe("ImportYaml", () => {
    test("renders editor and submit button", () => {
        // Given / When
        const wrapper = mount(ImportYaml, globalConfig)

        // Then
        expect(wrapper.find("[data-test='import-yaml-editor']").exists()).toBe(true)
        expect(wrapper.find("[data-test='import-yaml-submit']").exists()).toBe(true)
        expect(wrapper.find("[data-test='import-yaml-back']").exists()).toBe(true)
    })

    test("submit button is disabled when editor is empty", () => {
        // Given
        const wrapper = mount(ImportYaml, globalConfig)

        // Then
        const btn = wrapper.find("[data-test='import-yaml-submit']")
        expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    })

    test("emits submit with yaml on valid YAML", async () => {
        // Given
        const wrapper = mount(ImportYaml, globalConfig)
        const editor = wrapper.find("[data-test='import-yaml-editor']")
        await editor.setValue(VALID_YAML)

        // When
        await wrapper.find("[data-test='import-yaml-submit']").trigger("click")

        // Then
        expect(wrapper.find("[data-test='import-yaml-error']").exists()).toBe(false)
        expect(wrapper.emitted("submit")).toBeTruthy()
        const [payload] = wrapper.emitted("submit")![0] as [{yaml: string}]
        expect(payload.yaml).toBe(VALID_YAML)
    })

    test("shows parse error alert on invalid YAML", async () => {
        // Given
        const wrapper = mount(ImportYaml, globalConfig)
        const editor = wrapper.find("[data-test='import-yaml-editor']")
        await editor.setValue("INVALID: {{{")

        // When
        await wrapper.find("[data-test='import-yaml-submit']").trigger("click")

        // Then
        expect(wrapper.find("[data-test='import-yaml-error']").exists()).toBe(true)
        expect(wrapper.emitted("submit")).toBeFalsy()
    })

    test("emits back when back button is clicked", async () => {
        // Given
        const wrapper = mount(ImportYaml, globalConfig)

        // When
        await wrapper.find("[data-test='import-yaml-back']").trigger("click")

        // Then
        expect(wrapper.emitted("back")).toBeTruthy()
    })
})
