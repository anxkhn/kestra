package io.kestra.core.lock;

import java.time.Instant;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

import io.kestra.core.models.HasUID;
import io.kestra.core.utils.IdUtils;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.With;

/**
 * A long-living, TTL-bounded <b>lease</b> on a resource, keyed by {@code (category, id)}.
 *
 * <p>A lease is distinct from a {@link Lock}: a {@code Lock} is a transient transactional mutex taken
 * via {@link LockService#doInLock}/{@link LockService#tryLock} — owned by a server instance, held only
 * for the duration of a runnable, with no expiry. A {@code Lease} is owned by an EXECUTION or a USER,
 * survives across an async, multi-server execution, and carries a TTL ({@link #lockedUntil}). Expiry is
 * lazy — there is no janitor: an expired lease is ignored by {@code findActive} and taken over by the
 * next {@code acquire}.</p>
 *
 * <p>Leases are persisted in the same {@code locks} table as {@link Lock}s (no dedicated table); the two
 * never share a {@code (category, id)} so a row is unambiguously one or the other.</p>
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Lease implements HasUID {
    private String category;
    private String id;
    private String owner;

    /** {@code EXECUTION} or {@code USER}. */
    private String ownerType;

    @With
    private Instant createdAt;

    @With
    private Instant lockedUntil;

    /** Display-only metadata (e.g. executionId, flowId, flowNamespace, taskRunId, username, namespace). */
    private Map<String, Object> metadata;

    @Override
    public String uid() {
        return IdUtils.fromParts(this.category, this.id);
    }

    /** @return {@code true} if this lease is still in effect at {@code now}. */
    public boolean isActiveAt(Instant now) {
        return this.lockedUntil != null && this.lockedUntil.isAfter(now);
    }
}
