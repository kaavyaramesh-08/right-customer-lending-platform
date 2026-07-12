// Seeded random number generator for determinism
function LCG(seed) {
  return function() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const random = LCG(2026); // Hackathon year seed

function getRandomInRange(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function getRandomElement(arr) {
  return arr[Math.floor(random() * arr.length)];
}

const firstNames = [
  "Aarav", "Aditya", "Amit", "Ananya", "Arjun", "Deepak", "Divya", "Gaurav", "Harish", "Ishaan",
  "Karan", "Kavita", "Manish", "Neha", "Nikhil", "Pooja", "Pranav", "Rahul", "Rohan", "Sanjay",
  "Shreya", "Siddharth", "Sneha", "Sunita", "Tarun", "Varun", "Vijay", "Vikram", "Yash", "Zoya",
  "Rajesh", "Priya", "Anjali", "Suresh", "Ramesh", "Kiran", "Meera", "Alok", "Abhishek", "Jyoti"
];

const lastNames = [
  "Sharma", "Verma", "Gupta", "Mehta", "Joshi", "Patel", "Shah", "Reddy", "Nair", "Iyer",
  "Kumar", "Singh", "Mishra", "Pandey", "Sen", "Roy", "Das", "Choudhury", "Bose", "Rao",
  "Deshmukh", "Kulkarni", "Prasad", "Yadav", "Trivedi", "Banerjee", "Chatterjee", "Saxena", "Kapoor", "Malhotra"
];

const occupations = [
  { title: "Software Engineer", sector: "MNC", stability: 88 },
  { title: "Product Manager", sector: "MNC", stability: 85 },
  { title: "Senior Consultant", sector: "Professional Services", stability: 82 },
  { title: "Government Officer", sector: "Govt", stability: 96 },
  { title: "Public School Teacher", sector: "Govt", stability: 94 },
  { title: "Medical Practitioner", sector: "Healthcare", stability: 90 },
  { title: "Retail Store Owner", sector: "Business", stability: 65 },
  { title: "Chartered Accountant", sector: "Professional Services", stability: 89 },
  { title: "E-commerce Merchant", sector: "Business", stability: 60 },
  { title: "Civil Contractor", sector: "Business", stability: 55 },
  { title: "HR Manager", sector: "MNC", stability: 84 },
  { title: "Financial Analyst", sector: "MNC", stability: 87 }
];

const loanTypes = ["Home Loan", "Personal Loan", "Vehicle Loan", "Business Loan"];

// Generate 100 customer profiles
function generateCustomers() {
  const customers = [];

  for (let i = 1; i <= 100; i++) {
    const id = `IDBI${1000 + i}`;
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const fullName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    const age = getRandomInRange(23, 58);
    const occ = getRandomElement(occupations);
    
    // Financial range based on age and occupation
    let baseIncome = getRandomInRange(45000, 180000);
    if (occ.sector === "Business") {
      baseIncome = getRandomInRange(70000, 300000);
    } else if (occ.sector === "Govt") {
      baseIncome = getRandomInRange(50000, 140000);
    }
    if (age > 40) {
      baseIncome = Math.floor(baseIncome * 1.4);
    }

    const monthlyIncome = baseIncome;
    
    // Expenses (usually 35% to 60% of income)
    const expensePercentage = getRandomInRange(35, 60) / 100;
    const monthlyExpenses = Math.floor(monthlyIncome * expensePercentage);

    // Existing EMI (some have none, some have a substantial amount)
    const hasEMI = random() > 0.4;
    const existingEMI = hasEMI ? getRandomInRange(5000, Math.floor(monthlyIncome * 0.25)) : 0;

    // Credit score (between 580 and 830)
    const creditScore = getRandomInRange(580, 830);

    // Calculate stability: affected by occupation standard stability + credit score factor
    let incomeStabilityScore = Math.min(100, Math.max(30, occ.stability + getRandomInRange(-5, 5)));
    if (creditScore < 650) {
      incomeStabilityScore = Math.max(30, incomeStabilityScore - 10);
    }

    // Disposable Income = Income - Expenses - Existing EMI
    const disposableIncome = monthlyIncome - monthlyExpenses - existingEMI;

    // Repayment Capacity: based on disposable income & credit score multiplier
    const repaymentCapacity = Math.floor(Math.max(0, disposableIncome * 0.6) * (creditScore / 850));

    // Loan Intent inputs:
    const loanInquiriesLast90Days = getRandomInRange(0, 5);
    const bureauChecks = getRandomInRange(0, 4);
    const savingsDropAlert = random() > 0.6; // true if savings are declining
    const webCalculatorUseCount = getRandomInRange(0, 8);
    const competitorTransferInquiry = random() > 0.75;

    // Loan Intent Score calculation
    let intentScore = 15; // baseline
    intentScore += loanInquiriesLast90Days * 10;
    intentScore += bureauChecks * 8;
    if (savingsDropAlert) intentScore += 15;
    intentScore += webCalculatorUseCount * 4;
    if (competitorTransferInquiry) intentScore += 12;
    intentScore = Math.min(100, Math.max(10, intentScore + getRandomInRange(-5, 5)));

    // Normalize values to 0-100 scores for the Lead Score Formula
    const repaymentCapacityScore = Math.min(100, Math.floor((repaymentCapacity / Math.max(1, monthlyIncome * 0.4)) * 100));
    const creditScoreScore = Math.min(100, Math.floor(((creditScore - 500) / 330) * 100));

    // Lead Score = 40% Repayment Capacity + 30% Loan Intent + 20% Income Stability + 10% Credit Score
    const leadScore = Math.floor(
      0.40 * repaymentCapacityScore +
      0.30 * intentScore +
      0.20 * incomeStabilityScore +
      0.10 * creditScoreScore
    );

    // Status: Hot, Warm, Cold
    let status = "Cold";
    if (leadScore >= 75) {
      status = "Hot";
    } else if (leadScore >= 50) {
      status = "Warm";
    }

    // Fraud Risk Score (100 - creditScore/10 - stability/5 + random jitter)
    let fraudRiskScore = Math.max(3, Math.floor(100 - (creditScore / 8.5) - (incomeStabilityScore / 5) + getRandomInRange(-5, 5)));
    if (fraudRiskScore > 100) fraudRiskScore = 95;

    // Recommended Loan Selection
    let recommendedLoan = "Personal Loan";
    if (occ.sector === "Business") {
      recommendedLoan = "Business Loan";
    } else if (age >= 28 && monthlyIncome > 80000 && creditScore >= 700 && existingEMI < (monthlyIncome * 0.15)) {
      recommendedLoan = "Home Loan";
    } else if (age >= 24 && age <= 45 && random() > 0.5) {
      recommendedLoan = "Vehicle Loan";
    }

    // Risk Level (Low, Medium, High)
    let riskLevel = "Medium";
    if (creditScore >= 740 && incomeStabilityScore >= 80 && fraudRiskScore < 20) {
      riskLevel = "Low";
    } else if (creditScore < 630 || incomeStabilityScore < 60 || fraudRiskScore > 65) {
      riskLevel = "High";
    }

    // Suggested Loan Amount (usually 10x to 60x repayment capacity or income-based)
    let multiplier = 24;
    if (recommendedLoan === "Home Loan") multiplier = 60;
    if (recommendedLoan === "Vehicle Loan") multiplier = 18;
    if (recommendedLoan === "Business Loan") multiplier = 36;
    const suggestedLoanAmount = repaymentCapacity * multiplier;

    // Safe EMI Recommendation (conservative DSR)
    const safeEMI = Math.floor(repaymentCapacity * 0.85);

    // Dynamic AI Explanation components
    const positiveFactors = [];
    const negativeFactors = [];

    if (creditScore >= 750) positiveFactors.push("Excellent credit history");
    else if (creditScore < 650) negativeFactors.push("Below-average credit score");

    if (incomeStabilityScore >= 85) positiveFactors.push("High income stability (salaried/govt sector)");
    else if (incomeStabilityScore < 65) negativeFactors.push("Income fluctuations or business sector risks");

    if (disposableIncome > monthlyIncome * 0.4) positiveFactors.push("Strong monthly cash surplus");
    else negativeFactors.push("High living costs and low cash buffer");

    if (existingEMI > 0) {
      if (existingEMI > monthlyIncome * 0.2) negativeFactors.push("High existing debt burden (EMI)");
      else positiveFactors.push("Manageable existing EMIs");
    }

    if (intentScore >= 75) positiveFactors.push("High engagement and recent credit inquiries indicate immediate loan search");
    else if (intentScore < 40) negativeFactors.push("Low recent credit activity and online engagement");

    const explanation = `Customer demonstrates a lead score of ${leadScore}%. ${
      positiveFactors.length > 0 ? "Key strengths include: " + positiveFactors.join(", ") + "." : ""
    } ${
      negativeFactors.length > 0 ? "Risk monitors identify: " + negativeFactors.join(", ") + "." : ""
    } Recommended next action is to offer a custom ${recommendedLoan} up to ₹${suggestedLoanAmount.toLocaleString("en-IN")} at standard rates, with a monthly EMI structured below ₹${safeEMI.toLocaleString("en-IN")}.`;

    // Monthly data trends (6 months)
    const incomeTrend = [];
    const expenseTrend = [];
    for (let m = 0; m < 6; m++) {
      // Income fluctuation
      let fluc = 0;
      if (occ.sector === "Business") {
        fluc = getRandomInRange(-Math.floor(monthlyIncome * 0.2), Math.floor(monthlyIncome * 0.25));
      } else {
        fluc = getRandomInRange(-Math.floor(monthlyIncome * 0.02), Math.floor(monthlyIncome * 0.02));
      }
      incomeTrend.push(monthlyIncome + fluc);
      
      // Expense fluctuation
      const expFluc = getRandomInRange(-Math.floor(monthlyExpenses * 0.15), Math.floor(monthlyExpenses * 0.2));
      expenseTrend.push(monthlyExpenses + expFluc);
    }

    // Synthetic transaction log (recent 10 items)
    const transactionList = [
      { date: "2026-07-01", desc: "Salary / Business Inflow Credit", type: "Credit", category: "Income", amount: monthlyIncome },
      { date: "2026-07-02", desc: "House Rent / Mortgage Debit", type: "Debit", category: "Housing", amount: Math.floor(monthlyExpenses * 0.35) },
      { date: "2026-07-05", desc: "Tata Power Utility Bill Payment", type: "Debit", category: "Utilities", amount: getRandomInRange(1500, 4500) },
      { date: "2026-07-07", desc: "D-Mart Groceries Store Retail", type: "Debit", category: "Groceries", amount: getRandomInRange(3000, 9000) },
      { date: "2026-07-10", desc: "Amazon India Shopping Retail", type: "Debit", category: "Shopping", amount: getRandomInRange(2000, 15000) }
    ];

    if (existingEMI > 0) {
      transactionList.push({ date: "2026-07-03", desc: "HDFC Loan EMI Auto-Debit", type: "Debit", category: "Finance (EMI)", amount: existingEMI });
    }

    // Fill up to 10 transactions
    const categories = ["Food & Dining", "Travel & Fuel", "Medical Expenses", "Entertainment"];
    const descriptions = ["Zomato Food Delivery", "Indian Oil Fuel Station", "Apollo Pharmacy", "BookMyShow Movies", "Netflix Subscription", "Uber Ride"];
    while (transactionList.length < 10) {
      const idx = transactionList.length;
      const desc = getRandomElement(descriptions);
      const cat = getRandomElement(categories);
      const amt = getRandomInRange(500, 4000);
      transactionList.push({
        date: `2026-06-${getRandomInRange(10, 28)}`,
        desc: desc,
        type: "Debit",
        category: cat,
        amount: amt
      });
    }

    // Sort transactions by date descending
    transactionList.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Behavioral insights bullet points
    const behavioralInsights = [];
    if (savingsDropAlert) {
      behavioralInsights.push("High probability of liquid cash requirement due to drop in savings accounts balances.");
    } else {
      behavioralInsights.push("Steady capital accumulation observed over consecutive months.");
    }
    if (loanInquiriesLast90Days >= 3) {
      behavioralInsights.push(`Aggressive search behavior with ${loanInquiriesLast90Days} loan inquiries at external bureaus.`);
    }
    if (creditScore >= 760) {
      behavioralInsights.push("Flawless repayment pattern with no late charges in the last 24 months.");
    } else if (creditScore < 640) {
      behavioralInsights.push("Risk flag: Elevated credit usage spikes and multiple active short-term loan checks.");
    }
    if (existingEMI > monthlyIncome * 0.2) {
      behavioralInsights.push("Debt-to-Income ratio is approaching caution levels due to existing EMIs.");
    } else {
      behavioralInsights.push("Low debt obligation provides significant room for expansion.");
    }
    if (webCalculatorUseCount >= 4) {
      behavioralInsights.push(`Deep digital intent: Accessed mortgage/personal loan calculators ${webCalculatorUseCount} times this month.`);
    }

    customers.push({
      id,
      name: fullName,
      email,
      age,
      occupation: occ.title,
      sector: occ.sector,
      monthlyIncome,
      monthlyExpenses,
      existingEMI,
      disposableIncome,
      creditScore,
      incomeStabilityScore,
      repaymentCapacity,
      repaymentCapacityScore,
      intentScore,
      leadScore,
      recommendedLoan,
      riskLevel,
      status,
      fraudRiskScore,
      suggestedLoanAmount,
      safeEMI,
      explanation,
      incomeTrend,
      expenseTrend,
      transactions: transactionList,
      behavioralInsights,
      inquiries: loanInquiriesLast90Days,
      webUse: webCalculatorUseCount
    });
  }

  return customers;
}

// Export data to global window object
window.syntheticCustomers = generateCustomers();
console.log("Generated 100 synthetic customer records.");
