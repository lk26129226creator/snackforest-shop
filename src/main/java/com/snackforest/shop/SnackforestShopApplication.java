package com.snackforest.shop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.CommandLineRunner;
import javax.sql.DataSource;
import java.sql.Connection;

import com.snackforest.shop.repository.*;
import com.snackforest.shop.model.*;

@SpringBootApplication
public class SnackforestShopApplication {
    public static void main(String[] args) {
        // 為了讓 Hibernate 自動更新資料庫結構，請在 application.properties 中加入以下設定：
        // spring.jpa.hibernate.ddl-auto=update
        SpringApplication.run(SnackforestShopApplication.class, args);
    }

    // 設定 Hibernate 命名策略為 "原樣使用"，避免將駝峰命名 (如 idCustomers) 自動轉為蛇形命名 (如 id_customers)
    @Bean
    public org.hibernate.boot.model.naming.PhysicalNamingStrategy physicalNamingStrategy() {
        return new org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl();
    }

    @Bean
    public CommandLineRunner testConnection(DataSource dataSource,
                                            ProductRepository productRepository,
                                            CustomerRepository customerRepository,
                                            CategoryRepository categoryRepository,
                                            ShippingMethodRepository shippingMethodRepository,
                                            PaymentMethodRepository paymentMethodRepository,
                                            EmployeeRepository employeeRepository) {
        return args -> {
            try (Connection conn = dataSource.getConnection()) {
                System.out.println("✅ Database connection successful! URL: " + conn.getMetaData().getURL());
                
                // 驗證 Table 是否存在且 Entity 對應正確
                System.out.println("✅ Products Table 串接成功! 目前商品數量: " + productRepository.count());
                System.out.println("✅ Customers Table 串接成功! 目前客戶數量: " + customerRepository.count());
                System.out.println("✅ Category Table 串接成功! 目前分類數量: " + categoryRepository.count());
                System.out.println("✅ ShippingMethods Table 串接成功! 目前運送方式數量: " + shippingMethodRepository.count());
                System.out.println("✅ PaymentMethods Table 串接成功! 目前付款方式數量: " + paymentMethodRepository.count());
                System.out.println("✅ Employee Table 串接成功! 目前員工數量: " + employeeRepository.count());
                System.out.println("👉 若發生欄位錯誤，請訪問: https://snackforest-shop.up.railway.app/api/fix-db 進行修復");
                
                // 執行資料庫初始化
                initializeDatabase(categoryRepository, shippingMethodRepository, paymentMethodRepository, employeeRepository);
                
            } catch (Exception e) {
                System.err.println("❌ Database connection failed: " + e.getMessage());
            }
        };
    }

    private void initializeDatabase(CategoryRepository categoryRepository,
                                    ShippingMethodRepository shippingMethodRepository,
                                    PaymentMethodRepository paymentMethodRepository,
                                    EmployeeRepository employeeRepository) {
        if (categoryRepository.count() == 0) {
            Category c1 = new Category(); c1.setCategoryName("熱銷排行"); categoryRepository.save(c1);
            Category c2 = new Category(); c2.setCategoryName("季節限定"); categoryRepository.save(c2);
            Category c3 = new Category(); c3.setCategoryName("禮盒系列"); categoryRepository.save(c3);
            System.out.println("📦 已初始化商品分類");
        }

        if (shippingMethodRepository.count() == 0) {
            ShippingMethod s1 = new ShippingMethod(); s1.setMethodName("宅配到府"); shippingMethodRepository.save(s1);
            ShippingMethod s2 = new ShippingMethod(); s2.setMethodName("超商取貨"); shippingMethodRepository.save(s2);
            System.out.println("🚚 已初始化運送方式");
        }

        if (paymentMethodRepository.count() == 0) {
            PaymentMethod p1 = new PaymentMethod(); p1.setMethodName("信用卡"); paymentMethodRepository.save(p1);
            PaymentMethod p2 = new PaymentMethod(); p2.setMethodName("銀行轉帳"); paymentMethodRepository.save(p2);
            PaymentMethod p3 = new PaymentMethod(); p3.setMethodName("貨到付款"); paymentMethodRepository.save(p3);
            System.out.println("💳 已初始化付款方式");
        }
        
        if (employeeRepository.count() == 0) {
            Employee e1 = new Employee(); e1.setEmployeeName("Admin"); employeeRepository.save(e1);
        }
    }
}
