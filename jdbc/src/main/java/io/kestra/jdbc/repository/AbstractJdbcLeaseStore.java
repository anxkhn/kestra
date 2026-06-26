package io.kestra.jdbc.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.SQLDialect;
import org.jooq.exception.DataAccessException;
import org.jooq.impl.DSL;

import io.kestra.core.lock.Lease;
import io.kestra.core.lock.LeaseHeldException;
import io.kestra.core.lock.LeaseStore;
import io.kestra.core.utils.IdUtils;

/**
 * JDBC {@link LeaseStore} on the shared {@code locks} table (leases and {@link io.kestra.core.lock.Lock}
 * mutexes coexist, distinguished by row content; a {@code (category, id)} is only ever one or the other).
 *
 * <p>The "exactly one winner" guarantee for a first-time acquire comes from the PRIMARY KEY on {@code key}
 * (the deterministic {@link Lease#uid()}): concurrent inserts both pass the {@code FOR UPDATE} select
 * (which locks nothing when the row is absent), but only one insert succeeds — the loser re-reads the
 * winning row and is rejected by {@link #decide}. {@code FOR UPDATE} serializes takeover / refresh on an
 * already-existing row.</p>
 */
public abstract class AbstractJdbcLeaseStore extends AbstractJdbcRepository implements LeaseStore {
    protected final io.kestra.jdbc.AbstractJdbcRepository<Lease> jdbcRepository;

    public AbstractJdbcLeaseStore(io.kestra.jdbc.AbstractJdbcRepository<Lease> jdbcRepository) {
        this.jdbcRepository = jdbcRepository;
    }

    @Override
    public Optional<Lease> findById(String category, String id) {
        return this.jdbcRepository.getDslContextWrapper()
            .transactionResult(configuration -> {
                var select = DSL.using(configuration)
                    .select(field("value"))
                    .from(this.jdbcRepository.getTable())
                    .where(field("key").eq(IdUtils.fromParts(category, id)));
                return this.jdbcRepository.fetchOne(select);
            });
    }

    @Override
    public Map<String, Lease> findActive(String category, Collection<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }

        List<String> keys = ids.stream().map(id -> IdUtils.fromParts(category, id)).toList();
        return this.jdbcRepository.getDslContextWrapper()
            .transactionResult(configuration -> {
                var select = DSL.using(configuration)
                    .select(field("value"))
                    .from(this.jdbcRepository.getTable())
                    .where(field("key").in(keys));
                Instant now = Instant.now();
                return this.jdbcRepository.fetch(select).stream()
                    .filter(lease -> lease.isActiveAt(now))
                    .collect(Collectors.toMap(Lease::getId, lease -> lease));
            });
    }

    @Override
    public Lease acquire(Lease candidate) {
        return this.jdbcRepository.getDslContextWrapper()
            .transactionResult(configuration -> {
                var dslContext = DSL.using(configuration);
                Instant now = Instant.now();

                Optional<Lease> existing = fetchOneForUpdate(dslContext, candidate.uid());
                if (existing.isPresent()) {
                    return decide(dslContext, existing.get(), candidate, now);
                }

                // No row yet — try to win the insert. If we win, the candidate is the live lease (do NOT
                // run decide on it: a fresh lease would look active + different-owner and self-reject).
                if (tryInsert(dslContext, candidate)) {
                    return candidate;
                }

                // We lost the insert race: another acquire inserted concurrently. Re-read it and decide.
                Lease raced = fetchOneForUpdate(dslContext, candidate.uid())
                    .orElseThrow(() -> new IllegalStateException("Lease row vanished after a losing insert race for " + candidate.uid()));
                return decide(dslContext, raced, candidate, now);
            });
    }

    @Override
    public boolean release(String category, String id, String owner) {
        return this.jdbcRepository.getDslContextWrapper()
            .transactionResult(configuration -> {
                var dslContext = DSL.using(configuration);
                Optional<Lease> existing = fetchOneForUpdate(dslContext, IdUtils.fromParts(category, id));
                // owner-only match (no ownerType): owner ids are globally unique across owner types
                // (an executionId is never also a userId), so the owner alone identifies the holder.
                if (existing.isPresent() && Objects.equals(existing.get().getOwner(), owner)) {
                    this.jdbcRepository.delete(existing.get());
                    return true;
                }
                return false;
            });
    }

    @Override
    public boolean forceRelease(String category, String id) {
        return this.jdbcRepository.getDslContextWrapper()
            .transactionResult(configuration -> DSL.using(configuration)
                .delete(this.jdbcRepository.getTable())
                .where(field("key").eq(IdUtils.fromParts(category, id)))
                .execute() > 0
            );
    }

    /**
     * Decide the fate of an acquire against an {@code existing} row already present (and row-locked).
     * Rejects if the existing lease is live and held by a different owner; otherwise takes over an
     * expired lease or refreshes a same-owner lease by persisting {@code candidate}.
     */
    private Lease decide(DSLContext dslContext, Lease existing, Lease candidate, Instant now) {
        if (existing.isActiveAt(now) && !isSameOwner(existing, candidate)) {
            throw new LeaseHeldException(existing);
        }
        this.jdbcRepository.persist(candidate, dslContext, this.jdbcRepository.persistFields(candidate));
        return candidate;
    }

    private static boolean isSameOwner(Lease existing, Lease candidate) {
        return Objects.equals(existing.getOwner(), candidate.getOwner())
            && Objects.equals(existing.getOwnerType(), candidate.getOwnerType());
    }

    private boolean tryInsert(DSLContext dslContext, Lease candidate) {
        Map<Field<Object>, Object> fields = this.jdbcRepository.persistFields(candidate);
        try {
            var insert = dslContext
                .insertInto(this.jdbcRepository.getTable())
                .set(field("key"), candidate.uid())
                .set(fields);
            if (dslContext.configuration().dialect().supports(SQLDialect.POSTGRES) || dslContext.configuration().dialect().supports(SQLDialect.MYSQL)) {
                return insert.onDuplicateKeyIgnore().execute() > 0;
            }
            return insert.execute() > 0;
        } catch (DataAccessException e) {
            // Duplicate key on a concurrent first-time acquire (H2 path) — we lost the race.
            return false;
        }
    }

    private Optional<Lease> fetchOneForUpdate(DSLContext dslContext, String key) {
        var select = dslContext
            .select(field("value"))
            .from(this.jdbcRepository.getTable())
            .where(field("key").eq(key))
            .forUpdate();
        return this.jdbcRepository.fetchOne(select);
    }
}
