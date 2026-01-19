package com.snackforest.shop.controller;

import com.snackforest.shop.model.*;
import com.snackforest.shop.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ClientApiController {

    @Autowired private CustomerRepository customerRepository;
    @Autowired private ProductRepository productRepository; // 新增：用於查詢商品真實價格
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ShippingMethodRepository shippingMethodRepository;
    @Autowired private PaymentMethodRepository paymentMethodRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private OrderDetailRepository orderDetailRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    // 1. 會員註冊
    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody Map<String, String> body) {
        try {
            String account = body.get("account");
            String password = body.get("password");

            // 基本防呆驗證
            if (account == null || account.trim().isEmpty()) return ResponseEntity.badRequest().body("帳號不能為空");
            if (password == null || password.trim().isEmpty()) return ResponseEntity.badRequest().body("密碼不能為空");

            if (customerRepository.findByAccount(account).isPresent()) {
                return ResponseEntity.status(409).body("帳號已存在");
            }

            Customer customer = new Customer();
            customer.setAccount(account);
            customer.setPasswordHash(passwordEncoder.encode(password)); // 加密密碼
            customer.setCustomerName(body.get("name"));
            customer.setEmail(body.get("email"));
            customer.setPhone(body.get("phone"));
            
            customerRepository.save(customer);
            return ResponseEntity.ok("註冊成功");
        } catch (Exception e) {
            e.printStackTrace(); // 在後端 Console 印出詳細錯誤，方便除錯
            return ResponseEntity.status(500).body("註冊失敗: " + e.getMessage());
        }
    }
    
    // 2. 取得基礎資料 (分類、運送、付款)
    @GetMapping("/categories")
    public List<Category> getCategories() { return categoryRepository.findAll(); }

    @GetMapping("/shipping-methods")
    public List<ShippingMethod> getShippingMethods() { return shippingMethodRepository.findAll(); }

    @GetMapping("/payment-methods")
    public List<PaymentMethod> getPaymentMethods() { return paymentMethodRepository.findAll(); }

    // 4. 檢查登入狀態
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> checkLogin(Authentication auth) {
        Map<String, Object> response = new HashMap<>();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            response.put("loggedIn", true);
            response.put("account", auth.getName());
            // 順便回傳會員資料供前端使用
            customerRepository.findByAccount(auth.getName()).ifPresent(c -> {
                response.put("name", c.getCustomerName());
                response.put("email", c.getEmail());
                response.put("phone", c.getPhone());
            });
            return ResponseEntity.ok(response);
        }
        response.put("loggedIn", false);
        return ResponseEntity.ok(response);
    }

    // 5. 更新會員資料
    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return ResponseEntity.status(401).body("請先登入");
        }

        return customerRepository.findByAccount(auth.getName()).map(customer -> {
            if (body.containsKey("name")) customer.setCustomerName(body.get("name"));
            if (body.containsKey("email")) customer.setEmail(body.get("email"));
            if (body.containsKey("phone")) customer.setPhone(body.get("phone"));
            
            String newPassword = body.get("password");
            if (newPassword != null && !newPassword.trim().isEmpty()) {
                customer.setPasswordHash(passwordEncoder.encode(newPassword));
            }
            
            customerRepository.save(customer);
            return ResponseEntity.ok("更新成功");
        }).orElse(ResponseEntity.status(404).body("找不到會員資料"));
    }

    // 3. 提交訂單 (需登入)
    @PostMapping("/orders")
    public ResponseEntity<String> createOrder(@RequestBody OrderRequest request) {
        // 取得當前登入的會員
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String account = auth.getName();
        Customer customer = customerRepository.findByAccount(account)
                .orElseThrow(() -> new RuntimeException("找不到會員資料"));

        // 驗證訂單內容
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return ResponseEntity.badRequest().body("訂單內容不能為空");
        }

        // --- 安全性修正：由後端計算總金額，不信任前端傳來的價格 ---
        int calculatedTotal = 0;
        List<OrderDetail> detailsToSave = new ArrayList<>();

        for (OrderItem item : request.getItems()) {
            Product product = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new RuntimeException("商品不存在 ID: " + item.getProductId()));
            
            int quantity = item.getQuantity();
            if (quantity <= 0) continue;

            // 使用資料庫中的真實價格
            int realPrice = product.getPrice(); 
            calculatedTotal += (realPrice * quantity);

            OrderDetail detail = new OrderDetail();
            detail.setProductId(product.getId());
            detail.setQuantity(quantity);
            detail.setUnitPrice(realPrice); // 記錄當下購買的真實單價
            detailsToSave.add(detail);
        }

        // 建立訂單主檔
        Order order = new Order();
        order.setCustomerId(customer.getId());
        order.setOrderDate(LocalDateTime.now());
        order.setTotalAmount(calculatedTotal); // 使用後端計算的總金額
        order.setStatus("Pending");
        order.setShippingMethodId(request.getShippingMethodId());
        order.setPaymentMethodId(request.getPaymentMethodId());
        order.setRecipientName(request.getRecipientName());
        order.setRecipientPhone(request.getRecipientPhone());
        order.setRecipientAddress(request.getRecipientAddress());
        
        Order savedOrder = orderRepository.save(order);

        // 儲存訂單明細
        for (OrderDetail detail : detailsToSave) {
            detail.setOrderId(savedOrder.getId());
            orderDetailRepository.save(detail);
        }

        return ResponseEntity.ok("訂單提交成功，單號：" + savedOrder.getId());
    }

    // 內部類別：接收訂單 JSON 格式
    public static class OrderRequest {
        private Integer totalAmount;
        private Integer shippingMethodId;
        private Integer paymentMethodId;
        private String recipientName;
        private String recipientPhone;
        private String recipientAddress;
        private List<OrderItem> items;
        // Getters & Setters (省略，Spring 會自動處理)
        public Integer getTotalAmount() { return totalAmount; }
        public void setTotalAmount(Integer totalAmount) { this.totalAmount = totalAmount; }
        public Integer getShippingMethodId() { return shippingMethodId; }
        public void setShippingMethodId(Integer shippingMethodId) { this.shippingMethodId = shippingMethodId; }
        public Integer getPaymentMethodId() { return paymentMethodId; }
        public void setPaymentMethodId(Integer paymentMethodId) { this.paymentMethodId = paymentMethodId; }
        public String getRecipientName() { return recipientName; }
        public void setRecipientName(String recipientName) { this.recipientName = recipientName; }
        public String getRecipientPhone() { return recipientPhone; }
        public void setRecipientPhone(String recipientPhone) { this.recipientPhone = recipientPhone; }
        public String getRecipientAddress() { return recipientAddress; }
        public void setRecipientAddress(String recipientAddress) { this.recipientAddress = recipientAddress; }
        public List<OrderItem> getItems() { return items; }
        public void setItems(List<OrderItem> items) { this.items = items; }
    }

    public static class OrderItem {
        private Integer productId;
        private Integer quantity;
        private Integer unitPrice;
        // Getters & Setters
        public Integer getProductId() { return productId; }
        public void setProductId(Integer productId) { this.productId = productId; }
        public Integer getQuantity() { return quantity; }
        public void setQuantity(Integer quantity) { this.quantity = quantity; }
        public Integer getUnitPrice() { return unitPrice; }
        public void setUnitPrice(Integer unitPrice) { this.unitPrice = unitPrice; }
    }
}
