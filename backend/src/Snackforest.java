import java.util.*; // 引入常用工具類別庫，例如 List, Map, Scanner
import java.io.InputStreamReader; // 用於處理字元輸入
import java.nio.charset.StandardCharsets; // 標準 UTF-8 編碼
import java.sql.*; // JDBC 資料庫操作
import java.security.NoSuchAlgorithmException;
import java.math.BigDecimal;

// 匯入 DAO 和模型類別
import dao.*;
import model.*;

/**
 * 主程式類別 Snackforest
 * 提供命令列購物系統的完整流程，包括會員登入/註冊、商品瀏覽、購物車、結帳、管理員後台等功能。
 */
public class Snackforest {
    // 購物車：儲存商品與數量，使用 LinkedHashMap 保持插入順序
    private static Map<Product, Integer> cart = new LinkedHashMap<>();

    // 全域 Scanner 物件：接收使用者輸入，支援 UTF-8
    private static Scanner scanner = new Scanner(new InputStreamReader(System.in, StandardCharsets.UTF_8));

    // 全域資料庫連線物件
    private static Connection conn;

    // 資料存取物件 (DAO) 用於操作顧客與商品資料
    private static CustomerDAO customerDAO;
    private static ProductDAO productDAO;

    // 當前登入的顧客物件，null 表示未登入
    private static Customer currentCustomer = null;

    /**
     * 列舉：定義購物車操作的結果
     */
    private enum CartAction {
        PROCEED_TO_CHECKOUT, RETURN_TO_MENU, STAY_ON_PAGE
    }

    private static boolean isRunning = true; // 控制主迴圈的布林變數

    public static void main(String[] args) {
        try {
            conn = DBConnect.getConnection();
            customerDAO = new CustomerDAO(conn);
            productDAO = new ProductDAO(conn);
        } catch (SQLException e) {
            System.err.println("FATAL: 資料庫連線失敗，程式無法啟動。");
            e.printStackTrace();
            return;
        }

        try {
            while (isRunning) {
                currentCustomer = null;
                cart.clear();

                String role = login();

                switch (role) {
                    case "ADMIN":
                        runAdminPanel();
                        break;
                    case "CUSTOMER":
                        runCustomerShopping();
                        break;
                    case "EXIT":
                        isRunning = false;
                        break;
                    default:
                        System.out.println("未知的角色，請重新嘗試。");
                }
            }
        } catch (Exception e) {
            System.out.println("系統錯誤：" + e.getMessage());
            e.printStackTrace();
        } finally {
            try {
                if (conn != null)
                    conn.close();
            } catch (SQLException e) {
                System.err.println("關閉資料庫連線時發生錯誤。");
            }
        }
        System.out.println("感謝光臨，再見！");
    }

    // --- 登入與註冊相關功能 ---

    /**
     * 會員登入流程。
     * 提示使用者輸入帳號和密碼，並根據輸入驗證其角色。
     * @return String - "ADMIN" (管理員), "CUSTOMER" (顧客), 或 "EXIT" (退出程式)。
     */
    private static String login() throws SQLException, NoSuchAlgorithmException {
        while (true) {
            System.out.println("\n====== 歡迎來到 SnackForest 商店 ======");
            System.out.println("輸入RG (註冊新帳號) | exit (離開系統)");
            String account = promptInput("請輸入帳號：");

            if (account.equalsIgnoreCase("exit")) {
                return "EXIT";
            }
            if (account.equalsIgnoreCase("RG")) {
                registerCustomer();
                continue;
            }

            String password = promptInput("請輸入密碼：");

            if (account.equalsIgnoreCase("admin") && password.equalsIgnoreCase("000000")) {
                System.out.println("你好，管理員！");
                return "ADMIN";
            }

            currentCustomer = customerDAO.findByAccountAndPassword(account, password);

            if (currentCustomer != null) {
                System.out.println("你好，" + currentCustomer.getName() + "！");
                return "CUSTOMER";
            } else {
                System.out.println("❗ 帳號或密碼錯誤，請重新輸入。\n");
            }
        }
    }

    /**
     * 顧客自行註冊新帳號的流程。
     */
    private static void registerCustomer() throws SQLException, NoSuchAlgorithmException {
        System.out.println("\n--- 註冊新帳號 ---");
        String newName = promptInput("請輸入您的姓名 (或輸入 'B' 返回)：");
        if (newName.equalsIgnoreCase("B")) {
            return;
        }

        String newAccount = promptInput("請輸入您要設定的帳號：");

        String newPassword;
        while (true) {
            newPassword = promptInput("請輸入您要設定的密碼：");
            String confirmPassword = promptInput("請再次輸入密碼以確認：");
            if (newPassword.equals(confirmPassword)) {
                break;
            } else {
                System.out.println("❌ 兩次輸入的密碼不一致，請重新輸入。");
            }
        }

        if (createNewCustomer(newName, newAccount, newPassword)) {
            System.out.println("✅ 註冊成功！您現在可以使用新帳號登入。");
        }
    }

    /**
     * (管理員用) 新增客戶功能。
     */
    private static void addCustomer() throws SQLException, NoSuchAlgorithmException {
        System.out.println("\n--- 新增客戶 ---");
        String newName = promptInput("請輸入新客戶姓名 (或輸入 'B' 返回)：");
        if (newName.equalsIgnoreCase("B")) {
            return;
        }
        String newAccount = promptInput("請輸入新客戶帳號：");
        String newPassword = promptInput("請輸入新客戶密碼 (建議使用電話)：");

        if (createNewCustomer(newName, newAccount, newPassword)) {
            System.out.println("✅ 客戶「" + newName + "」已成功新增！");
        }
    }

