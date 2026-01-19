package com.snackforest.shop.controller;

import com.snackforest.shop.model.Product;
import com.snackforest.shop.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Base64;

@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {

    @Autowired
    private ProductRepository productRepository;

    // 新增商品 (包含圖片上傳)
    @PostMapping
    public ResponseEntity<?> createProduct(@RequestParam("name") String name,
                                           @RequestParam("price") Integer price,
                                           @RequestParam(value = "image", required = false) MultipartFile image) {
        try {
            Product product = new Product();
            product.setName(name); // 修正：配合前端欄位名稱 (productName -> name)
            product.setPrice(price);
            product.setCategoryId(1); // 修正：命名慣例 (CategoriesId -> CategoryId)

            if (image != null && !image.isEmpty()) {
                String base64 = Base64.getEncoder().encodeToString(image.getBytes());
                String dataUri = "data:" + (image.getContentType() != null ? image.getContentType() : "image/jpeg") + ";base64," + base64;
                product.setImageUrl(dataUri);
            }

            productRepository.save(product);
            return ResponseEntity.ok("商品新增成功");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("新增失敗: " + e.getMessage());
        }

    }
    
    // 更新商品
    @PutMapping("/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable Integer id,
                                           @RequestParam("name") String name,
                                           @RequestParam("price") Integer price,
                                           @RequestParam(value = "image", required = false) MultipartFile image) {
        return productRepository.findById(id).map(product -> {
            try {
                product.setName(name);
                product.setPrice(price);
                
                if (image != null && !image.isEmpty()) {
                    String base64 = Base64.getEncoder().encodeToString(image.getBytes());
                    String dataUri = "data:" + (image.getContentType() != null ? image.getContentType() : "image/jpeg") + ";base64," + base64;
                    product.setImageUrl(dataUri);
                }
                
                productRepository.save(product);
                return ResponseEntity.ok("商品更新成功");
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body("更新失敗: " + e.getMessage());
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    // 刪除商品
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable Integer id) {
        if (productRepository.existsById(id)) {
            productRepository.deleteById(id);
            return ResponseEntity.ok("刪除成功");
        }
        return ResponseEntity.notFound().build();
    }
}