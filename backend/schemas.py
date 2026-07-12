from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class PredictionRequest(BaseModel):
    age: float
    monthly_credits: float
    monthly_debits: float
    salary_credit_flag: int
    num_income_sources: int
    existing_emis: float
    avg_balance: float
    txn_frequency: int
    loan_app_visits: int
    emi_calculator_uses: int
    credit_score: int
    existing_loans: int
    occupation_type: str
    preferred_loan_type: str

class CustomerLeadResponse(BaseModel):
    customer_id: str
    name: str
    age: int
    occupation_type: str
    monthly_credits: float
    monthly_debits: float
    salary_credit_flag: int
    num_income_sources: int
    existing_emis: float
    avg_balance: float
    txn_frequency: int
    loan_app_visits: int
    emi_calculator_uses: int
    credit_score: int
    existing_loans: int
    preferred_loan_type: str
    
    # Model derived scores (0-100)
    intent_score: float
    income_score: float
    repayment_score: float
    lead_score: float
    
    # Recommendations
    recommended_product: str
    
    # SHAP feature contributions for each of the three models
    # Structure: {"intent": {"loan_app_visits": 12.5, ...}, "income": {...}, "repayment": {...}}
    feature_contributions: Dict[str, Dict[str, float]]

class ChatbotRequest(BaseModel):
    customer_id: str
    question: str

class ChatbotResponse(BaseModel):
    answer: str
