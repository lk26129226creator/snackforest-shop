package com.snackforest.shop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.CommandLineRunner;
import javax.sql.DataSource;
import java.sql.Connection;

import com.snackforest.shop.repository.*;

@SpringBootApplication
public class SnackforestShopApplication {
    public static void main(String[] args) {
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
            } catch (Exception e) {
                System.err.println("❌ Database connection failed: " + e.getMessage());
            }
        };
    }
}
