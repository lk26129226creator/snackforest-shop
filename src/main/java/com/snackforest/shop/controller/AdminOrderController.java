package com.snackforest.shop.controller;

import com.snackforest.shop.model.Order;
import com.snackforest.shop.model.OrderDetail;
import com.snackforest.shop.repository.OrderRepository;
import com.snackforest.shop.repository.OrderDetailRepository;
import com.snackforest.shop.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrderController {

    @Autowired private OrderRepository orderRepository;
    @Autowired private OrderDetailRepository orderDetailRepository;
    @Autowired private ProductRepository productRepository;

    // 取得所有訂單列表
    @GetMapping
    public List<Order> getAllOrders() {
        // 實際專案建議使用分頁與排序 (例如 findAllByOrderByOrderDateDesc)
        // 這裡直接回傳所有訂單
        return orderRepository.findAll();
    }

    // 取得訂單數量 (用於前端輪詢通知)
    @GetMapping("/count")
    public long getOrderCount() {
        return orderRepository.count();
    }

    // 取得單筆訂單明細 (包含商品資訊)
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrderDetails(@PathVariable Integer id) {
        return orderRepository.findById(id).map(order -> {
            Map<String, Object> response = new HashMap<>();
            response.put("order", order);
            
            // 組合訂單明細與商品資訊
            List<Map<String, Object>> items = new ArrayList<>();
            // 注意：因為無法確認 Repository 是否有 findByOrderId，這裡使用 Stream 過濾確保安全
            List<OrderDetail> details = orderDetailRepository.findAll().stream()
                    .filter(d -> d.getOrderId().equals(id))
                    .collect(Collectors.toList());

            for (OrderDetail d : details) {
                Map<String, Object> itemMap = new HashMap<>();
                itemMap.put("quantity", d.getQuantity());
                itemMap.put("unitPrice", d.getUnitPrice());
                
                // 查詢商品名稱與圖片
                productRepository.findById(d.getProductId()).ifPresent(p -> {
                    itemMap.put("productName", p.getName());
                    itemMap.put("imageUrl", p.getImageUrl());
                });
                items.add(itemMap);
            }
            response.put("items", items);
            
            return ResponseEntity.ok(response);
        }).orElse(ResponseEntity.notFound().build());
    }

    // 更新訂單狀態
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        return orderRepository.findById(id).map(order -> {
            String newStatus = body.get("status");
            if (newStatus != null) {
                order.setStatus(newStatus);
                orderRepository.save(order);
            }
            return ResponseEntity.ok("狀態更新成功");
        }).orElse(ResponseEntity.notFound().build());
    }
}