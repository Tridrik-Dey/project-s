@echo off
cd /d d:\Project1\backend
set SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/supplier_platform_phase_validation
set SPRING_DATASOURCE_USERNAME=supplier_admin
set SPRING_DATASOURCE_PASSWORD=supplier_pass
set SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver
set SPRING_JPA_HIBERNATE_DDL_AUTO=validate
set SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT=org.hibernate.dialect.PostgreSQLDialect
set FEATURE_REVAMP_READ_ENABLED=true
set FEATURE_REVAMP_WRITE_ENABLED=true
set FEATURE_REVAMP_ALIAS_ENABLED=false
mvn -Dmaven.repo.local=d:/Project1/.m2/repository spring-boot:run
