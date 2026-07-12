// Global Application State
let appState = {
  currentUser: null,
  activePage: "dashboard",
  selectedCustomerId: "IDBI1001",
  theme: "light",
  sortColumn: null,
  sortDirection: "asc",
  filteredCustomers: []
};

// Safe storage wrapper in case localStorage is blocked in local files
const safeStorage = {
  data: {},
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return this.data[key] || null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      this.data[key] = value;
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete this.data[key];
    }
  }
};

// Global Chart instances holder (to prevent Chart.js reuse errors)
window.myCharts = {};

// Initial Load Hook
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Lucide icons
  lucide.createIcons();
  
  // Fetch live customer list from backend
  try {
    const response = await fetch("/customers/leads");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Map backend response fields to the schema used by the frontend
    window.syntheticCustomers = data.map(c => {
      // Calculate disposable income
      const averageMonthlyExpenses = c.declared_salary * 0.45; // simulate expenses
      const disposable = c.estimated_income - averageMonthlyExpenses - c.existing_emis;
      
      // Determine sector
      let sector = "Professional Services";
      const occ = c.occupation.toLowerCase();
      if (occ.includes("engineer") || occ.includes("manager") || occ.includes("analyst")) {
        sector = "MNC";
      } else if (occ.includes("government") || occ.includes("teacher") || occ.includes("officer")) {
        sector = "Govt";
      } else if (occ.includes("owner") || occ.includes("merchant") || occ.includes("contractor")) {
        sector = "Business";
      } else if (occ.includes("practitioner") || occ.includes("doctor")) {
        sector = "Healthcare";
      }
      
      // Map transactions
      const mappedTransactions = (c.transactions || []).map(t => {
        return {
          date: t.date,
          desc: t.category === "Salary Credit" ? "Monthly Salary Credit" : `${t.category} payment`,
          category: t.category,
          type: t.type === "credit" ? "Credit" : "Debit",
          amount: t.amount
        };
      });

      // Suggested loan amount (Safe EMI capacity * multiplier)
      const multiplier = c.top_intent === "home" ? 120 : (c.top_intent === "vehicle" ? 48 : 24);
      const suggestedAmount = Math.max(50000, Math.floor(c.safe_emi * multiplier));

      // Behavioral insights list
      const insights = [
        `UPI cash outflow variance is stable at Rs. ${Math.round(c.feature_contributions.std_debit_amount || 5000).toLocaleString("en-IN")}.`,
        `Estimated transaction-derived savings rate: ${Math.round((c.feature_contributions.savings_rate || 0.2) * 100)}%.`,
        `Utility bill payment pattern is observed as ${c.utility_bill_payment_pattern.toUpperCase()}.`,
        `Existing EMI obligations take up ${Math.round(c.existing_emis / c.estimated_income * 100)}% of estimated true income.`
      ];

      const explainText = `The XGBoost intent model predicts a high intent for ${c.top_intent.toUpperCase()} loan (probability: ${Math.round((c.intent_probabilities[c.top_intent] || 0) * 100)}%), driven by category transaction spend ratios. Estimated true monthly income is Rs. ${Math.round(c.estimated_income).toLocaleString("en-IN")} compared to Rs. ${Math.round(c.declared_salary).toLocaleString("en-IN")} declared.`;

      return {
        id: c.customer_id,
        name: c.name,
        age: c.age,
        occupation: c.occupation,
        sector: sector,
        email: `${c.name.toLowerCase().replace(/\s+/g, ".")}@idbi-innovate.com`,
        declaredSalary: c.declared_salary,
        monthlyIncome: c.estimated_income, // estimated true income
        monthlyExpenses: averageMonthlyExpenses,
        existingEMI: c.existing_emis,
        disposableIncome: disposable,
        repaymentCapacity: c.safe_emi, // repayment capacity is safe_emi
        repaymentCapacityScore: Math.min(100, Math.floor((c.safe_emi / Math.max(1, c.estimated_income * 0.4)) * 100)),
        intentScore: Math.round(c.lead_score), // intent score is lead_score
        leadScore: Math.round(c.lead_score),   // CRM prioritization score
        creditScore: Math.min(850, Math.max(300, Math.floor(650 + (c.lead_score * 1.5) - (c.existing_emis / 1000)))), // simulate credit score
        incomeStabilityScore: Math.min(100, Math.max(30, Math.floor(c.lead_score * 0.8 + 20))),
        status: c.lead_score >= 75 ? "Hot" : (c.lead_score >= 45 ? "Warm" : "Cold"),
        fraudRiskScore: Math.min(100, Math.max(0, Math.floor(100 - (c.lead_score * 0.8)))),
        recommendedLoan: c.top_intent.charAt(0).toUpperCase() + c.top_intent.slice(1) + " Loan",
        riskLevel: c.lead_score >= 75 ? "Low" : (c.lead_score >= 45 ? "Medium" : "High"),
        intentProbabilities: c.intent_probabilities,
        featureContributions: c.feature_contributions,
        utility_bill_payment_pattern: c.utility_bill_payment_pattern,
        savings_pattern: c.savings_pattern,
        account_balance_trend: c.account_balance_trend,
        transactions: mappedTransactions,
        suggestedLoanAmount: suggestedAmount,
        safeEMI: c.safe_emi,
        behavioralInsights: insights,
        explanation: explainText,
        incomeTrend: [c.estimated_income * 0.9, c.estimated_income * 0.95, c.estimated_income, c.estimated_income, c.estimated_income, c.estimated_income],
        expenseTrend: [averageMonthlyExpenses * 0.92, averageMonthlyExpenses * 0.96, averageMonthlyExpenses * 1.02, averageMonthlyExpenses, averageMonthlyExpenses * 0.98, averageMonthlyExpenses]
      };
    });
  } catch (err) {
    console.error("Failed to load customer leads", err);
    window.syntheticCustomers = [];
  }

  // Set up filtered customer list initially
  appState.filteredCustomers = [...(window.syntheticCustomers || [])];

  // Set up page navigation listeners
  setupNavigation();

  // Initialize chatbot Welcome msg early so it is ready on the login screen
  initChatbot();

  // Check login state (simulate redirect to login)
  checkAuth();
  
  // Handle click outside to close dropdowns
  document.addEventListener("click", (e) => {
    const notifyBtn = document.querySelector('[title="Notifications"]');
    const notifyTray = document.getElementById("notificationsTray");
    if (notifyTray && notifyTray.style.display === "flex" && !notifyTray.contains(e.target) && !notifyBtn.contains(e.target)) {
      notifyTray.style.display = "none";
    }

    const profileTrigger = document.querySelector(".profile-menu-trigger");
    const profileDropdown = document.getElementById("profileDropdown");
    if (profileDropdown && profileDropdown.style.display === "flex" && !profileDropdown.contains(e.target) && !profileTrigger.contains(e.target)) {
      profileDropdown.style.display = "none";
    }
  });
});

