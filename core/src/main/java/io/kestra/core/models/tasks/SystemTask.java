package io.kestra.core.models.tasks;

/**
 * Marker interface for tasks that require direct access to Kestra
 * repositories (e.g. executions, logs, audit logs).
 *
 * <p>Tasks implementing this interface are routed to the reserved
 * worker group {@code "system"} and executed by the SystemWorker,
 * which runs inside a trusted process (webserver / standalone) and
 * has direct database access.</p>
 *
 * <p>Intended for core and Enterprise Edition tasks. Plugin authors
 * should not implement this interface: SystemTasks execute with raw
 * repository access and bypass the gRPC trust boundary.</p>
 *
 * <h2>EXCEPTIONAL USAGE — do not reach for this by default</h2>
 *
 * <p>The SystemWorker runs on the executor side (webserver / standalone), <b>not</b> on the
 * horizontally-scalable worker pool. Every SystemTask therefore consumes capacity on a process that
 * does <b>not</b> scale out the way regular workers do. This interface exists only for tasks that
 * genuinely need repositories/services <b>and</b> have <b>low volumetry</b> — e.g. one-off cleanup,
 * purge, or administrative tasks that run rarely and in small numbers.</p>
 *
 * <p><b>Do NOT implement {@code SystemTask} for tasks expected to run frequently or at scale.</b>
 * A high-volume task (one invoked by many flows / many executions) implemented as a SystemTask will
 * funnel that load onto the executor and become a scalability bottleneck. If such a task needs a
 * repository-backed operation, it must run on a <b>regular worker</b> and reach the operation
 * indirectly — via a gRPC controller service (the MetaStore pattern) or the Kestra client SDK — so
 * the work stays on the scalable worker tier and only the data access crosses to the trusted
 * process.</p>
 *
 * <p>This note is also a guardrail for AI agents and contributors: prefer the gRPC/SDK indirection
 * for anything that isn't clearly rare and low-volume. Reach for {@code SystemTask} only when no
 * scalable alternative is reasonable, and say why.</p>
 */
public interface SystemTask {
}
