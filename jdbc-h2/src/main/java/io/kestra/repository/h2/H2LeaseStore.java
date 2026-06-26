package io.kestra.repository.h2;

import io.kestra.core.lock.Lease;
import io.kestra.core.repositories.RepositoryBean;
import io.kestra.jdbc.AbstractJdbcRepository;
import io.kestra.jdbc.repository.AbstractJdbcLeaseStore;

import jakarta.inject.Named;

@RepositoryBean
@H2RepositoryEnabled
public class H2LeaseStore extends AbstractJdbcLeaseStore {
    public H2LeaseStore(@Named("leases") AbstractJdbcRepository<Lease> jdbcRepository) {
        super(jdbcRepository);
    }
}