// Authentication checks
function checkAuth() {
  const savedUser = safeStorage.getItem("idbi_staff_user");
  if (savedUser) {
    appState.currentUser = JSON.parse(savedUser);
    document.getElementById("loginScreen").style.opacity = 0;
    setTimeout(() => {
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("appContainer").style.display = "flex";
      initApp();
    }, 400);
  } else {
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("appContainer").style.display = "none";
  }
}

function handleLogin() {
  const emailInput = document.getElementById("email").value;
  appState.currentUser = { email: emailInput, name: "R. Sharma" };
  safeStorage.setItem("idbi_staff_user", JSON.stringify(appState.currentUser));
  showToast("Logged in successfully as Relationship Manager");
  checkAuth();
}

function handleDemoLogin() {
  appState.currentUser = { email: "demo.officer@idbi.com", name: "Demo Loan Officer" };
  safeStorage.setItem("idbi_staff_user", JSON.stringify(appState.currentUser));
  showToast("Quick Demo Mode activated");
  checkAuth();
}

function logout() {
  safeStorage.removeItem("idbi_staff_user");
  appState.currentUser = null;
  showToast("Logged out successfully");
  checkAuth();
  // Close dropdowns
  document.getElementById("profileDropdown").style.display = "none";
}

// Initialise the application pages and charts
function initApp() {
  // Sync the username in the navbar
  document.querySelector(".user-name").innerText = appState.currentUser.name;
  document.querySelector(".user-avatar").innerText = appState.currentUser.name.split(" ").map(n => n[0]).join("");

  // Set up dropdown lists for profile page & decision engine
  populateCustomerSelectors();

  // Load the default page (Dashboard)
  navigateTo("dashboard");
  
  // Initialize chatbot Welcome msg
  initChatbot();
}

// Populate customer select dropdowns across the views
function populateCustomerSelectors() {
  const customers = window.syntheticCustomers;
  const profileSelect = document.getElementById("profileCustomerSelect");
  const engineSelect = document.getElementById("engineCustomerSelect");
  
  if (profileSelect && engineSelect) {
    profileSelect.innerHTML = "";
    engineSelect.innerHTML = "";
    
    customers.forEach(c => {
      const opt = `<option value="${c.id}">${c.name} (${c.id})</option>`;
      profileSelect.insertAdjacentHTML("beforeend", opt);
      engineSelect.insertAdjacentHTML("beforeend", opt);
    });
  }
}

// Navigation & Routing Setup
function setupNavigation() {
  const menuItems = document.querySelectorAll(".sidebar-item");
  menuItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const pageId = item.getAttribute("data-page");
      navigateTo(pageId);
    });
  });
}

function navigateTo(pageId) {
  appState.activePage = pageId;
  
  // Update sidebar active class
  document.querySelectorAll(".sidebar-item").forEach(item => {
    if (item.getAttribute("data-page") === pageId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update navbar title
  const titles = {
    "dashboard": "Executive Dashboard",
    "customer-intelligence": "Customer Intelligence Center",
    "customer-profile": "Lending Prospect Deep Dive",
    "ai-decision-engine": "AI Lending Decision Engine",
    "lead-ranking": "Lead Scoring & CRM Prioritization",
    "analytics": "Advanced Lending Analytics & Forecasts"
  };
  document.getElementById("pageTitle").innerText = titles[pageId] || "Smart Retail Lending Portal";

  // Toggle active view container
  document.querySelectorAll(".page-view").forEach(view => {
    if (view.id === pageId) {
      view.classList.add("active");
    } else {
      view.classList.remove("active");
    }
  });

  // Trigger page-specific loads
  if (pageId === "dashboard") {
    loadDashboardPage();
  } else if (pageId === "customer-intelligence") {
    loadCustomerIntelligencePage();
  } else if (pageId === "customer-profile") {
    loadCustomerProfilePage(appState.selectedCustomerId);
  } else if (pageId === "ai-decision-engine") {
    loadDecisionEnginePage(appState.selectedCustomerId);
  } else if (pageId === "lead-ranking") {
    loadLeadRankingPage();
  } else if (pageId === "analytics") {
    loadAnalyticsPage();
  }

  // Auto close sidebar on mobile sizes
  const sidebar = document.querySelector(".sidebar");
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("active");
  }
  
  // Scroll to top
  window.scrollTo(0, 0);
}

// ----------------------------------------------------
// PAGE 2: DASHBOARD PAGE CONTROLLER
// ----------------------------------------------------
function loadDashboardPage() {
  const customers = window.syntheticCustomers;
  
  // Calculate Dashboard KPIs
  const total = customers.length;
  const highIntent = customers.filter(c => c.intentScore >= 70).length;
  const eligible = customers.filter(c => c.creditScore >= 700 && c.riskLevel !== "High").length;
  const avgRepayment = Math.floor(customers.reduce((acc, curr) => acc + curr.repaymentCapacity, 0) / total);
  
  document.getElementById("kpiHighIntent").innerText = highIntent;
  document.getElementById("kpiEligible").innerText = eligible;
  document.getElementById("kpiAvgRepayment").innerText = `₹${avgRepayment.toLocaleString("en-IN")}`;

  // Destroy previous charts if exist
  if (window.myCharts.dashComb) window.myCharts.dashComb.destroy();
  if (window.myCharts.dashPie) window.myCharts.dashPie.destroy();
  if (window.myCharts.dashLine) window.myCharts.dashLine.destroy();

  // Aggregate combination chart data (Loan type averages)
  const loanTypes = ["Home Loan", "Personal Loan", "Vehicle Loan", "Business Loan"];
  const avgIncomeByLoan = loanTypes.map(type => {
    const list = customers.filter(c => c.recommendedLoan === type);
    return list.length ? Math.floor(list.reduce((acc, curr) => acc + curr.monthlyIncome, 0) / list.length) : 0;
  });
  
  const avgRepayByLoan = loanTypes.map(type => {
    const list = customers.filter(c => c.recommendedLoan === type);
    return list.length ? Math.floor(list.reduce((acc, curr) => acc + curr.repaymentCapacity, 0) / list.length) : 0;
  });

  // Chart 1: Mixed Income / Repayment Chart
  const ctxComb = document.getElementById("dashboardCombinationChart").getContext("2d");
  window.myCharts.dashComb = new Chart(ctxComb, {
    type: 'bar',
    data: {
      labels: loanTypes,
      datasets: [
        {
          label: 'Avg Monthly Income (₹)',
          data: avgIncomeByLoan,
          backgroundColor: 'rgba(59, 130, 246, 0.65)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          label: 'Avg Repayment Capacity (₹)',
          data: avgRepayByLoan,
          type: 'line',
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 4,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'var(--text-secondary)' }
        },
        x: {
          ticks: { color: 'var(--text-secondary)' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: 'var(--text-primary)' } }
      }
    }
  });

  // Chart 2: Share of loan types recommended
  const shareData = loanTypes.map(type => customers.filter(c => c.recommendedLoan === type).length);
  const ctxPie = document.getElementById("dashboardPieChart").getContext("2d");
  window.myCharts.dashPie = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: loanTypes,
      datasets: [{
        data: shareData,
        backgroundColor: [
          '#1e3a8a', // Home Loan
          '#3b82f6', // Personal Loan
          '#06b6d4', // Vehicle Loan
          '#10b981'  // Business Loan
        ],
        borderWidth: 2,
        borderColor: 'var(--bg-primary)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: 'var(--text-primary)', boxWidth: 12 }
        }
      }
    }
  });

  // Chart 3: Monthly dynamics of lead generation vs conversion
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const ctxLine = document.getElementById("dashboardLineChart").getContext("2d");
  window.myCharts.dashLine = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Total Leads Identified',
          data: [35, 45, 62, 78, 89, 100],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        },
        {
          label: 'Conversions (AI Engine Lead)',
          data: [6, 8, 12, 15, 17, 21],
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          tension: 0.3,
          borderWidth: 2,
          pointStyle: 'circle'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: 'var(--text-secondary)' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: 'var(--text-secondary)' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: 'var(--text-primary)' } }
      }
    }
  });
}

