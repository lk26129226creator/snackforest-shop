package com.snackforest.shop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.snackforest.shop.model.ShippingMethod;

public interface ShippingMethodRepository extends JpaRepository<ShippingMethod, Integer> {
}