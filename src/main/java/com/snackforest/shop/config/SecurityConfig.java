package com.snackforest.shop.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

import com.snackforest.shop.repository.CustomerRepository;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // 開發階段暫時關閉 CSRF
            .authorizeHttpRequests(auth -> auth
                // 開放靜態資源 (CSS, JS, 圖片) 與 前台頁面
                .requestMatchers("/client/**", "/css/**", "/js/**", "/images/**", "/").permitAll() // 開放 client 資料夾下所有檔案
                .requestMatchers("/admin/login.html").permitAll() // 特別開放後台登入頁，否則會被下面的規則擋住
                .requestMatchers("/admin/**", "/api/admin/**").hasRole("ADMIN") // 保護 admin 資料夾與後台 API
                .requestMatchers("/api/register", "/api/categories", "/api/shipping-methods", "/api/payment-methods", "/api/me", "/error", "/favicon.ico").permitAll() // 開放前台 API 與錯誤頁面
                .requestMatchers("/api/products/**", "/api/hello", "/api/fix-schema").permitAll() // 公開路徑
                .anyRequest().authenticated() // 其他都需要登入
            )
            .formLogin(form -> form
                .loginPage("/client/login.html") // 指定自訂登入頁 (路徑變更)
                .loginProcessingUrl("/perform_login") // 登入表單提交的 URL
                .successHandler(authenticationSuccessHandler()) // 使用自訂的成功處理器
                .failureUrl("/client/login.html?error=true") // 失敗跳轉 (路徑變更)
                .permitAll()
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/client/login.html") // 登出後導回登入頁
                .permitAll()
            ) // 啟用登出功能
            .httpBasic(basic -> {}); // 啟用 Basic Auth (方便 Postman 測試)

        return http.build();
    }

    // 登入成功後的導向邏輯
    @Bean
    public AuthenticationSuccessHandler authenticationSuccessHandler() {
        return (request, response, authentication) -> {
            var authorities = authentication.getAuthorities();
            String redirectUrl = "/client/client.html"; // 預設導向前台

            if (authorities.stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
                redirectUrl = "/admin/admin.html"; // 管理員導向後台
            }

            response.sendRedirect(redirectUrl);
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // 這裡我們混合使用：後台用記憶體帳號，前台用資料庫
    @Bean
    public UserDetailsService userDetailsService(CustomerRepository customerRepository) {
        // 1. 建立後台管理員 (因為 employee 表格缺密碼欄位，暫時寫死)
        InMemoryUserDetailsManager manager = new InMemoryUserDetailsManager();
        manager.createUser(User.withUsername("admin")
                .password(passwordEncoder().encode("000000"))
                .roles("ADMIN")
                .build());

        // 2. 為了讓 Customer 也能登入，我們需要一個自訂的邏輯
        // 注意：在真實專案中，通常會分開兩個 UserDetailsService 或使用 AuthenticationProvider
        // 這裡為了簡化示範，我們用一個簡單的 Wrapper，如果找不到 Admin 就找 Customer
        return username -> {
            if (manager.userExists(username)) {
                return manager.loadUserByUsername(username);
            }

            return customerRepository.findByAccount(username)
                    .map(customer -> User.withUsername(customer.getAccount())
                            .password(customer.getPasswordHash()) // 資料庫必須是 BCrypt 加密過的字串
                            .roles("USER")
                            .build())
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        };
    }
}