// ----------------------------------------------------
// PAGE 3: CUSTOMER INTELLIGENCE PAGE CONTROLLER
// ----------------------------------------------------
function loadCustomerIntelligencePage() {
  renderCustomerTable(appState.filteredCustomers);
}

function renderCustomerTable(data) {
  const tbody = document.getElementById("ciTableBody");
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px;">No customers match the current filter criteria.</td></tr>`;
    return;
  }

  data.forEach(c => {
    const row = `
      <tr onclick="handleRowClick('${c.id}')">
        <td style="font-weight: 600; color: var(--primary-light);">${c.id}</td>
        <td style="font-weight: 500;">${c.name}</td>
        <td>₹${c.monthlyIncome.toLocaleString("en-IN")}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex:1; height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; max-width: 50px;">
              <div style="height: 100%; width: ${c.incomeStabilityScore}%; background: var(--primary-light); border-radius: 3px;"></div>
            </div>
            <span>${c.incomeStabilityScore}%</span>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex:1; height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; max-width: 50px;">
              <div style="height: 100%; width: ${c.intentScore}%; background: var(--warning); border-radius: 3px;"></div>
            </div>
            <span>${c.intentScore}%</span>
          </div>
        </td>
        <td>₹${c.repaymentCapacity.toLocaleString("en-IN")}</td>
        <td><span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--primary-light); border: 1px solid rgba(59, 130, 246, 0.2);">${c.recommendedLoan}</span></td>
        <td><span class="badge ${c.riskLevel.toLowerCase()}">${c.riskLevel}</span></td>
        <td style="font-weight: 700; color: var(--primary-light);">${c.leadScore}%</td>
        <td><span class="badge ${c.status.toLowerCase()}">${c.status}</span></td>
      </tr>
    `;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

function filterCustomerIntelligence() {
  const searchVal = document.getElementById("ciSearch").value.toLowerCase();
  const loanVal = document.getElementById("ciLoanFilter").value;
  const riskVal = document.getElementById("ciRiskFilter").value;
  const statusVal = document.getElementById("ciStatusFilter").value;
  const incomeVal = document.getElementById("ciIncomeFilter").value;

  appState.filteredCustomers = window.syntheticCustomers.filter(c => {
    // Search filter
    const matchesSearch = c.name.toLowerCase().includes(searchVal) || 
                          c.id.toLowerCase().includes(searchVal) || 
                          c.occupation.toLowerCase().includes(searchVal);
    
    // Dropdowns
    const matchesLoan = loanVal === "" || c.recommendedLoan === loanVal;
    const matchesRisk = riskVal === "" || c.riskLevel === riskVal;
    const matchesStatus = statusVal === "" || c.status === statusVal;
    
    // Income range check
    let matchesIncome = true;
    if (incomeVal !== "") {
      const [min, max] = incomeVal.split("-").map(Number);
      matchesIncome = c.monthlyIncome >= min && c.monthlyIncome <= max;
    }

    return matchesSearch && matchesLoan && matchesRisk && matchesStatus && matchesIncome;
  });

  renderCustomerTable(appState.filteredCustomers);
}

function resetFilters() {
  document.getElementById("ciSearch").value = "";
  document.getElementById("ciLoanFilter").value = "";
  document.getElementById("ciRiskFilter").value = "";
  document.getElementById("ciStatusFilter").value = "";
  document.getElementById("ciIncomeFilter").value = "";
  
  appState.filteredCustomers = [...window.syntheticCustomers];
  renderCustomerTable(appState.filteredCustomers);
  showToast("Filters reset successfully");
}

function handleRowClick(customerId) {
  appState.selectedCustomerId = customerId;
  
  // Sync the selectors
  document.getElementById("profileCustomerSelect").value = customerId;
  document.getElementById("engineCustomerSelect").value = customerId;
  
  navigateTo("customer-profile");
  showToast(`Loaded profile for ${customerId}`);
}

// Table sorting logic
function sortTable(columnIndex) {
  const columnsMap = [
    "id", "name", "monthlyIncome", "incomeStabilityScore", 
    "intentScore", "repaymentCapacity", "recommendedLoan", 
    "riskLevel", "leadScore", "status"
  ];
  
  const col = columnsMap[columnIndex];
  if (!col) return;

  if (appState.sortColumn === col) {
    appState.sortDirection = appState.sortDirection === "asc" ? "desc" : "asc";
  } else {
    appState.sortColumn = col;
    appState.sortDirection = "asc";
  }

  // Update header arrows indicator visually (simulate)
  const headers = document.querySelectorAll("#customerTable th");
  headers.forEach((h, idx) => {
    const icon = h.querySelector("i");
    if (idx === columnIndex) {
      icon.setAttribute("data-lucide", appState.sortDirection === "asc" ? "chevron-up" : "chevron-down");
    } else {
      icon.setAttribute("data-lucide", "chevrons-up-down");
    }
  });
  lucide.createIcons();

  appState.filteredCustomers.sort((a, b) => {
    let valA = a[col];
    let valB = b[col];

    // Handle alpha codes or numeric checks
    if (typeof valA === 'string') {
      return appState.sortDirection === "asc" 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      return appState.sortDirection === "asc" 
        ? valA - valB 
        : valB - valA;
    }
  });

  renderCustomerTable(appState.filteredCustomers);
}

// ----------------------------------------------------
// PAGE 4: CUSTOMER PROFILE PAGE CONTROLLER
// ----------------------------------------------------
function loadCustomerProfile(customerId) {
  appState.selectedCustomerId = customerId;
  
  const customer = window.syntheticCustomers.find(c => c.id === customerId);
  if (!customer) return;

  // Set selectors value just in case
  document.getElementById("profileCustomerSelect").value = customerId;
  document.getElementById("engineCustomerSelect").value = customerId;

  // Populate textual details
  document.getElementById("profName").innerText = customer.name;
  document.getElementById("profIdAndTitle").innerText = `${customer.id} | ${customer.occupation} (${customer.sector} Sector)`;
  document.getElementById("profEmail").innerText = customer.email;
  document.getElementById("profAge").innerText = `${customer.age} Years`;
  document.getElementById("profCreditScore").innerText = customer.creditScore;
  document.getElementById("profGrossIncome").innerText = `₹${customer.monthlyIncome.toLocaleString("en-IN")} / mo`;
  document.getElementById("profExpenses").innerText = `₹${customer.monthlyExpenses.toLocaleString("en-IN")} / mo`;
  document.getElementById("profExistingEMI").innerText = `₹${customer.existingEMI.toLocaleString("en-IN")} / mo`;
  document.getElementById("profDisposable").innerText = `₹${customer.disposableIncome.toLocaleString("en-IN")} / mo`;
  
  // Set avatar text
  document.getElementById("profAvatar").innerText = customer.name.split(" ").map(n => n[0]).join("");

  // Set Badges
  const riskBadge = document.getElementById("profRiskBadge");
  riskBadge.innerText = `${customer.riskLevel} Risk`;
  riskBadge.className = `badge ${customer.riskLevel.toLowerCase()}`;

  const statusBadge = document.getElementById("profStatusBadge");
  statusBadge.innerText = `${customer.status} Lead (${customer.leadScore}%)`;
  statusBadge.className = `badge ${customer.status.toLowerCase()}`;

  // Behavioral insights
  const behaviorList = document.getElementById("profBehaviorList");
  behaviorList.innerHTML = "";
  customer.behavioralInsights.forEach(insight => {
    behaviorList.insertAdjacentHTML("beforeend", `<li>${insight}</li>`);
  });

  // AI Verdict details
  document.getElementById("profAiRationale").innerText = customer.explanation;
  document.getElementById("profRecLoan").innerText = customer.recommendedLoan;
  document.getElementById("profSuggestedAmount").innerText = `₹${customer.suggestedLoanAmount.toLocaleString("en-IN")}`;
  document.getElementById("profSafeEMI").innerText = `₹${customer.safeEMI.toLocaleString("en-IN")}`;

  // Populate Recent transactions summary table
  const txTbody = document.getElementById("profTransactionTableBody");
  txTbody.innerHTML = "";
  customer.transactions.forEach(tx => {
    const isCredit = tx.type === "Credit";
    const amtColor = isCredit ? "var(--success)" : "var(--text-primary)";
    const sign = isCredit ? "+" : "-";
    const row = `
      <tr>
        <td>${tx.date}</td>
        <td>${tx.desc}</td>
        <td>${tx.category}</td>
        <td style="font-weight: 600; color: ${isCredit ? 'var(--success)' : 'var(--text-secondary)'};">${tx.type}</td>
        <td style="font-weight: 700; color: ${amtColor};">${sign} ₹${tx.amount.toLocaleString("en-IN")}</td>
      </tr>
    `;
    txTbody.insertAdjacentHTML("beforeend", row);
  });

  // Render Chart: Income vs Expenses 6 months
  if (window.myCharts.profileIncExp) window.myCharts.profileIncExp.destroy();
  const ctx = document.getElementById("profileIncomeExpenseChart").getContext("2d");
  
  const labelMonths = ["Month -5", "Month -4", "Month -3", "Month -2", "Month -1", "Current"];
  window.myCharts.profileIncExp = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labelMonths,
      datasets: [
        {
          label: 'Monthly Income Inflow',
          data: customer.incomeTrend,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderRadius: 4
        },
        {
          label: 'Monthly Expenses Outflow',
          data: customer.expenseTrend,
          backgroundColor: 'rgba(239, 68, 68, 0.65)',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: 'var(--text-secondary)' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: 'var(--text-secondary)' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: 'var(--text-primary)' } }
      }
    }
  });
}

