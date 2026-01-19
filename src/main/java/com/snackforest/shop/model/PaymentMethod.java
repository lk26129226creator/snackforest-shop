package com.snackforest.shop.model;

import jakarta.persistence.*;

@Entity
@Table(name = "payment_methods")
public class PaymentMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "idPaymentMethods") // 推測主鍵名稱
    private Integer id;

    @Column(name = "MethodName")
    private String methodName;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getMethodName() { return methodName; }
    public void setMethodName(String methodName) { this.methodName = methodName; }
}