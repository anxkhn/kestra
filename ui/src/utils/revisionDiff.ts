import {flowYamlUtils} from "@kestra-io/topology"

export type BlockSection = "tasks" | "triggers" | "errors" | "finally"

export type BlockChangeType = "added" | "removed" | "modified" | "unchanged"

export interface FieldChange {
    field: string
    oldValue: unknown
    newValue: unknown
}

export interface BlockDiff {
    id: string
    type: string | undefined
    section: BlockSection
    changeType: BlockChangeType
    fieldChanges: FieldChange[]
}

export interface RevisionDiff {
    blockDiffs: BlockDiff[]
    hasChanges: boolean
}

const SECTIONS: BlockSection[] = ["tasks", "triggers", "errors", "finally"]

function blockListFromSection(flow: Record<string, unknown>, section: BlockSection): Record<string, unknown>[] {
    const raw = flow[section]
    if (!Array.isArray(raw)) return []
    return raw.filter((b): b is Record<string, unknown> => b !== null && typeof b === "object")
}

function topLevelFieldChanges(oldBlock: Record<string, unknown>, newBlock: Record<string, unknown>): FieldChange[] {
    const allKeys = new Set([...Object.keys(oldBlock), ...Object.keys(newBlock)])
    const changes: FieldChange[] = []

    for (const key of allKeys) {
        const oldVal = oldBlock[key]
        const newVal = newBlock[key]
        const oldSerialized = JSON.stringify(oldVal)
        const newSerialized = JSON.stringify(newVal)
        if (oldSerialized !== newSerialized) {
            changes.push({field: key, oldValue: oldVal, newValue: newVal})
        }
    }

    return changes
}

export function computeRevisionDiff(leftSource: string, rightSource: string): RevisionDiff {
    const leftFlow = (flowYamlUtils.parse<Record<string, unknown>>(leftSource, false) ?? {}) as Record<string, unknown>
    const rightFlow = (flowYamlUtils.parse<Record<string, unknown>>(rightSource, false) ?? {}) as Record<string, unknown>

    const blockDiffs: BlockDiff[] = []

    for (const section of SECTIONS) {
        const leftBlocks = blockListFromSection(leftFlow, section)
        const rightBlocks = blockListFromSection(rightFlow, section)

        const leftById = new Map(leftBlocks.map(b => [String(b.id), b]))
        const rightById = new Map(rightBlocks.map(b => [String(b.id), b]))

        const allIds = [...new Set([...leftById.keys(), ...rightById.keys()])]

        for (const id of allIds) {
            const leftBlock = leftById.get(id)
            const rightBlock = rightById.get(id)

            if (leftBlock === undefined) {
                blockDiffs.push({
                    id,
                    type: rightBlock ? String(rightBlock.type) : undefined,
                    section,
                    changeType: "added",
                    fieldChanges: [],
                })
            } else if (rightBlock === undefined) {
                blockDiffs.push({
                    id,
                    type: String(leftBlock.type),
                    section,
                    changeType: "removed",
                    fieldChanges: [],
                })
            } else {
                const fieldChanges = topLevelFieldChanges(leftBlock, rightBlock)
                blockDiffs.push({
                    id,
                    type: String(rightBlock.type ?? leftBlock.type),
                    section,
                    changeType: fieldChanges.length > 0 ? "modified" : "unchanged",
                    fieldChanges,
                })
            }
        }
    }

    return {
        blockDiffs,
        hasChanges: blockDiffs.some(d => d.changeType !== "unchanged"),
    }
}