function triggerReportDownload() {
  const customer = window.syntheticCustomers.find(c => c.id === appState.selectedCustomerId);
  showToast(`Generating report for ${customer.name}...`);
  setTimeout(() => {
    showToast(`SUCCESS: Downloaded ${customer.id}_Financial_Summary.pdf`);
  }, 1000);
}

// ----------------------------------------------------
// PAGE 5: AI DECISION ENGINE PAGE CONTROLLER
// ----------------------------------------------------
function loadDecisionEnginePage(customerId) {
  appState.selectedCustomerId = customerId;
  const customer = window.syntheticCustomers.find(c => c.id === customerId);
  if (!customer) return;

  // Sync selectors
  document.getElementById("engineCustomerSelect").value = customerId;
  document.getElementById("profileCustomerSelect").value = customerId;

  // 1. Income stability score gauge
  updateGauge("gaugeStability", "valStability", customer.incomeStabilityScore, "var(--primary-light)");
  // 2. Loan eligibility score gauge (based on normalized credit score ratio)
  updateGauge("gaugeEligibility", "valEligibility", customer.repaymentCapacityScore, "var(--success)");
  // 3. Loan intent probability gauge
  updateGauge("gaugeIntent", "valIntent", customer.intentScore, "var(--warning)");
  // 4. Fraud risk score gauge
  updateGauge("gaugeFraud", "valFraud", customer.fraudRiskScore, "var(--danger)");

  // Update Rationale Explanation
  document.getElementById("engineRationaleText").innerText = customer.explanation;
  document.getElementById("engineEstIncome").innerText = `₹${customer.monthlyIncome.toLocaleString("en-IN")}`;
  document.getElementById("engineRepayCap").innerText = `₹${customer.repaymentCapacity.toLocaleString("en-IN")}`;
}

function updateGauge(circleId, valId, val, color) {
  const circle = document.getElementById(circleId);
  const text = document.getElementById(valId);
  
  circle.style.setProperty("--percentage", `${val}%`);
  circle.style.setProperty("--fill-color", color);
  
  // Custom circular conic gradient fallback styling updates
  circle.style.background = `conic-gradient(${color} ${val}%, rgba(120, 120, 120, 0.1) ${val}%)`;
  text.innerText = `${val}%`;
}

function loadEngineMetrics(val) {
  loadDecisionEnginePage(val);
  showToast(`Recalculated engine variables for ${val}`);
}