    /**
     * 建立新客戶的核心邏輯 (供 registerCustomer 和 addCustomer 共用)。
     * @return boolean - true 表示成功，false 表示失敗。
     */
    private static boolean createNewCustomer(String name, String account, String password) throws SQLException, NoSuchAlgorithmException {
        // 使用資料庫的 AUTO_INCREMENT，由 DAO 在 insert 後回填 id
        Customer newCustomer = new Customer(0, name, account, password, "");

        try {
            return customerDAO.save(newCustomer);
        } catch (SQLException e) {
            if (e.getErrorCode() == 1062) { // Unique constraint violation
                System.out.println("❌ 操作失敗！此帳號「" + account + "」已經有人使用了。");
            } else {
                System.out.println("❌ 資料庫錯誤：" + e.getMessage());
            }
            return false;
        } catch (NoSuchAlgorithmException e) {
            System.err.println("密碼雜湊演算法錯誤: " + e.getMessage());
            System.out.println("❌ 操作失敗，請稍後再試。");
            return false;
        }
    }


    // --- 菜單相關功能 ---

    /**
     * 顧客的購物主迴圈。
     */
    private static void runCustomerShopping() throws SQLException, NoSuchAlgorithmException {
        while (true) {
            showShopMenu();
            int choice = getChoice();
            if (!handleChoice(choice)) {
                break;
            }
        }
    }

    /**
     * 顯示顧客的主選單。
     */
    private static void showShopMenu() {
        System.out.println("\n====== SnackForest 商店選單 ======");
        System.out.println("1. 瀏覽與購買商品");
        System.out.println("2. 查看購物車");
        System.out.println("3. 會員中心 (查詢訂單/修改密碼)");
        System.out.println("4. 登出");
        System.out.print("請選擇功能（輸入數字）：");
    }

    /**
     * 處理顧客主選單的選擇。
     * @return boolean - true 繼續購物, false 登出。
     */
    private static boolean handleChoice(int choice) throws SQLException, NoSuchAlgorithmException {
        switch (choice) {
            case 1:
                browseAndBuyProductsLoop();
                break;
            case 2:
                if (runCartWorkflow()) {
                    checkout();
                }
                break;
            case 3:
                runMemberCenter();
                break;
            case 4:
                return false; // 登出
            default:
                System.out.println("無效選擇，請輸入1-4的數字！");
        }
        return true;
    }

    // --- 後台管理功能 ---

    /**
     * 管理員後台面板的主迴圈
     */
    private static void runAdminPanel() throws SQLException, NoSuchAlgorithmException {
        while (true) {
            showAdminMenu();
            int choice = getChoice();
            if (!handleAdminChoice(choice)) {
                break;
            }
        }
    }

    /**
     * 顯示後台管理選單
     */
    private static void showAdminMenu() {
        System.out.println("\n====== 後台管理系統 ======");
        System.out.println("1. 管理客戶資料");
        System.out.println("2. 管理商品資料");
        System.out.println("3. 查詢訂單資料");
        System.out.println("4. 管理貨運方式");
        System.out.println("5. 管理付款方式");
        System.out.println("6. 登出");
        System.out.print("請選擇功能：");
    }

    /**
     * 處理後台管理選單的選擇。
     * @return boolean - true 繼續操作, false 登出。
     */
    private static boolean handleAdminChoice(int choice) throws SQLException, NoSuchAlgorithmException {
        switch (choice) {
            case 1: manageCustomers(); break;
            case 2: manageProducts(); break;
            case 3: queryOrders(); break;
            case 4: manageShippingMethods(); break;
            case 5: managePaymentMethods(); break;
            case 6: return false; // 登出
            default: System.out.println("無效選擇！");
        }
        return true;
    }

