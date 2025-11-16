        // ===== GOOGLE CHARTS INITIALIZATION =====
        google.charts.load('current', {'packages':['corechart']});

        // ===== AUTH SYSTEM =====
        let currentUser = null;

        // Encryption key (in production, derive from user's master password)
        const ENCRYPTION_KEY = 'expense_manager_secret_key_2025';

        // Encrypt password using CryptoJS
        function encryptPassword(password) {
            try {
                return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
            } catch (e) {
                console.error('Encryption failed:', e);
                return password; // Fallback to plain text
            }
        }

        // Decrypt password using CryptoJS
        function decryptPassword(encryptedPassword) {
            try {
                const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
                return bytes.toString(CryptoJS.enc.Utf8);
            } catch (e) {
                console.error('Decryption failed:', e);
                return encryptedPassword; // Fallback
            }
        }

        // Load users from localStorage
        function loadUsers() {
            try {
                const stored = localStorage.getItem('app_users');
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.warn('Failed to load users:', e);
                return [];
            }
        }

        // Save users to localStorage
        function saveUsers(users) {
            try {
                localStorage.setItem('app_users', JSON.stringify(users));
            } catch (e) {
                console.warn('Failed to save users:', e);
            }
        }

        // Load current user session
        function loadCurrentUser() {
            try {
                const stored = localStorage.getItem('app_current_user');
                if (stored) {
                    currentUser = JSON.parse(stored);
                    return true;
                }
            } catch (e) {
                console.warn('Failed to load current user:', e);
            }
            return false;
        }

        // Save current user session
        function saveCurrentUser(user) {
            try {
                localStorage.setItem('app_current_user', JSON.stringify(user));
                currentUser = user;
            } catch (e) {
                console.warn('Failed to save current user:', e);
            }
        }

        // Sign out
        function signOut() {
            try {
                localStorage.removeItem('app_current_user');
                currentUser = null;
                showAuthPage();
            } catch (e) {
                console.warn('Failed to sign out:', e);
            }
        }

        // Toggle between sign in and create account forms
        function toggleAuthForm() {
            const signInForm = document.getElementById('signInForm');
            const createForm = document.getElementById('createAccountForm');
            const toggleText = document.getElementById('toggleText');
            const toggleBtn = document.getElementById('toggleFormBtn');

            if (signInForm.style.display !== 'none') {
                // Show create account
                signInForm.style.display = 'none';
                createForm.style.display = 'block';
                toggleText.textContent = 'Already have an account? ';
                toggleBtn.textContent = 'Sign in here';
            } else {
                // Show sign in
                signInForm.style.display = 'block';
                createForm.style.display = 'none';
                toggleText.textContent = 'Don\'t have an account? ';
                toggleBtn.textContent = 'Sign up here';
            }
        }

        // Toggle password visibility
        function togglePasswordVisibility(inputId) {
            const input = document.getElementById(inputId);
            if (input.type === 'password') {
                input.type = 'text';
            } else {
                input.type = 'password';
            }
        }

        // Show auth page
        function showAuthPage() {
            const authContainer = document.getElementById('authContainer');
            const appContainer = document.getElementById('appContainer');
            if (authContainer) authContainer.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';
        }

        // Show app page
        function showAppPage() {
            const authContainer = document.getElementById('authContainer');
            const appContainer = document.getElementById('appContainer');
            if (authContainer) authContainer.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';
        }

        // Handle sign in
        async function handleSignIn(e) {
            e.preventDefault();
            const email = document.getElementById('signInEmail').value.trim();
            const password = document.getElementById('signInPassword').value;

            if (!email || !password) {
                showMessage('Please fill in all fields', 'error');
                return;
            }

            const users = loadUsers();
            const user = users.find(u => {
                // Try to support multiple storage formats to be resilient to past changes
                // 1) Encrypted password (preferred): decrypt and compare
                // 2) Plaintext stored password: compare directly
                // 3) Encrypted with current key: compare encrypted input
                let decryptedPwd = null;
                try {
                    decryptedPwd = decryptPassword(u.password);
                } catch (e) {
                    decryptedPwd = null;
                }

                const encryptedInput = (() => {
                    try { return encryptPassword(password); } catch (e) { return null; }
                })();

                const matchPlain = u.password === password;
                const matchDecrypted = decryptedPwd === password;
                const matchEncrypted = encryptedInput && u.password === encryptedInput;

                return u.email === email && (matchDecrypted || matchPlain || matchEncrypted);
            });

            if (user) {
                saveCurrentUser({ email: user.email, name: user.name });
                showMessage('Signed in successfully!', 'success');
                setTimeout(() => {
                    document.getElementById('signInForm').reset();
                    showAppPage();
                    initializeApp();
                }, 500);
            } else {
                showMessage('Invalid email or password', 'error');
            }
        }

        // Handle create account
        async function handleCreateAccount(e) {
            e.preventDefault();
            const name = document.getElementById('createName').value.trim();
            const email = document.getElementById('createEmail').value.trim();
            const password = document.getElementById('createPassword').value;
            const passwordConfirm = document.getElementById('createPasswordConfirm').value;

            if (!name || !email || !password || !passwordConfirm) {
                showMessage('Please fill in all fields', 'error');
                return;
            }

            if (password !== passwordConfirm) {
                showMessage('Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                showMessage('Password must be at least 6 characters', 'error');
                return;
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showMessage('Please enter a valid email', 'error');
                return;
            }

            const users = loadUsers();
            if (users.find(u => u.email === email)) {
                showMessage('Email already registered', 'error');
                return;
            }

            // Encrypt password before storing
            const encryptedPassword = encryptPassword(password);
            
            users.push({ 
                email, 
                password: encryptedPassword, 
                name,
                createdAt: new Date().toISOString()
            });
            saveUsers(users);
            saveCurrentUser({ email, name });
            showMessage('Account created successfully!', 'success');
            setTimeout(() => {
                document.getElementById('createAccountForm').reset();
                showAppPage();
                initializeApp();
            }, 500);
        }

        // ===== END AUTH SYSTEM =====

        // Global variables
        let currentTransactions = [];
        let filteredTransactions = [];
        let editingTransaction = null;
        let deleteTransactionId = null;
        let monthlySpendingChart = null;
        let categoryPieChart = null;
        let reportsChart = null;

        // Load Google Charts
        google.charts.load('current', { 'packages': ['corechart'] });
        google.charts.setOnLoadCallback(() => {
            // Charts will be initialized when DOM is ready
        });

        // Cached DOM refs helper
        const _refs = Object.create(null);
        function getRef(id) {
            if (!id) return null;
            if (!_refs[id]) {
                _refs[id] = document.getElementById(id);
            }
            return _refs[id];
        }

        // Helper: convert rgb(...) or rgba(...) to hex, or return input if already hex
        function rgbToHex(input) {
            if (!input) return null;
            input = input.trim();
            if (input.startsWith('#')) return input;
            const m = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (!m) return null;
            const r = parseInt(m[1], 10);
            const g = parseInt(m[2], 10);
            const b = parseInt(m[3], 10);
            return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        }

        // Default configuration
        const defaultConfig = {
            app_title: "Expense Manager",
            currency_symbol: "$",
            company_name: "Your Company"
        };

        // Data handler for SDK
        const dataHandler = {
            onDataChanged(data) {
                currentTransactions = data || [];
                filteredTransactions = [...currentTransactions];
                updateDashboard();
                updateTransactionsTable();
                updateCharts();
            }
        };

        // Fallback in-memory storage when SDK is unavailable (per-user)
        const fallbackStorage = {
            data: [],
            
            // Get storage key for current user
            getStorageKey() {
                if (!currentUser) return 'app_transactions_default';
                // Create unique key per user email to prevent data mixing
                return `app_transactions_${currentUser.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            },

            load() {
                try {
                    const key = this.getStorageKey();
                    const stored = localStorage.getItem(key);
                    if (stored) {
                        this.data = JSON.parse(stored);
                    } else {
                        this.data = [];
                    }
                } catch (e) {
                    console.warn('Failed to load from localStorage:', e);
                    this.data = [];
                }
                return this.data;
            },

            save() {
                try {
                    const key = this.getStorageKey();
                    localStorage.setItem(key, JSON.stringify(this.data));
                } catch (e) {
                    console.warn('Failed to save to localStorage:', e);
                }
            },

            create(item) {
                this.data.push(item);
                this.save();
                return { isOk: true, data: item };
            },

            update(item) {
                const idx = this.data.findIndex(t => t.id === item.id || t.__backendId === item.__backendId);
                if (idx >= 0) {
                    this.data[idx] = item;
                    this.save();
                    return { isOk: true, data: item };
                }
                return { isOk: false, error: { message: 'Item not found' } };
            },

            delete(item) {
                const idx = this.data.findIndex(t => t.id === item.id || t.__backendId === item.__backendId);
                if (idx >= 0) {
                    this.data.splice(idx, 1);
                    this.save();
                    return { isOk: true };
                }
                return { isOk: false, error: { message: 'Item not found' } };
            },

            init(handler) {
                this.load();
                if (handler && typeof handler.onDataChanged === 'function') {
                    handler.onDataChanged(this.data);
                }
                return { isOk: true };
            },

            // Export user's transaction history
            export() {
                return JSON.parse(JSON.stringify(this.data)); // Deep copy
            },

            // Clear user's transactions (for debugging/reset)
            clear() {
                this.data = [];
                this.save();
                return { isOk: true };
            }
        };

        // Initialize app
        async function initializeApp() {
            // Initialize Element SDK
            if (window.elementSdk) {
                await window.elementSdk.init({
                    defaultConfig,
                    onConfigChange: async (config) => {
                        const appTitle = config.app_title || defaultConfig.app_title;
                        const currencySymbol = config.currency_symbol || defaultConfig.currency_symbol;
                        const companyName = config.company_name || defaultConfig.company_name;

                        // Update app title
                        document.getElementById('app-title').textContent = appTitle;
                        document.title = appTitle;

                        // Update currency displays
                        updateCurrencyDisplays(currencySymbol);

                        // Update settings form
                        document.getElementById('userNameSetting').value = companyName;
                        document.getElementById('currencySetting').value = currencySymbol;
                    },
                    mapToCapabilities: (config) => ({
                        recolorables: [
                            {
                                get: () => config.primary_color || "#3b82f6",
                                set: (value) => {
                                    config.primary_color = value;
                                    window.elementSdk.setConfig({ primary_color: value });
                                }
                            },
                            {
                                get: () => config.background_color || "#f8fafc",
                                set: (value) => {
                                    config.background_color = value;
                                    window.elementSdk.setConfig({ background_color: value });
                                }
                            },
                            {
                                get: () => config.surface_color || "#ffffff",
                                set: (value) => {
                                    config.surface_color = value;
                                    window.elementSdk.setConfig({ surface_color: value });
                                }
                            },
                            {
                                get: () => config.text_color || "#1e293b",
                                set: (value) => {
                                    config.text_color = value;
                                    window.elementSdk.setConfig({ text_color: value });
                                }
                            }
                        ],
                        borderables: [],
                        fontEditable: {
                            get: () => config.font_family || "Inter",
                            set: (value) => {
                                config.font_family = value;
                                window.elementSdk.setConfig({ font_family: value });
                            }
                        },
                        fontSizeable: {
                            get: () => config.font_size || 14,
                            set: (value) => {
                                config.font_size = value;
                                window.elementSdk.setConfig({ font_size: value });
                            }
                        }
                    }),
                    mapToEditPanelValues: (config) => new Map([
                        ["app_title", config.app_title || defaultConfig.app_title],
                        ["currency_symbol", config.currency_symbol || defaultConfig.currency_symbol],
                        ["company_name", config.company_name || defaultConfig.company_name]
                    ])
                });
            }

            // Initialize Data SDK
            if (window.dataSdk) {
                const initResult = await window.dataSdk.init(dataHandler);
                if (!initResult.isOk) {
                    console.error("Failed to initialize data SDK");
                }
            }

            // Set up event listeners
            setupEventListeners();
            
            // Display current user's name
            if (currentUser) {
                const userDisplay = document.getElementById('userNameDisplay');
                if (userDisplay) {
                    userDisplay.textContent = `Welcome, ${currentUser.name}`;
                }
            }

            // Load transactions from SDK or fallback storage so data persists across reloads
            try {
                const dataSDK = window.dataSdk || fallbackStorage;
                if (typeof dataSDK.load === 'function') {
                    const initialData = dataSDK.load();
                    // Ensure local UI state is updated with loaded data
                    dataHandler.onDataChanged(initialData || []);
                }
            } catch (e) {
                console.warn('Failed to load initial transaction data:', e);
            }
            
            // Load budgets and goals
            currentBudgets = loadBudgets();
            currentGoals = loadGoals();
            updateBudgetList();
            updateGoalsList();
            
            // Set default date
            const dateInput = document.getElementById('transactionDate');
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            
            // Initialize charts after Google Charts is ready
            google.charts.setOnLoadCallback(initializeCharts);
        }

        function updateCurrencyDisplays(symbol) {
            // Update all currency displays
            const currencyElements = document.querySelectorAll('[id*="total"], [id*="Total"], .transaction-amount');
            currencyElements.forEach(el => {
                if (el.textContent.match(/[\$€£¥]/)) {
                    el.textContent = el.textContent.replace(/[\$€£¥]/, symbol);
                }
            });
        }

        function setupEventListeners() {
            // Navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    const page = item.dataset.page;
                    navigateToPage(page);
                });
            });

            // Menu toggle: collapse on small screens, minimize on larger screens
            const menuToggle = getRef('menuToggle');
            if (menuToggle) {
                menuToggle.addEventListener('click', () => {
                    const sidebar = getRef('sidebar');
                    const mainContent = getRef('mainContent');
                    if (!sidebar || !mainContent) return;
                    const small = window.innerWidth <= 768;
                    if (small) {
                        sidebar.classList.toggle('collapsed');
                        mainContent.classList.toggle('expanded');
                    } else {
                        sidebar.classList.toggle('minimized');
                        mainContent.classList.toggle('minimized');
                    }
                });
            }

            // Add transaction buttons
            const addTransactionBtn = getRef('addTransactionBtn');
            if (addTransactionBtn) addTransactionBtn.addEventListener('click', () => showAddTransactionModal());
            const addIncomeBtn = getRef('addIncomeBtn');
            if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => showAddTransactionModal('income'));
            const addExpenseBtn = getRef('addExpenseBtn');
            if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => showAddTransactionModal('expense'));

            // Budget form
            const saveBudgetBtn = getRef('saveBudgetBtn');
            if (saveBudgetBtn) saveBudgetBtn.addEventListener('click', saveBudget);

            // Goal form
            const saveGoalBtn = getRef('saveGoalBtn');
            if (saveGoalBtn) saveGoalBtn.addEventListener('click', saveGoal);

            // Transaction form
            const saveTransactionBtn = getRef('saveTransactionBtn');
            if (saveTransactionBtn) saveTransactionBtn.addEventListener('click', saveTransaction);

            // Filters
            const searchInput = getRef('searchInput');
            if (searchInput) searchInput.addEventListener('input', applyFilters);
            const categoryFilter = getRef('categoryFilter');
            if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
            const typeFilter = getRef('typeFilter');
            if (typeFilter) typeFilter.addEventListener('change', applyFilters);
            const dateFromFilter = getRef('dateFromFilter');
            if (dateFromFilter) dateFromFilter.addEventListener('change', applyFilters);
            const dateToFilter = getRef('dateToFilter');
            if (dateToFilter) dateToFilter.addEventListener('change', applyFilters);
            const clearFiltersBtn = getRef('clearFiltersBtn');
            if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

            // Settings
            const saveSettingsBtn = getRef('saveSettingsBtn');
            if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);

            // Delete confirmation
            const confirmDeleteBtn = getRef('confirmDeleteBtn');
            if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);

            // Theme handlers (no accent color control)
            const themeSelect = getRef('themeSelect');

            // Load saved theme preference
            try {
                const savedTheme = localStorage.getItem('app_theme_mode') || 'system';
                if (themeSelect) themeSelect.value = savedTheme;
            } catch (e) { console.warn('Failed to load theme prefs', e); }

            function applyThemeMode(mode) {
                if (mode === 'system') {
                    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.body.classList.toggle('theme-dark', prefersDark);
                } else if (mode === 'dark') {
                    document.body.classList.add('theme-dark');
                } else {
                    document.body.classList.remove('theme-dark');
                }
                try { localStorage.setItem('app_theme_mode', mode); } catch (_) {}
                // Update charts to pick up new CSS variables
                try { updateCharts(); } catch (_) {}
            }

            // Apply the initial theme on load (use select value if present, otherwise saved preference)
            try {
                const initialTheme = (themeSelect && themeSelect.value) ? themeSelect.value : (localStorage.getItem('app_theme_mode') || 'system');
                applyThemeMode(initialTheme);
            } catch (e) { console.warn('Failed to apply initial theme', e); }

            if (themeSelect) themeSelect.addEventListener('change', (e) => {
                applyThemeMode(e.target.value);
            });

            // Modal close on backdrop click
            document.querySelectorAll('.modal').forEach(modal => {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.remove('active');
                    }
                });
            });

            // Transactions table actions (edit/delete) via event delegation
            const transactionsBody = document.getElementById('transactionsTableBody');
            if (transactionsBody) {
                transactionsBody.addEventListener('click', (e) => {
                    const btn = e.target.closest('button[data-action]');
                    if (!btn) return;
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    if (action === 'edit') {
                        showEditTransactionModal(id);
                    } else if (action === 'delete') {
                        showDeleteModal(id);
                    }
                });
            }
        }

        function navigateToPage(page) {
            // Update navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-page="${page}"]`).classList.add('active');

            // Update page content
            document.querySelectorAll('.page').forEach(p => {
                p.classList.remove('active');
            });
            document.getElementById(page).classList.add('active');

            // Update page title
            const titles = {
                dashboard: 'Dashboard',
                transactions: 'Transactions',
                budget: 'Budget',
                goals: 'Goals & Savings',
                reports: 'Reports',
                settings: 'Settings'
            };
            document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
        }

        function showAddTransactionModal(type = '') {
            editingTransaction = null;
            document.getElementById('transactionModalTitle').textContent = 'Add Transaction';
            document.getElementById('transactionForm').reset();
            document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
            
            if (type) {
                document.getElementById('transactionType').value = type;
            }
            
            document.getElementById('addTransactionModal').classList.add('active');
        }

        function showEditTransactionModal(transaction) {
            // Accept either a transaction object or an id string
            if (typeof transaction === 'string' || typeof transaction === 'number') {
                const id = String(transaction);
                transaction = currentTransactions.find(t => String(t.id) === id || String(t.__backendId) === id) || null;
            }
            if (!transaction) return;
            editingTransaction = transaction;
            document.getElementById('transactionModalTitle').textContent = 'Edit Transaction';
            
            // Populate form
            document.getElementById('transactionType').value = transaction.type;
            document.getElementById('transactionTitle').value = transaction.title;
            document.getElementById('transactionAmount').value = transaction.amount;
            document.getElementById('transactionCategory').value = transaction.category;
            document.getElementById('transactionDate').value = transaction.date;
            document.getElementById('transactionPaymentMethod').value = transaction.paymentMethod || 'Cash';
            document.getElementById('transactionNotes').value = transaction.notes || '';
            
            document.getElementById('addTransactionModal').classList.add('active');
        }

        async function saveTransaction() {
            const form = document.getElementById('transactionForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const saveBtn = document.getElementById('saveTransactionBtn');
            saveBtn.classList.add('loading');
            saveBtn.disabled = true;

            try {
                const transactionData = {
                    type: document.getElementById('transactionType').value,
                    title: document.getElementById('transactionTitle').value,
                    amount: parseFloat(document.getElementById('transactionAmount').value),
                    category: document.getElementById('transactionCategory').value,
                    date: document.getElementById('transactionDate').value,
                    paymentMethod: document.getElementById('transactionPaymentMethod').value,
                    notes: document.getElementById('transactionNotes').value,
                    createdAt: new Date().toISOString()
                };

                if (editingTransaction) {
                    // Update existing transaction
                    const updatedTransaction = { ...editingTransaction, ...transactionData };
                    let result = { isOk: false };
                    
                    // Try SDK first, fall back to storage if unavailable
                    const dataSDK = window.dataSdk || fallbackStorage;
                    
                    if (typeof dataSDK.update === 'function') {
                        try {
                            result = await dataSDK.update(updatedTransaction);
                        } catch (err) {
                            console.error('Data SDK update threw:', err);
                            result = { isOk: false, error: err };
                        }
                    } else {
                        console.warn('SDK/storage update not available');
                        result = { isOk: false, error: { message: 'Storage unavailable' } };
                    }

                    if (result.isOk) {
                        closeModal('addTransactionModal');
                        // Reload all data to refresh UI
                        const reloadedData = fallbackStorage.load();
                        dataHandler.onDataChanged(reloadedData);
                        showMessage('Transaction updated successfully!', 'success');
                    } else {
                        console.error('Update error:', result.error);
                        showMessage(`Failed to update transaction: ${result.error?.message || 'Please try again.'}`, 'error');
                    }
                } else {
                    // Check transaction limit before creating
                    if (currentTransactions.length >= 999) {
                        showMessage('Maximum limit of 999 transactions reached. Please delete some transactions first.', 'error');
                        saveBtn.classList.remove('loading');
                        saveBtn.disabled = false;
                        return;
                    }

                    // Create new transaction
                    transactionData.id = generateId();
                    
                    // Try SDK first, fall back to storage if unavailable
                    const dataSDK = window.dataSdk || fallbackStorage;
                    
                    if (!dataSDK || typeof dataSDK.create !== 'function') {
                        showMessage('Data storage not available. Please refresh the page and try again.', 'error');
                        saveBtn.classList.remove('loading');
                        saveBtn.disabled = false;
                        return;
                    }

                    let result = { isOk: false };
                    try {
                        result = await dataSDK.create(transactionData);
                    } catch (err) {
                        console.error('Data SDK create threw:', err);
                        result = { isOk: false, error: err };
                    }

                    if (result.isOk) {
                        closeModal('addTransactionModal');
                        // Reload all data to refresh UI
                        const reloadedData = fallbackStorage.load();
                        dataHandler.onDataChanged(reloadedData);
                        showMessage('Transaction added successfully!', 'success');
                    } else {
                        console.error('Create error:', result.error);
                        showMessage(`Failed to add transaction: ${result.error?.message || 'Unknown error occurred'}`, 'error');
                    }
                }
            } catch (error) {
                console.error('Unexpected error:', error);
                showMessage('An unexpected error occurred. Please try again.', 'error');
            }

            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }

        function showDeleteModal(transaction) {
            // Accept either transaction object or id
            if (typeof transaction === 'object' && transaction !== null) {
                deleteTransactionId = transaction.id || transaction.__backendId || null;
            } else {
                deleteTransactionId = transaction || null;
            }
            if (!deleteTransactionId) return;
            document.getElementById('deleteModal').classList.add('active');
        }

        async function confirmDelete() {
            if (!deleteTransactionId) return;

            const deleteBtn = document.getElementById('confirmDeleteBtn');
            deleteBtn.classList.add('loading');
            deleteBtn.disabled = true;

            const transaction = currentTransactions.find(t => String(t.__backendId) === String(deleteTransactionId) || String(t.id) === String(deleteTransactionId));
            if (transaction) {
                // Try SDK first, fall back to storage if unavailable
                const dataSDK = window.dataSdk || fallbackStorage;
                
                if (!dataSDK || typeof dataSDK.delete !== 'function') {
                    showMessage('Data storage not available. Please refresh the page and try again.', 'error');
                } else {
                    try {
                        const result = await dataSDK.delete(transaction);
                        if (result.isOk) {
                            closeModal('deleteModal');
                            // Reload all data to refresh UI
                            const reloadedData = fallbackStorage.load();
                            dataHandler.onDataChanged(reloadedData);
                            showMessage('Transaction deleted successfully!', 'success');
                        } else {
                            showMessage('Failed to delete transaction. Please try again.', 'error');
                        }
                    } catch (err) {
                        console.error('Data SDK delete threw:', err);
                        showMessage('Failed to delete transaction. Please try again.', 'error');
                    }
                }
            }

            deleteBtn.classList.remove('loading');
            deleteBtn.disabled = false;
            deleteTransactionId = null;
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        // Global variables for budgets and goals
        let currentBudgets = [];
        let currentGoals = [];
        let editingBudget = null;
        let editingGoal = null;

        // Load budgets from localStorage
        function loadBudgets() {
            try {
                const key = `app_budgets_${currentUser?.email.replace(/[^a-zA-Z0-9]/g, '_') || 'default'}`;
                const stored = localStorage.getItem(key);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.warn('Failed to load budgets:', e);
                return [];
            }
        }

        // Save budgets to localStorage
        function saveBudgets(budgets) {
            try {
                const key = `app_budgets_${currentUser?.email.replace(/[^a-zA-Z0-9]/g, '_') || 'default'}`;
                localStorage.setItem(key, JSON.stringify(budgets));
            } catch (e) {
                console.warn('Failed to save budgets:', e);
            }
        }

        // Load goals from localStorage
        function loadGoals() {
            try {
                const key = `app_goals_${currentUser?.email.replace(/[^a-zA-Z0-9]/g, '_') || 'default'}`;
                const stored = localStorage.getItem(key);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.warn('Failed to load goals:', e);
                return [];
            }
        }

        // Save goals to localStorage
        function saveGoals(goals) {
            try {
                const key = `app_goals_${currentUser?.email.replace(/[^a-zA-Z0-9]/g, '_') || 'default'}`;
                localStorage.setItem(key, JSON.stringify(goals));
            } catch (e) {
                console.warn('Failed to save goals:', e);
            }
        }

        // Budget Modal Functions
        function showAddBudgetModal() {
            editingBudget = null;
            document.getElementById('budgetModalTitle').textContent = 'Add Budget';
            document.getElementById('budgetForm').reset();
            const today = new Date();
            document.getElementById('budgetMonth').value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
            document.getElementById('addBudgetModal').classList.add('active');
        }

        function showEditBudgetModal(budget) {
            editingBudget = budget;
            document.getElementById('budgetModalTitle').textContent = 'Edit Budget';
            document.getElementById('budgetCategory').value = budget.category;
            document.getElementById('budgetAmount').value = budget.amount;
            document.getElementById('budgetMonth').value = budget.month;
            document.getElementById('addBudgetModal').classList.add('active');
        }

        async function saveBudget() {
            const category = document.getElementById('budgetCategory').value;
            const amount = parseFloat(document.getElementById('budgetAmount').value);
            const month = document.getElementById('budgetMonth').value;

            if (!category || !amount || !month) {
                showMessage('Please fill in all fields', 'error');
                return;
            }

            if (editingBudget) {
                editingBudget.category = category;
                editingBudget.amount = amount;
                editingBudget.month = month;
                currentBudgets = currentBudgets.map(b => b.id === editingBudget.id ? editingBudget : b);
                showMessage('Budget updated successfully!', 'success');
            } else {
                const newBudget = {
                    id: generateId(),
                    category,
                    amount,
                    month,
                    createdAt: new Date().toISOString()
                };
                currentBudgets.push(newBudget);
                showMessage('Budget created successfully!', 'success');
            }

            saveBudgets(currentBudgets);
            closeModal('addBudgetModal');
            updateBudgetList();
        }

        function deleteBudget(budgetId) {
            currentBudgets = currentBudgets.filter(b => b.id !== budgetId);
            saveBudgets(currentBudgets);
            updateBudgetList();
            showMessage('Budget deleted successfully!', 'success');
        }

        function updateBudgetList() {
            const budgetList = document.getElementById('budgetList');
            
            if (currentBudgets.length === 0) {
                budgetList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><span class="material-symbols-outlined">dashboard</span></div>
                        <h3>No budgets set</h3>
                        <p>Create budgets to track your spending by category</p>
                        <button class="btn btn-primary" onclick="showAddBudgetModal()">Create Budget</button>
                    </div>
                `;
                return;
            }

            const currencySymbol = window.elementSdk?.config?.currency_symbol || defaultConfig.currency_symbol;
            budgetList.innerHTML = currentBudgets.map(budget => {
                const spent = currentTransactions
                    .filter(t => t.type === 'expense' && t.category === budget.category && t.date.startsWith(budget.month))
                    .reduce((sum, t) => sum + t.amount, 0);
                
                const percentage = Math.min((spent / budget.amount) * 100, 100);
                const status = spent > budget.amount ? 'over' : 'on-track';

                return `
                    <div class="budget-item" style="margin-bottom: 20px; padding: 15px; border: 1px solid var(--md-sys-outline); border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0;">${budget.category} - ${budget.month}</h4>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary" onclick="showEditBudgetModal({id: '${budget.id}', category: '${budget.category}', amount: ${budget.amount}, month: '${budget.month}'})" style="padding: 6px 12px; font-size: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
                                </button>
                                <button class="btn btn-danger" onclick="deleteBudget('${budget.id}')" style="padding: 6px 12px; font-size: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
                                </button>
                            </div>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                                <span>Spent: ${currencySymbol}${spent.toFixed(2)} / ${currencySymbol}${budget.amount.toFixed(2)}</span>
                                <span>${percentage.toFixed(0)}%</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: var(--md-sys-surface-variant); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${percentage}%; height: 100%; background: ${status === 'over' ? '#ef4444' : '#10b981'}; transition: width 0.3s;"></div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Goals Modal Functions
        function showAddGoalModal() {
            editingGoal = null;
            document.getElementById('goalModalTitle').textContent = 'Add Goal';
            document.getElementById('goalForm').reset();
            document.getElementById('addGoalModal').classList.add('active');
        }

        function showEditGoalModal(goal) {
            editingGoal = goal;
            document.getElementById('goalModalTitle').textContent = 'Edit Goal';
            document.getElementById('goalName').value = goal.name;
            document.getElementById('goalAmount').value = goal.targetAmount;
            document.getElementById('goalCurrentAmount').value = goal.currentAmount;
            document.getElementById('goalTargetDate').value = goal.targetDate;
            document.getElementById('goalDescription').value = goal.description || '';
            document.getElementById('addGoalModal').classList.add('active');
        }

        async function saveGoal() {
            const name = document.getElementById('goalName').value.trim();
            const targetAmount = parseFloat(document.getElementById('goalAmount').value);
            const currentAmount = parseFloat(document.getElementById('goalCurrentAmount').value);
            const targetDate = document.getElementById('goalTargetDate').value;
            const description = document.getElementById('goalDescription').value.trim();

            if (!name || !targetAmount || !targetDate) {
                showMessage('Please fill in all required fields', 'error');
                return;
            }

            if (editingGoal) {
                editingGoal.name = name;
                editingGoal.targetAmount = targetAmount;
                editingGoal.currentAmount = currentAmount;
                editingGoal.targetDate = targetDate;
                editingGoal.description = description;
                currentGoals = currentGoals.map(g => g.id === editingGoal.id ? editingGoal : g);
                showMessage('Goal updated successfully!', 'success');
            } else {
                const newGoal = {
                    id: generateId(),
                    name,
                    targetAmount,
                    currentAmount,
                    targetDate,
                    description,
                    createdAt: new Date().toISOString()
                };
                currentGoals.push(newGoal);
                showMessage('Goal created successfully!', 'success');
            }

            saveGoals(currentGoals);
            closeModal('addGoalModal');
            updateGoalsList();
        }

        function deleteGoal(goalId) {
            currentGoals = currentGoals.filter(g => g.id !== goalId);
            saveGoals(currentGoals);
            updateGoalsList();
            showMessage('Goal deleted successfully!', 'success');
        }

        function updateGoalsList() {
            const goalsList = document.getElementById('goalsList');
            
            if (currentGoals.length === 0) {
                goalsList.innerHTML = `
                    <div class="goal-card">
                        <div class="empty-state">
                            <div class="empty-state-icon"><span class="material-symbols-outlined">target</span></div>
                            <h3>No goals set</h3>
                            <p>Set savings goals to track your progress</p>
                            <button class="btn btn-primary" onclick="showAddGoalModal()">Add Goal</button>
                        </div>
                    </div>
                `;
                return;
            }

            const currencySymbol = window.elementSdk?.config?.currency_symbol || defaultConfig.currency_symbol;
            goalsList.innerHTML = currentGoals.map(goal => {
                const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                const daysLeft = Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
                const remaining = goal.targetAmount - goal.currentAmount;

                return `
                    <div class="goal-card" style="padding: 20px; border: 1px solid var(--md-sys-outline); border-radius: 12px; background: var(--md-sys-surface);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                            <div>
                                <h3 style="margin: 0 0 5px 0;">${goal.name}</h3>
                                <p style="margin: 0; font-size: 12px; color: var(--md-sys-on-surface-variant);">${daysLeft > 0 ? daysLeft + ' days left' : 'Goal date reached'}</p>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary" onclick="showEditGoalModal({id: '${goal.id}', name: '${goal.name}', targetAmount: ${goal.targetAmount}, currentAmount: ${goal.currentAmount}, targetDate: '${goal.targetDate}', description: '${goal.description || ''}'})" style="padding: 6px 12px; font-size: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
                                </button>
                                <button class="btn btn-danger" onclick="deleteGoal('${goal.id}')" style="padding: 6px 12px; font-size: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
                                </button>
                            </div>
                        </div>
                        ${goal.description ? `<p style="margin: 0 0 15px 0; font-size: 13px; color: var(--md-sys-on-surface-variant);">${goal.description}</p>` : ''}
                        <div style="margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
                                <span>${currencySymbol}${goal.currentAmount.toFixed(2)} / ${currencySymbol}${goal.targetAmount.toFixed(2)}</span>
                                <span>${percentage.toFixed(0)}%</span>
                            </div>
                            <div style="width: 100%; height: 10px; background: var(--md-sys-surface-variant); border-radius: 5px; overflow: hidden;">
                                <div style="width: ${percentage}%; height: 100%; background: var(--md-sys-primary); transition: width 0.3s;"></div>
                            </div>
                        </div>
                        <p style="margin: 0; font-size: 12px; color: var(--md-sys-on-surface-variant);">Remaining: ${currencySymbol}${remaining > 0 ? remaining.toFixed(2) : '0.00'}</p>
                    </div>
                `;
            }).join('');
        }

        function updateDashboard() {
            const currencySymbol = window.elementSdk?.config?.currency_symbol || defaultConfig.currency_symbol;
            
            const income = currentTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const expenses = currentTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const balance = income - expenses;
            const savings = balance > 0 ? balance : 0;

            document.getElementById('totalBalance').textContent = `${currencySymbol}${balance.toFixed(2)}`;
            document.getElementById('totalIncome').textContent = `${currencySymbol}${income.toFixed(2)}`;
            document.getElementById('totalExpenses').textContent = `${currencySymbol}${expenses.toFixed(2)}`;
            document.getElementById('totalSavings').textContent = `${currencySymbol}${savings.toFixed(2)}`;

            updateRecentTransactions();
        }

        function updateRecentTransactions() {
            const recentList = document.getElementById('recentTransactionsList');
            const recent = currentTransactions
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

            if (recent.length === 0) {
                recentList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><span class="material-symbols-outlined">note_alt</span></div>
                        <h3>No transactions yet</h3>
                        <p>Start by adding your first income or expense</p>
                        <button class="btn btn-primary" onclick="showAddTransactionModal()">Add Transaction</button>
                    </div>
                `;
                return;
            }

            const currencySymbol = window.elementSdk?.config?.currency_symbol || defaultConfig.currency_symbol;
            
            recentList.innerHTML = recent.map(transaction => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-category ${transaction.type}">
                            ${getCategoryIcon(transaction.category)}
                        </div>
                        <div class="transaction-details">
                            <h4>${transaction.title}</h4>
                            <p>${transaction.category} • ${formatDate(transaction.date)}</p>
                        </div>
                    </div>
                    <div class="transaction-amount ${transaction.type}">
                        ${transaction.type === 'income' ? '+' : '-'}${currencySymbol}${transaction.amount.toFixed(2)}
                    </div>
                </div>
            `).join('');
        }

        function updateTransactionsTable() {
            const tbody = document.getElementById('transactionsTableBody');
            
            if (filteredTransactions.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="empty-state">
                                <div class="empty-state-icon"><span class="material-symbols-outlined">note_alt</span></div>
                                <h3>No transactions found</h3>
                                <p>Add your first transaction to get started</p>
                                <button class="btn btn-primary" onclick="showAddTransactionModal()">Add Transaction</button>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            const currencySymbol = window.elementSdk?.config?.currency_symbol || defaultConfig.currency_symbol;
            
            tbody.innerHTML = filteredTransactions.map(transaction => `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">${getCategoryIcon(transaction.category)}</span>
                            ${transaction.category || '-'}
                        </div>
                    </td>
                    <td>${transaction.title || '-'}</td>
                    <td>${transaction.date ? formatDate(transaction.date) : '-'}</td>
                    <td class="transaction-amount ${transaction.type}">
                        ${transaction.type === 'income' ? '+' : '-'}${currencySymbol}${(Number(transaction.amount) || 0).toFixed(2)}
                    </td>
                    <td>
                        <span class="badge ${transaction.type}">${transaction.type || '-'}</span>
                    </td>
                    <td>${transaction.notes || '-'}</td>
                    <td>
                        <button class="btn btn-secondary" data-action="edit" data-id="${transaction.id || transaction.__backendId || ''}">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="btn btn-danger" data-action="delete" data-id="${transaction.id || transaction.__backendId || ''}">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        function applyFilters() {
            const search = document.getElementById('searchInput').value.toLowerCase();
            const category = document.getElementById('categoryFilter').value;
            const type = document.getElementById('typeFilter').value;
            const dateFrom = document.getElementById('dateFromFilter').value;
            const dateTo = document.getElementById('dateToFilter').value;

            filteredTransactions = currentTransactions.filter(transaction => {
                const matchesSearch = !search || 
                    transaction.title.toLowerCase().includes(search) ||
                    transaction.category.toLowerCase().includes(search) ||
                    (transaction.notes && transaction.notes.toLowerCase().includes(search));
                
                const matchesCategory = !category || transaction.category === category;
                const matchesType = !type || transaction.type === type;
                
                const matchesDateFrom = !dateFrom || transaction.date >= dateFrom;
                const matchesDateTo = !dateTo || transaction.date <= dateTo;

                return matchesSearch && matchesCategory && matchesType && matchesDateFrom && matchesDateTo;
            });

            updateTransactionsTable();
        }

        function clearFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('categoryFilter').value = '';
            document.getElementById('typeFilter').value = '';
            document.getElementById('dateFromFilter').value = '';
            document.getElementById('dateToFilter').value = '';
            
            filteredTransactions = [...currentTransactions];
            updateTransactionsTable();
        }

        function updateCharts() {
            // Update Monthly Spending Line Chart (Google Charts)
            if (monthlySpendingChart) {
                const monthlyData = {};
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();

                // Get last 12 months
                for (let i = 11; i >= 0; i--) {
                    const date = new Date(currentYear, currentMonth - i, 1);
                    const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                    monthlyData[key] = 0;
                }

                // Sum expenses by month
                currentTransactions
                    .filter(t => t.type === 'expense')
                    .forEach(t => {
                        const date = new Date(t.date);
                        const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                        if (monthlyData.hasOwnProperty(key)) {
                            monthlyData[key] += t.amount;
                        }
                    });

                // Prepare data for Google Charts
                const dataArray = [['Month', 'Spending']];
                Object.keys(monthlyData).forEach(month => {
                    const value = Math.max(0, Number(monthlyData[month] || 0));
                    dataArray.push([month, value]);
                });

                const data = google.visualization.arrayToDataTable(dataArray);
                const currencySymbol = window.elementSdk?.config?.currency_symbol || defaultConfig.currency_symbol;
                // Determine surface color from CSS variables to match theme
                const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-surface') || getComputedStyle(document.documentElement).getPropertyValue('--md-sys-background') || '#ffffff';
                const surfaceFill = (surfaceColor || '#ffffff').trim();

                const options = {
                    title: '',
                    fontName: 'GoogleSans',
                    curveType: 'function',
                    legend: { position: 'none' },
                    pointSize: 5,
                    lineWidth: 3,
                    colors: ['#ef4444'],
                    hAxis: {
                        textStyle: { fontSize: 12 },
                        slantedText: false
                    },
                    vAxis: {
                        format: currencySymbol + '#,###',
                        textStyle: { fontSize: 12 },
                        viewWindowMode: 'explicit',
                        viewWindow: { min: 0 }
                    },
                    chartArea: { left: 40, top: 20, width: '100%', height: '85%' },
                    backgroundColor: { fill: surfaceFill }
                };

                monthlySpendingChart.draw(data, options);
            }

            // Update Category Pie Chart
            if (categoryPieChart) {
                const categoryData = {};
                currentTransactions
                    .filter(t => t.type === 'expense')
                    .forEach(t => {
                        categoryData[t.category] = (categoryData[t.category] || 0) + t.amount;
                    });

                const hasData = Object.keys(categoryData).length > 0;

                if (hasData) {
                    categoryPieChart.data.labels = Object.keys(categoryData);
                    categoryPieChart.data.datasets[0].data = Object.values(categoryData);
                    categoryPieChart.data.datasets[0].backgroundColor = [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'
                    ];
                    categoryPieChart.options.plugins.tooltip = { enabled: true };
                } else {
                    // Show "No Data" state
                    categoryPieChart.data.labels = ['No Data'];
                    categoryPieChart.data.datasets[0].data = [100];
                    categoryPieChart.data.datasets[0].backgroundColor = ['#d1d5db'];
                    categoryPieChart.options.plugins.tooltip = { enabled: false };
                    categoryPieChart.options.plugins.datalabels = {
                        color: '#666',
                        font: { size: 14, weight: 'bold' },
                        formatter: () => 'No Data'
                    };
                }
                categoryPieChart.update();
            }

            // Update Reports Chart (if exists)
            if (reportsChart) {
                const reportData = {};
                currentTransactions.forEach(t => {
                    const type = t.type === 'income' ? 'Income' : 'Expense';
                    reportData[type] = (reportData[type] || 0) + t.amount;
                });

                reportsChart.data.labels = Object.keys(reportData);
                reportsChart.data.datasets[0].data = Object.values(reportData);
                reportsChart.update();
            }
        }

        function initializeCharts() {
                    // Ensure Chart.js canvas fonts use GoogleSans
                    if (window.Chart) {
                        Chart.defaults.font.family = 'GoogleSans';
                    }

                    // Monthly Spending Line Chart (Google Charts)
            monthlySpendingChart = new google.visualization.LineChart(
                document.getElementById('monthlySpendingChart')
            );

            // Category Pie Chart
            const ctx2 = document.getElementById('categoryPieChart');
            if (ctx2) {
                categoryPieChart = new Chart(ctx2, {
                    type: 'pie',
                    plugins: [
                        {
                            id: 'noDataPlugin',
                            afterDatasetsDraw(chart) {
                                const hasData = chart.data.datasets[0].data.some(v => v > 0);
                                if (!hasData) {
                                    const { ctx, chartArea: { left, top, width, height } } = chart;
                                    const centerX = left + width / 2;
                                    const centerY = top + height / 2;
                                    
                                    ctx.save();
                                    ctx.fillStyle = '#d1d5db';
                                    ctx.beginPath();
                                    ctx.arc(centerX, centerY, Math.min(width, height) / 2, 0, 2 * Math.PI);
                                    ctx.fill();
                                    
                                    ctx.fillStyle = '#666';
                                    ctx.font = 'bold 16px "GoogleSans", sans-serif';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.fillText('No Data', centerX, centerY);
                                    ctx.restore();
                                }
                            }
                        }
                    ],
                    data: {
                        labels: [],
                        datasets: [{
                            data: [],
                            backgroundColor: [
                                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'
                            ],
                            borderColor: 'var(--md-sys-surface)',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 1,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 15,
                                    font: { size: 12 },
                                    usePointStyle: true,
                                    pointStyle: 'circle'
                                }
                            },
                            tooltip: {
                                enabled: true,
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                titleFont: { size: 13, weight: 'bold' },
                                bodyFont: { size: 12 },
                                displayColors: true,
                                callbacks: {
                                    label: function(context) {
                                        const currencySymbol = window.elementSdk?.config?.currency_symbol || defaultConfig.currency_symbol;
                                        return currencySymbol + context.raw.toFixed(2);
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // Reports Chart
            const ctx3 = document.getElementById('reportsChart');
            if (ctx3) {
                reportsChart = new Chart(ctx3, {
                    type: 'doughnut',
                    data: {
                        labels: [],
                        datasets: [{
                            data: [],
                            backgroundColor: [
                                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }
            // Draw charts now that chart instances exist
            try {
                updateCharts();
            } catch (e) {
                console.warn('Failed to update charts after initialization:', e);
            }
            // Redraw charts on window resize to keep them filling their containers
            let _chartResizeTimer = null;
            window.addEventListener('resize', () => {
                clearTimeout(_chartResizeTimer);
                _chartResizeTimer = setTimeout(() => {
                    try {
                        updateCharts();
                        if (categoryPieChart && typeof categoryPieChart.resize === 'function') categoryPieChart.resize();
                        if (reportsChart && typeof reportsChart.resize === 'function') reportsChart.resize();
                    } catch (err) {
                        console.warn('Chart resize/update error:', err);
                    }
                }, 120);
            });
        }

        

        function saveSettings() {
            const companyName = document.getElementById('userNameSetting').value;
            const currency = document.getElementById('currencySetting').value;
            
            if (window.elementSdk) {
                window.elementSdk.setConfig({
                    company_name: companyName,
                    currency_symbol: currency
                });
            }
            
            showMessage('Settings saved successfully!', 'success');
        }

        // Utility functions
        function generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString();
        }

        function getCategoryIcon(category) {
            const icons = {
                'Food': '<span class="material-symbols-outlined">restaurant</span>',
                'Transportation': '<span class="material-symbols-outlined">directions_car</span>',
                'Entertainment': '<span class="material-symbols-outlined">movie</span>',
                'Shopping': '<span class="material-symbols-outlined">shopping_bag</span>',
                'Bills': '<span class="material-symbols-outlined">receipt_long</span>',
                'Salary': '<span class="material-symbols-outlined">money_bag</span>',
                'Other': '<span class="material-symbols-outlined">note_alt</span>'
            };
            return icons[category] || '<span class="material-symbols-outlined">note_alt</span>'
        }

        function showMessage(message, type) {
            // Create toast message
            const toast = document.createElement('div');
            toast.className = `${type}-message`;
            toast.textContent = message;
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.right = '20px';
            toast.style.zIndex = '3000';
            toast.style.padding = '12px 16px';
            toast.style.borderRadius = '8px';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '500';
            toast.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        // Initialize app when DOM is loaded
        // Global error handlers to catch uncaught errors and promises
        window.addEventListener('error', (e) => {
            console.error('Uncaught error:', e.error || e.message || e);
            try { showMessage('An unexpected error occurred. Check console for details.', 'error'); } catch (_) {}
        });
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled rejection:', e.reason || e);
            try { showMessage('An unexpected error occurred. Check console for details.', 'error'); } catch (_) {}
        });

        document.addEventListener('DOMContentLoaded', () => {
            try {
                // Check if user is already logged in
                if (loadCurrentUser()) {
                    // User is logged in, show app
                    showAppPage();
                    initializeApp();
                } else {
                    // User is not logged in, show auth page
                    showAuthPage();
                }

                // Wire up auth forms
                const signInForm = document.getElementById('signInForm');
                const createAccountForm = document.getElementById('createAccountForm');

                if (signInForm) {
                    signInForm.addEventListener('submit', handleSignIn);
                }

                if (createAccountForm) {
                    createAccountForm.addEventListener('submit', handleCreateAccount);
                }
            } catch (err) {
                console.error('Failed to initialize app:', err);
                showMessage('Failed to initialize app. See console for details.', 'error');
            }
        });