package com.snackforest.shop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.snackforest.shop.model.Category;

public interface CategoryRepository extends JpaRepository<Category, Integer> {
}