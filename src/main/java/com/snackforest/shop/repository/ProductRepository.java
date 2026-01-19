package com.snackforest.shop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.snackforest.shop.model.Product;

public interface ProductRepository extends JpaRepository<Product, Integer> {
}