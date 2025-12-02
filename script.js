// ===== CONFIGURATION & UTILS =====
const ENCRYPTION_KEY = 'expense_manager_secret_key_2025';

// Biến lưu instance của Chart.js để destroy trước khi vẽ lại (tránh lỗi đè chart)
let categoryChartInstance = null;

// currency conf
const CURRENCY_CONFIG = {
    'USD': { locale: 'en-US', currency: 'USD' },
    'EUR': { locale: 'de-DE', currency: 'EUR' },
    'GBP': { locale: 'en-GB', currency: 'GBP' },
    'JPY': { locale: 'ja-JP', currency: 'JPY' },
    'CNY': { locale: 'zh-CN', currency: 'CNY' },
    'VND': { locale: 'vi-VN', currency: 'VND' },
    'ZWL': { locale: 'en-ZW', currency: 'ZWL' }
};

// biến toàn cục
let currentUser = null;
let currentTransactions = [];
let currentBudgets = [];
let currentGoals = [];

// ===== biểu đồ line =====
google.charts.load('current', { 'packages': ['corechart'] });
let isGoogleChartsLoaded = false;
google.charts.setOnLoadCallback(() => { 
    isGoogleChartsLoaded = true; 
    if(currentUser) updateCharts(); 
});

// ===== xử lí login=====

function encryptPassword(password) { //mã hóa mật khẩu
    try { return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString(); } 
    catch (e) { return password; }
}

function decryptPassword(encryptedPassword) { //giải mã mật khẩu
    try { 
        const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) { return encryptedPassword; }
}

function loadUsers() {//load cài đặt người dùng
    try { return JSON.parse(localStorage.getItem('app_users')) || []; } 
    catch (e) { return []; }
}

function saveUsers(users) {// lưu cài đặt người dùng
    localStorage.setItem('app_users', JSON.stringify(users));
}

function loadCurrentUser() {// load phiên đăng nhập
    try {
        const stored = localStorage.getItem('app_current_user');
        if (stored) {
            currentUser = JSON.parse(stored);
            if (!currentUser.settings) currentUser.settings = { baseCurrency: 'USD' };
            return true;
        }
    } catch (e) { console.warn(e); }
    return false;
}

function saveCurrentUser(user) {
    localStorage.setItem('app_current_user', JSON.stringify(user));
    currentUser = user;
}

function signOut() {
    localStorage.removeItem('app_current_user');
    currentUser = null;
    currentTransactions = [];
    showAuthPage();
}

// ===== CURRENCY HELPER =====

function getCurrentCurrency() {
    return currentUser?.settings?.baseCurrency || 'USD';
}

function formatCurrency(amount) {
    const code = getCurrentCurrency();
    const config = CURRENCY_CONFIG[code] || CURRENCY_CONFIG['USD'];
    try {
        const digits = (code === 'VND' || code === 'JPY') ? 0 : 2;
        return new Intl.NumberFormat(config.locale, {
            style: 'currency',
            currency: config.currency,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }).format(amount);
    } catch (e) { return `${amount} ${code}`; }
}

// ===== DATA MANAGEMENT ===== quản lí dữ liệu

function getUserKey() {
    if (!currentUser) return null;
    return currentUser.email.replace(/[^a-zA-Z0-9]/g, '_');
}

function loadUserData() {
    const key = getUserKey();
    if (!key) return;
    currentTransactions = JSON.parse(localStorage.getItem(`app_transactions_${key}`)) || [];
    currentBudgets = JSON.parse(localStorage.getItem(`app_budgets_${key}`)) || [];
    currentGoals = JSON.parse(localStorage.getItem(`app_goals_${key}`)) || [];
}

function saveTransactionData() {// lưu dữ liệu giao dịch
    const key = getUserKey();
    if (key) localStorage.setItem(`app_transactions_${key}`, JSON.stringify(currentTransactions));
    updateDashboard();
}

function saveBudgetData() {// lưu dữ liệu ngân sách
    const key = getUserKey();
    if (key) localStorage.setItem(`app_budgets_${key}`, JSON.stringify(currentBudgets));
    updateBudgetList();
}

function saveGoalData() {// lưu dữ liệu mục tiêu
    const key = getUserKey();
    if (key) localStorage.setItem(`app_goals_${key}`, JSON.stringify(currentGoals));
    updateGoalsList();
}

// ===== UI UPDATES ===== refresh lại giao diện