// ----------------------------------------------------
// PAGE 6: LEAD RANKING PAGE CONTROLLER
// ----------------------------------------------------
function loadLeadRankingPage() {
  const customers = [...window.syntheticCustomers];
  
  // Sort customers by Lead Score descending
  customers.sort((a, b) => b.leadScore - a.leadScore);

  const top10 = customers.slice(0, 10);
  const rankBody = document.getElementById("rankListBody");
  rankBody.innerHTML = "";

  top10.forEach((c, index) => {
    const isHot = c.leadScore >= 75;
    const badgeColor = isHot ? "red" : "orange";
    
    // Priority Tag
    let priorityText = "MEDIUM PRIORITY";
    let priorityClass = "badge warm";
    if (index < 3) {
      priorityText = "CRITICAL LEAD";
      priorityClass = "badge hot";
    } else if (index < 6) {
      priorityText = "HIGH PRIORITY";
      priorityClass = "badge hot";
    }

    const rankRow = `
      <div class="glass-card rank-item" onclick="handleRowClick('${c.id}')">
        <div class="rank-number">#${index + 1}</div>
        <div class="rank-name">
          <div style="font-weight: 700; font-size: 16px; color: var(--text-primary);">${c.name}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">ID: ${c.id} | ${c.occupation}</div>
        </div>
        
        <div class="rank-score-details">
          <div class="rank-metric">
            <span class="label">Repayment Capacity</span>
            <span class="val">₹${c.repaymentCapacity.toLocaleString("en-IN")}</span>
          </div>
          <div class="rank-metric">
            <span class="label">Intent Score</span>
            <span class="val">${c.intentScore}%</span>
          </div>
          <div class="rank-metric">
            <span class="label">Stability Index</span>
            <span class="val">${c.incomeStabilityScore}%</span>
          </div>
          <div class="rank-metric">
            <span class="label">Credit Score</span>
            <span class="val">${c.creditScore}</span>
          </div>
        </div>

        <div style="margin-left: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <span class="${priorityClass}">${priorityText}</span>
          <span class="lead-score-badge">${c.leadScore}%</span>
        </div>
      </div>
    `;
    rankBody.insertAdjacentHTML("beforeend", rankRow);
  });
}

function triggerRankingExport() {
  showToast("Compiling top CRM lending leads...");
  setTimeout(() => {
    showToast("SUCCESS: Exported CRM_Leads_Prioritization_2026.csv");
  }, 1200);
}

// ----------------------------------------------------
// PAGE 7: ANALYTICS PAGE CONTROLLER
// ----------------------------------------------------
function loadAnalyticsPage() {
  const customers = window.syntheticCustomers;
  
  // 1. Render 100 Heatmap Cells
  const heatmap = document.getElementById("heatmapContainer");
  heatmap.innerHTML = "";
  
  customers.forEach(c => {
    // Colors: Low intent green gradient/grey, warm yellow gradient, hot blue gradient
    let colorClass = "#10b981"; // green default
    if (c.intentScore >= 75) {
      colorClass = "#1e3a8a"; // deep blue
    } else if (c.intentScore >= 55) {
      colorClass = "#3b82f6"; // bright blue
    } else if (c.intentScore >= 40) {
      colorClass = "#f59e0b"; // yellow
    } else {
      colorClass = "rgba(120, 120, 120, 0.2)"; // gray low intent
    }

    const cell = `
      <div class="heatmap-cell" 
           style="background-color: ${colorClass};" 
           data-tooltip="${c.name} (${c.id}) | Intent: ${c.intentScore}%"
           onclick="handleRowClick('${c.id}')">
      </div>
    `;
    heatmap.insertAdjacentHTML("beforeend", cell);
  });

  // 2. Render Lead Funnel
  // Total: 100 -> High Intent: (>=60) -> Eligible: (credit >= 700 & low/med risk) -> Converted (Hot leads ratio)
  const totalCount = customers.length;
  const highIntentCount = customers.filter(c => c.intentScore >= 60).length;
  const eligibleCount = customers.filter(c => c.creditScore >= 690 && c.riskLevel !== "High").length;
  const convertedCount = Math.floor(eligibleCount * 0.4); // conversion prediction simulation
  
  const funnelContainer = document.getElementById("funnelContainer");
  funnelContainer.innerHTML = `
    <div class="funnel-stage">
      <span class="funnel-label">Identified Portfolio</span>
      <div class="funnel-bar funnel-1" style="width: 100%">
        <span>${totalCount} Customers</span>
        <span>100%</span>
      </div>
    </div>
    <div class="funnel-stage">
      <span class="funnel-label">High Intent Leads</span>
      <div class="funnel-bar funnel-2" style="width: ${Math.max(30, (highIntentCount/totalCount)*100)}%">
        <span>${highIntentCount} Candidates</span>
        <span>${Math.floor((highIntentCount/totalCount)*100)}%</span>
      </div>
    </div>
    <div class="funnel-stage">
      <span class="funnel-label">Credit Approved</span>
      <div class="funnel-bar funnel-3" style="width: ${Math.max(30, (eligibleCount/totalCount)*100)}%">
        <span>${eligibleCount} Safe Profiles</span>
        <span>${Math.floor((eligibleCount/totalCount)*100)}%</span>
      </div>
    </div>
    <div class="funnel-stage">
      <span class="funnel-label">AI Conversion Target</span>
      <div class="funnel-bar funnel-4" style="width: ${Math.max(30, (convertedCount/totalCount)*100)}%">
        <span>${convertedCount} Expected</span>
        <span>${Math.floor((convertedCount/totalCount)*100)}%</span>
      </div>
    </div>
  `;

  // Destroy previous charts if exist
  if (window.myCharts.analRisk) window.myCharts.analRisk.destroy();
  if (window.myCharts.analTrend) window.myCharts.analTrend.destroy();
  if (window.myCharts.analIncome) window.myCharts.analIncome.destroy();

  // Pie Chart: Risk distribution
  const lowRiskCount = customers.filter(c => c.riskLevel === "Low").length;
  const medRiskCount = customers.filter(c => c.riskLevel === "Medium").length;
  const highRiskCount = customers.filter(c => c.riskLevel === "High").length;
  
  const ctxRisk = document.getElementById("analyticsRiskPieChart").getContext("2d");
  window.myCharts.analRisk = new Chart(ctxRisk, {
    type: 'pie',
    data: {
      labels: ["Low Risk", "Medium Risk", "High Risk"],
      datasets: [{
        data: [lowRiskCount, medRiskCount, highRiskCount],
        backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
        borderWidth: 1,
        borderColor: 'var(--bg-primary)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: 'var(--text-primary)' }, position: 'bottom' }
      }
    }
  });

  // Line Chart: 6-Month Trends and Conversion Forecast
  const ctxTrend = document.getElementById("analyticsTrendLineChart").getContext("2d");
  window.myCharts.analTrend = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul (Forecast)"],
      datasets: [
        {
          label: 'Traditional Conversion Rate (%)',
          data: [11.2, 11.5, 11.0, 11.8, 12.1, 12.0, 12.2],
          borderColor: '#94a3b8',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          tension: 0.2
        },
        {
          label: 'Smart AI Conversion Rate (%)',
          data: [15.1, 16.4, 17.2, 18.0, 18.2, 18.4, 19.5],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          ticks: { color: 'var(--text-secondary)' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: 'var(--text-secondary)' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: 'var(--text-primary)' } }
      }
    }
  });

  // Bar Chart: Income Distributions vs Lead Scores
  // Bracket: < 75k, 75k-150k, > 150k
  const bracket1 = customers.filter(c => c.monthlyIncome < 75000);
  const bracket2 = customers.filter(c => c.monthlyIncome >= 75000 && c.monthlyIncome <= 150000);
  const bracket3 = customers.filter(c => c.monthlyIncome > 150000);

  const avgScoreB1 = bracket1.length ? Math.floor(bracket1.reduce((acc, curr) => acc + curr.leadScore, 0) / bracket1.length) : 0;
  const avgScoreB2 = bracket2.length ? Math.floor(bracket2.reduce((acc, curr) => acc + curr.leadScore, 0) / bracket2.length) : 0;
  const avgScoreB3 = bracket3.length ? Math.floor(bracket3.reduce((acc, curr) => acc + curr.leadScore, 0) / bracket3.length) : 0;

  const ctxIncome = document.getElementById("analyticsIncomeBarChart").getContext("2d");
  window.myCharts.analIncome = new Chart(ctxIncome, {
    type: 'bar',
    data: {
      labels: ["Below ₹75k/mo", "₹75k - ₹1.5L/mo", "Above ₹1.5L/mo"],
      datasets: [
        {
          label: 'Volume of Prospects',
          data: [bracket1.length, bracket2.length, bracket3.length],
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          label: 'Average Lead Score (%)',
          data: [avgScoreB1, avgScoreB2, avgScoreB3],
          backgroundColor: '#10b981',
          borderRadius: 6,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: 'var(--text-secondary)' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: 'var(--text-secondary)' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: 'var(--text-primary)' } }
      }
    }
  });
}

