package com.snackforest.shop.model;

import jakarta.persistence.*;

@Entity
@Table(name = "category")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "idCategory") // 推測主鍵名稱
    private Integer id;

    @Column(name = "CategoryName")
    private String categoryName;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
}