OCCUPATION_MAP = {
    "Salaried": 0,
    "Self-Employed": 1,
    "Business": 2,
    "Professional": 3,
    "Student": 4,
    "Retired": 5
}

LOAN_TYPE_MAP = {
    "home": 0,
    "auto": 1,
    "personal": 2,
    "gold": 3,
    "education": 4,
    "none": 5
}

# Fix ordering of features for training and inference
FEATURE_ORDER = [
    "age",
    "monthly_credits",
    "monthly_debits",
    "salary_credit_flag",
    "num_income_sources",
    "existing_emis",
    "avg_balance",
    "txn_frequency",
    "loan_app_visits",
    "emi_calculator_uses",
    "credit_score",
    "existing_loans",
    "occupation_type_code",
    "preferred_loan_type_code"
]

def extract_features(row):
    """
    row: dictionary or sqlite object representing customer data.
    Extracts and maps raw database columns into model-ready features.
    """
    # If row is a SQLAlchemy object, convert to dict first
    if hasattr(row, '__dict__'):
        row_dict = {col: getattr(row, col) for col in row.__table__.columns.keys()}
    else:
        row_dict = dict(row)
        
    features = {}
    
    features["age"] = float(row_dict.get("age", 35))
    features["monthly_credits"] = float(row_dict.get("monthly_credits", 50000.0))
    features["monthly_debits"] = float(row_dict.get("monthly_debits", 35000.0))
    features["salary_credit_flag"] = float(row_dict.get("salary_credit_flag", 1))
    features["num_income_sources"] = float(row_dict.get("num_income_sources", 1))
    features["existing_emis"] = float(row_dict.get("existing_emis", 0.0))
    features["avg_balance"] = float(row_dict.get("avg_balance", 25000.0))
    features["txn_frequency"] = float(row_dict.get("txn_frequency", 30))
    features["loan_app_visits"] = float(row_dict.get("loan_app_visits", 0))
    features["emi_calculator_uses"] = float(row_dict.get("emi_calculator_uses", 0))
    features["credit_score"] = float(row_dict.get("credit_score", 700))
    features["existing_loans"] = float(row_dict.get("existing_loans", 0))
    
    # Categorical encoders
    occ_str = str(row_dict.get("occupation_type", "Salaried"))
    features["occupation_type_code"] = float(OCCUPATION_MAP.get(occ_str, 0))
    
    loan_str = str(row_dict.get("preferred_loan_type", "none")).lower()
    features["preferred_loan_type_code"] = float(LOAN_TYPE_MAP.get(loan_str, 5))
    
    return features

def get_feature_names():
    return FEATURE_ORDER

def row_to_feature_vector(row):
    features = extract_features(row)
    return [features[name] for name in FEATURE_ORDER]
