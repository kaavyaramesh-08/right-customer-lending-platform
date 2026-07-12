import os
import csv
import json
import random

def generate_synthetic_data(output_path, num_customers=150):
    # Set seed for reproducibility
    random.seed(2026)
    
    first_names = [
        "Aarav", "Aditya", "Amit", "Ananya", "Arjun", "Deepak", "Divya", "Gaurav", "Harish", "Ishaan",
        "Karan", "Kavita", "Manish", "Neha", "Nikhil", "Pooja", "Pranav", "Rahul", "Rohan", "Sanjay",
        "Shreya", "Siddharth", "Sneha", "Sunita", "Tarun", "Varun", "Vijay", "Vikram", "Yash", "Zoya",
        "Rajesh", "Priya", "Anjali", "Suresh", "Ramesh", "Kiran", "Meera", "Alok", "Abhishek", "Jyoti"
    ]
    
    last_names = [
        "Sharma", "Verma", "Gupta", "Mehta", "Joshi", "Patel", "Shah", "Reddy", "Nair", "Iyer",
        "Kumar", "Singh", "Mishra", "Pandey", "Sen", "Roy", "Das", "Choudhury", "Bose", "Rao",
        "Deshmukh", "Kulkarni", "Prasad", "Yadav", "Trivedi", "Banerjee", "Chatterjee", "Saxena", "Kapoor", "Malhotra"
    ]
    
    occupations = [
        {"type": "Salaried", "titles": ["Software Engineer", "HR Specialist", "Product Manager", "Govt Officer", "School Teacher"]},
        {"type": "Self-Employed", "titles": ["E-commerce Merchant", "Retailer", "Freelancer", "Consultant"]},
        {"type": "Business", "titles": ["Manufacturer", "Civil Contractor", "Distributor", "Hotelier"]},
        {"type": "Professional", "titles": ["Doctor", "Chartered Accountant", "Lawyer", "Architect"]},
        {"type": "Student", "titles": ["Graduate Student", "PhD Scholar"]},
        {"type": "Retired", "titles": ["Retired Bank Manager", "Pensioner"]}
    ]
    
    loan_types = ["home", "auto", "personal", "gold", "education", "none"]
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "customer_id", "name", "age", "occupation_type", "monthly_credits",
            "monthly_debits", "salary_credit_flag", "num_income_sources",
            "existing_emis", "avg_balance", "txn_frequency", "loan_app_visits",
            "emi_calculator_uses", "credit_score", "existing_loans", "preferred_loan_type",
            "intent_score_gt", "income_score_gt", "repayment_score_gt"
        ])
        
        for i in range(1, num_customers + 1):
            customer_id = f"IDBI{1000 + i}"
            name = f"{random.choice(first_names)} {random.choice(last_names)}"
            
            # Occupation and Age correlations
            occ_choice = random.choices(
                occupations, 
                weights=[0.35, 0.20, 0.15, 0.15, 0.08, 0.07], 
                k=1
            )[0]
            occ_type = occ_choice["type"]
            
            if occ_type == "Student":
                age = random.randint(18, 25)
            elif occ_type == "Retired":
                age = random.randint(60, 75)
            else:
                age = random.randint(22, 58)
                
            # Base salary credits based on occupation type
            if occ_type == "Salaried":
                monthly_credits = random.randint(30000, 180000)
                salary_credit_flag = 1
                num_income_sources = 1 if random.random() < 0.85 else 2
            elif occ_type == "Professional":
                monthly_credits = random.randint(60000, 250000)
                salary_credit_flag = random.choice([0, 1])
                num_income_sources = random.randint(1, 2)
            elif occ_type == "Business":
                monthly_credits = random.randint(80000, 300000)
                salary_credit_flag = 0
                num_income_sources = random.randint(2, 4)
            elif occ_type == "Self-Employed":
                monthly_credits = random.randint(25000, 100000)
                salary_credit_flag = 0
                num_income_sources = random.randint(1, 3)
            elif occ_type == "Student":
                monthly_credits = random.randint(5000, 20000)
                salary_credit_flag = 0
                num_income_sources = 1
            else: # Retired
                monthly_credits = random.randint(20000, 70000)
                salary_credit_flag = 0
                num_income_sources = 1 if random.random() < 0.70 else 2
                
            # Spend (monthly_debits) must normally be less than monthly_credits
            spend_ratio = random.uniform(0.5, 0.9)
            if occ_type == "Student":
                spend_ratio = random.uniform(0.8, 0.98)
            monthly_debits = int(monthly_credits * spend_ratio)
            
            # Existing loans and EMIs
            existing_loans = random.choices([0, 1, 2, 3], weights=[0.55, 0.30, 0.12, 0.03], k=1)[0]
            existing_emis = 0
            if existing_loans > 0:
                # Existing EMI cannot exceed 40% of income safely
                existing_emis = int(monthly_credits * random.uniform(0.1, 0.35) * (existing_loans / 2.0))
            
            # Avg Balance
            avg_balance = int(monthly_credits * random.uniform(0.3, 4.0))
            if occ_type in ["Business", "Retired"]:
                avg_balance = int(monthly_credits * random.uniform(1.5, 8.0))
                
            # Transaction Frequency
            txn_frequency = random.randint(15, 110)
            if occ_type in ["Business", "Self-Employed"]:
                txn_frequency = random.randint(40, 150)
            elif occ_type == "Retired":
                txn_frequency = random.randint(8, 40)
                
            # Intent Features (Behavioral)
            # High intent customers will have high values here
            preferred_loan_type = random.choice(loan_types)
            
            # Student prefers education or none
            if occ_type == "Student":
                preferred_loan_type = random.choice(["education", "none", "personal"])
            # Retired prefers gold, home (reverse mortgage), or none
            elif occ_type == "Retired":
                preferred_loan_type = random.choice(["gold", "none", "personal"])
                
            if preferred_loan_type == "none":
                loan_app_visits = random.randint(0, 3)
                emi_calculator_uses = random.randint(0, 2)
            else:
                loan_app_visits = random.randint(4, 25)
                emi_calculator_uses = random.randint(3, 15)
                
            # Credit Score
            if occ_type == "Student":
                credit_score = random.randint(300, 650) # thin file
            else:
                # Skewed towards good scores, but some poor scores for demo
                credit_score = random.choices(
                    [random.randint(700, 850), random.randint(600, 699), random.randint(300, 599)],
                    weights=[0.60, 0.25, 0.15],
                    k=1
                )[0]
                
            # --- Ground Truth Score Calculations ---
            
            # 1. Intent Score (0-100)
            intent_noise = random.uniform(-5.0, 5.0)
            intent_base = (loan_app_visits * 3.2) + (emi_calculator_uses * 4.5)
            if preferred_loan_type != "none":
                intent_base += 25.0
            else:
                intent_base += 5.0
            
            # existing loans reduces intent slightly (market fatigue)
            intent_base -= existing_loans * 2.5
            intent_score_gt = float(round(max(0.0, min(100.0, intent_base + intent_noise)), 2))
            
            # 2. Income Score (0-100)
            income_noise = random.uniform(-4.0, 4.0)
            # Level aspect
            level_score = (monthly_credits / 250000.0) * 45.0
            # Stability aspect
            stability_score = salary_credit_flag * 30.0 + (num_income_sources - 1) * 8.0
            # Balance buffer aspect
            balance_factor = min(15.0, (avg_balance / 200000.0) * 15.0)
            
            income_score_gt = float(round(max(0.0, min(100.0, level_score + stability_score + balance_factor + income_noise)), 2))
            
            # 3. Repayment Capacity Score (0-100)
            repayment_noise = random.uniform(-3.0, 3.0)
            # Credit Score component (40%)
            cs_comp = ((credit_score - 300) / 550.0) * 40.0
            # Debt-to-income component (35%)
            dti = existing_emis / max(1.0, monthly_credits)
            dti_comp = max(0.0, (1.0 - dti) * 35.0)
            # Spend-to-income component (15%)
            sti = monthly_debits / max(1.0, monthly_credits)
            sti_comp = max(0.0, (1.0 - sti) * 15.0)
            # Balance-to-income component (10%)
            bal_ratio = avg_balance / max(1.0, monthly_credits)
            bal_comp = min(10.0, bal_ratio * 3.5)
            
            repayment_score_gt = float(round(max(0.0, min(100.0, cs_comp + dti_comp + sti_comp + bal_comp + repayment_noise)), 2))
            
            writer.writerow([
                customer_id, name, age, occ_type, monthly_credits,
                monthly_debits, salary_credit_flag, num_income_sources,
                existing_emis, avg_balance, txn_frequency, loan_app_visits,
                emi_calculator_uses, credit_score, existing_loans, preferred_loan_type,
                intent_score_gt, income_score_gt, repayment_score_gt
            ])
            
    print(f"Generated data for {num_customers} customers written to {output_path}.")

if __name__ == "__main__":
    generate_synthetic_data(
        "C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform\\data\\raw_customers.csv",
        num_customers=150
    )
