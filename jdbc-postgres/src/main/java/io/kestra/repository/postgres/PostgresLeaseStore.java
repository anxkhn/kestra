package io.kestra.repository.postgres;

import io.kestra.core.lock.Lease;
import io.kestra.core.repositories.RepositoryBean;
import io.kestra.jdbc.AbstractJdbcRepository;
import io.kestra.jdbc.repository.AbstractJdbcLeaseStore;

import jakarta.inject.Named;

@RepositoryBean
@PostgresRepositoryEnabled
public class PostgresLeaseStore extends AbstractJdbcLeaseStore {
    public PostgresLeaseStore(@Named("leases") AbstractJdbcRepository<Lease> jdbcRepository) {
        super(jdbcRepository);
    }
}
