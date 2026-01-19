package com.snackforest.shop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.snackforest.shop.model.Order;

public interface OrderRepository extends JpaRepository<Order, Integer> {
}
