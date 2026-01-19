package com.snackforest.shop.model;

import jakarta.persistence.*;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "idProducts")
    private Integer id;

    @Column(name = "ProductName", nullable = false)
    private String name;

    @Column(name = "Price", nullable = false)
    private Integer price;

    @Column(name = "CategoriesID", nullable = false)
    private Integer categoryId;

    @Column(name = "ImageUrl", columnDefinition = "LONGTEXT") // 加上 columnDefinition = "LONGTEXT"
    private String imageUrl;
    
    @Column(name = "Introduction")
    private String introduction;

    // Getters and Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Integer getPrice() { return price; }
    public void setPrice(Integer price) { this.price = price; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public Integer getCategoryId() { return categoryId; }
    public void setCategoryId(Integer categoryId) { this.categoryId = categoryId; }

    public String getIntroduction() { return introduction; }
    public void setIntroduction(String introduction) { this.introduction = introduction; }
}