function showMessage(msg, type = 'info') {
    // Tạo toast simple
    const toast = document.createElement('div');
    toast.textContent = msg;
    Object.assign(toast.style, {
        position: 'fixed', top: '20px', right: '20px', padding: '12px 20px',
        borderRadius: '8px', color: '#fff', zIndex: '9999', fontWeight: '500',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    });
    
    if (type === 'success') toast.style.backgroundColor = '#10b981';
    else if (type === 'error') toast.style.backgroundColor = '#ef4444';
    else toast.style.backgroundColor = '#3b82f6';

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateDashboard() { //refresh lại bảng dashboard
    if (!currentUser) return;

    let income = 0;
    let expense = 0;

    currentTransactions.forEach(t => {
        const amt = parseFloat(t.amount);
        if (t.type === 'income') income += amt;
        else if (t.type === 'expense') expense += amt;
    });

    const balance = income - expense;
    const savings = balance > 0 ? balance : 0; 

    document.getElementById('totalBalance').innerText = formatCurrency(balance);
    document.getElementById('totalIncome').innerText = formatCurrency(income);
    document.getElementById('totalExpenses').innerText = formatCurrency(expense);
    document.getElementById('totalSavings').innerText = formatCurrency(savings);

    updateTransactionsTable();
    updateCharts();
}

function updateTransactionsTable() { // cập nhật bảng giao dịch
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sorted = [...currentTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><div class="transaction-category" style="display: flex; justify-content: center" center><span class="material-symbols-outlined">category</span></div></tr>
                          <tr><td colspan="7"><div class="empty-state"><h3>No transactions</h3></div></td></tr>`;
    } else {
        sorted.forEach(t => {
            const row = document.createElement('tr');
            const amountClass = t.type === 'income' ? 'text-success' : 'text-danger';
            const sign = t.type === 'income' ? '+' : '-';
            
            row.innerHTML = `
                <td>${t.category}</td>
                <td>${t.title}</td>
                <td>${t.date}</td>
                <td class="${amountClass}" style="font-weight:bold">${sign} ${formatCurrency(t.amount)}</td>
                <td>${t.type.toUpperCase()}</td>
                <td>${t.notes || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${t.id}')">
                        <span class="material-symbols-outlined" style="font-size:16px">delete</span>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // List rút gọn
    const recentList = document.getElementById('recentTransactionsList');
    if (recentList) {
        recentList.innerHTML = '';
        if (sorted.length === 0) {
             recentList.innerHTML = `<div class="empty-state"><h3>No transactions yet</h3><button class="btn btn-primary" onclick="showAddTransactionModal()">Add Transaction</button></div>`;
        } else {
            sorted.slice(0, 5).forEach(t => {
                const item = document.createElement('div');
                item.className = 'transaction-item';
                const sign = t.type === 'income' ? '+' : '-';
                const color = t.type === 'income' ? '#16a34a' : '#dc2626';
                
                item.innerHTML = `
                    <div class="transaction-info">
                        <div class="transaction-category" style="background: #f1f5f9">
                             <span class="material-symbols-outlined">receipt</span>
                        </div>
                        <div class="transaction-details">
                            <h4>${t.title}</h4>
                            <p>${t.date}</p>
                        </div>
                    </div>
                    <div class="transaction-amount" style="color: ${color}">
                        ${sign} ${formatCurrency(t.amount)}
                    </div>
                `;
                recentList.appendChild(item);
            });
        }
    }
}

// ===== CHART SYSTEM (FIXED) =====
// Pie Chart: Dùng Chart.js (vẽ vào Canvas)
// Line Chart: Dùng Google Charts (vẽ vào Div)

function updateCharts() {
    if (!currentUser) return;

    // 1. UPDATE PIE CHART (Chart.js -> Canvas)
    const categoryData = {};
    currentTransactions.filter(t => t.type === 'expense').forEach(t => {
        categoryData[t.category] = (categoryData[t.category] || 0) + parseFloat(t.amount);
    });

    const labels = Object.keys(categoryData);
    const dataValues = Object.values(categoryData);
    const canvas = document.getElementById('categoryPieChart');

    if (canvas) {
        // Destroy biểu đồ cũ nếu tồn tại để tránh lỗi đè hình
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        if (labels.length > 0) {
            const ctx = canvas.getContext('2d');
            categoryChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: [
                            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        } else {
            // Xóa trắng canvas nếu không có data
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Có thể vẽ text "No Data" thủ công nếu muốn
        }
    }


    // 2. UPDATE LINE CHART (Google Charts -> Div)
    if (!isGoogleChartsLoaded) return;
    
    const dateData = {};
    currentTransactions.forEach(t => {
        dateData[t.date] = (dateData[t.date] || 0) + parseFloat(t.amount);
    });
    
    const lineDataArray = [['Date', 'Total']];
    const sortedDates = Object.keys(dateData).sort();
    sortedDates.forEach(date => {
        lineDataArray.push([date, dateData[date]]);
    });

    const lineChartDiv = document.getElementById('monthlySpendingChart');
    if (lineChartDiv) {
        if (lineDataArray.length > 1) {
            const dataLine = google.visualization.arrayToDataTable(lineDataArray);
            const optionsLine = { 
                title: 'Transaction History', 
                curveType: 'function', 
                legend: { position: 'bottom' },
                chartArea: { width: '85%', height: '70%' }
            };
            const chartLine = new google.visualization.LineChart(lineChartDiv);
            chartLine.draw(dataLine, optionsLine);
        } else {
            lineChartDiv.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;">Not enough data</div>';
        }
    }
}

function updateBudgetList() {
    const container = document.getElementById('budgetList');
    if (!container) return;
    container.innerHTML = '';

    if (currentBudgets.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No budgets set</h3><button class="btn btn-primary" onclick="showAddBudgetModal()">Create Budget</button></div>`;
        return;
    }

    currentBudgets.forEach(b => {
        const spent = currentTransactions
            .filter(t => t.type === 'expense' && t.category === b.category)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const percent = Math.min(100, (spent / parseFloat(b.amount)) * 100);
        const colorClass = percent > 90 ? 'danger' : (percent > 70 ? 'warning' : '');
        const barColor = percent > 90 ? '#ef4444' : (percent > 70 ? '#f59e0b' : '#6750A4');

        const div = document.createElement('div');
        div.className = 'budget-item';
        div.innerHTML = `
            <div class="budget-header">
                <span class="budget-category">${b.category}</span>
                <span class="budget-amount">${formatCurrency(spent)} / ${formatCurrency(b.amount)}</span>
            </div>
            <div class="progress">
                <div class="progress-bar ${colorClass}" style="width: ${percent}%; background-color: ${barColor}"></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function updateGoalsList() { // cập nhật danh sách mục tiêu
    const container = document.getElementById('goalsList');
    if (!container) return;
    container.innerHTML = '';
    
    if (currentGoals.length === 0) {
        container.innerHTML = `<div class="goal-card"><div class="empty-state"><h3>No goals</h3><button class="btn btn-primary" onclick="showAddGoalModal()">Add Goal</button></div></div>`;
        return;
    }

    currentGoals.forEach(g => {
        const percent = Math.min(100, Math.round((parseFloat(g.current) / parseFloat(g.target)) * 100));
        const div = document.createElement('div');
        div.className = 'goal-card';
        div.style.marginBottom = '20px';
        div.innerHTML = `
            <div class="goal-progress">
                <div class="goal-circle" style="background: conic-gradient(#10b981 ${percent * 3.6}deg, #f1f5f9 0deg);">
                    <span class="goal-percentage">${percent}%</span>
                </div>
            </div>
            <h4>${g.name}</h4>
            <p>${formatCurrency(g.current)} of ${formatCurrency(g.target)}</p>
            <p style="font-size:12px; color:#64748b">Target: ${g.date}</p>
        `;
        container.appendChild(div);
    });
}

// ===== AUTH HANDLERS (FIXED LOGIN) =====

function toggleAuthForm() { // chuyển đổi form đăng nhập và tạo tài khoản
    const signIn = document.getElementById('signInForm');
    const create = document.getElementById('createAccountForm');
    const btn = document.getElementById('toggleFormBtn');
    const txt = document.getElementById('toggleText');

    if (signIn.style.display !== 'none') {
        signIn.style.display = 'none';
        create.style.display = 'block';
        txt.textContent = 'Already have an account? ';
        btn.textContent = 'Sign in here';
    } else {
        signIn.style.display = 'block';
        create.style.display = 'none';
        txt.textContent = "Don't have an account? ";
        btn.textContent = 'Sign up here';
    }
}

function showAuthPage() { // hiển thị trang đăng nhập
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

function showAppPage() {    //  hiển thị trang ứng dụng
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('userNameDisplay').textContent = currentUser.name;
    
    loadUserData();
    loadSettingsToUI();
    updateDashboard();
    updateBudgetList();
    updateGoalsList();
}

async function handleSignIn(e) {// xử lí đăng nhập
    e.preventDefault();
    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value;

    const users = loadUsers();
    
    // FIX: Tìm user theo Email TRƯỚC
    const user = users.find(u => u.email === email);

    if (user) {
        // Sau đó mới check password của đúng user đó
        let storedPass = user.password;
        let decrypted = decryptPassword(storedPass);
        
        if (decrypted === password || storedPass === password) {
            saveCurrentUser(user);
            showMessage('Signed in successfully!', 'success');
            document.getElementById('signInForm').reset();
            showAppPage();
            return;
        }
    }
    
    showMessage('Invalid email or password', 'error');
}

async function handleCreateAccount(e) {// xử lí tạo tài khoản
    e.preventDefault();
    const name = document.getElementById('createName').value.trim();
    const email = document.getElementById('createEmail').value.trim();
    const pwd = document.getElementById('createPassword').value;
    const pwdConf = document.getElementById('createPasswordConfirm').value;

    if (pwd !== pwdConf) return showMessage('Passwords do not match', 'error');
    
    const users = loadUsers();
    if (users.find(u => u.email === email)) return showMessage('Email already exists', 'error');

    const newUser = {
        email,
        password: encryptPassword(pwd),
        name,
        settings: { baseCurrency: 'USD' }
    };
    
    users.push(newUser);
    saveUsers(users);
    saveCurrentUser(newUser);
    showMessage('Account created!', 'success');
    document.getElementById('createAccountForm').reset();
    showAppPage();
}

// ===== SETTINGS HANDLERS =====

function loadSettingsToUI() { // tải cài đặt vào UI
    if (!currentUser) return;
    const currencySelect = document.getElementById('currencySetting');
    if (currencySelect) currencySelect.value = getCurrentCurrency();

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = localStorage.getItem('app_theme_mode') || 'system';
    applyTheme(themeSelect.value);
}

function saveSettings() { //    lưu cài đặt
    if (!currentUser) return;

    const currencySelect = document.getElementById('currencySetting');
    const themeSelect = document.getElementById('themeSelect');
    
    if (currencySelect) {
        const newCurr = currencySelect.value;
        currentUser.settings.baseCurrency = newCurr;
        
        const users = loadUsers();
        const idx = users.findIndex(u => u.email === currentUser.email);
        if (idx !== -1) {
            users[idx].settings = users[idx].settings || {};
            users[idx].settings.baseCurrency = newCurr;
            saveUsers(users);
        }
        saveCurrentUser(currentUser);
    }

    if (themeSelect) {
        localStorage.setItem('app_theme_mode', themeSelect.value);
        applyTheme(themeSelect.value);
    }

    updateDashboard();
    updateBudgetList();
    updateGoalsList();
    showMessage('Settings saved successfully!', 'success');
}

function applyTheme(mode) { // áp dụng giao diện
    const body = document.body;
    if (mode === 'dark') body.classList.add('theme-dark');
    else if (mode === 'light') body.classList.remove('theme-dark');
    else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            body.classList.add('theme-dark');
        } else {
            body.classList.remove('theme-dark');
        }
    }
}

// ===== TRANSACTION MODAL HANDLERS (FIXED EVENTS) =====

// Hàm này được gọi từ các nút Add
function showAddTransactionModal(type = '') {
    const modal = document.getElementById('addTransactionModal');
    const typeSelect = document.getElementById('transactionType');
    
    // Reset form trước khi hiện
    document.getElementById('transactionForm').reset();
    
    // Set type nếu có (Income/Expense)
    if (type && typeSelect) {
        typeSelect.value = type;
    } 

    // Set ngày hôm nay mặc định
    document.getElementById('transactionDate').valueAsDate = new Date();

    modal.classList.add('active');
}

function showAddBudgetModal() { // mở modal thêm ngân sách
    document.getElementById('addBudgetModal').classList.add('active');
}
function showAddGoalModal() { // mở modal thêm mục tiêu
    document.getElementById('addGoalModal').classList.add('active');
}

function closeModal(id) { // đóng modal
    document.getElementById(id).classList.remove('active');
}

function handleSaveTransaction(e) { // lưu giao dịch
    e.preventDefault();
    const type = document.getElementById('transactionType').value;
    const title = document.getElementById('transactionTitle').value;
    const amount = document.getElementById('transactionAmount').value;
    const category = document.getElementById('transactionCategory').value;
    const date = document.getElementById('transactionDate').value;

    if (!type || !title || !amount || !category || !date) return showMessage('Please fill all fields', 'error');

    const newTrans = { // tạo giao dịch mới
        id: Date.now().toString(),
        type, title, amount, category, date,
        notes: document.getElementById('transactionNotes').value
    };

    currentTransactions.push(newTrans);
    saveTransactionData();
    closeModal('addTransactionModal');
    showMessage('Transaction added!', 'success');
}

function deleteTransaction(id) {// xóa giao dịch
    if (!confirm('Delete this transaction?')) return;
    currentTransactions = currentTransactions.filter(t => t.id !== id);
    saveTransactionData();
    showMessage('Transaction deleted', 'success');
}

function handleSaveBudget(e) {// lưu ngân sách
    e.preventDefault();
    const cat = document.getElementById('budgetCategory').value;
    const amt = document.getElementById('budgetAmount').value;
    
    if(!cat || !amt) return showMessage('Missing fields', 'error');
    
    currentBudgets = currentBudgets.filter(b => b.category !== cat);
    currentBudgets.push({ id: Date.now().toString(), category: cat, amount: amt });
    
    saveBudgetData();
    closeModal('addBudgetModal');
    showMessage('Budget set!', 'success');
}

function handleSaveGoal(e) {// lưu mục tiêu
    e.preventDefault();
    const name = document.getElementById('goalName').value;
    const target = document.getElementById('goalAmount').value;
    const current = document.getElementById('goalCurrentAmount').value;
    const date = document.getElementById('goalTargetDate').value;

    if(!name || !target) return showMessage('Missing fields', 'error');

    currentGoals.push({
        id: Date.now().toString(),
        name, target, current, date
    });
    
    saveGoalData();
    closeModal('addGoalModal');
    showMessage('Goal added!', 'success');
}

// ===== NAVIGATION =====

function setupNavigation() {// thiết lập điều hướng
    const buttons = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const title = document.getElementById('pageTitle');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    buttons.forEach(btn => {// gắn sự kiện cho các nút điều hướng
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-page');
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            title.textContent = btn.querySelector('.nav-label').textContent;
            if (window.innerWidth <= 768) sidebar.classList.remove('open');
            
            // Nếu chuyển sang tab Reports hoặc Dashboard thì vẽ lại chart
            if (targetId === 'dashboard' || targetId === 'reports') {
                setTimeout(updateCharts, 100);
            }
        });
    });

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

function togglePasswordVisibility(id) {// ẩn/hiện mật khẩu
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== INITIALIZATION (FIXED EVENTS) =====

document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation
    setupNavigation();

    // 2. Auth Listeners
    const signInForm = document.getElementById('signInForm');
    if(signInForm) signInForm.addEventListener('submit', handleSignIn);

    const createForm = document.getElementById('createAccountForm');
    if(createForm) createForm.addEventListener('submit', handleCreateAccount);

    // 3. Settings & Reset
    const saveSetBtn = document.getElementById('saveSettingsBtn');
    if(saveSetBtn) saveSetBtn.addEventListener('click', saveSettings);
    
    const resetBtn = document.getElementById('resetDataBtn');
    if(resetBtn) resetBtn.addEventListener('click', () => {
        if(confirm('Reset all data?')) {
            localStorage.clear();
            location.reload();
        }
    });

    // 4. Modal Triggers (Gắn sự kiện cho các nút Dashboard)
    
    // Nút "Add Transaction" trên Header
    const addTransHeader = document.getElementById('addTransactionBtn');
    if(addTransHeader) {
        addTransHeader.addEventListener('click', () => showAddTransactionModal());
    }

    // Nút "Add Income" màu xanh ở Dashboard
    const addIncomeBtn = document.getElementById('addIncomeBtn');
    if(addIncomeBtn) {
        addIncomeBtn.addEventListener('click', () => showAddTransactionModal('income'));
    }

    // Nút "Add Expense" màu đỏ ở Dashboard
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    if(addExpenseBtn) {
        addExpenseBtn.addEventListener('click', () => showAddTransactionModal('expense'));
    }

    // Các nút Save trong Modal
    const saveTransBtn = document.getElementById('saveTransactionBtn');
    if(saveTransBtn) saveTransBtn.addEventListener('click', handleSaveTransaction);

    const saveBudgBtn = document.getElementById('saveBudgetBtn');
    if(saveBudgBtn) saveBudgBtn.addEventListener('click', handleSaveBudget);
    
    const saveGoalBtn = document.getElementById('saveGoalBtn');
    if(saveGoalBtn) saveGoalBtn.addEventListener('click', handleSaveGoal);

    // 5. Check Session
    if (loadCurrentUser()) {
        showAppPage();
    } else {
        showAuthPage();
    }
});