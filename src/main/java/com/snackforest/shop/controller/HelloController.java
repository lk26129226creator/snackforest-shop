package com.snackforest.shop.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import com.snackforest.shop.model.Product;
import com.snackforest.shop.repository.ProductRepository;

@RestController
public class HelloController {

    @Autowired
    private ProductRepository productRepository;

    // 公開 API：測試連線與列出商品
    @GetMapping("/api/products")
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    // 測試 API：確認系統運作中
    @GetMapping("/api/hello")
    public String hello() {
        return "Snackforest Shop System is Online! DB Connection: Active.";
    }
}