import {flowYamlUtils} from "@kestra-io/topology"

export interface ParseImportResult {
    error?: string
    id?: string
    namespace?: string
}

export function parseImportYaml(yaml: string): ParseImportResult {
    if (!yaml.trim()) {
        return {error: "YAML content is empty."}
    }

    let parsed: unknown
    try {
        parsed = flowYamlUtils.parse(yaml)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return {error: msg}
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return {error: "Invalid flow YAML: expected a mapping."}
    }

    const record = parsed as Record<string, unknown>
    return {
        id: typeof record.id === "string" ? record.id : undefined,
        namespace: typeof record.namespace === "string" ? record.namespace : undefined,
    }
}
