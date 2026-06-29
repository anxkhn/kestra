import {describe, test, expect, vi} from "vitest"

vi.mock("@kestra-io/topology", () => ({
    flowYamlUtils: {
        parse: (s: string) => {
            if (s.includes("bad: {{{")) throw new Error("YAML parse error")
            if (s === "- item") return ["item"]
            const lines = s.split("\n")
            const result: Record<string, string> = {}
            for (const line of lines) {
                const m = line.match(/^(\w+):\s*(.+)$/)
                if (m) result[m[1]] = m[2].trim()
            }
            return result
        },
    },
}))

import {parseImportYaml} from "../../../src/utils/importYamlUtils"

describe("parseImportYaml", () => {
    test("returns error for empty input", () => {
        // Given / When
        const result = parseImportYaml("   ")

        // Then
        expect(result.error).toBeTruthy()
    })

    test("returns error when YAML fails to parse", () => {
        // Given / When
        const result = parseImportYaml("bad: {{{")

        // Then
        expect(result.error).toContain("YAML parse error")
    })

    test("returns error for non-mapping YAML (list)", () => {
        // Given / When
        const result = parseImportYaml("- item")

        // Then
        expect(result.error).toBeTruthy()
    })

    test("extracts id and namespace from a valid flow mapping", () => {
        // Given
        const yaml = "id: my-flow\nnamespace: company.team"

        // When
        const result = parseImportYaml(yaml)

        // Then
        expect(result.error).toBeUndefined()
        expect(result.id).toBe("my-flow")
        expect(result.namespace).toBe("company.team")
    })

    test("returns undefined id and namespace when absent from mapping", () => {
        // Given
        const yaml = "tasks: []"

        // When
        const result = parseImportYaml(yaml)

        // Then
        expect(result.error).toBeUndefined()
        expect(result.id).toBeUndefined()
        expect(result.namespace).toBeUndefined()
    })
})
