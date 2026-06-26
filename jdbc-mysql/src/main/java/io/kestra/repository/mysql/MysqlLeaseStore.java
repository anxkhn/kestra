package io.kestra.repository.mysql;

import io.kestra.core.lock.Lease;
import io.kestra.core.repositories.RepositoryBean;
import io.kestra.jdbc.AbstractJdbcRepository;
import io.kestra.jdbc.repository.AbstractJdbcLeaseStore;

import jakarta.inject.Named;

@RepositoryBean
@MysqlRepositoryEnabled
public class MysqlLeaseStore extends AbstractJdbcLeaseStore {
    public MysqlLeaseStore(@Named("leases") AbstractJdbcRepository<Lease> jdbcRepository) {
        super(jdbcRepository);
    }
}
