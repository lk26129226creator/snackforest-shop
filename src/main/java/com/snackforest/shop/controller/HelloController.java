package com.snackforest.shop.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import com.snackforest.shop.model.Product;
import com.snackforest.shop.repository.ProductRepository;

@RestController
public class HelloController {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

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

    // 修復資料庫 Schema (刪除所有舊表，解決 500 錯誤)
    @GetMapping("/api/fix-schema")
    public String fixSchema() {
        try {
            // 刪除所有可能命名衝突的表格
            String[] tables = {"order_details", "orders", "customers", "products", "category", "shipping_methods", "payment_methods", "employee"};
            for (String table : tables) {
                jdbcTemplate.execute("DROP TABLE IF EXISTS " + table);
            }
            return "✅ 資料庫表格已清除。請【重新啟動】後端程式以重建正確的表格結構。";
        } catch (Exception e) {
            return "❌ 修復失敗: " + e.getMessage();
        }
    }
}