package io.kestra.core.repositories;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;

import io.kestra.core.junit.annotations.KestraTest;
import io.kestra.core.lock.Lease;
import io.kestra.core.lock.LeaseHeldException;
import io.kestra.core.lock.LeaseStore;
import io.kestra.core.utils.IdUtils;

import jakarta.inject.Inject;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@KestraTest
public abstract class AbstractLeaseStoreTest {
    private static final String CATEGORY = "lease";

    @Inject
    protected LeaseStore leaseStore;

    @Test
    void shouldAllowExactlyOneWinnerWhenConcurrentlyAcquiring() throws Exception {
        String id = IdUtils.create();
        int threads = 16;

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger winners = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        AtomicReference<Throwable> unexpected = new AtomicReference<>();

        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            String executionId = "exec-" + i;
            futures.add(pool.submit(() -> {
                ready.countDown();
                try {
                    start.await();
                    leaseStore.acquire(executionLease(id, executionId, Instant.now().plusSeconds(60)));
                    winners.incrementAndGet();
                } catch (LeaseHeldException e) {
                    rejected.incrementAndGet();
                } catch (Throwable t) {
                    unexpected.set(t);
                }
            }));
        }

        ready.await();
        start.countDown();
        for (Future<?> f : futures) {
            f.get();
        }
        pool.shutdownNow();

