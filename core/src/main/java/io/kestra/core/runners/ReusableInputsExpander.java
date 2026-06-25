package io.kestra.core.runners;

import java.util.List;
import java.util.stream.Stream;

import io.kestra.core.models.flows.Input;
import io.kestra.core.models.flows.input.ReusableInputsInput;

/**
 * Resolves a {@link ReusableInputsInput} reference into the referenced block's inputs, inlined into the flow as if
 * the block were copy-pasted: each input's id is prefixed with the reference id, so children resolve as
 * {@code {{ inputs.<refId>.<childId> }}}. Inlining (rather than wrapping in a single FORM) lets a block contain a
 * {@code FORM} of its own, since the spliced inputs are flattened by the normal input-resolution machinery.
 *
 * <p>This is an Enterprise Edition concern: the open-source default ({@code NoOpReusableInputsExpander}) errors, and
 * the EE implementation looks the block up from its namespace/tenant-scoped store, walking the namespace hierarchy.
 */
public interface ReusableInputsExpander {
    /**
     * @param tenantId      the tenant of the flow being executed
     * @param flowNamespace the namespace of the flow, used as the default when the reference omits one
     * @param input         the reference to resolve
     * @return the block's inputs, each with its id prefixed by {@code input.getId() + "."}, to splice into the flow
     */
    List<Input<?>> resolve(String tenantId, String flowNamespace, ReusableInputsInput input);

    /**
     * Inlines every {@link ReusableInputsInput} reference in {@code inputs} (each spliced in via {@link #resolve},
     * other inputs pass through unchanged). Returns the list untouched when it holds no reference, so flows without
     * reusable inputs never hit the store. This is the reusable-inputs counterpart of {@link Input#expandToLeaves} —
     * the single place the inlining happens, called from {@code FlowInterface.resolvableInputs(expander)} and the
     * input-resolution paths.
     */
    default List<Input<?>> expand(String tenantId, String flowNamespace, List<Input<?>> inputs) {
        if (inputs == null || inputs.stream().noneMatch(ReusableInputsInput.class::isInstance)) {
            return inputs;
        }

        return inputs.stream()
            .flatMap(input -> input instanceof ReusableInputsInput reusable
                ? resolve(tenantId, flowNamespace, reusable).stream()
                : Stream.of(input))
            .toList();
    }
}
