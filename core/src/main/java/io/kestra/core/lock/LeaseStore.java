package io.kestra.core.lock;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

/**
 * Store for long-living, TTL-bounded {@link Lease}s (see {@link Lease} for how a lease differs from a
 * {@link Lock} mutex).
 *
 * <p>Injected directly into server-side beans (executor / webserver / standalone) that have database
 * access — e.g. the EE asset service and the assets REST controller. It is a repository-backed store
 * and is not available on a worker; tasks that need to lock acquire/release through the REST API.</p>
 *
 * <p>Implementations must guarantee exactly one winner under concurrency, take over expired leases, and
 * refresh a lease re-acquired by the same owner.</p>
 */
public interface LeaseStore {
    /**
     * Atomically acquire/refresh a lease: inserts a fresh one, takes over an EXPIRED one, or refreshes one
     * held by the SAME owner; rejects a live lease held by a DIFFERENT owner.
     *
     * @return the persisted lease.
     * @throws LeaseHeldException if the lease is live and held by a different owner.
     */
    Lease acquire(Lease candidate);

    /**
     * @return the live lease on {@code (category, id)}, or empty if none / expired.
     */
    default Optional<Lease> findActive(String category, String id) {
        return findById(category, id).filter(lease -> lease.isActiveAt(Instant.now()));
    }

    /**
     * Batch variant of {@link #findActive(String, String)} (avoids N+1 when rendering a list). Keyed by
     * {@code id}, live entries only.
     */
    Map<String, Lease> findActive(String category, Collection<String> ids);

    /**
     * Owner-checked release: removes the lease only if it is held by {@code owner}.
     *
     * @return {@code true} if a lease was released.
     */
    boolean release(String category, String id, String owner);

    /**
     * Unconditional release regardless of owner — backs the manual unlock from the UI.
     *
     * @return {@code true} if a lease was removed.
     */
    boolean forceRelease(String category, String id);

    /**
     * Raw lookup regardless of expiry (used by {@link #findActive(String, String)}).
     */
    Optional<Lease> findById(String category, String id);
}
