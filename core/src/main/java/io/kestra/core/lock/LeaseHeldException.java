package io.kestra.core.lock;

import lombok.Getter;

/**
 * Thrown when a {@link LeaseStore#acquire} is attempted on a resource that is currently live-leased by a
 * different owner. Carries the current holder so callers can surface who holds it and until when (the EE
 * webserver maps this to HTTP 423 LOCKED).
 */
@Getter
public class LeaseHeldException extends RuntimeException {
    private final transient Lease currentHolder;

    public LeaseHeldException(Lease currentHolder) {
        super(message(currentHolder));
        this.currentHolder = currentHolder;
    }

    private static String message(Lease holder) {
        return "Lease on '" + holder.getCategory() + "'.'" + holder.getId() + "' is held until "
            + holder.getLockedUntil() + " by " + holder.getOwnerType() + " '" + holder.getOwner() + "'.";
    }
}
