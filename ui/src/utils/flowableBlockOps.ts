import {flowYamlUtils} from "@kestra-io/topology"

export type BlockSection = "tasks" | "triggers" | "errors" | "finally"

const FLOWABLE_BRANCH_KEYS = ["tasks", "then", "else", "errors", "finally", "defaults", "cases"] as const

export const FLOWABLE_SUFFIXES = [
    "If", "Switch", "Parallel", "Sequential", "ForEach",
    "EachSequential", "Dag", "WaitFor", "ForEachItem",
] as const

export function isFlowableType(
    type: string,
    icons?: Record<string, {icon: string; flowable: boolean}>,
): boolean {
    const iconEntry = icons?.[type]
    if (iconEntry !== undefined) return iconEntry.flowable
    return FLOWABLE_SUFFIXES.some(suffix => type.endsWith(`.${suffix}`))
}

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
    const afterDelete = flowYamlUtils.replaceBlockWithPath({source, path, newContent: ""})
    return removeEmptySequences(afterDelete)
}

export function duplicateBlock(source: string, section: BlockSection, id: string): string {
    const blockYaml = flowYamlUtils.extractBlock({source, section, key: id})
    if (!blockYaml) return source

    const parsed = flowYamlUtils.parse<Record<string, unknown>>(blockYaml)
    if (!parsed) return source

    const existingIds = collectAllIds(source)
    const newId = uniqueId(String(parsed.id), existingIds)
    existingIds.add(newId)
    const duplicate = renameNestedIds({...parsed, id: newId}, existingIds)

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
    existingIds.add(newId)
    const duplicate = renameNestedIds({...parsed, id: newId}, existingIds)

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

function renameNestedIds(
    node: Record<string, unknown>,
    takenIds: Set<string>,
): Record<string, unknown> {
    const result: Record<string, unknown> = {...node}
    for (const key of FLOWABLE_BRANCH_KEYS) {
        const val = node[key]
        if (Array.isArray(val)) {
            result[key] = (val as Record<string, unknown>[]).map(item =>
                renameTaskNode(item, takenIds),
            )
        } else if (key === "cases" && val && typeof val === "object" && !Array.isArray(val)) {
            const casesObj = val as Record<string, unknown>
            const newCases: Record<string, unknown> = {}
            for (const [caseKey, caseVal] of Object.entries(casesObj)) {
                if (Array.isArray(caseVal)) {
                    newCases[caseKey] = (caseVal as Record<string, unknown>[]).map(item =>
                        renameTaskNode(item, takenIds),
                    )
                } else {
                    newCases[caseKey] = caseVal
                }
            }
            result[key] = newCases
        }
    }
    return result
}

function renameTaskNode(
    node: Record<string, unknown>,
    takenIds: Set<string>,
): Record<string, unknown> {
    if (!node || typeof node !== "object") return node
    const originalId = typeof node.id === "string" ? node.id : undefined
    if (originalId === undefined) return renameNestedIds(node, takenIds)
    const newId = uniqueId(originalId, takenIds)
    takenIds.add(newId)
    return renameNestedIds({...node, id: newId}, takenIds)
}

function removeEmptySequences(source: string): string {
    try {
        const parsed = flowYamlUtils.parse<Record<string, unknown>>(source)
        const cleaned = removeEmptyArrays(parsed) as Record<string, unknown>
        return flowYamlUtils.stringify(cleaned)
    } catch {
        return source
    }
}

function removeEmptyArrays(node: unknown): unknown {
    if (!node || typeof node !== "object") return node
    if (Array.isArray(node)) return node.map(removeEmptyArrays)
    const obj = node as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(obj)) {
        if (Array.isArray(val) && val.length === 0) continue
        result[key] = removeEmptyArrays(val)
    }
    return result
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

export function moveBlockAtPath(source: string, path: string, direction: "up" | "down"): string {
    const match = path.match(/^(.*)\[(\d+)\]$/)
    if (!match) return source

    const parentPath = match[1]
    const index = parseInt(match[2], 10)

    try {
        const parsed = flowYamlUtils.parse<Record<string, unknown>>(source)
        if (!parsed) return source

        const list = getAtPath(parsed, parentPath)
        if (!Array.isArray(list)) return source

        const targetIndex = direction === "up" ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= list.length) return source

        const copy = [...list]
        const tmp = copy[index]
        copy[index] = copy[targetIndex]
        copy[targetIndex] = tmp

        setAtPath(parsed, parentPath, copy)
        return flowYamlUtils.stringify(parsed)
    } catch {
        return source
    }
}

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
    const segments = parsePath(path)
    let cur: unknown = obj
    for (const seg of segments) {
        if (cur == null || typeof cur !== "object") return undefined
        if (Array.isArray(cur)) {
            cur = (cur as unknown[])[Number(seg)]
        } else {
            cur = (cur as Record<string, unknown>)[seg]
        }
    }
    return cur
}

function setAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const segments = parsePath(path)
    if (segments.length === 0) return
    let cur: unknown = obj
    for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i]
        if (cur == null || typeof cur !== "object") return
        if (Array.isArray(cur)) {
            cur = (cur as unknown[])[Number(seg)]
        } else {
            cur = (cur as Record<string, unknown>)[seg]
        }
    }
    const last = segments[segments.length - 1]
    if (cur == null || typeof cur !== "object") return
    if (Array.isArray(cur)) {
        (cur as unknown[])[Number(last)] = value
    } else {
        (cur as Record<string, unknown>)[last] = value
    }
}

function parsePath(path: string): string[] {
    const segments: string[] = []
    let remaining = path
    while (remaining.length > 0) {
        const bracketIdx = remaining.indexOf("[")
        const dotIdx = remaining.indexOf(".")
        if (bracketIdx === -1 && dotIdx === -1) {
            segments.push(remaining)
            break
        }
        const firstSpecial = bracketIdx === -1 ? dotIdx : dotIdx === -1 ? bracketIdx : Math.min(bracketIdx, dotIdx)
        if (firstSpecial > 0) {
            segments.push(remaining.slice(0, firstSpecial))
            remaining = remaining.slice(firstSpecial)
        } else if (remaining[0] === "[") {
            const close = remaining.indexOf("]")
            segments.push(remaining.slice(1, close))
            remaining = remaining.slice(close + 1)
            if (remaining.startsWith(".")) remaining = remaining.slice(1)
        } else if (remaining[0] === ".") {
            remaining = remaining.slice(1)
        }
    }
    return segments
}

let taskCounter = 0

export function buildMinimalTask(fqcn: string): Record<string, unknown> {
    const parts = fqcn.split(".")
    const shortName = parts[parts.length - 1] ?? "task"
    const id = shortName.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_" + Date.now().toString(36) + (++taskCounter).toString(36)
    return {id, type: fqcn}
}

export {collectAllIds}
