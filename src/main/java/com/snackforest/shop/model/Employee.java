package com.snackforest.shop.model;

import jakarta.persistence.*;

@Entity
@Table(name = "employee")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "idEmployee") // 推測主鍵名稱
    private Integer id;

    @Column(name = "EmployeeName")
    private String employeeName;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
}