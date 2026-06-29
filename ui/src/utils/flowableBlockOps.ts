import {flowYamlUtils} from "@kestra-io/topology"

export type BlockSection = "tasks" | "triggers" | "errors" | "finally"

export function updateBlock(source: string, section: BlockSection, id: string, newContent: string): string {
    const existing = flowYamlUtils.extractBlock({source, section, key: id})
    if (!existing) return source
    const path = flowYamlUtils.getPathFromSectionAndId({source, section, id})
    if (!path) return source
    return flowYamlUtils.replaceBlockWithPath({source, path, newContent})
}

export interface BlockRef {
    section: BlockSection
    id: string
}

export function addBlock(source: string, section: BlockSection, block: Record<string, unknown>, afterId?: string): string {
    const refPath = afterId !== undefined
        ? (() => {
            const path = flowYamlUtils.getPathFromSectionAndId({source, section, id: afterId})
            if (!path) return undefined
            const match = path.match(/\[(\d+)\]$/)
            return match ? parseInt(match[1], 10) : undefined
        })()
        : undefined

    return flowYamlUtils.insertBlockWithPath({
        source,
        parentPath: section,
        newBlock: flowYamlUtils.stringify(block),
        refPath,
        position: "after",
    })
}

export function deleteBlock(source: string, section: BlockSection, id: string): string {
    return flowYamlUtils.deleteBlock({source, section, key: id})
}

export function duplicateBlock(source: string, section: BlockSection, id: string): string {
    const blockYaml = flowYamlUtils.extractBlock({source, section, key: id})
    if (!blockYaml) return source

    const parsed = flowYamlUtils.parse<Record<string, unknown>>(blockYaml)
    if (!parsed) return source

    const existingIds = collectIds(source)
    const baseId = `${parsed.id}_copy`
    let newId = baseId
    let counter = 2
    while (existingIds.has(newId)) {
        newId = `${baseId}_${counter++}`
    }

    const duplicate = {...parsed, id: newId}

    const path = flowYamlUtils.getPathFromSectionAndId({source, section, id})
    const match = path?.match(/\[(\d+)\]$/)
    const refPath = match ? parseInt(match[1], 10) : undefined

    return flowYamlUtils.insertBlockWithPath({
        source,
        parentPath: section,
        newBlock: flowYamlUtils.stringify(duplicate),
        refPath,
        position: "after",
    })
}

const ALL_SECTIONS: BlockSection[] = ["tasks", "triggers", "errors", "finally"]

function collectIds(source: string): Set<string> {
    const ids = new Set<string>()
    try {
        const parsed = flowYamlUtils.parse<Record<string, unknown>>(source)
        for (const section of ALL_SECTIONS) {
            const items = parsed?.[section]
            if (!Array.isArray(items)) continue
            for (const item of items) {
                if (item && typeof item === "object" && "id" in item) {
                    ids.add(String((item as Record<string, unknown>).id))
                }
            }
        }
    } catch {
        // ignore parse errors
    }
    return ids
}
