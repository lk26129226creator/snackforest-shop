package com.snackforest.shop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.snackforest.shop.model.PaymentMethod;

public interface PaymentMethodRepository extends JpaRepository<PaymentMethod, Integer> {
}