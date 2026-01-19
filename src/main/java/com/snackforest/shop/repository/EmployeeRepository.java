package com.snackforest.shop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.snackforest.shop.model.Employee;

public interface EmployeeRepository extends JpaRepository<Employee, Integer> {
}