import {flowYamlUtils} from "@kestra-io/topology"

export type BlockSection = "tasks" | "triggers" | "errors" | "finally"

const FLOWABLE_BRANCH_KEYS = ["tasks", "then", "else", "errors", "finally", "defaults", "cases"] as const

export function updateBlock(source: string, section: BlockSection, id: string, newContent: string): string {
    const existing = flowYamlUtils.extractBlock({source, section, key: id})
    if (!existing) return source
    const path = flowYamlUtils.getPathFromSectionAndId({source, section, id})
    if (!path) return source
    return flowYamlUtils.replaceBlockWithPath({source, path, newContent})
}

export function updateBlockAtPath(source: string, path: string, newContent: string): string {
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

export function addBlockAtPath(
    source: string,
    parentPath: string,
    block: Record<string, unknown>,
    afterIndex?: number,
): string {
    return flowYamlUtils.insertBlockWithPath({
        source,
        parentPath,
        newBlock: flowYamlUtils.stringify(block),
        refPath: afterIndex,
        position: "after",
    })
}

export function deleteBlock(source: string, section: BlockSection, id: string): string {
    return flowYamlUtils.deleteBlock({source, section, key: id})
}

export function deleteBlockAtPath(source: string, path: string): string {
    return flowYamlUtils.replaceBlockWithPath({source, path, newContent: ""})
}

export function duplicateBlock(source: string, section: BlockSection, id: string): string {
    const blockYaml = flowYamlUtils.extractBlock({source, section, key: id})
    if (!blockYaml) return source

    const parsed = flowYamlUtils.parse<Record<string, unknown>>(blockYaml)
    if (!parsed) return source

    const existingIds = collectAllIds(source)
    const newId = uniqueId(String(parsed.id), existingIds)
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

export function duplicateBlockAtPath(source: string, path: string): string {
    const blockYaml = flowYamlUtils.extractBlockWithPath({source, path})
    if (!blockYaml) return source

    const parsed = flowYamlUtils.parse<Record<string, unknown>>(blockYaml)
    if (!parsed) return source

    const existingIds = collectAllIds(source)
    const newId = uniqueId(String(parsed.id), existingIds)
    const duplicate = {...parsed, id: newId}

    const parentPath = pathParent(path)
    const match = path.match(/\[(\d+)\]$/)
    const refPath = match ? parseInt(match[1], 10) : undefined

    return flowYamlUtils.insertBlockWithPath({
        source,
        parentPath,
        newBlock: flowYamlUtils.stringify(duplicate),
        refPath,
        position: "after",
    })
}

function pathParent(path: string): string {
    const lastBracket = path.lastIndexOf("[")
    if (lastBracket !== -1) return path.slice(0, lastBracket)
    const lastDot = path.lastIndexOf(".")
    if (lastDot !== -1) return path.slice(0, lastDot)
    return path
}

function uniqueId(baseId: string, existingIds: Set<string>): string {
    const candidate = `${baseId}_copy`
    if (!existingIds.has(candidate)) return candidate
    let counter = 2
    while (existingIds.has(`${candidate}_${counter}`)) counter++
    return `${candidate}_${counter}`
}

function collectAllIds(source: string): Set<string> {
    const ids = new Set<string>()
    try {
        const parsed = flowYamlUtils.parse<Record<string, unknown>>(source)
        walkIds(parsed, ids)
    } catch {
        // ignore parse errors
    }
    return ids
}

function walkIds(node: unknown, ids: Set<string>): void {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) {
        for (const item of node) walkIds(item, ids)
        return
    }
    const obj = node as Record<string, unknown>
    if ("id" in obj && typeof obj.id === "string") ids.add(obj.id)
    for (const key of FLOWABLE_BRANCH_KEYS) {
        const val = obj[key]
        if (Array.isArray(val)) {
            for (const item of val) walkIds(item, ids)
        } else if (val && typeof val === "object") {
            for (const caseVal of Object.values(val as Record<string, unknown>)) {
                if (Array.isArray(caseVal)) {
                    for (const item of caseVal) walkIds(item, ids)
                }
            }
        }
    }
}

export {collectAllIds}