    // --- 會員中心 ---
    /**
     * 會員中心的主迴圈。
     */
    private static void runMemberCenter() throws SQLException, NoSuchAlgorithmException {
        while (true) {
            System.out.println("\n--- 會員中心 ---");
            System.out.println("1. 查詢歷史訂單");
            System.out.println("2. 修改密碼");
            System.out.println("M. 返回主選單");
            String input = promptInput("請選擇功能：");

            if (input.equalsIgnoreCase("M")) return;

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1: viewMyOrders(); break;
                    case 2: changeMyPassword(); break;
                    default: System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'M'！");
            }
        }
    }

    /**
     * 查詢自己的歷史訂單。
     */
    private static void viewMyOrders() throws SQLException {
        System.out.println("\n--- " + currentCustomer.getName() + " 的歷史訂單 ---");
        String sql = "SELECT o.idOrders, o.OrderDate, o.TotalAmount, c.CustomerName " +
                     "FROM orders o JOIN customers c ON o.idCustomers = c.idCustomers WHERE o.idCustomers = ? ORDER BY o.OrderDate DESC";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, currentCustomer.getId());
            displayOrderListAndPromptForDetails(stmt);
        }
    }

    /**
     * 修改自己的密碼。
     */
    private static void changeMyPassword() throws SQLException, NoSuchAlgorithmException {
        String oldPassword = promptInput("請輸入目前的密碼以進行驗證：");
        Customer verifiedCustomer = customerDAO.findByAccountAndPassword(currentCustomer.getAccount(), oldPassword);

        if (verifiedCustomer == null) {
            System.out.println("❌ 密碼驗證失敗！");
            return;
        }

        String newPassword = promptInput("請輸入新密碼：");
        String confirmPassword = promptInput("請再次輸入新密碼以確認：");

        if (!newPassword.equals(confirmPassword)) {
            System.out.println("❌ 兩次輸入的新密碼不一致！");
            return;
        }

        Customer updatedCustomer = new Customer(currentCustomer.getId(), currentCustomer.getName(), currentCustomer.getAccount(), newPassword, "");

        try {
            if (customerDAO.save(updatedCustomer)) {
                System.out.println("✅ 密碼已成功更新！");
            } else {
                System.out.println("❌ 密碼更新失敗。");
            }
        } catch (SQLException e) {
            System.out.println("❌ 發生錯誤：" + e.getMessage());
        }
    }


    // --- 客戶管理 (Admin) ---
    private static void manageCustomers() throws SQLException, NoSuchAlgorithmException {
        while (true) {
            System.out.println("\n--- 管理客戶資料 ---");
            System.out.println("1. 顯示所有客戶");
            System.out.println("2. 新增客戶");
            System.out.println("3. 刪除客戶");
            System.out.println("B. 返回後台選單");
            String input = promptInput("請選擇功能：");

            if (input.equalsIgnoreCase("B")) return;

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1: showAllCustomers(); break;
                    case 2: addCustomer(); break;
                    case 3: deleteCustomer(); break;
                    default: System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    private static void deleteCustomer() throws SQLException {
        showAllCustomers();
        String input = promptInput("\n請輸入要刪除的客戶 ID (或輸入 'B' 返回)：");
        if (input.equalsIgnoreCase("B")) return;

        int customerId;
        try {
            customerId = Integer.parseInt(input);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 輸入無效，請輸入數字 ID。");
            return;
        }

        String confirm = promptInput("確定要刪除此客戶嗎？ (y/n): ");
        if (!confirm.equalsIgnoreCase("y")) {
            System.out.println("操作已取消。");
            return;
        }

        try {
            if (customerDAO.delete(customerId)) {
                System.out.println("✅ 客戶已成功刪除！");
            } else {
                System.out.println("⚠️ 找不到此客戶 ID。");
            }
        } catch (SQLException e) {
            if (e.getSQLState().startsWith("23")) {
                System.out.println("❌ 刪除失敗！此客戶尚有訂單記錄，無法直接刪除。");
            } else {
                throw e;
            }
        }
    }

    private static void showAllCustomers() throws SQLException {
        System.out.println("\n--- 客戶列表 ---");
        List<Customer> customers = customerDAO.findAll();
        System.out.printf("%-5s %-15s %-15s\n", "ID", "姓名", "帳號");
        System.out.println("----------------------------------------------------------");
        for (Customer c : customers) {
            System.out.printf("%-5d %-15s %-15s\n", c.getId(), c.getName(), c.getAccount());
        }
        System.out.println("----------------------------------------------------------");
    }


    // --- 購物車與商品瀏覽 ---

    /**
     * 購物車頁面的主迴圈。
     * @return boolean - true 代表要去結帳，false 代表要返回主選單。
     */
    private static boolean runCartWorkflow() {
        while (true) {
            CartAction action = viewCartAndGetAction();
            switch (action) {
                case PROCEED_TO_CHECKOUT: return true;
                case RETURN_TO_MENU: return false;
                case STAY_ON_PAGE: continue;
            }
        }
    }

    /**
     * 顯示購物車內容，處理刪除操作，並返回下一步的指令。
     */
    private static CartAction viewCartAndGetAction() {
        System.out.println("\n🛒 購物車內容：");
        if (cart.isEmpty()) {
            System.out.println("目前購物車為空！\n");
            return CartAction.RETURN_TO_MENU;
        }

        int total = 0;
        for (Map.Entry<Product, Integer> entry : cart.entrySet()) {
            Product p = entry.getKey();
            int qty = entry.getValue();
            int sub = p.getPrice() * qty;
            System.out.printf("%d. %s - $%d x %d = $%d\n", p.getIdProducts(), p.getProductName(), p.getPrice(), qty, sub);
            total += sub;
        }
        System.out.println("總金額：$" + total);

        System.out.println("\n輸入格式：[商品編號] [數量] (刪除商品)");
        System.out.println("輸入 '++' 立即結帳，或 'M' 返回主選單：");
        String input = promptInput("> ");

        if (input.equals("++")) return CartAction.PROCEED_TO_CHECKOUT;
        if (input.equalsIgnoreCase("M")) return CartAction.RETURN_TO_MENU;

        // 處理刪除邏輯
        try {
            String[] tokens = input.split("\\s+");
            if (tokens.length >= 2) {
                int productId = Integer.parseInt(tokens[0]);
                int qtyToRemove = Integer.parseInt(tokens[1]);
                removeProductFromCart(productId, qtyToRemove);
            } else {
                System.out.println("⚠️ 輸入格式錯誤！");
            }
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 輸入格式錯誤，商品編號與數量請輸入數字！");
        }
        return CartAction.STAY_ON_PAGE;
    }

    /**
     * 從購物車移除指定數量的商品。
     */
    private static void removeProductFromCart(int productId, int qtyToRemove) {
        Product toRemove = null;
        for (Product p : cart.keySet()) {
            if (p.getIdProducts() == productId) {
                toRemove = p;
                break;
            }
        }

        if (toRemove != null) {
            int currentQty = cart.get(toRemove);
            if (qtyToRemove >= currentQty) {
                cart.remove(toRemove);
            } else {
                cart.put(toRemove, currentQty - qtyToRemove);
            }
            System.out.println("✅ 已更新購物車，刪除商品：" + toRemove.getProductName());
        } else {
            System.out.println("⚠️ 查無此商品編號於購物車中！");
        }
    }

    /**
     * 瀏覽與購買商品的迴圈。
     */
    private static void browseAndBuyProductsLoop() throws SQLException {
        while (true) {
            String categoryAction = selectCategoryAndGetAction();

            if (categoryAction.equalsIgnoreCase("M")) {
                return; // 返回主選單
            }
            if (categoryAction.equalsIgnoreCase("C")) {
                checkout(); // 前往結帳
                return; // 結帳後返回主選單
            }

            try {
                int categoryId = Integer.parseInt(categoryAction);
                if (!handleProductSelectionInCategory(categoryId)) {
                    return; // 如果在商品選擇中途選擇返回主選單
                }
            } catch (NumberFormatException e) {
                System.out.println("❗ 無效選擇\n");
            }
        }
    }

    /**
     * 顯示商品分類選單，讓使用者選擇一個分類或操作。
     * @return String - "M" (返回主選單), "C" (結帳), 或選擇的分類ID。
     */
    private static String selectCategoryAndGetAction() throws SQLException {
        List<Map<String, String>> categoryList = getCategories();
        System.out.println("\n📦 商品分類：");
        for (int i = 0; i < categoryList.size(); i++) {
            System.out.println((i + 1) + ". " + categoryList.get(i).get("name"));
        }
        System.out.println("C. 前往結帳");
        System.out.println("M. 返回主選單");
        String input = promptInput("請選擇分類：");

        if (input.equalsIgnoreCase("C") && cart.isEmpty()) {
            System.out.println("\n❗ 購物車是空的，無法結帳。請先購買商品。");
            return selectCategoryAndGetAction(); // 重新顯示分類
        }
        
        if (input.equalsIgnoreCase("M") || input.equalsIgnoreCase("C")) {
            return input;
        }

        try {
            int choice = Integer.parseInt(input);
            if (choice >= 1 && choice <= categoryList.size()) {
                return categoryList.get(choice - 1).get("id");
            }
        } catch (NumberFormatException e) {
            // 忽略，下方會處理
        }
        return "INVALID"; // 代表無效選擇
    }

    /**
     * 顯示特定分類下的商品，並處理購買操作。
     * @return boolean - true 繼續瀏覽, false 返回主選單。
     */
    private static boolean handleProductSelectionInCategory(int categoryId) throws SQLException {
        List<Product> categoryProducts = productDAO.findByCategoryId(categoryId);
        String categoryName = getCategoryNameById(categoryId);

        System.out.println("\n🪧 商品列表（" + categoryName + "）：");
        for (int i = 0; i < categoryProducts.size(); i++) {
            System.out.println((i + 1) + ". " + categoryProducts.get(i));
        }

        while (true) {
            System.out.println("\n請輸入要購買的商品編號（B 返回分類選單，M 返回主選單）：");
            String buyInput = promptInput("> ");
            if (buyInput.equalsIgnoreCase("B")) return true; // 返回分類選單
            if (buyInput.equalsIgnoreCase("M")) return false; // 返回主選單

            try {
                int selectionIndex = Integer.parseInt(buyInput);
                if (selectionIndex >= 1 && selectionIndex <= categoryProducts.size()) {
                    Product selectedProduct = categoryProducts.get(selectionIndex - 1);
                    cart.put(selectedProduct, cart.getOrDefault(selectedProduct, 0) + 1);
                    System.out.println("✅ 已加入：" + selectedProduct.getProductName());
                } else {
                    System.out.println("⚠️ 無此商品編號！");
                }
            } catch (NumberFormatException e) {
                System.out.println("⚠️ 輸入格式錯誤，請輸入商品編號或指令！");
            }
        }
    }


    // --- 商品管理 (Admin) ---
    private static void manageProducts() throws SQLException {
        while (true) {
            System.out.println("\n--- 管理商品資料 ---");
            System.out.println("1. 顯示所有商品");
            System.out.println("2. 新增商品");
            System.out.println("3. 修改商品");
            System.out.println("4. 刪除商品");
            System.out.println("B. 返回後台選單");
            String input = promptInput("請選擇功能：");

            if (input.equalsIgnoreCase("B")) return;

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1: adminShowProducts(); break;
                    case 2: addProduct(); break;
                    case 3: updateProduct(); break;
                    case 4: deleteProduct(); break;
                    default: System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    private static void adminShowProducts() throws SQLException {
        List<Product> products = productDAO.findAll();
        System.out.println("\n🪧 商品列表：");
        System.out.printf("%-5s %-20s %-10s %-15s\n", "ID", "商品名稱", "價格", "分類ID");
        System.out.println("-----------------------------------------------------");
        for (Product p : products) {
            System.out.printf("%-5d %-20s %-10d %-15d\n", p.getIdProducts(), p.getProductName(), p.getPrice(), p.getCategoriesID());
        }
    }

    private static void addProduct() throws SQLException {
        System.out.println("\n--- 新增商品 ---");
        String name = promptInput("請輸入商品名稱 (或輸入 'B' 返回)：");
        if (name.equalsIgnoreCase("B")) return;

        int price;
        try {
            price = Integer.parseInt(promptInput("請輸入商品價格："));
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 價格輸入無效，操作已取消。");
            return;
        }

        List<Map<String, String>> categories = getCategories();
        System.out.println("請選擇商品分類：");
        categories.forEach(c -> System.out.println(c.get("id") + ". " + c.get("name")));
        
        int categoryId;
        try {
            categoryId = Integer.parseInt(promptInput("請輸入分類編號："));
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 分類編號輸入無效，操作已取消。");
            return;
        }

        int newId = findNextAvailableId("products", "idProducts");
        Product newProduct = new Product(newId, categoryId, name, price);

        try {
            if (productDAO.save(newProduct, categoryId, new ArrayList<>())) {
                System.out.println("✅ 商品新增成功！");
            }
        } catch (SQLException e) {
            if (e.getErrorCode() == 1062) {
                System.out.println("❌ 新增失敗！該商品名稱可能已存在。");
            } else {
                System.out.println("❌ 資料庫錯誤：" + e.getMessage());
            }
        }
    }

    private static void updateProduct() throws SQLException {
        adminShowProducts();
        String input = promptInput("\n請輸入要修改的商品 ID (或輸入 'B' 返回)：");
        if (input.equalsIgnoreCase("B")) return;

        int id;
        try {
            id = Integer.parseInt(input);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 輸入無效，請輸入數字 ID。");
            return;
        }

        String newName = promptInput("請輸入新的商品名稱（留空則不修改）：");
        String priceInput = promptInput("請輸入新的商品價格（留空則不修改）：");
        
        List<Map<String, String>> categories = getCategories();
        System.out.println("請選擇新的商品分類（留空則不修改）：");
        categories.forEach(c -> System.out.println(c.get("id") + ". " + c.get("name")));
        String categoryInput = promptInput("請輸入分類編號：");

        try {
            Integer newPrice = priceInput.isEmpty() ? null : Integer.parseInt(priceInput);
            Integer newCategoryId = categoryInput.isEmpty() ? null : Integer.parseInt(categoryInput);

            if (newName.isEmpty() && newPrice == null && newCategoryId == null) {
                System.out.println("沒有任何修改。");
                return;
            }

            if (productDAO.update(id, newName, newPrice, newCategoryId, null, null, null, null, null)) {
                System.out.println("✅ 商品更新成功！");
            } else {
                System.out.println("❌ 找不到該商品或更新失敗。");
            }
        } catch (SQLException e) {
            if (e.getErrorCode() == 1062) {
                System.out.println("❌ 更新失敗！該商品名稱可能已存在。");
            } else {
                System.out.println("❌ 資料庫錯誤：" + e.getMessage());
            }
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 價格或分類編號輸入無效，操作已取消。");
        }
    }

    private static void deleteProduct() throws SQLException {
        adminShowProducts();
        String input = promptInput("\n請輸入要刪除的商品 ID (或輸入 'B' 返回)：");
        if (input.equalsIgnoreCase("B")) return;

        int id;
        try {
            id = Integer.parseInt(input);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 輸入無效，請輸入數字 ID。");
            return;
        }

        String confirm = promptInput("確定要刪除此商品嗎？ (y/n): ");
        if (!confirm.equalsIgnoreCase("y")) {
            System.out.println("操作已取消。");
            return;
        }

        try {
            if (productDAO.delete(id)) {
                System.out.println("✅ 商品刪除成功！");
            } else {
                System.out.println("⚠️ 找不到此商品 ID。");
            }
        } catch (SQLException e) {
            if (e.getSQLState().startsWith("23")) {
                System.out.println("❌ 刪除失敗！此商品可能已存在於某些訂單中。");
            } else {
                throw e;
            }
        }
    }


    // --- 訂單與結帳 ---

    /**
     * 查詢訂單資料的主介面 (Admin)。
     */
    private static void queryOrders() throws SQLException {
        while (true) {
            System.out.println("\n--- 查詢訂單資料 ---");
            System.out.println("1. 查詢所有訂單");
            System.out.println("2. 依客戶姓名查詢");
            System.out.println("B. 返回後台選單");
            String input = promptInput("請選擇查詢方式：");

            if (input.equalsIgnoreCase("B")) return;

            String sql = "SELECT o.idOrders, o.OrderDate, o.TotalAmount, c.CustomerName " +
                         "FROM orders o JOIN customers c ON o.idCustomers = c.idCustomers ";
            try {
                int choice = Integer.parseInt(input);
                if (choice == 1) {
                    sql += "ORDER BY o.OrderDate DESC";
                    try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                        displayOrderListAndPromptForDetails(stmt);
                    }
                } else if (choice == 2) {
                    String customerName = promptInput("請輸入客戶姓名：");
                    sql += "WHERE c.CustomerName LIKE ? ORDER BY o.OrderDate DESC";
                    try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                        stmt.setString(1, "%" + customerName + "%");
                        displayOrderListAndPromptForDetails(stmt);
                    }
                } else {
                    System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    /**
     * 顯示訂單列表，並提示使用者是否要查看詳細內容。
     */
    private static void displayOrderListAndPromptForDetails(PreparedStatement stmt) throws SQLException {
        try (ResultSet rs = stmt.executeQuery()) {
            if (!displayOrderList(rs)) {
                System.out.println("查無任何訂單資料。");
                return;
            }
        }
        
        // 獨立出提示邏輯
        while (true) {
            String input = promptInput("輸入訂單 ID 查看詳細內容，或輸入 'B' 返回上一頁：");
            if (input.equalsIgnoreCase("B")) return;
            try {
                int orderId = Integer.parseInt(input);
                showOrderDetails(orderId);
                // 顯示完一筆明細後可以繼續查詢其他筆
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    /**
     * 僅負責顯示訂單列表。
     * @return boolean - true 如果有訂單被顯示, false 如果沒有。
     */
    private static boolean displayOrderList(ResultSet rs) throws SQLException {
        System.out.println("\n--- 訂單列表 ---");
        System.out.printf("%-8s %-25s %-15s %-10s\n", "訂單ID", "訂單日期", "客戶名稱", "總金額");
        System.out.println("--------------------------------------------------------------");
        boolean found = false;
        while (rs.next()) {
            found = true;
            System.out.printf("%-8d %-25s %-15s $%-9.2f\n",
                    rs.getInt("idOrders"),
                    rs.getTimestamp("OrderDate").toString(),
                    rs.getString("CustomerName"),
                    rs.getBigDecimal("TotalAmount"));
        }
        System.out.println("--------------------------------------------------------------");
        return found;
    }

    /**
     * 顯示特定訂單的詳細內容。
     */
    private static void showOrderDetails(int orderId) throws SQLException {
        // 顯示訂單主檔
        String sql = "SELECT * FROM orders WHERE idOrders = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, orderId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                System.out.println("\n--- 訂單 #" + orderId + " 詳細內容 ---");
                System.out.printf("訂單日期：%s\n", rs.getTimestamp("OrderDate"));
                System.out.printf("總金額：$%.2f\n", rs.getBigDecimal("TotalAmount"));
                System.out.printf("運送方式：%s\n", rs.getString("ShippingMethod"));
                System.out.printf("付款方式：%s\n", rs.getString("PaymentMethod"));
                System.out.printf("收貨人：%s, 地址：%s, 電話：%s\n", rs.getString("RecipientName"), rs.getString("RecipientAddress"), rs.getString("RecipientPhone"));
                System.out.println("---------------------------------");
            } else {
                System.out.println("查無此訂單！");
                return;
            }
        }

        // 顯示商品明細
        String detailSql = "SELECT p.ProductName, od.Quantity, od.PriceAtTimeOfPurchase " +
                           "FROM order_details od JOIN products p ON od.idProducts = p.idProducts " +
                           "WHERE od.idOrders = ?";
        try (PreparedStatement detailStmt = conn.prepareStatement(detailSql)) {
            detailStmt.setInt(1, orderId);
            ResultSet drs = detailStmt.executeQuery();
            System.out.println("商品明細：");
            System.out.printf("%-20s %-10s %-10s\n", "商品名稱", "數量", "單價");
            System.out.println("------------------------------------------");
            while (drs.next()) {
                System.out.printf("%-20s %-10d $%-9.2f\n",
                        drs.getString("ProductName"),
                        drs.getInt("Quantity"),
                        drs.getBigDecimal("PriceAtTimeOfPurchase"));
            }
            System.out.println("------------------------------------------");
        }
    }

    /**
     * 結帳流程總管。
     */
    private static void checkout() throws SQLException {
        if (cart.isEmpty()) {
            System.out.println("❗ 購物車為空，無法結帳。\n");
            return;
        }
        if (currentCustomer == null) {
            System.out.println("錯誤：無顧客登入資訊，無法結帳。請重新登入。");
            return;
        }

        // 步驟 1: 顯示摘要
        BigDecimal total = displayCheckoutSummary();

        // 步驟 2 & 3: 選擇運送與付款方式
        String shippingMethod = selectShippingMethod();
        if (shippingMethod == null) { System.out.println("操作已取消。"); return; }

        String paymentMethod = selectPaymentMethodWithTree(shippingMethod);
        if (paymentMethod == null) { System.out.println("操作已取消。"); return; }

        // 步驟 4: 輸入收件資訊
        Map<String, String> recipientInfo = collectRecipientInfo();
        if (recipientInfo == null) { System.out.println("操作已取消。"); return; }

        // 步驟 5: 最終確認
        boolean confirmed = confirmFinalOrder(total, shippingMethod, paymentMethod, recipientInfo);
        if (!confirmed) {
            System.out.println("操作已取消，返回主選單。");
            return;
        }

        // 步驟 6: 寫入資料庫
        saveOrderToDatabase(total, shippingMethod, paymentMethod, recipientInfo);
    }

    private static BigDecimal displayCheckoutSummary() {
        System.out.println("\n=== 結帳清單 ===");
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<Product, Integer> entry : cart.entrySet()) {
            Product item = entry.getKey();
            int quantity = entry.getValue();
            BigDecimal price = BigDecimal.valueOf(item.getPrice());
            BigDecimal subtotal = price.multiply(BigDecimal.valueOf(quantity));
            System.out.printf("%d. %s x %d = $%.2f\n", item.getIdProducts(), item.getProductName(), quantity, subtotal);
            total = total.add(subtotal);
        }
        System.out.printf("總金額: $%.2f\n", total);
        return total;
    }

    private static String selectShippingMethod() throws SQLException {
        List<String> shippingOptions = new ArrayList<>();
        try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery("SELECT shipping_methodsName FROM shipping_methods")) {
            while (rs.next()) shippingOptions.add(rs.getString("shipping_methodsName"));
        }

        while (true) {
            System.out.println("\n請選擇取貨方式：");
            for (int i = 0; i < shippingOptions.size(); i++) {
                System.out.printf("%d. %s\n", i + 1, shippingOptions.get(i));
            }
            System.out.println("M. 返回購物");
            String input = promptInput("輸入選項：");
            if (input.equalsIgnoreCase("M")) return null;
            try {
                int choice = Integer.parseInt(input);
                if (choice >= 1 && choice <= shippingOptions.size()) {
                    return shippingOptions.get(choice - 1);
                }
            } catch (NumberFormatException e) { /* fall through */ }
            System.out.println("無效的選項，請重新輸入。");
        }
    }

    private static Map<String, String> collectRecipientInfo() {
        Map<String, String> info = new HashMap<>();
        String name = promptInput("\n請輸入收件人姓名 (B 返回): ");
        if (name.equalsIgnoreCase("B")) return null;
        info.put("name", name);

        String address = promptInput("請輸入收件地址 (B 返回): ");
        if (address.equalsIgnoreCase("B")) return null;
        info.put("address", address);

        String phone = promptInput("請輸入聯絡電話 (B 返回): ");
        if (phone.equalsIgnoreCase("B")) return null;
        info.put("phone", phone);

        return info;
    }

    private static boolean confirmFinalOrder(BigDecimal total, String shipping, String payment, Map<String, String> recipient) {
        System.out.println("\n=== 訂單最終確認 ===");
        System.out.printf("總金額：$%.2f\n", total);
        System.out.println("付款方式：" + payment);
        System.out.println("貨運方式：" + shipping);
        System.out.println("收件人：" + recipient.get("name"));
        System.out.println("收件地址：" + recipient.get("address"));
        System.out.println("聯絡電話：" + recipient.get("phone"));
        String confirm = promptInput("\nY 送出訂單 / N 取消：");
        return confirm.equalsIgnoreCase("Y");
    }

    private static void saveOrderToDatabase(BigDecimal total, String shipping, String payment, Map<String, String> recipient) throws SQLException {
        Connection checkoutConn = null;
        try {
            checkoutConn = DBConnect.getConnection();
            checkoutConn.setAutoCommit(false);

            String orderSql = "INSERT INTO orders (idCustomers, OrderDate, TotalAmount, ShippingMethod, PaymentMethod, RecipientName, RecipientAddress, RecipientPhone, Remark) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?)";
            int orderId;
            try (PreparedStatement orderStmt = checkoutConn.prepareStatement(orderSql, Statement.RETURN_GENERATED_KEYS)) {
                orderStmt.setInt(1, currentCustomer.getId());
                orderStmt.setBigDecimal(2, total);
                orderStmt.setString(3, shipping);
                orderStmt.setString(4, payment);
                orderStmt.setString(5, recipient.get("name"));
                orderStmt.setString(6, recipient.get("address"));
                orderStmt.setString(7, recipient.get("phone"));
                orderStmt.setString(8, ""); // Remark
                orderStmt.executeUpdate();

                ResultSet generatedKeys = orderStmt.getGeneratedKeys();
                if (generatedKeys.next()) {
                    orderId = generatedKeys.getInt(1);
                } else {
                    throw new SQLException("建立訂單失敗，無法取得訂單ID。");
                }
            }

            String detailSql = "INSERT INTO order_details (idOrders, idProducts, Quantity, PriceAtTimeOfPurchase) VALUES (?, ?, ?, ?)";
            try (PreparedStatement detailStmt = checkoutConn.prepareStatement(detailSql)) {
                for (Map.Entry<Product, Integer> entry : cart.entrySet()) {
                    detailStmt.setInt(1, orderId);
                    detailStmt.setInt(2, entry.getKey().getIdProducts());
                    detailStmt.setInt(3, entry.getValue());
                    detailStmt.setBigDecimal(4, BigDecimal.valueOf(entry.getKey().getPrice()));
                    detailStmt.addBatch();
                }
                detailStmt.executeBatch();
            }

            checkoutConn.commit();
            System.out.println("\n✅ 感謝您的購買，訂單已成功建立！");
            cart.clear();

        } catch (SQLException e) {
            System.out.println("❌ 訂單處理失敗，正在復原操作...");
            if (checkoutConn != null) checkoutConn.rollback();
            throw e;
        } finally {
            if (checkoutConn != null) checkoutConn.close();
        }
    }

    /**
     * 讓使用者選擇付款方式，支援樹狀結構。
     */
    private static String selectPaymentMethodWithTree(String shippingMethod) throws SQLException {
        // 1. 查詢最上層的付款方式
        String sql = "SELECT idPaymentMethod, MethodName FROM payment_methods WHERE parent_id IS NULL";
        List<Integer> topLevelIds = new ArrayList<>();
        List<String> topLevelNames = new ArrayList<>();

        try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                String methodName = rs.getString("MethodName");
                // 根據貨運方式過濾
                if (shippingMethod.equals("面交") && !methodName.equalsIgnoreCase("現金")) continue;
                if (!shippingMethod.equals("面交") && methodName.equalsIgnoreCase("現金")) continue;
                
                topLevelIds.add(rs.getInt("idPaymentMethod"));
                topLevelNames.add(methodName);
            }
        }

        if (topLevelNames.isEmpty()) {
            System.out.println("❗ 無可用付款方式，請聯絡管理員。");
            return null;
        }

        // 2. 顯示頂層選單並取得選擇
        while (true) {
            System.out.println("\n請選擇付款方式：");
            for (int i = 0; i < topLevelNames.size(); i++) {
                System.out.printf("%d. %s\n", i + 1, topLevelNames.get(i));
            }
            System.out.println("B. 返回上一層");
            String input = promptInput("輸入選項：");
            if (input.equalsIgnoreCase("B")) return null;

            try {
                int choice = Integer.parseInt(input);
                if (choice >= 1 && choice <= topLevelNames.size()) {
                    int selectedId = topLevelIds.get(choice - 1);
                    String finalChoice = selectSubPaymentMethod(selectedId);
                    if (finalChoice != null) {
                        return finalChoice; // 使用者在子選單中做了選擇
                    }
                    // 如果 finalChoice 是 null，代表使用者從子選單返回，迴圈會繼續，重新顯示頂層選單
                } else {
                    System.out.println("⚠️ 無效選擇。");
                }
            } catch (NumberFormatException e) {
                System.out.println("⚠️ 輸入錯誤。");
            }
        }
    }

    /**
     * 處理付款方式的子選單。
     * @return String - 最終選擇的名稱, 或 null (如果使用者選擇返回)。
     */
    private static String selectSubPaymentMethod(int parentId) throws SQLException {
        List<String> subOptions = new ArrayList<>();
        try (PreparedStatement stmt = conn.prepareStatement("SELECT MethodName FROM payment_methods WHERE parent_id = ?")) {
            stmt.setInt(1, parentId);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) subOptions.add(rs.getString("MethodName"));
        }

        // 如果沒有子分類，表示這就是最終選項
        if (subOptions.isEmpty()) {
            try (PreparedStatement stmt = conn.prepareStatement("SELECT MethodName FROM payment_methods WHERE idPaymentMethod = ?")) {
                stmt.setInt(1, parentId);
                ResultSet rs = stmt.executeQuery();
                return rs.next() ? rs.getString("MethodName") : null;
            }
        }

        // 顯示子選單
        while (true) {
            System.out.println("\n--- 請選擇詳細付款方式 ---");
            for (int i = 0; i < subOptions.size(); i++) {
                System.out.printf("%d. %s\n", i + 1, subOptions.get(i));
            }
            System.out.println("B. 返回上一層");
            String input = promptInput("輸入選項：");
            if (input.equalsIgnoreCase("B")) return null; // 返回頂層選單

            try {
                int choice = Integer.parseInt(input);
                if (choice >= 1 && choice <= subOptions.size()) {
                    return subOptions.get(choice - 1);
                }
            } catch (NumberFormatException e) { /* fall through */ }
            System.out.println("⚠️ 無效的選項。");
        }
    }


    // --- 貨運與付款方式管理 (Admin) ---
    private static void manageShippingMethods() throws SQLException {
        // ... (此處及以下的管理方法維持原樣，因為它們結構相對簡單)
        while (true) {
            System.out.println("\n--- 管理貨運方式 ---");
            System.out.println("1. 顯示所有貨運方式");
            System.out.println("2. 新增貨運方式");
            System.out.println("3. 刪除貨運方式");
            System.out.println("B. 返回後台選單");
            String input = promptInput("請選擇功能：");

            if (input.equalsIgnoreCase("B")) return;

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1: showAllShippingMethods(); break;
                    case 2: addShippingMethod(); break;
                    case 3: deleteShippingMethod(); break;
                    default: System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    private static void showAllShippingMethods() throws SQLException {
        System.out.println("\n--- 貨運方式列表 ---");
        try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery("SELECT idshipping_methods, shipping_methodsName FROM shipping_methods")) {
            while (rs.next()) {
                System.out.printf("ID: %d, 名稱: %s\n", rs.getInt("idshipping_methods"), rs.getString("shipping_methodsName"));
            }
        }
    }

    private static void addShippingMethod() throws SQLException {
        String name = promptInput("請輸入新的貨運方式名稱：");
        if (name.isEmpty()) {
            System.out.println("名稱不可為空！");
            return;
        }
        int newId = findNextAvailableId("shipping_methods", "idshipping_methods");
        try (PreparedStatement stmt = conn.prepareStatement("INSERT INTO shipping_methods (idshipping_methods, shipping_methodsName) VALUES (?, ?)")) {
            stmt.setInt(1, newId);
            stmt.setString(2, name);
            stmt.executeUpdate();
            System.out.println("✅ 新增成功！");
        }
    }

    private static void deleteShippingMethod() throws SQLException {
        showAllShippingMethods();
        try {
            int id = Integer.parseInt(promptInput("請輸入要刪除的貨運方式 ID："));
            try (PreparedStatement stmt = conn.prepareStatement("DELETE FROM shipping_methods WHERE idshipping_methods = ?")) {
                stmt.setInt(1, id);
                int affectedRows = stmt.executeUpdate();
                if (affectedRows > 0) {
                    System.out.println("✅ 刪除成功！");
                } else {
                    System.out.println("⚠️ 找不到該 ID。");
                }
            }
        } catch (NumberFormatException e) {
            System.out.println("⚠️ ID 輸入無效。");
        }
    }

    private static void managePaymentMethods() throws SQLException {
        while (true) {
            System.out.println("\n--- 管理付款方式 ---");
            System.out.println("1. 顯示所有付款方式");
            System.out.println("2. 新增付款方式");
            System.out.println("3. 刪除付款方式");
            System.out.println("B. 返回後台選單");
            String input = promptInput("請選擇功能：");

            if (input.equalsIgnoreCase("B")) return;

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1: showAllPaymentMethods(); break;
                    case 2: addPaymentMethod(); break;
                    case 3: deletePaymentMethod(); break;
                    default: System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    private static void showAllPaymentMethods() throws SQLException {
        System.out.println("\n--- 付款方式列表 ---");
        try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery("SELECT idPaymentMethod, MethodName, parent_id FROM payment_methods ORDER BY parent_id, idPaymentMethod")) {
            while (rs.next()) {
                System.out.printf("ID: %d, 名稱: %s, 上層ID: %s\n", rs.getInt("idPaymentMethod"), rs.getString("MethodName"), rs.getObject("parent_id"));
            }
        }
    }

    private static void addPaymentMethod() throws SQLException {
        String name = promptInput("請輸入新的付款方式名稱：");
        if (name.isEmpty()) {
            System.out.println("名稱不可為空！");
            return;
        }
        String parentIdInput = promptInput("請輸入上層分類的 ID (若無則留空): ");
        
        int newId = findNextAvailableId("payment_methods", "idPaymentMethod");
        String sql = "INSERT INTO payment_methods (idPaymentMethod, MethodName, parent_id) VALUES (?, ?, ?)";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, newId);
            stmt.setString(2, name);
            if (parentIdInput.isEmpty()) {
                stmt.setNull(3, Types.INTEGER);
            } else {
                stmt.setInt(3, Integer.parseInt(parentIdInput));
            }
            stmt.executeUpdate();
            System.out.println("✅ 新增成功！");
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 上層 ID 輸入無效。");
        }
    }

    private static void deletePaymentMethod() throws SQLException {
        showAllPaymentMethods();
        try {
            int id = Integer.parseInt(promptInput("請輸入要刪除的付款方式 ID："));
            try (PreparedStatement stmt = conn.prepareStatement("DELETE FROM payment_methods WHERE idPaymentMethod = ?")) {
                stmt.setInt(1, id);
                int affectedRows = stmt.executeUpdate();
                if (affectedRows > 0) {
                    System.out.println("✅ 刪除成功！");
                } else {
                    System.out.println("⚠️ 找不到該 ID。");
                }
            }
        } catch (NumberFormatException e) {
            System.out.println("⚠️ ID 輸入無效。");
        }
    }


    // --- 通用輔助方法 ---

    /**
     * 取得使用者輸入的整數選項。
     */
    private static int getChoice() {
        while (true) {
            try {
                return Integer.parseInt(scanner.nextLine().trim());
            } catch (NumberFormatException e) {
                System.out.print("輸入錯誤，請輸入數字：");
            }
        }
    }

    /**
     * 提示並取得使用者輸入的字串。
     */
    private static String promptInput(String prompt) {
        System.out.print(prompt);
        return scanner.nextLine().trim();
    }

    /**
     * 從資料庫獲取所有商品分類。
     */
    private static List<Map<String, String>> getCategories() throws SQLException {
        List<Map<String, String>> categoryList = new ArrayList<>();
        try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery("SELECT idcategories, categoryname FROM category")) {
            while (rs.next()) {
                Map<String, String> category = new HashMap<>();
                category.put("id", rs.getString("idcategories"));
                category.put("name", rs.getString("categoryname"));
                categoryList.add(category);
            }
        }
        return categoryList;
    }
    
    private static String getCategoryNameById(int categoryId) throws SQLException {
        try (PreparedStatement stmt = conn.prepareStatement("SELECT categoryname FROM category WHERE idcategories = ?")) {
            stmt.setInt(1, categoryId);
            ResultSet rs = stmt.executeQuery();
            return rs.next() ? rs.getString("categoryname") : "未知分類";
        }
    }

    /**
     * 尋找下一個可用的 ID。
     */
    private static int findNextAvailableId(String tableName, String idColumn) throws SQLException {
        try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery("SELECT MAX(" + idColumn + ") FROM " + tableName)) {
            if (rs.next()) {
                return rs.getInt(1) + 1;
            }
        }
        return 1; // 如果表是空的
    }
}
