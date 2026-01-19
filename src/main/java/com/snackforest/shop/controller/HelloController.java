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

    // 臨時修復 API：重置相關表格 (解決欄位衝突問題)
    @GetMapping("/api/fix-db")
    public String fixDb() {
        try {
            // 依照順序刪除，避免 Foreign Key 錯誤
            jdbcTemplate.execute("DROP TABLE IF EXISTS order_details");
            jdbcTemplate.execute("DROP TABLE IF EXISTS orders");
            jdbcTemplate.execute("DROP TABLE IF EXISTS customers");
            return "✅ 資料庫修復成功！customers 與訂單表格已刪除。請【重新啟動】後端程式以重建表格。";
        } catch (Exception e) {
            return "❌ 修復失敗: " + e.getMessage();
        }
    }
}