package com.snackforest.shop.controller;

import com.snackforest.shop.model.Product;
import com.snackforest.shop.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Base64;
import java.io.IOException;

@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {

    @Autowired
    private ProductRepository productRepository;

    // 新增商品 (包含圖片上傳)
    @PostMapping
    public Product createProduct(@RequestParam("name") String name,
                                 @RequestParam("price") Integer price,
                                 @RequestParam(value = "image", required = false) MultipartFile image) throws IOException {
        Product product = new Product();
        product.setProductName(name);
        product.setPrice(price);
        // ⚠️ 注意：這裡暫時將分類 ID 設為 1，請確保您的資料庫 category 表中至少有一筆 ID 為 1 的資料
        product.setCategoriesId(1); 

        if (image != null && !image.isEmpty()) {
            // 將圖片轉為 Base64 字串存入資料庫
            String base64 = Base64.getEncoder().encodeToString(image.getBytes());
            String dataUri = "data:" + (image.getContentType() != null ? image.getContentType() : "image/jpeg") + ";base64," + base64;
            product.setImageUrl(dataUri);
        }

        return productRepository.save(product);
    }
    
    // 更新商品
    @PutMapping("/{id}")
    public Product updateProduct(@PathVariable Integer id,
                                 @RequestParam("name") String name,
                                 @RequestParam("price") Integer price,
                                 @RequestParam(value = "image", required = false) MultipartFile image) throws IOException {
        Product product = productRepository.findById(id).orElseThrow(() -> new RuntimeException("Product not found"));
        product.setProductName(name);
        product.setPrice(price);
        
        if (image != null && !image.isEmpty()) {
            String base64 = Base64.getEncoder().encodeToString(image.getBytes());
            String dataUri = "data:" + (image.getContentType() != null ? image.getContentType() : "image/jpeg") + ";base64," + base64;
            product.setImageUrl(dataUri);
        }
        
        return productRepository.save(product);
    }

    // 刪除商品
    @DeleteMapping("/{id}")
    public void deleteProduct(@PathVariable Integer id) {
        productRepository.deleteById(id);
    }
}