// ----------------------------------------------------
// PROTOTYPE UI SHELL EXTRA INTERACTIVE LOGIC
// ----------------------------------------------------
function toggleTheme() {
  const htmlEl = document.documentElement;
  const icon = document.getElementById("themeIcon");
  
  if (appState.theme === "light") {
    appState.theme = "dark";
    htmlEl.setAttribute("data-theme", "dark");
    icon.setAttribute("data-lucide", "sun");
    showToast("Dark Mode activated");
  } else {
    appState.theme = "light";
    htmlEl.removeAttribute("data-theme");
    icon.setAttribute("data-lucide", "moon");
    showToast("Light Mode activated");
  }
  
  lucide.createIcons();

  // Reload charts to align color parameters with variables
  if (appState.activePage === "dashboard") {
    loadDashboardPage();
  } else if (appState.activePage === "customer-profile") {
    loadCustomerProfile(appState.selectedCustomerId);
  } else if (appState.activePage === "analytics") {
    loadAnalyticsPage();
  }
}

function toggleNotifications() {
  const tray = document.getElementById("notificationsTray");
  const isDisp = tray.style.display === "flex";
  tray.style.display = isDisp ? "none" : "flex";
}

function toggleProfileMenu() {
  const dropdown = document.getElementById("profileDropdown");
  const isDisp = dropdown.style.display === "flex";
  dropdown.style.display = isDisp ? "none" : "flex";
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  sidebar.classList.toggle("active");
}

// Custom Toast System
function showToast(message) {
  const toast = document.getElementById("toastNotification");
  const toastText = document.getElementById("toastText");
  
  toastText.innerText = message;
  toast.style.display = "flex";
  
  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

// =============================================================
// CHATBOT CONTROLLER (LOAN GENIE AI)
// =============================================================

function initChatbot() {
  appState.chatOpen = false;
  appState.assessmentState = {
    step: 0,
    salary: null,
    expenses: null,
    emi: null
  };

  const welcomeText = `👋 Hello! I'm **Loan Genie AI**, your virtual banking assistant. I can help you with loan eligibility, EMI calculations, repayment capacity, loan recommendations, required documents, and application status. How can I assist you today?`;
  
  // Clear chat body and render welcome bubble
  const chatBody = document.getElementById("chatBody");
  chatBody.innerHTML = "";
  
  addMessageToFeed("bot", welcomeText);
  
  // Render initial quick actions
  const quickActions = [
    "Check Loan Eligibility",
    "Personalized Eligibility Wizard",
    "Calculate EMI",
    "Recommended Loan",
    "Track Loan Application",
    "Required Documents",
    "Compare Loan Types",
    "Contact Loan Officer"
  ];
  addQuickActions(quickActions);
}

function toggleChat() {
  const chatWin = document.getElementById("chatbotWindow");
  const fab = document.getElementById("chatbotFAB");
  const badge = fab.querySelector(".chat-notification-badge");
  
  appState.chatOpen = !appState.chatOpen;
  
  if (appState.chatOpen) {
    chatWin.style.display = "flex";
    if (badge) badge.style.display = "none"; // Hide notifications
    // Change icon to close (x)
    fab.innerHTML = `<i data-lucide="x"></i>`;
  } else {
    chatWin.style.display = "none";
    fab.innerHTML = `<i data-lucide="message-square"></i>`;
  }
  lucide.createIcons();
}

function sendChatMessage(overrideText = null) {
  const inputEl = document.getElementById("chatInput");
  const userText = overrideText || inputEl.value.trim();
  
  if (!userText) return;
  
  // Reset input field
  if (!overrideText) inputEl.value = "";
  
  // Render user message bubble
  addMessageToFeed("user", userText);
  
  // Show bot typing indicator
  showTypingIndicator();
  
  // Call FastAPI backend chatbot endpoint
  fetch("/chatbot/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      customer_id: appState.selectedCustomerId,
      question: userText
    })
  })
  .then(res => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  })
  .then(data => {
    removeTypingIndicator();
    addMessageToFeed("bot", data.answer);
  })
  .catch(err => {
    console.error("Chatbot error:", err);
    removeTypingIndicator();
    addMessageToFeed("bot", "Error: Failed to fetch AI assistant response from the ML backend. Make sure your GEMINI_API_KEY environment variable is set.");
  });
}

function addMessageToFeed(sender, content) {
  const chatBody = document.getElementById("chatBody");
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Parse bold markdown syntax simply for UI representation
  let parsedContent = content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/-(.*?)\n/g, "• $1<br>")
    .replace(/\n/g, "<br>");

  const msgHTML = `
    <div class="chat-msg ${sender}">
      <div class="chat-msg-bubble">
        ${parsedContent}
      </div>
      <div class="chat-msg-meta">${time}</div>
    </div>
  `;
  
  chatBody.insertAdjacentHTML("beforeend", msgHTML);
  chatBody.scrollTop = chatBody.scrollHeight;
  lucide.createIcons();
}

