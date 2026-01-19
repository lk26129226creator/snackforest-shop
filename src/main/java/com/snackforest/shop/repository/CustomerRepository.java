package com.snackforest.shop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import com.snackforest.shop.model.Customer;

public interface CustomerRepository extends JpaRepository<Customer, Integer> {
    Optional<Customer> findByAccount(String account);
}