        assertThat(unexpected.get()).isNull();
        assertThat(winners.get()).isEqualTo(1);
        assertThat(rejected.get()).isEqualTo(threads - 1);
        assertThat(leaseStore.findActive(CATEGORY, id)).isPresent();
    }

    @Test
    void shouldAllowExactlyOneWinnerWhenConcurrentlyTakingOverExpiredLease() throws Exception {
        String id = IdUtils.create();
        int threads = 16;
        ExecutorService pool = Executors.newFixedThreadPool(threads);

        // seed an already-expired lease from a SEPARATE (committed) transaction so the racers see a real,
        // pre-existing row. Seeding on the test thread would enlist it in the rolled-back test transaction.
        pool.submit(() -> leaseStore.acquire(executionLease(id, "exec-expired", Instant.now().minusSeconds(1)))).get();

        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger winners = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        AtomicReference<Throwable> unexpected = new AtomicReference<>();

        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            String executionId = "exec-" + i;
            futures.add(pool.submit(() -> {
                ready.countDown();
                try {
                    start.await();
                    leaseStore.acquire(executionLease(id, executionId, Instant.now().plusSeconds(60)));
                    winners.incrementAndGet();
                } catch (LeaseHeldException e) {
                    rejected.incrementAndGet();
                } catch (Throwable t) {
                    unexpected.set(t);
                }
            }));
        }

        ready.await();
        start.countDown();
        for (Future<?> f : futures) {
            f.get();
        }
        pool.shutdownNow();

        assertThat(unexpected.get()).isNull();
        assertThat(winners.get()).isEqualTo(1);
        assertThat(rejected.get()).isEqualTo(threads - 1);
        assertThat(leaseStore.findActive(CATEGORY, id)).isPresent();
    }

    @Test
    void shouldRejectWhenLiveLeaseHeldByDifferentOwner() {
        String id = IdUtils.create();
        leaseStore.acquire(executionLease(id, "exec-A", Instant.now().plusSeconds(60)));

        assertThatThrownBy(() -> leaseStore.acquire(executionLease(id, "exec-B", Instant.now().plusSeconds(60))))
            .isInstanceOf(LeaseHeldException.class);
    }

    @Test
    void shouldTakeOverExpiredLease() {
        String id = IdUtils.create();
        leaseStore.acquire(executionLease(id, "exec-A", Instant.now().minusSeconds(1)));
        assertThat(leaseStore.findActive(CATEGORY, id)).isEmpty();

        Lease taken = leaseStore.acquire(executionLease(id, "exec-B", Instant.now().plusSeconds(60)));
        assertThat(taken.getOwner()).isEqualTo("exec-B");
        assertThat(leaseStore.findActive(CATEGORY, id)).get().satisfies(lease -> assertThat(lease.getOwner()).isEqualTo("exec-B"));
    }

    @Test
    void shouldRefreshWhenReacquiredBySameOwner() {
        String id = IdUtils.create();
        leaseStore.acquire(executionLease(id, "exec-A", Instant.now().plusSeconds(30)));

        // truncate to millis so the round-trip comparison holds across all backends (H2/PG=micros, ES=millis)
        Instant secondUntil = Instant.now().plusSeconds(120).truncatedTo(ChronoUnit.MILLIS);
        Lease refreshed = leaseStore.acquire(executionLease(id, "exec-A", secondUntil));

        assertThat(refreshed.getLockedUntil()).isEqualTo(secondUntil);
        assertThat(leaseStore.findActive(CATEGORY, id)).get().satisfies(lease -> assertThat(lease.getLockedUntil()).isEqualTo(secondUntil));
    }

    @Test
    void shouldReleaseOnlyForMatchingOwner() {
        String id = IdUtils.create();
        leaseStore.acquire(executionLease(id, "exec-A", Instant.now().plusSeconds(60)));

        assertThat(leaseStore.release(CATEGORY, id, "exec-B")).isFalse();
        assertThat(leaseStore.findActive(CATEGORY, id)).isPresent();

        assertThat(leaseStore.release(CATEGORY, id, "exec-A")).isTrue();
        assertThat(leaseStore.findActive(CATEGORY, id)).isEmpty();
    }

    @Test
    void shouldForceReleaseRegardlessOfOwner() {
        String id = IdUtils.create();
        leaseStore.acquire(userLease(id, "alice", Instant.now().plusSeconds(60)));

        assertThat(leaseStore.forceRelease(CATEGORY, id)).isTrue();
        assertThat(leaseStore.findActive(CATEGORY, id)).isEmpty();
        assertThat(leaseStore.forceRelease(CATEGORY, id)).isFalse();
    }

    @Test
    void shouldUserLeaseBlockExecutionAcquire() {
        String id = IdUtils.create();
        leaseStore.acquire(userLease(id, "alice", Instant.now().plusSeconds(60)));

        assertThatThrownBy(() -> leaseStore.acquire(executionLease(id, "exec-A", Instant.now().plusSeconds(60))))
            .isInstanceOf(LeaseHeldException.class);
    }

    @Test
    void shouldBatchFindActiveExcludingExpired() {
        String liveId = IdUtils.create();
        String expiredId = IdUtils.create();
        String absentId = IdUtils.create();

        leaseStore.acquire(executionLease(liveId, "exec-A", Instant.now().plusSeconds(60)));
        leaseStore.acquire(executionLease(expiredId, "exec-B", Instant.now().minusSeconds(1)));

        Map<String, Lease> active = leaseStore.findActive(CATEGORY, List.of(liveId, expiredId, absentId));

        assertThat(active).containsOnlyKeys(liveId);
        assertThat(active.get(liveId).getOwner()).isEqualTo("exec-A");
    }

    @Test
    void shouldReturnEmptyWhenBatchFindActiveGivenNoIds() {
        assertThat(leaseStore.findActive(CATEGORY, List.of())).isEmpty();
    }

    @Test
    void shouldRoundTripLongAssetSizedId() {
        // An asset lease id is Asset.uid = tenant + "_" + assetId (assetId allowed up to 150 chars), so it
        // far exceeds the original locks.id VARCHAR(150). The 2.0.11 widening (id -> 500, key -> 700) must
        // accommodate it; before widening this failed with a confusing "row vanished" insert error.
        String id = "a".repeat(480);
        leaseStore.acquire(executionLease(id, "exec-A", Instant.now().plusSeconds(60)));
        assertThat(leaseStore.findActive(CATEGORY, id)).isPresent();
    }

    private Lease executionLease(String id, String executionId, Instant lockedUntil) {
        return Lease.builder()
            .category(CATEGORY)
            .id(id)
            .owner(executionId)
            .ownerType("EXECUTION")
            .createdAt(Instant.now())
            .lockedUntil(lockedUntil)
            .metadata(Map.of("executionId", executionId))
            .build();
    }

    private Lease userLease(String id, String username, Instant lockedUntil) {
        return Lease.builder()
            .category(CATEGORY)
            .id(id)
            .owner(username)
            .ownerType("USER")
            .createdAt(Instant.now())
            .lockedUntil(lockedUntil)
            .build();
    }
}
