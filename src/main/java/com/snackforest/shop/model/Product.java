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
    private String productName;

    @Column(name = "Price", nullable = false)
    private Integer price;

    @Column(name = "CategoriesID", nullable = false)
    private Integer categoriesId;

    @Column(name = "ImageUrl", columnDefinition = "LONGTEXT") // 加上 columnDefinition = "LONGTEXT"
    private String imageUrl;
    
    @Column(name = "Introduction")
    private String introduction;

    // Getters and Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public Integer getPrice() { return price; }
    public void setPrice(Integer price) { this.price = price; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public Integer getCategoriesId() { return categoriesId; }
    public void setCategoriesId(Integer categoriesId) { this.categoriesId = categoriesId; }

    public String getIntroduction() { return introduction; }
    public void setIntroduction(String introduction) { this.introduction = introduction; }
}