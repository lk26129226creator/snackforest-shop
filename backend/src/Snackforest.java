import java.util.*; // 引入常用工具類別庫，例如 List, Map, Scanner
import java.io.InputStreamReader; // 用於處理字元輸入
import java.nio.charset.StandardCharsets; // 標準 UTF-8 編碼
import java.sql.*; // JDBC 資料庫操作
import java.security.NoSuchAlgorithmException;

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
            System.out.print("請輸入帳號：");
            String account = scanner.nextLine().trim();

            if (account.equalsIgnoreCase("exit")) {
                return "EXIT";
            }
            if (account.equalsIgnoreCase("RG")) {
                registerCustomer();
                continue;
            }

            System.out.print("請輸入密碼：");
            String password = scanner.nextLine().trim();

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
     * 提示使用者輸入姓名、帳號與密碼，並進行密碼確認，最後將資料寫入資料庫。
     */
    private static void registerCustomer() throws SQLException, NoSuchAlgorithmException {
        System.out.println("\n--- 註冊新帳號 ---");
        System.out.print("請輸入您的姓名 (或輸入 'B' 返回)：");
        String newName = scanner.nextLine().trim();
        if (newName.equalsIgnoreCase("B")) {
            return;
        }

        System.out.print("請輸入您要設定的帳號：");
        String newAccount = scanner.nextLine().trim();

        String newPassword;
        while (true) {
            System.out.print("請輸入您要設定的密碼：");
            newPassword = scanner.nextLine().trim();
            System.out.print("請再次輸入密碼以確認：");
            String confirmPassword = scanner.nextLine().trim();
            if (newPassword.equals(confirmPassword)) {
                break;
            } else {
                System.out.println("❌ 兩次輸入的密碼不一致，請重新輸入。");
            }
        }

        int newId = findNextAvailableId("customers", "idCustomers");
        Customer newCustomer = new Customer(newId, newName, newAccount, newPassword, ""); // Updated constructor

        try {
            if (customerDAO.save(newCustomer)) {
                System.out.println("✅ 註冊成功！您現在可以使用新帳號登入。");
            } else {
                System.out.println("❌ 註冊失敗，請稍後再試。");
            }
        } catch (SQLException e) {
            if (e.getErrorCode() == 1062) {
                System.out.println("❌ 註冊失敗！此帳號「" + newAccount + "」已經有人使用了。");
            }
        } catch (java.security.NoSuchAlgorithmException e) {
            System.err.println("密碼雜湊演算法錯誤: " + e.getMessage());
            System.out.println("❌ 註冊失敗，請稍後再試。");
        }
    }

    // --- 菜單相關功能 ---

    /**
     * 顧客的購物主迴圈。
     * 登入後，顧客會進入此迴圈，可以進行瀏覽、購物、結帳等操作，直到選擇登出。
     */
    private static void runCustomerShopping() throws SQLException, NoSuchAlgorithmException {
        // 顧客登入後的主迴圈，此迴圈會持續執行，直到使用者選擇登出。
        while (true) {
            showShopMenu(); // 顯示顧客的主選單
            int choice = getChoice(); // 取得顧客的選擇
            // 呼叫 handleChoice 處理選擇，並判斷其回傳值。
            // 如果回傳 false（代表顧客選擇了「登出」），則 `!` 運算子會使其變為 true，觸發 break。
            if (!handleChoice(choice)) { // `!` 是 "not" 的意思，表示如果 handleChoice 回傳 false
                break; // 顧客選擇離開購物，跳出迴圈返回登入畫面
            }
        }
    }

    /**
     * 顯示顧客的主選單。
     */
    private static void showShopMenu() {
        System.out.println("\n====== SnackForest 商店選單 ======"); // 選單標題
        System.out.println("1. 瀏覽與購買商品"); // 選項一：進入商品分類，開始購物
        System.out.println("2. 查看購物車"); // 選項二：管理購物車內的商品
        System.out.println("3. 會員中心 (查詢訂單/修改密碼)"); // 選項三：查看個人化資訊
        System.out.println("4. 登出"); // 選項四：返回登入畫面
        System.out.print("請選擇功能（輸入數字）：");
    }

    /**
     * 取得使用者輸入的整數選項。
     * 此方法會持續提示，直到使用者輸入一個有效的整數為止。
     * @return int - 使用者輸入的整數。
     */
    private static int getChoice() {
        while (true) {
            try { // `try` 區塊包住可能出錯的程式碼
                return Integer.parseInt(scanner.nextLine());
            } catch (NumberFormatException e) { // 如果使用者輸入的不是數字，`parseInt` 會拋出此例外
                // 如果輸入的不是合法整數（如輸入文字），顯示錯誤訊息並要求重新輸入
                System.out.print("輸入錯誤，請輸入數字：");
            }
        }
    }

    /**
     * 處理顧客主選單的選擇。
     * 根據傳入的選項數字，呼叫對應的功能方法。
     * @param choice 使用者選擇的數字。
     * @return boolean - 如果使用者選擇繼續購物則回傳 true，選擇登出則回傳 false。
     */
    private static boolean handleChoice(int choice) throws SQLException, NoSuchAlgorithmException {
        switch (choice) { // `switch` 語句根據 `choice` 的值，執行對應的 `case` 區塊。
            case 1:
                // 選項 1：瀏覽商品並直接購買
                browseAndBuyProductsLoop();
                break;
            case 2:
                // 選項 2：進入購物車頁面，可反覆刪除商品，選擇結帳或返回主選單
                if (runCartWorkflow()) {
                    checkout(); // 若使用者在購物車中選擇結帳（輸入 ++）
                }
                break;
            case 3:
                runMemberCenter(); // 進入會員中心
                break;
            case 4:
                // 選項 4：登出，返回 false 以跳出顧客迴圈
                return false;
            default: // 如果 `choice` 的值不符合任何 `case`，則執行 `default` 區塊。
                // 非 1～3 的輸入 → 顯示錯誤訊息
                System.out.println("無效選擇，請輸入1-4的數字！");
        } // `break` 會跳出 `switch` 語句，防止程式繼續執行下一個 `case`。
        return true; // 選單流程繼續執行
    }

    // --- 後台管理功能 ---

    /**
     * 管理員後台面板的主迴圈
     * 管理員登入後會進入此迴圈，可以進行各項管理操作，直到選擇登出
     */
    private static void runAdminPanel() throws SQLException, NoSuchAlgorithmException {
        // 管理員登入後的主迴圈，此迴圈會持續執行，直到管理員選擇登出。
        while (true) {
            showAdminMenu(); // 顯示管理員的主選單
            int choice = getChoice(); // 取得管理員的選擇
            // 呼叫 handleAdminChoice 處理選擇，如果回傳 false（代表管理員選擇了「登出」），則跳出迴圈。
            if (!handleAdminChoice(choice)) {
                break; // 管理員選擇登出，返回登入畫面
            }
        }
    }

    /**
     * 會員中心的主迴圈。
     * 提供會員查詢歷史訂單、修改密碼等功能。
     */
    private static void runMemberCenter() throws SQLException, NoSuchAlgorithmException {
        // 會員中心的子迴圈，讓使用者可以重複操作，直到選擇返回。
        while (true) {
            System.out.println("\n--- 會員中心 ---"); // 選單標題
            System.out.println("1. 查詢歷史訂單"); // 選項一：查看過去的購買紀錄
            System.out.println("2. 修改密碼"); // 選項二：變更登入密碼
            System.out.println("M. 返回主選單"); // 選項M：退出會員中心
            System.out.print("請選擇功能：");
            String input = scanner.nextLine().trim();
            if (input.equalsIgnoreCase("M")) { // 優先處理返回指令
                return; // 返回主選單
            }

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1: // 選擇 1
                        viewMyOrders();
                        break;
                    case 2: // 選擇 2
                        changeMyPassword();
                        break;
                    default: // 處理非 1 或 2 的數字選項
                        System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'M'！");
            }
        }
    }

    /**
     * 讓當前登入的顧客查詢自己的歷史訂單。
     */
    private static void viewMyOrders() throws SQLException {
        System.out.println("\n--- " + currentCustomer.getName() + " 的歷史訂單 ---"); // 使用登入者的名字作為標題
        // 修正 SQL：JOIN customers 表以取得 CustomerName，使其與 displayOrders 方法的期望相符
        String sql = "SELECT o.idOrders, o.OrderDate, o.TotalAmount, c.CustomerName " +
                "FROM orders o JOIN customers c ON o.idCustomers = c.idCustomers WHERE o.idCustomers = ? ORDER BY o.OrderDate DESC";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, currentCustomer.getId());
            // 使用管理員的 displayOrders 方法來顯示，因為格式相同
            // 這裡傳入 PreparedStatement 是為了讓 displayOrders 方法更具通用性
            displayOrders(stmt);
        }
    }

    /**
     * 讓當前登入的顧客修改自己的密碼。
     */
    private static void changeMyPassword() throws SQLException, NoSuchAlgorithmException {
        System.out.print("請輸入目前的密碼以進行驗證：");
        String oldPassword = scanner.nextLine().trim();

        // 驗證使用者輸入的舊密碼是否與記憶體中儲存的密碼相符
        Customer verifiedCustomer = customerDAO.findByAccountAndPassword(currentCustomer.getAccount(), oldPassword);

        if (verifiedCustomer == null) {
            System.out.println("❌ 密碼驗證失敗！");
            return;
        }

        System.out.print("請輸入新密碼：");
        String newPassword = scanner.nextLine().trim();
        System.out.print("請再次輸入新密碼以確認：");
        String confirmPassword = scanner.nextLine().trim();

        if (!newPassword.equals(confirmPassword)) {
            System.out.println("❌ 兩次輸入的新密碼不一致！");
            return;
        }

        // 建立一個新的 Customer 物件來傳遞更新資訊，避免直接修改 currentCustomer
        Customer updatedCustomer = new Customer(
                currentCustomer.getId(),
                currentCustomer.getName(),
                currentCustomer.getAccount(),
                newPassword, // 傳遞純文字密碼給 DAO 進行雜湊
                "" // 鹽值由 DAO 內部生成，此處為空字串佔位
        );

        try {
            if (customerDAO.save(updatedCustomer)) {
                // 資料庫更新成功後，才同步更新記憶體中的 currentCustomer 物件
                // 這裡假設 save 方法會更新現有記錄，並且下次登入會使用新的雜湊密碼
                System.out.println("✅ 密碼已成功更新！");
            } else {
                System.out.println("❌ 密碼更新失敗。");
            }
        } catch (SQLException e) {
            System.out.println("❌ 發生錯誤：" + e.getMessage());
            e.printStackTrace();
        }
    }

    //顯示後台管理選單
    private static void showAdminMenu() {
        System.out.println("\n====== 後台管理系統 ======"); // 選單標題
        System.out.println("1. 管理客戶資料"); // 選項一：新增、刪除、查詢客戶
        System.out.println("2. 管理商品資料"); // 選項二：新增、修改、刪除商品
        System.out.println("3. 查詢訂單資料"); // 選項三：查看所有或特定客戶的訂單
        System.out.println("4. 管理貨運方式"); // 選項四：管理結帳時可用的貨運選項
        System.out.println("5. 管理付款方式"); // 選項五：管理結帳時可用的付款選項
        System.out.println("6. 登出"); // 選項六：返回登入畫面
        System.out.print("請選擇功能：");
    }

    /**
     * 處理後台管理選單的選擇。
     * @param choice 管理員選擇的數字。
     * @return boolean - 如果管理員選擇繼續操作則回傳 true，選擇登出則回傳 false。
     */
    private static boolean handleAdminChoice(int choice) throws SQLException, NoSuchAlgorithmException {
        switch (choice) {
            case 1: // 選擇 1，進入客戶管理
                manageCustomers();
                break;
            case 2: // 選擇 2，進入商品管理
                manageProducts();
                break;
            case 3: // 選擇 3，進入訂單查詢
                queryOrders();
                break;
            case 4: // 選擇 4，進入貨運方式管理
                manageShippingMethods();
                break;
            case 5: // 選擇 5，進入付款方式管理
                managePaymentMethods();
                break;
            case 6: // 選擇 6，登出
                return false; // 回傳 false，通知 runAdminPanel() 迴圈結束
            default:
                System.out.println("無效選擇！");
        }
        return true;
    }

    /**
     * 客戶管理的主選單迴圈。
     * 建立一個子選單，讓管理員可以重複進行顯示、新增、刪除客戶等操作。
     */
    private static void manageCustomers() throws SQLException, NoSuchAlgorithmException {
        // 客戶管理的子迴圈，讓管理員可以重複操作，直到選擇返回。
        while (true) {
            System.out.println("\n--- 管理客戶資料 ---"); // 選單標題
            System.out.println("1. 顯示所有客戶"); // 選項一
            System.out.println("2. 新增客戶"); // 選項二
            System.out.println("3. 刪除客戶"); // 選項三
            System.out.println("B. 返回後台選單"); // 返回指令
            System.out.print("請選擇功能：");
            String input = scanner.nextLine().trim();

            if (input.equalsIgnoreCase("B")) {
                return; // 返回後台主選單
            }

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1 -> showAllCustomers();
                    case 2 -> addCustomer();
                    case 3 -> deleteCustomer();
                    default -> System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    /**
     * 新增客戶功能。
     * 提示管理員輸入新客戶的姓名、帳號和密碼，並將其寫入資料庫。
     */
    private static void addCustomer() throws SQLException, NoSuchAlgorithmException {
        System.out.println("\n--- 新增客戶 ---");
        System.out.print("請輸入新客戶姓名 (或輸入 'B' 返回)：");
        String newName = scanner.nextLine().trim();
        if (newName.equalsIgnoreCase("B")) {
            return; // `return` 會直接結束當前方法的執行
        }
        System.out.print("請輸入新客戶帳號：");
        String newAccount = scanner.nextLine().trim();
        System.out.print("請輸入新客戶密碼 (建議使用電話)：");
        String newPassword = scanner.nextLine().trim();

        // 找到下一個可用的 ID
        int newId = findNextAvailableId("customers", "idCustomers");

        // 建立新的 Customer 物件並透過 DAO 儲存
        Customer newCustomer = new Customer(newId, newName, newAccount, newPassword, ""); // Updated constructor

        try {
            if (customerDAO.save(newCustomer)) {
                System.out.println("✅ 客戶「" + newName + "」已成功新增！");
            }
        } catch (SQLException e) {
            if (e.getErrorCode() == 1062) {
                System.out.println("❌ 新增失敗！此帳號「" + newAccount + "」已經被註冊。");
            } else {
                throw e; // 拋出其他類型的 SQL 錯誤
            }
        } catch (java.security.NoSuchAlgorithmException e) {
            System.err.println("密碼雜湊演算法錯誤: " + e.getMessage());
            System.out.println("❌ 新增客戶失敗，請稍後再試。");
        }
    }

    /**
     * 刪除客戶功能。
     * 會先顯示所有客戶列表，然後提示管理員輸入要刪除的客戶ID，並進行二次確認。
     * 特別處理了因外鍵約束（客戶已有訂單）而無法刪除的情況。
     */
    private static void deleteCustomer() throws SQLException {
        showAllCustomers(); // 先顯示所有客戶，方便管理員查看ID
        System.out.print("\n請輸入要刪除的客戶 ID (或輸入 'B' 返回)：");
        String input = scanner.nextLine().trim();
        if (input.equalsIgnoreCase("B")) {
            return;
        }

        int customerId;
        try { // 再次使用 try-catch 處理可能的數字格式錯誤
            customerId = Integer.parseInt(input);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 輸入無效，請輸入數字 ID。");
            return;
        }

        System.out.print("確定要刪除此客戶嗎？這將無法復原！ (y/n): ");
        if (!scanner.nextLine().trim().equalsIgnoreCase("y")) { // 提供二次確認，增加操作安全性
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
            // 處理外鍵約束衝突。`getSQLState()` 回傳的 SQL 標準錯誤碼中，以 "23" 開頭的通常表示違反了資料完整性約束。
            // 在此情境下，最可能的原因是試圖刪除一個已經被 `orders` 表格引用的客戶。
            if (e.getSQLState().startsWith("23")) {
                System.out.println("❌ 刪除失敗！此客戶尚有訂單記錄，無法直接刪除。");
            } else {
                throw e;
            }
        }
    }

    /**
     * (管理員用) 顯示所有客戶列表。
     */
    private static void showAllCustomers() throws SQLException {
        System.out.println("\n--- 客戶列表 ---");
        List<Customer> customers = customerDAO.findAll();

        System.out.printf("%-5s %-15s %-15s\n", "ID", "姓名", "帳號"); // Removed "電話(密碼)" column
        System.out.println("----------------------------------------------------------");
        for (Customer c : customers) {
            System.out.printf("%-5d %-15s %-15s\n", c.getId(), c.getName(), c.getAccount()); // Removed c.getPhone()
        }
        System.out.println("----------------------------------------------------------");
    }

    // --- 購物車相關功能 ---

    /**
     * 瀏覽與購買商品的迴圈。
     * 讓使用者可以重複選擇商品分類進行瀏覽，直到選擇返回主選單。
     */
    private static void browseAndBuyProductsLoop() throws SQLException {
        // 瀏覽與購買的迴圈，讓使用者可以看完一個分類後，繼續看下一個分類。
        while (true) {
            // 呼叫單一分類的瀏覽購買流程，如果該方法回傳 false（代表使用者選擇了返回主選單），則跳出此迴圈。
            if (!browseAndBuySingleCategory())
                break;
        }
    }

    /**
     * 查看購物車內容，並處理使用者的操作指令。
     * @return int - 根據使用者操作回傳不同代碼：
     *         1: 使用者選擇結帳 (輸入 '++')
     *         0: 使用者選擇返回主選單 (輸入 'M')
     *         -1: 使用者進行了刪除操作或輸入無效，應停留在購物車頁面 (舊版邏輯)
     */
    private static CartAction viewCart() {
        System.out.println("\n🛒 購物車內容："); // 顯示購物車標題
        if (cart.isEmpty()) {
            System.out.println("目前購物車為空！\n"); // 若購物車為空，顯示提示
            return CartAction.RETURN_TO_MENU; // 返回主選單
        }
        int total = 0; // 初始化總金額
        for (Map.Entry<Product, Integer> entry : cart.entrySet()) { // 遍歷購物車內容
            Product p = entry.getKey(); // 取得商品
            int qty = entry.getValue(); // 取得購買數量
            int sub = p.getPrice() * qty; // 計算小計
            System.out.printf("%d. %s - $%d x %d = $%d\n", p.getIdProducts(), p.getProductName(), p.getPrice(), qty,
                    sub); // 顯示每項商品明細，包含商品ID
            total += sub; // 累加總金額
        }
        System.out.println("總金額：$" + total); // 顯示總金額

        System.out.println("\n你想要刪除購物車的商品嗎？"); // 提示是否要刪除商品
        System.out.println("輸入格式：商品編號 數量（數字需空格）"); // 提示輸入格式
        System.out.println("輸入 ++ 立即結帳，或 M 返回主選單："); // 顯示其他操作選項
        System.out.print("> "); // 顯示輸入提示符號
        String input = scanner.nextLine().trim(); // 讀取使用者輸入並去除前後空白

        if (input.equals("++"))
            return CartAction.PROCEED_TO_CHECKOUT; // 跳轉結帳
        if (input.equalsIgnoreCase("M"))
            return CartAction.RETURN_TO_MENU; // 返回主選單

        // 嘗試刪除商品指令解析與處理
        try {
            // 使用 "\\s+" 作為分隔符，可以處理使用者輸入多個空格的情況
            String[] tokens = input.split("\\s+");
            if (tokens.length >= 2) // 確保輸入至少有兩個部分（商品編號、數量）
                try {
                    int productId = Integer.parseInt(tokens[0]); // 將第一個欄位轉為商品編號
                    int qtyToRemove = Integer.parseInt(tokens[1]); // 將第二個欄位轉為要刪除的數量

                    Product toRemove = null; // 預設待刪除商品為 null
                    for (Product p : cart.keySet()) // 遍歷購物車所有商品
                        if (p.getIdProducts() == productId) { // 如果找到相符的商品編號
                            toRemove = p; // 記錄要刪除的商品
                            break;
                        }

                    if (toRemove != null) { // 如果找到商品
                        int currentQty = cart.get(toRemove); // 取得目前購物車內該商品的數量
                        if (qtyToRemove >= currentQty) {
                            cart.remove(toRemove); // 若刪除數量大於等於現有數量，就直接移除整個商品
                        } else {
                            cart.put(toRemove, currentQty - qtyToRemove); // 否則就扣除部分數量
                        }
                        System.out.println("✅ 已更新購物車，刪除商品：" + toRemove.getProductName()); // 顯示成功訊息
                    } else {
                        System.out.println("⚠️ 查無此商品編號於購物車中！"); // 找不到該商品，顯示警告
                    }
                } catch (NumberFormatException e) {
                    System.out.println("⚠️ 輸入格式錯誤，請輸入商品編號或指令！");
                }
            else
                System.out.println("⚠️ 輸入格式錯誤！"); // 輸入欄位不足，格式錯誤
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 輸入格式錯誤，商品編號與數量請輸入數字！"); // 輸入非數字，格式錯誤
        }

        return CartAction.STAY_ON_PAGE; // 回到購物車頁面（不離開 viewCart 函式）
    }

    /**
     * 購物車頁面的主迴圈。
     * 此方法會不斷呼叫 viewCart() 來顯示購物車並處理使用者操作，
     * 直到使用者選擇結帳或返回主選單。
     * @return boolean - true 代表要去結帳，false 代表要返回主選單。
     */
    private static boolean runCartWorkflow() {
        // 購物車頁面的主迴圈，讓使用者可以反覆進行刪除商品等操作。
        while (true) {
            CartAction action = viewCart(); // 呼叫 viewCart 並取得使用者的操作意圖
            if (action == CartAction.PROCEED_TO_CHECKOUT) // 如果使用者選擇結帳
                return true; // 使用者輸入 ++ → 結帳
            if (action == CartAction.RETURN_TO_MENU) // 如果使用者選擇返回
                return false; // 使用者輸入 0 → 返回主選單
            // 若 action 為 STAY_ON_PAGE（例如刪除了商品），迴圈會繼續執行，重新顯示更新後的購物車。
        }
    }

    // --- 商品管理相關功能 ---

    /**
     * 商品管理的主選單迴圈。
     * 建立一個子選單，讓管理員可以重複進行顯示、新增、修改、刪除商品等操作，
     * 直到選擇返回後台主選單。
     */
    private static void manageProducts() throws SQLException {
        while (true) { // 一個無限迴圈的功能選單，讓管理員可以持續操作商品資料
            System.out.println("\n--- 管理商品資料 ---");
            System.out.println("1. 顯示所有商品");
            System.out.println("2. 新增商品");
            System.out.println("3. 修改商品");
            System.out.println("4. 刪除商品");
            System.out.println("B. 返回後台選單");
            System.out.print("請選擇功能：");
            String input = scanner.nextLine().trim(); // 讀取使用者輸入的字串

            if (input.equalsIgnoreCase("B")) {
                return; // 離開這個功能並返回上一層選單
            }

            try {
                int choice = Integer.parseInt(input); // 嘗試將輸入轉為數字
                switch (choice) {
                    case 1:
                        adminShowProducts(); // 顯示商品列表
                        break;
                    case 2:
                        addProduct(); // 執行新增商品的流程
                        break;
                    case 3:
                        updateProduct(); // 執行修改商品的流程
                        break;
                    case 4:
                        deleteProduct(); // 執行刪除商品的流程
                        break;
                    default:
                        System.out.println("無效選擇！"); // 錯誤處理
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！"); // 處理非數字且非'B'的輸入
            }
        }
    }

    /**
     * (管理員用) 顯示所有商品列表
     * 從資料庫讀取商品資料，並使用格式化的輸出，讓列表更整齊易讀
     */
    private static void adminShowProducts() throws SQLException {
        List<Product> products = productDAO.findAll(); // 從資料庫中抓取所有商品資料
        System.out.println("\n🪧 商品列表：");
        System.out.printf("%-5s %-20s %-10s %-15s\n", "ID", "商品名稱", "價格", "分類");
        System.out.println("-----------------------------------------------------");
        for (Product p : products) {
            // 每筆商品資料格式化輸出（左對齊），包含商品 ID、名稱、價格、分類名稱
            System.out.printf("%-5d %-20s %-10d %-15s\n", p.getIdProducts(), p.getProductName(), p.getPrice(),
                    p.getCategoriesID());
        }
    }

    /**
     * 從資料庫獲取所有商品分類(category 資料表)
     * @return 一個 List，其中每個元素是一個 Map，代表一個分類 (包含 id 和 name)
     */
    private static List<Map<String, String>> getCategories() throws SQLException {
        List<Map<String, String>> categoryList = new ArrayList<>();
        String sql = "SELECT idcategories, categoryname FROM category"; // 查詢所有分類
        try (PreparedStatement stmt = conn.prepareStatement(sql);
                ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                // 每一筆分類資料放進 Map，包含分類 ID 與名稱
                Map<String, String> category = new HashMap<>();
                category.put("id", rs.getString("idcategories"));
                category.put("name", rs.getString("categoryname"));
                categoryList.add(category); // 加入清單
            }
        }
        return categoryList; // 回傳分類清單
    }

    /**
     * 新增商品功能。
     * 提示管理員輸入商品名稱、價格，並從現有分類中選擇一個，最後將資料寫入資料庫。
     */
    private static void addProduct() throws SQLException {
        System.out.println("\n--- 新增商品 ---");
        System.out.print("請輸入商品名稱 (或輸入 'B' 返回)：");
        String name = scanner.nextLine().trim(); // 讀取商品名稱
        if (name.equalsIgnoreCase("B")) {
            return; // 返回上一層
        }

        System.out.print("請輸入商品價格 (或輸入 'B' 返回)：");
        String priceInput = scanner.nextLine().trim();
        if (priceInput.equalsIgnoreCase("B")) {
            return; // 返回上一層
        }

        int price;
        try {
            price = Integer.parseInt(priceInput);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 價格輸入無效，操作已取消。");
            return;
        }

        List<Map<String, String>> categories = getCategories(); // 顯示分類選項
        System.out.println("請選擇商品分類：");
        for (Map<String, String> category : categories) {
            System.out.println(category.get("id") + ". " + category.get("name")); // 輸出分類選單
        }
        System.out.print("請輸入分類編號 (或輸入 'B' 返回)：");
        String categoryInput = scanner.nextLine().trim();
        if (categoryInput.equalsIgnoreCase("B")) {
            return; // 返回上一層
        }

        int categoryId;
        try {
            categoryId = Integer.parseInt(categoryInput);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 分類編號輸入無效，操作已取消。");
            return;
        }

        // 找到下一個可用的 ID
        int newId = findNextAvailableId("products", "idProducts");

        // 建立新的 Product 物件並透過 DAO 儲存
        // Product 的 category 欄位在此處不重要，可以給 null，因為 DAO 是用 categoryId 來儲存的
        // 這裡需提供 categoriesID，假設用 categoryId 變數
        Product newProduct = new Product(newId, categoryId, name, price);

        try {
            if (productDAO.save(newProduct, categoryId, new java.util.ArrayList<String>())) {
                System.out.println("✅ 商品新增成功！");
            } else {
                System.out.println("❌ 新增商品失敗。");
            }
        } catch (SQLException e) {
            if (e.getErrorCode() == 1062) { // 捕捉名稱重複的錯誤
                System.out.println("❌ 新增失敗！該商品名稱可能已存在。");
            } else {
                System.out.println("❌ 資料庫錯誤：" + e.getMessage());
            }
        }
    }

    /**
     * 修改一個已存在的商品。
     * 允許管理員選擇性地修改商品的名稱、價格或分類。（可部分更新）
     */
    private static void updateProduct() throws SQLException {
        adminShowProducts(); // 先顯示目前所有商品
        System.out.print("\n請輸入要修改的商品 ID (或輸入 'B' 返回)：");
        String input = scanner.nextLine().trim();
        if (input.equalsIgnoreCase("B")) {
            return;
        }

        int id;
        try {
            id = Integer.parseInt(input);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 輸入無效，請輸入數字 ID。");
            return;
        }

        // 讀取新的名稱與價格，允許略過不想修改的欄位
        System.out.print("請輸入新的商品名稱（留空則不修改）：");
        String newName = scanner.nextLine(); // 留空代表不修改

        // 顯示分類清單讓使用者重新選擇
        System.out.print("請輸入新的商品價格（留空則不修改）：");
        String priceInput = scanner.nextLine().trim();

        List<Map<String, String>> categories = getCategories();
        System.out.println("請選擇新的商品分類（留空則不修改）：");
        categories.forEach(c -> System.out.println(c.get("id") + ". " + c.get("name")));
        System.out.print("請輸入分類編號：");
        String categoryInput = scanner.nextLine().trim();

        try {
            Integer newPrice = priceInput.isEmpty() ? null : Integer.parseInt(priceInput);
            Integer newCategoryId = categoryInput.isEmpty() ? null : Integer.parseInt(categoryInput);

            // 至少要有一項被修改
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
            if (e.getErrorCode() == 1062) { // 捕捉名稱重複的錯誤
                System.out.println("❌ 更新失敗！該商品名稱可能已存在。");
            } else {
                System.out.println("❌ 資料庫錯誤：" + e.getMessage());
            }
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 價格或分類編號輸入無效，操作已取消。");
        }
    }

    /**
     * 刪除商品功能。
     * 提示管理員輸入要刪除的商品 ID，並進行二次確認。
     * 特別處理了因外鍵約束（商品已存在於訂單中）而無法刪除的情況。
     */
    private static void deleteProduct() throws SQLException {
        adminShowProducts(); // 顯示商品清單
        System.out.print("\n請輸入要刪除的商品 ID (或輸入 'B' 返回)：");
        String input = scanner.nextLine().trim();
        if (input.equalsIgnoreCase("B")) {
            return;
        }

        int id;
        try {
            id = Integer.parseInt(input);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ 輸入無效，請輸入數字 ID。");
            return;
        }

        System.out.print("確定要刪除此商品嗎？ (y/n): ");
        if (!scanner.nextLine().trim().equalsIgnoreCase("y")) {
            System.out.println("操作已取消。");
            return; // 使用者取消操作
        }

        try {
            if (productDAO.delete(id)) {
                System.out.println("✅ 商品刪除成功！");
            } else {
                System.out.println("⚠️ 找不到此商品 ID。");
            }
        } catch (SQLException e) {
            if (e.getSQLState().startsWith("23")) {
                System.out.println("❌ 刪除失敗！此商品可能已存在於某些訂單中，無法直接刪除。");
            } else {
                throw e; // 其他 SQL 錯誤則拋出例外
            }
        }
    }

    /**
     * 顯示單一商品分類的瀏覽與購買介面
     * 1. 顯示所有商品分類
     * 2. 讓使用者選擇一個分類
     * 3. 顯示該分類下的所有商品，並讓使用者可以將商品加入購物車
     */
    private static boolean browseAndBuySingleCategory() throws SQLException {
        List<Product> products = productDAO.findAll();
        while (true) {
            List<Map<String, String>> categoryList = getCategories();
            System.out.println("\n📦 商品分類：");
            for (int i = 0; i < categoryList.size(); i++) {
                System.out.println((i + 1) + ". " + categoryList.get(i).get("name"));
            }
            System.out.println("C. 前往結帳");
            System.out.println("M. 返回主選單");
            System.out.print("請選擇分類：");
            String input = scanner.nextLine().trim();
            if (input.equalsIgnoreCase("M")) {
                return false;
            }
            if (input.equalsIgnoreCase("C")) {
                if (cart.isEmpty()) {
                    System.out.println("\n❗ 購物車是空的，無法結帳。請先購買商品。");
                    continue;
                }
                checkout();
                return false;
            }
            int choice;
            try {
                choice = Integer.parseInt(input);
            } catch (NumberFormatException e) {
                System.out.println("❗ 無效選擇\n");
                continue;
            }
            if (choice < 1 || choice > categoryList.size()) {
                System.out.println("❗ 無效選擇\n");
                continue;
            }
            int selectedCatId = Integer.parseInt(categoryList.get(choice - 1).get("id"));
            String selectedCatName = categoryList.get(choice - 1).get("name");
            List<Product> categoryProducts = new ArrayList<>();
            for (Product p : products) {
                if (p.getCategoriesID() == selectedCatId) {
                    categoryProducts.add(p);
                }
            }
            System.out.println("\n🪧 商品列表（" + selectedCatName + "）：");
            for (int i = 0; i < categoryProducts.size(); i++) {
                System.out.println((i + 1) + ". " + categoryProducts.get(i));
            }
            while (true) {
                System.out.println("\n請輸入要購買的商品編號（B 返回分類選單，M 返回主選單）：");
                System.out.print("> ");
                String buyInput = scanner.nextLine().trim();
                if (buyInput.equalsIgnoreCase("B"))
                    break;
                if (buyInput.equalsIgnoreCase("M"))
                    return false;
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
    }

    // --- 訂單與結帳相關功能 ---

    /**
     * 查詢訂單資料的主介面。
     * 提供管理員查詢所有訂單或特定客戶訂單的功能。
     */
    private static void queryOrders() throws SQLException {
        while (true) {
            System.out.println("\n--- 查詢訂單資料 ---");
            System.out.println("1. 查詢所有訂單");
            System.out.println("2. 依客戶姓名查詢");
            System.out.println("B. 返回後台選單");
            System.out.print("請選擇查詢方式：");
            String input = scanner.nextLine().trim();

            if (input.equalsIgnoreCase("B")) {
                return; // 返回後台主選單
            }

            // `JOIN` 是 SQL 中用來合併兩個或多個表格的語法。
            // `o.idCustomers = c.idCustomers` 是合併的條件。
            String sql = "SELECT o.idOrders, o.OrderDate, o.TotalAmount, c.CustomerName " +
                    "FROM orders o JOIN customers c ON o.idCustomers = c.idCustomers ";

            try {
                int choice = Integer.parseInt(input);
                if (choice == 2) {
                    System.out.print("請輸入客戶姓名：");
                    String customerName = scanner.nextLine().trim();
                    sql += "WHERE c.CustomerName LIKE ? ORDER BY o.OrderDate DESC"; // `LIKE` 用於模糊查詢，`%` 是萬用字元。
                    try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                        stmt.setString(1, "%" + customerName + "%");
                        displayOrders(stmt);
                    }
                } else if (choice == 1) {
                    sql += "ORDER BY o.OrderDate DESC";
                    try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                        displayOrders(stmt);
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
     * 根據提供的 PreparedStatement 執行查詢並顯示訂單列表。
     */
    private static void displayOrders(PreparedStatement stmt) throws SQLException {
        try (ResultSet rs = stmt.executeQuery()) {
            System.out.println("\n--- 訂單列表 ---");
            System.out.printf("%-8s %-25s %-15s %-10s\n", "訂單ID", "訂單日期", "客戶名稱", "總金額"); // `%-25s` 表示寬度為25的字串
            System.out.println("--------------------------------------------------------------");
            boolean found = false; // 使用一個布林變數來標記是否找到任何資料
            while (rs.next()) { // `rs.next()` 會將指標移到下一筆資料，如果沒有下一筆則回傳 false
                found = true;
                System.out.printf("%-8d %-25s %-15s $%-9.2f\n",
                        rs.getInt("idOrders"),
                        rs.getTimestamp("OrderDate").toString(),
                        rs.getString("CustomerName"),
                        rs.getBigDecimal("TotalAmount"));
            }
            if (!found) { // 如果迴圈從未執行，表示查無資料
                System.out.println("查無任何訂單資料。");
                return;
            }
            System.out.println("--------------------------------------------------------------");
            System.out.print("輸入訂單 ID 查看詳細內容，或輸入 'B' 返回上一頁：");
            String input = scanner.nextLine().trim();
            if (input.equalsIgnoreCase("B")) {
                return; // 返回上一頁
            }
            try {
                int orderId = Integer.parseInt(input);
                showOrderDetails(orderId);
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    /**
     * 顯示特定訂單的詳細購買品項。
     */
    private static void showOrderDetails(int orderId) throws SQLException {
        // 查詢 orders 主檔
        String sql = "SELECT * FROM orders WHERE idOrders = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, orderId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    System.out.println("\n--- 訂單 #" + orderId + " 主檔內容 ---");
                    System.out.printf("訂單日期：%s\n", rs.getTimestamp("OrderDate"));
                    System.out.printf("會員ID：%d\n", rs.getInt("idCustomers"));
                    System.out.printf("總金額：$%.2f\n", rs.getBigDecimal("TotalAmount"));
                    System.out.printf("運送方式：%s\n", rs.getString("ShippingMethod"));
                    System.out.printf("付款方式：%s\n", rs.getString("PaymentMethod"));
                    System.out.printf("收貨人：%s\n", rs.getString("RecipientName"));
                    System.out.printf("收貨地址：%s\n", rs.getString("RecipientAddress"));
                    System.out.printf("收貨人電話：%s\n", rs.getString("RecipientPhone"));
                    System.out.printf("備註：%s\n", rs.getString("Remark"));
                    System.out.println("---------------------------------");
                } else {
                    System.out.println("查無此訂單主檔！");
                    return;
                }
            }
        }

        // 查詢並顯示商品明細
        String detailSql = "SELECT p.ProductName, od.Quantity, od.PriceAtTimeOfPurchase " +
                "FROM order_details od JOIN products p ON od.idProducts = p.idProducts " +
                "WHERE od.idOrders = ?";
        try (PreparedStatement detailStmt = conn.prepareStatement(detailSql)) {
            detailStmt.setInt(1, orderId);
            try (ResultSet drs = detailStmt.executeQuery()) {
                boolean found = false;
                System.out.println("商品明細：");
                System.out.println("商品名稱\t數量\t單價");
                System.out.println("-----------------------------");
                while (drs.next()) {
                    found = true;
                    System.out.printf("%-10s\t%d\t$%.2f\n",
                            drs.getString("ProductName"),
                            drs.getInt("Quantity"),
                            drs.getBigDecimal("PriceAtTimeOfPurchase"));
                }
                if (!found) {
                    System.out.println("(此訂單無商品明細)");
                }
                System.out.println("-----------------------------");
            }
        }
    }

    /**
     * 結帳流程。
     * 包含顯示清單、選擇運送與付款方式、輸入收件資訊，最後成立訂單並清空購物車。
     */
    private static void checkout() throws SQLException {
        // 檢查1：購物車是否為空
        if (cart.isEmpty()) {
            System.out.println("❗ 購物車為空，無法結帳。\n"); // 購物車空的情況下，阻止結帳
            return;
        }
        // 檢查2：使用者是否已登入
        if (currentCustomer == null) {
            System.out.println("錯誤：無顧客登入資訊，無法結帳。請重新登入。");
            return;
        }

        // --- 步驟1: 驗證與顯示清單 ---
        System.out.println("\n=== 購物車明細 ===");
        double total = 0; // 修正：使用 double 來處理金額，避免未來擴充時的精度問題
        System.out.println("\n🧾 結帳清單："); // 顯示標題
        for (Map.Entry<Product, Integer> entry : cart.entrySet()) { // 遍歷購物車商品
            Product item = entry.getKey();
            String itemName = item.getProductName();
            int quantity = entry.getValue();
            double subtotal = (double) item.getPrice() * quantity;
            System.out.printf("%d. %s x %d = $%.2f\n", item.getIdProducts(), itemName, quantity, subtotal); // 顯示商品明細，包含商品ID
            total += subtotal; // 累加總金額
        }

        // 宣告變數來儲存使用者的選擇，它們的作用域需要涵蓋到迴圈之後的步驟
        String shippingMethod;
        String paymentMethod;
        // 使用一個外層迴圈和標籤，方便在選擇付款方式時能跳回選擇貨運方式
        shippingAndPaymentLoop: while (true) {
            // --- 步驟2: 選擇貨運方式 ---
            while (true) {
                // 從您現有的 'shipping_methods' 表動態讀取貨運選項
                List<String> shippingOptions = new ArrayList<>();
                try (PreparedStatement stmt = conn
                        .prepareStatement("SELECT shipping_methodsName FROM shipping_methods");
                        ResultSet rs = stmt.executeQuery()) {
                    while (rs.next())
                        shippingOptions.add(rs.getString("shipping_methodsName"));
                }

                System.out.println("\n請選擇取貨方式：");
                for (int i = 0; i < shippingOptions.size(); i++) {
                    System.out.printf("%d. %s\n", i + 1, shippingOptions.get(i));
                }
                System.out.println("M. 返回購物 (返回主選單)");
                System.out.print("輸入選項：");

                String input = scanner.nextLine().trim();
                if (input.equalsIgnoreCase("M")) {
                    return; // 直接退出結帳流程，返回主選單
                }
                try {
                    int shippingChoice = Integer.parseInt(input);
                    if (shippingChoice >= 1 && shippingChoice <= shippingOptions.size()) {
                        shippingMethod = shippingOptions.get(shippingChoice - 1);
                        break; // 選擇成功，跳出貨運選擇迴圈
                      } else {
                        System.out.println("無效的選項，請重新輸入。");
                      }
                } catch (NumberFormatException e) {
                    System.out.println("⚠️ 輸入錯誤，請輸入數字或 'B'。");
                }
            }

            // --- 步驟3: 根據貨運方式決定可用的付款方式 ---
            // 呼叫新的樹狀付款選單邏輯
            paymentMethod = selectPaymentMethodWithTree(shippingMethod);

            if (paymentMethod == null) { // 如果使用者選擇返回
                continue shippingAndPaymentLoop; // 就跳回外層迴圈，重新選擇貨運方式
            } else {
                break shippingAndPaymentLoop; // 選擇成功，跳出迴圈繼續後續流程
            }
        }

        // --- 步驟4: 輸入收件資訊（可逐步返回） ---
        String recipient = "", address = "", phone = "";
        int step = 0;
        while (true) {
            switch (step) {
                case 0:
                    System.out.print("\n請輸入收件人姓名 (按B返回選擇付款方式)：");
                    String r = scanner.nextLine().trim();
                    if (r.equalsIgnoreCase("B")) {
                        // 回到付款方式
                        paymentMethod = null;
                        // 跳回付款方式選擇
                        shippingAndPaymentLoop: while (true) {
                            paymentMethod = selectPaymentMethodWithTree(shippingMethod);
                            if (paymentMethod == null)
                                continue shippingAndPaymentLoop;
                            else
                                break shippingAndPaymentLoop;
                        }
                        // 重新進入姓名輸入
                        continue;
                    }
                    if (!r.isEmpty()) {
                        recipient = r;
                        step = 1;
                    }
                    break;
                case 1:
                    System.out.print("請輸入收件地址（面交者可填面交地點）(按B返回輸入姓名)：");
                    String a = scanner.nextLine().trim();
                    if (a.equalsIgnoreCase("B")) {
                        step = 0;
                        continue;
                    }
                    if (!a.isEmpty()) {
                        address = a;
                        step = 2;
                    }
                    break;
                case 2:
                    System.out.print("請輸入聯絡電話 (按B返回輸入地址)：");
                    String p = scanner.nextLine().trim();
                    if (p.equalsIgnoreCase("B")) {
                        step = 1;
                        continue;
                    }
                    if (!p.isEmpty()) {
                        phone = p;
                        step = 3;
                    }
                    break;
                case 3:
                    // --- 步驟5: 顯示最終訂單摘要 ---
                    System.out.println("\n=== 訂單明細（請確認） ===");
                    System.out.printf("總金額：$%.2f\n", total);
                    System.out.println("付款方式：" + paymentMethod);
                    System.out.println("貨運方式：" + shippingMethod);
                    System.out.println("收件人：" + recipient);
                    System.out.println("收件地址：" + address);
                    System.out.println("聯絡電話：" + phone);
                    System.out.print("\nY 送出訂單 / N 全部重填 / B 返回購物車：");
                    String confirm = scanner.nextLine().trim();
                    if (confirm.equalsIgnoreCase("Y")) {
                        step = 4; // 進入訂單寫入
                        break;
                    } else if (confirm.equalsIgnoreCase("N")) {
                        step = 0;
                        continue;
                    } else if (confirm.equalsIgnoreCase("B")) {
                        // 返回購物車頁面
                        return;
                    } else {
                        System.out.println("請輸入 Y/N/B");
                        continue;
                    }
                case 4:
                    break;
            }
            if (step == 4)
                break;
        }

        // --- 步驟6: 將訂單寫入資料庫 (使用交易確保資料一致性) ---
        Connection checkoutConn = null;
        try {
            // 另外取得一個連線物件來處理交易，避免影響主連線
            checkoutConn = DBConnect.getConnection();
            // 1. 開始交易，關閉自動提交
            checkoutConn.setAutoCommit(false);

            // 2. 新增訂單到 `orders` 表，並取得自動產生的訂單 ID
            String orderSql = "INSERT INTO orders (idCustomers, OrderDate, TotalAmount, ShippingMethod, PaymentMethod, RecipientName, RecipientAddress, RecipientPhone) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)";
            int orderId;
            try (PreparedStatement orderStmt = checkoutConn.prepareStatement(orderSql,
                    Statement.RETURN_GENERATED_KEYS)) {
                orderStmt.setInt(1, currentCustomer.getId());
                orderStmt.setDouble(2, total);
                orderStmt.setString(3, shippingMethod);
                orderStmt.setString(4, paymentMethod);
                orderStmt.setString(5, recipient);
                orderStmt.setString(6, address);
                orderStmt.setString(7, phone);
                orderStmt.executeUpdate();

                try (ResultSet generatedKeys = orderStmt.getGeneratedKeys()) {
                    if (generatedKeys.next()) {
                        orderId = generatedKeys.getInt(1);
                    } else {
                        throw new SQLException("建立訂單失敗，無法取得訂單ID。");
                    }
                }
            }

            // 3. 將購物車內的商品逐一寫入 `order_details` 表
            String detailSql = "INSERT INTO order_details (idOrders, idProducts, Quantity, PriceAtTimeOfPurchase) VALUES (?, ?, ?, ?)";
            try (PreparedStatement detailStmt = checkoutConn.prepareStatement(detailSql)) {
                for (Map.Entry<Product, Integer> entry : cart.entrySet()) {
                    detailStmt.setInt(1, orderId);
                    detailStmt.setInt(2, entry.getKey().getIdProducts());
                    detailStmt.setInt(3, entry.getValue());
                    detailStmt.setDouble(4, (double) entry.getKey().getPrice());
                    detailStmt.addBatch(); // 加入批次處理
                }
                detailStmt.executeBatch(); // 執行批次新增
            }

            // 4. 如果所有操作都成功，提交交易
            checkoutConn.commit();
            System.out.println("\n✅ 感謝您的購買，歡迎再次光臨！");
            cart.clear(); // 正確的清空時機點，確保資料庫已經成功儲存訂單後，才清空記憶體中的購物車

        } catch (SQLException e) {
            System.out.println("❌ 訂單處理失敗，正在復原操作...");
            if (checkoutConn != null)
                checkoutConn.rollback(); // 如果出錯，回復交易
            throw e; // 將錯誤往上拋出，讓主程式處理
        } finally {
            if (checkoutConn != null)
                checkoutConn.close(); // 確保交易連線被關閉
        }
    }

    /**
     * 讓使用者選擇付款方式的完整流程，支援樹狀結構。
     * 此方法會先顯示頂層付款選項，並根據使用者的選擇，呼叫 `selectSubPaymentMethod` 處理子選單。
     *
     * @param shippingMethod 使用者選擇的貨運方式，用於過濾頂層付款選項 (例如面交只顯示現金)。
     * @return String - 使用者最終選擇的付款方式名稱。若使用者選擇返回上一層，則回傳 null。
     */
    private static String selectPaymentMethodWithTree(String shippingMethod) throws SQLException {
        while (true) {
            // 1. 查詢最上層的付款方式 (parent_id IS NULL)
            String sql = "SELECT idPaymentMethod, MethodName FROM payment_methods WHERE parent_id IS NULL";
            List<Integer> ids = new ArrayList<>();
            List<String> names = new ArrayList<>();
            try (PreparedStatement stmt = conn.prepareStatement(sql); ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String methodName = rs.getString("MethodName");
                    if (shippingMethod.equals("面交") && !methodName.equalsIgnoreCase("現金")) {
                        continue;
                    }
                    if (!shippingMethod.equals("面交") && methodName.equalsIgnoreCase("現金")) {
                        continue;
                    }
                    ids.add(rs.getInt("idPaymentMethod"));
                    names.add(methodName);
                }
            }
            if (names.isEmpty()) {
                System.out.println("❗ 無可用付款方式，請聯絡管理員。");
                return null;
            }
            System.out.println("\n請選擇付款方式：");
            for (int i = 0; i < names.size(); i++) {
                System.out.printf("%d. %s\n", i + 1, names.get(i));
            }
            System.out.println("B. 返回上一層");
            System.out.print("輸入選項：");
            String input = scanner.nextLine().trim();
            if (input.equalsIgnoreCase("B"))
                return null;
            int choice;
            try {
                choice = Integer.parseInt(input);
            } catch (NumberFormatException e) {
                System.out.println("⚠️ 輸入錯誤，請輸入數字或 'B'。");
                continue;
            }
            if (choice < 1 || choice > names.size()) {
                System.out.println("⚠️ 無效選擇，請重新輸入。");
                continue;
            }
            // 檢查是否有子分類
            int selectedId = ids.get(choice - 1);
            String sub = selectSubPaymentMethod(selectedId);
            if (sub != null) {
                return sub;
            } else {
                // 沒有子分類就直接回傳名稱
                return names.get(choice - 1);
            }
        }
    }

    /**
     * 處理付款方式的子選單選擇。
     * 如果傳入的 ID 沒有子分類，則直接回傳該 ID 對應的名稱。
     * 如果有子分類，則顯示子選單讓使用者選擇。
     *
     * @param parentId 上層付款方式的 ID。
     * @throws SQLException 如果資料庫查詢出錯。
     */
    /**
     * 此方法供 selectPaymentMethodWithTree 間接呼叫或未來擴充使用，
     * 雖 IDE 可能顯示未被本地呼叫的警告，但請勿移除。
     */
    private static String selectSubPaymentMethod(int parentId) throws SQLException {
        // 查詢此 parentId 底下所有的子分類
        String sql = "SELECT MethodName FROM payment_methods WHERE parent_id = ?";
        List<String> subOptions = new ArrayList<>();
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, parentId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    subOptions.add(rs.getString("MethodName"));
                }
            }
        }

        // 如果沒有子分類，表示這就是最終選項，直接回傳其名稱
        if (subOptions.isEmpty()) {
            String getNameSql = "SELECT MethodName FROM payment_methods WHERE idPaymentMethod = ?";
            try (PreparedStatement stmt = conn.prepareStatement(getNameSql)) {
                stmt.setInt(1, parentId);
                try (ResultSet rs = stmt.executeQuery()) {
                    // rs.next() 判斷是否有查到資料，如果有才回傳名稱
                    return rs.next() ? rs.getString("MethodName") : null;
                }
            }
        }

        // 如果有子分類，顯示子選單
        while (true) {
            System.out.println("\n--- 請選擇詳細付款方式 ---");
            for (int i = 0; i < subOptions.size(); i++) {
                System.out.printf("%d. %s\n", i + 1, subOptions.get(i));
            }
            System.out.println("B. 返回上一層");
            System.out.print("輸入選項：");
            String input = scanner.nextLine().trim();
            if (input.equalsIgnoreCase("B"))
                return null; // 使用者選擇返回
            try {
                int choice = Integer.parseInt(input);
                if (choice >= 1 && choice <= subOptions.size())
                    return subOptions.get(choice - 1);
                else
                    System.out.println("⚠️ 無效的選項，請重新輸入。");
            } catch (NumberFormatException e) {
                System.out.println("⚠️ 無效的選項，請重新輸入。");
            }
        }
    }

    // --- 其他輔助功能 ---

    /**
     * 尋找指定資料表中，第一個可用的（未被使用的）最小 ID。
     * 例如，如果 ID 有 1, 2, 4，此方法會回傳 3。
     * @param tableName 要查詢的資料表名稱。
     * @param idColumnName ID 欄位的名稱。
     * @return int - 下一個可用的 ID。
     * @throws SQLException 如果資料庫查詢出錯。
     */
    private static int findNextAvailableId(String tableName, String idColumn) throws SQLException {
        String query = "SELECT MAX(" + idColumn + ") + 1 AS nextId FROM " + tableName;
        try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery(query)) {
            if (rs.next()) {
                return rs.getInt("nextId");
            }
        }
        return 1; // 如果表是空的，從 1 開始
    }

    // --- 新增 manageShippingMethods 方法 ---
    private static void manageShippingMethods() throws SQLException {
        while (true) {
            System.out.println("\n--- 管理貨運方式 ---");
            System.out.println("1. 顯示所有貨運方式");
            System.out.println("2. 新增貨運方式");
            System.out.println("3. 刪除貨運方式");
            System.out.println("B. 返回後台選單");
            System.out.print("請選擇功能：");
            String input = scanner.nextLine().trim();

            if (input.equalsIgnoreCase("B")) {
                return;
            }

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1 -> showAllShippingMethods();
                    case 2 -> addShippingMethod();
                    case 3 -> deleteShippingMethod();
                    default -> System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    // --- 新增 managePaymentMethods 方法 ---
    private static void managePaymentMethods() throws SQLException {
        while (true) {
            System.out.println("\n--- 管理付款方式 ---");
            System.out.println("1. 顯示所有付款方式");
            System.out.println("2. 新增付款方式");
            System.out.println("3. 刪除付款方式");
            System.out.println("B. 返回後台選單");
            System.out.print("請選擇功能：");
            String input = scanner.nextLine().trim();

            if (input.equalsIgnoreCase("B")) {
                return;
            }

            try {
                int choice = Integer.parseInt(input);
                switch (choice) {
                    case 1 -> showAllPaymentMethods();
                    case 2 -> addPaymentMethod();
                    case 3 -> deletePaymentMethod();
                    default -> System.out.println("無效選擇！");
                }
            } catch (NumberFormatException e) {
                System.out.println("輸入錯誤，請輸入數字或 'B'！");
            }
        }
    }

    // --- 新增的貨運方式和付款方式管理方法 ---

    // --- 新增 showAllShippingMethods 方法 ---
    private static void showAllShippingMethods() throws SQLException {
        System.out.println("\n--- 貨運方式列表 ---");
        String sql = "SELECT idshipping_methods, shipping_methodsName FROM shipping_methods";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                System.out.printf("ID: %d, 名稱: %s\n", rs.getInt("idshipping_methods"), rs.getString("shipping_methodsName"));
            }
        }
    }

    // --- 新增 addShippingMethod 方法 ---
    private static void addShippingMethod() throws SQLException {
        System.out.print("請輸入新的貨運方式名稱：");
        String name = scanner.nextLine().trim();
        if (name.isEmpty()) {
            System.out.println("名稱不可為空！");
            return;
        }
        int newId = findNextAvailableId("shipping_methods", "idshipping_methods");
        String sql = "INSERT INTO shipping_methods (idshipping_methods, shipping_methodsName) VALUES (?, ?)";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, newId);
            stmt.setString(2, name);
            stmt.executeUpdate();
            System.out.println("✅ 新增成功！");
        }
    }

    // --- 新增 deleteShippingMethod 方法 ---
    private static void deleteShippingMethod() throws SQLException {
        showAllShippingMethods();
        System.out.print("請輸入要刪除的貨運方式 ID：");
        int id = Integer.parseInt(scanner.nextLine().trim());
        String sql = "DELETE FROM shipping_methods WHERE idshipping_methods = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, id);
            stmt.executeUpdate();
            System.out.println("✅ 刪除成功！");
        }
    }

    // --- 新增 showAllPaymentMethods 方法 ---
    private static void showAllPaymentMethods() throws SQLException {
        System.out.println("\n--- 付款方式列表 ---");
        String sql = "SELECT idPaymentMethod, MethodName FROM payment_methods";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                System.out.printf("ID: %d, 名稱: %s\n", rs.getInt("idPaymentMethod"), rs.getString("MethodName"));
            }
        }
    }

    // --- 新增 addPaymentMethod 方法 ---
    private static void addPaymentMethod() throws SQLException {
        System.out.print("請輸入新的付款方式名稱：");
        String name = scanner.nextLine().trim();
        if (name.isEmpty()) {
            System.out.println("名稱不可為空！");
            return;
        }
        int newId = findNextAvailableId("payment_methods", "idPaymentMethod");
        String sql = "INSERT INTO payment_methods (idPaymentMethod, MethodName) VALUES (?, ?)";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, newId);
            stmt.setString(2, name);
            stmt.executeUpdate();
            System.out.println("✅ 新增成功！");
        }
    }

    // --- 新增 deletePaymentMethod 方法 ---
    private static void deletePaymentMethod() throws SQLException {
        showAllPaymentMethods();
        System.out.print("請輸入要刪除的付款方式 ID：");
        int id = Integer.parseInt(scanner.nextLine().trim());
        String sql = "DELETE FROM payment_methods WHERE idPaymentMethod = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, id);
            stmt.executeUpdate();
            System.out.println("✅ 刪除成功！");
        }
    }
}