function addQuickActions(actions) {
  const chatBody = document.getElementById("chatBody");
  let chipsHTML = `<div class="chat-quick-actions">`;
  
  actions.forEach(act => {
    chipsHTML += `<div class="chat-chip" onclick="handleQuickActionClick('${act}')">${act}</div>`;
  });
  
  chipsHTML += `</div>`;
  chatBody.insertAdjacentHTML("beforeend", chipsHTML);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function handleQuickActionClick(actionText) {
  sendChatMessage(actionText);
}

function showTypingIndicator() {
  const chatBody = document.getElementById("chatBody");
  const indicatorHTML = `
    <div class="chat-msg bot" id="chatTypingIndicator">
      <div class="chat-msg-bubble" style="padding: 8px 14px;">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  chatBody.insertAdjacentHTML("beforeend", indicatorHTML);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById("chatTypingIndicator");
  if (indicator) indicator.remove();
}

function triggerVoiceInput() {
  showToast("Voice transcription active... Speak now");
  setTimeout(() => {
    const input = document.getElementById("chatInput");
    input.value = "Assess my loan eligibility";
    showToast("Voice captured successfully");
  }, 1500);
}

function handleChatFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  const chatBody = document.getElementById("chatBody");
  const chipHTML = `
    <div class="chat-msg user">
      <div class="chat-attachment-chip">
        <i data-lucide="file-text"></i>
        <span>${file.name}</span>
      </div>
    </div>
  `;
  chatBody.insertAdjacentHTML("beforeend", chipHTML);
  chatBody.scrollTop = chatBody.scrollHeight;
  lucide.createIcons();
  
  showTypingIndicator();
  setTimeout(() => {
    removeTypingIndicator();
    const reply = `I have successfully received your document: **${file.name}**. I will pass it to our loan processing module. The document will be reviewed as part of the underwriting appraisal checks.`;
    addMessageToFeed("bot", reply);
  }, 1500);
}

// Core Conversational Routing Engine
function generateBotResponse(userInput) {
  const text = userInput.toLowerCase();
  
  // Fetch active customer from state
  const customer = window.syntheticCustomers.find(c => c.id === appState.selectedCustomerId) || window.syntheticCustomers[0];

  // -----------------------------------------------------------------
  // MULTI-STEP ELIGIBILITY WIZARD STATE MACHINE
  // -----------------------------------------------------------------
  if (appState.assessmentState.step > 0) {
    const numericVal = parseFloat(text.replace(/[^0-9.]/g, ''));
    
    if (appState.assessmentState.step === 1) {
      if (isNaN(numericVal) || numericVal <= 0) {
        return {
          content: "Oops! That doesn't seem like a valid salary. Please type your monthly salary (e.g. 80000):"
        };
      }
      appState.assessmentState.salary = numericVal;
      appState.assessmentState.step = 2;
      return {
        content: `Salary logged: **₹${numericVal.toLocaleString("en-IN")}**.\n\n**Step 2 of 3: What are your average monthly spendings (including rent, groceries, shopping, utility bills)?**`
      };
    }
    
    if (appState.assessmentState.step === 2) {
      if (isNaN(numericVal) || numericVal < 0) {
        return {
          content: "Please enter a valid spending amount (e.g. 35000):"
        };
      }
      appState.assessmentState.expenses = numericVal;
      appState.assessmentState.step = 3;
      return {
        content: `Spendings logged: **₹${numericVal.toLocaleString("en-IN")}**.\n\n**Step 3 of 3: What are your active monthly EMI payments?** (If none, simply type 0):`
      };
    }
    
    if (appState.assessmentState.step === 3) {
      if (isNaN(numericVal) || numericVal < 0) {
        return {
          content: "Please enter a valid EMI obligation (e.g. 0):"
        };
      }
      appState.assessmentState.emi = numericVal;
      
      // RUN CALCULATIONS
      const salary = appState.assessmentState.salary;
      const expenses = appState.assessmentState.expenses;
      const emi = appState.assessmentState.emi;
      const disposable = salary - expenses - emi;
      
      // Conservative repayment: Max allowed EMI is 60% of disposable cash, scaled by safety multiplier 0.85
      const repayCapacity = Math.max(0, Math.floor(disposable * 0.6 * 0.85));
      const homeLimit = repayCapacity * 60;
      const personalLimit = repayCapacity * 24;
      const vehicleLimit = repayCapacity * 18;
      
      // Expense ratios
      const expenseRatio = Math.floor((expenses / salary) * 100);
      const emiRatio = Math.floor((emi / salary) * 100);
      const surplusRatio = 100 - expenseRatio - emiRatio;
      
      // Build advisory notes
      let advisoryNotes = "";
      if (emiRatio > 35) {
        advisoryNotes += "⚠️ **Debt Obligation Alert**: Your EMI debt takes up **" + emiRatio + "%** of your income (Caution: >35%). We suggest consolidating short-term credit cards to free up capacity.\n\n";
      } else {
        advisoryNotes += "✅ **Debt Level Healthy**: Your EMIs are well within safe thresholds (below 35%).\n\n";
      }
      
      if (expenseRatio > 50) {
        advisoryNotes += "⚠️ **Spendings Warning**: Your general expenses are **" + expenseRatio + "%** of your salary (Ideal: 50% max). Trimming discretionary shopping could double your pre-approved loan margins.\n\n";
      } else {
        advisoryNotes += "✅ **Expense Management Strong**: Essential spendings are under control.\n\n";
      }

      advisoryNotes += `📊 **50/30/20 Savings Rules Check**:\n- Current Needs & Spendings: **${expenseRatio}%**\n- Debt Obligations: **${emiRatio}%**\n- Cash Surplus: **${surplusRatio > 0 ? surplusRatio : 0}%** (Ideal: 20% minimum for investments).`;

      const resultText = `
**Appraisal Complete!** 🎉 Here is your customized AI lending evaluation:

**Financial Health Card**
- Monthly Income: **₹${salary.toLocaleString("en-IN")}**
- Monthly Spendings: **₹${expenses.toLocaleString("en-IN")} (${expenseRatio}%)**
- Monthly EMIs: **₹${emi.toLocaleString("en-IN")} (${emiRatio}%)**
- Disposable surplus: **₹${disposable.toLocaleString("en-IN")}**

👉 **Estimated Pre-approved Limits**:
- Safe Max Monthly EMI Capacity: **₹${repayCapacity.toLocaleString("en-IN")}**
- Home Loan Pre-approval: **₹${homeLimit.toLocaleString("en-IN")}**
- Personal Loan Pre-approval: **₹${personalLimit.toLocaleString("en-IN")}**
- Vehicle Loan Pre-approval: **₹${vehicleLimit.toLocaleString("en-IN")}**

💡 **Expense Plan Rationale**:
${advisoryNotes}
      `;
      
      // Reset State
      appState.assessmentState.step = 0;
      
      return {
        content: resultText,
        quickActions: ["Check Loan Eligibility", "Compare Loan Types", "Contact Loan Officer"]
      };
    }
  }

  // -----------------------------------------------------------------
  // NORMAL CONVERSATIONAL ROUTER
  // -----------------------------------------------------------------
  
  if (text.includes("personalized") || text.includes("wizard") || text.includes("assess") || text.includes("evaluate") || text.includes("spendings")) {
    appState.assessmentState.step = 1;
    return {
      content: `Sure! I can execute a personalized lending capacity assessment. Let's begin.\n\n**Step 1 of 3: What is your net monthly salary (in ₹)?** (e.g. 75000)`
    };
  }

  if (text.includes("eligibility") || text.includes("eligible")) {
    return {
      content: `I see you are inquiring about customer **${customer.name}** (ID: ${customer.id}). Based on their financial parameters:
- Credit Score: **${customer.creditScore}** (Risk rating: **${customer.riskLevel}**)
- Income Stability Index: **${customer.incomeStabilityScore}%**
- Disposable Income: **₹${customer.disposableIncome.toLocaleString("en-IN")}/mo**
- Repayment Capacity: **₹${customer.repaymentCapacity.toLocaleString("en-IN")}/mo**

**AI Verdict**: ${customer.explanation}`,
      quickActions: ["Track Loan Application", "Required Documents", "Compare Loan Types"]
    };
  }
  
  if (text.includes("calculate emi") || text.includes("emi calculator") || text.includes("calculate") || text.includes("emi")) {
    return {
      content: `To compute specific terms, please enter your amount and duration.
      
For example:
- A Personal Loan of **₹5,00,000** for **5 years** at 10.5% interest carries a monthly EMI of approx. **₹10,747**.
- A Home Loan of **₹40,00,000** for **20 years** at 8.40% interest carries a monthly EMI of approx. **₹34,460**.

Would you like to calculate eligibility using your own income details?`,
      quickActions: ["Personalized Eligibility Wizard", "Compare Loan Types"]
    };
  }

  if (text.includes("recommended") || text.includes("recommend")) {
    return {
      content: `Based on transaction audits and behavioral spikes for **${customer.name}**:
- Recommended Product: **${customer.recommendedLoan}**
- Suggested Pre-approved Limit: **₹${customer.suggestedLoanAmount.toLocaleString("en-IN")}**
- Target Safe EMI Cap: **₹${customer.safeEMI.toLocaleString("en-IN")} / month**

This is based on an income stability index of **${customer.incomeStabilityScore}%** and Credit Score **${customer.creditScore}**.`,
      quickActions: ["Track Loan Application", "Required Documents", "Contact Loan Officer"]
    };
  }

  if (text.includes("track") || text.includes("status") || text.includes("application")) {
    return {
      content: `Here is the current lending pipeline status for **${customer.name}** (${customer.id}):

<div class="chat-timeline">
  <div class="timeline-step done">
    <div class="timeline-dot done"><i data-lucide="check" style="width: 10px; height: 10px;"></i></div>
    <div>
      <span class="timeline-name">Lead Created & Seeding</span>
      <br><small>Completed on 2026-07-01</small>
    </div>
  </div>
  <div class="timeline-step done">
    <div class="timeline-dot done"><i data-lucide="check" style="width: 10px; height: 10px;"></i></div>
    <div>
      <span class="timeline-name">Automated Bureau Verification</span>
      <br><small>Passed (Credit score: ${customer.creditScore})</small>
    </div>
  </div>
  <div class="timeline-step active">
    <div class="timeline-dot active">3</div>
    <div>
      <span class="timeline-name">Document Appraisal (Active)</span>
      <br><small>Underwriter reviewing income stability indicators</small>
    </div>
  </div>
  <div class="timeline-step pending">
    <div class="timeline-dot pending">4</div>
    <div>
      <span class="timeline-name">Credit Committee Approval</span>
      <br><small>Estimated turnaround: 24 Hours</small>
    </div>
  </div>
</div>`,
      quickActions: ["Required Documents", "Contact Loan Officer"]
    };
  }

  if (text.includes("document") || text.includes("require") || text.includes("docs")) {
    return {
      content: `To process and disburse the pre-approved **${customer.recommendedLoan}**, we require:
- **Identity & KYC**: PAN Card and Aadhaar Card.
- **Income Proof**: 3 months salary slips and bank ledger statement for the past 6 months showing salary credit.
- **Tax Details**: Form 16 / Income Tax Returns for the last 2 financial years.
- **Property/Vehicle Invoice**: Signed sale agreement or dealership invoice (for Home or Vehicle loans).`,
      quickActions: ["Personalized Eligibility Wizard", "Compare Loan Types"]
    };
  }

  if (text.includes("compare") || text.includes("rates") || text.includes("interest")) {
    return {
      content: `IDBI Bank Retail Lending Schemes comparison table:
- **Home Loan**: Starting at **8.40% p.a.** (Floating). Max tenure: 30 Years. Processing fee: 0.5%.
- **Vehicle Loan**: Starting at **9.15% p.a.** (Fixed). Max tenure: 7 Years. Processing fee: flat ₹1,500.
- **Personal Loan**: Starting at **10.50% p.a.** (Fixed). Max tenure: 5 Years. Processing fee: 1.0%.
- **Business Loan**: Starting at **12.00% p.a.** (Reducing). Max tenure: 5 Years. Processing fee: 1.5%.`,
      quickActions: ["Calculate EMI", "Personalized Eligibility Wizard"]
    };
  }

  if (text.includes("officer") || text.includes("contact") || text.includes("connect") || text.includes("manager") || text.includes("rm")) {
    return {
      content: `You can connect directly with **Rajesh Sharma (Relationship Manager)**:
- Branch Code: **IDBI0000492** (Mumbai Main Branch)
- Direct Phone: **+91 22 6655 1234**
- Staff Email: **rm.sharma@idbibank.com**

Alternatively, click below to schedule an automated CRM callback queue ticket.`,
      quickActions: ["Schedule CRM Callback", "Frequently Asked Questions"]
    };
  }

  if (text.includes("schedule crm callback") || text.includes("callback") || text.includes("schedule")) {
    return {
      content: `✅ **Success!** A priority callback request has been logged in the CRM dashboard queue for RM Rajesh Sharma regarding prospect **${customer.name}** (${customer.id}). 
      
Estimated callback window: **Within 2 Hours**.`,
      quickActions: ["Check Loan Eligibility", "Frequently Asked Questions"]
    };
  }

  if (text.includes("faq") || text.includes("question") || text.includes("frequently")) {
    return {
      content: `Here are the top loan queries:
- **Q: How is repayment capacity estimated?**
  A: Disposable Cash surplus multiplied by standard debt service thresholds scaled by credit risk ratios.
- **Q: How does late fees impact my profile?**
  A: Late payment reduces your Income Stability Score and Credit Score, which can restrict pre-approved limits.
- **Q: Can I apply for two loans concurrently?**
  A: Yes, provided your cumulative EMI obligations remain below 45% of gross income.`,
      quickActions: ["Personalized Eligibility Wizard", "Compare Loan Types", "Contact Loan Officer"]
    };
  }

  // Fallback default
  return {
    content: `I'm not sure I understood that request. I can assist you with loan eligibility, EMI calculations, recommended loan products, required documents, and tracking applications.
    
Try clicking one of our quick action shortcuts or type "assess eligibility" to start a personalized calculations wizard!`,
    quickActions: ["Check Loan Eligibility", "Personalized Eligibility Wizard", "Calculate EMI", "Track Loan Application"]
  };
}

