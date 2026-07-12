import os
import sys
import pickle
import json
import numpy as np
from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

# Add current project root to PYTHONPATH
sys.path.append("C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform")

from backend.database import get_db, init_db_and_seed, Customer, engine, Base
from backend.schemas import (
    PredictionRequest, CustomerLeadResponse, ChatbotRequest, ChatbotResponse
)
from backend.chatbot import generate_chatbot_response
from scripts import feature_engineering
from scripts import train_models

# Load env vars
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(
    title="Right Customer, Right Loan, Right Time - Lending Intelligence Platform",
    description="FastAPI Backend powered by trained ML models for the IDBI Innovate 2026 Hackathon",
    version="2.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = "C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform\\models"
CONFIG_PATH = "C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform\\backend\\config.json"

# Global dict to store models
ml_models = {}

def load_weights() -> dict:
    """Loads weights from config.json, falling back to defaults if not found."""
    default_weights = {"intent": 0.35, "repayment": 0.35, "income": 0.30}
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                data = json.load(f)
                return data.get("weights", default_weights)
        except Exception as e:
            print(f"Error loading weights config: {e}")
            return default_weights
    return default_weights

def load_ml_models():
    """Loads serialised ML models into memory."""
    global ml_models
    model_files = {
        "intent_model": "intent_model.pkl",
        "income_model": "income_model.pkl",
        "repayment_model": "repayment_model.pkl"
    }
    
    print("Loading models from pickle files...")
    for model_key, filename in model_files.items():
        file_path = os.path.join(MODELS_DIR, filename)
        if not os.path.exists(file_path):
            print(f"Warning: Model file {filename} not found. Did you run scripts/train_models.py?")
            continue
            
        try:
            with open(file_path, "rb") as f:
                ml_models[model_key] = pickle.load(f)
            print(f"Successfully loaded model: {model_key}")
        except Exception as e:
            print(f"Error loading model {model_key}: {e}")

@app.on_event("startup")
def startup_event():
    # Force drop and re-seed to align columns
    print("Dropping tables and re-seeding database for clean hackathon workspace...")
    try:
        Base.metadata.drop_all(bind=engine)
    except Exception as e:
        print(f"Error dropping tables: {e}")
    init_db_and_seed()
    
    # Load Models
    load_ml_models()

def run_predictions_on_row(row_dict: dict) -> dict:
    """
    Runs all 3 ML models on a customer's raw data and returns scores, 
    recommendations, and feature contributions.
    """
    # Extract features
    features = feature_engineering.extract_features(row_dict)
    feature_vector = [features[name] for name in feature_engineering.get_feature_names()]
    X = [feature_vector]
    
    # Defaults in case models aren't loaded
    intent_score = 50.0
    income_score = 50.0
    repayment_score = 50.0
    
    # 1. Predict Intent Score
    if "intent_model" in ml_models:
        model = ml_models["intent_model"]["model"]
        intent_score = float(model.predict(X)[0])
        
    # 2. Predict Income Score
    if "income_model" in ml_models:
        model = ml_models["income_model"]["model"]
        income_score = float(model.predict(X)[0])
        
    # 3. Predict Repayment capacity Score
    if "repayment_model" in ml_models:
        model = ml_models["repayment_model"]["model"]
        repayment_score = float(model.predict(X)[0])
        
    # Bound scores to [0, 100]
    intent_score = max(0.0, min(100.0, intent_score))
    income_score = max(0.0, min(100.0, income_score))
    repayment_score = max(0.0, min(100.0, repayment_score))
    
    # 4. Calculate Lead Score (weighted average)
    weights = load_weights()
    lead_score = (
        weights.get("intent", 0.35) * intent_score +
        weights.get("repayment", 0.35) * repayment_score +
        weights.get("income", 0.30) * income_score
    )
    lead_score = max(0.0, min(100.0, lead_score))
    
    # Smart Loan Recommendation engine
    pref_loan = str(row_dict.get("preferred_loan_type", "none")).lower()
    credit_score = int(row_dict.get("credit_score", 700))
    monthly_credits = float(row_dict.get("monthly_credits", 50000.0))
    age = int(row_dict.get("age", 35))
    occ_type = str(row_dict.get("occupation_type", "Salaried"))
    
    # recommendation rule
    recommended_product = "Personal Loan" # Default
    if intent_score >= 40 and pref_loan != "none":
        loan_mapping = {
            "home": "Home Loan",
            "auto": "Auto Loan",
            "personal": "Personal Loan",
            "gold": "Gold Loan",
            "education": "Education Loan"
        }
        recommended_product = loan_mapping.get(pref_loan, "Personal Loan")
    else:
        # Fallback profile rules
        if age <= 26 and occ_type == "Student":
            recommended_product = "Education Loan"
        elif credit_score < 560:
            recommended_product = "Gold Loan" # Asset collateralized, easier approval
        elif credit_score >= 650 and monthly_credits >= 60000 and age >= 28:
            recommended_product = "Home Loan"
        elif monthly_credits >= 35000 and age <= 45:
            recommended_product = "Auto Loan"
            
    # Calculate feature contributions (SHAP-style proxy)
    # Contribution = feature_val * feature_importance
    feature_contributions = {}
    for model_key in ["intent_model", "income_model", "repayment_model"]:
        model_name = model_key.split("_")[0] # "intent", "income", "repayment"
        feature_contributions[model_name] = {}
        
        importances = ml_models.get(model_key, {}).get("importances", {})
        for feat_name, importance in importances.items():
            val = features.get(feat_name, 0.0)
            
            # Normalize to show positive/negative directions
            # Standardize feature values to -1 to +1 range for comparison
            # For simplicity: sign matches direction, magnitude matches importance
            # Skew intent features to show positive impact for visits
            if model_name == "intent" and feat_name in ["loan_app_visits", "emi_calculator_uses"]:
                direction = 1.0 if val > 2.0 else -0.5
            elif model_name == "income" and feat_name in ["monthly_credits", "avg_balance", "salary_credit_flag"]:
                direction = 1.0 if val > 20000 or (feat_name == "salary_credit_flag" and val == 1.0) else -0.5
            elif model_name == "repayment" and feat_name == "existing_emis":
                direction = -1.0 if val > 0.0 else 0.5
            elif model_name == "repayment" and feat_name == "credit_score":
                direction = 1.0 if val >= 680 else -1.0
            else:
                direction = 1.0 if val > 0.0 else -1.0
                
            contrib = float(importance * direction * 100.0)
            feature_contributions[model_name][feat_name] = contrib
            
        # Keep only top 4 contributions by absolute impact
        sorted_contrib = dict(
            sorted(feature_contributions[model_name].items(), key=lambda item: abs(item[1]), reverse=True)[:4]
        )
        feature_contributions[model_name] = sorted_contrib
        
    return {
        "intent_score": intent_score,
        "income_score": income_score,
        "repayment_score": repayment_score,
        "lead_score": lead_score,
        "recommended_product": recommended_product,
        "feature_contributions": feature_contributions,
        "features": features
    }

@app.get("/api/status")
def read_status():
    weights = load_weights()
    return {
        "status": "online",
        "message": "IDBI Bank - Smart Lending Intelligence Platform REST API is running.",
        "loaded_models": list(ml_models.keys()),
        "weights_config": weights,
        "gemini_api": "configured" if os.getenv("GEMINI_API_KEY") else "missing"
    }

@app.get("/api/leads", response_model=List[CustomerLeadResponse])
@app.get("/customers/leads", response_model=List[CustomerLeadResponse])
def get_customer_leads(sort: str = "lead_score", db: Session = Depends(get_db)):
    customers = db.query(Customer).all()
    leads = []
    
    for c in customers:
        row_dict = {
            "age": c.age,
            "occupation_type": c.occupation_type,
            "monthly_credits": c.monthly_credits,
            "monthly_debits": c.monthly_debits,
            "salary_credit_flag": c.salary_credit_flag,
            "num_income_sources": c.num_income_sources,
            "existing_emis": c.existing_emis,
            "avg_balance": c.avg_balance,
            "txn_frequency": c.txn_frequency,
            "loan_app_visits": c.loan_app_visits,
            "emi_calculator_uses": c.emi_calculator_uses,
            "credit_score": c.credit_score,
            "existing_loans": c.existing_loans,
            "preferred_loan_type": c.preferred_loan_type
        }
        
        preds = run_predictions_on_row(row_dict)
        
        leads.append(
            CustomerLeadResponse(
                customer_id=c.customer_id,
                name=c.name,
                age=c.age,
                occupation_type=c.occupation_type,
                monthly_credits=c.monthly_credits,
                monthly_debits=c.monthly_debits,
                salary_credit_flag=c.salary_credit_flag,
                num_income_sources=c.num_income_sources,
                existing_emis=c.existing_emis,
                avg_balance=c.avg_balance,
                txn_frequency=c.txn_frequency,
                loan_app_visits=c.loan_app_visits,
                emi_calculator_uses=c.emi_calculator_uses,
                credit_score=c.credit_score,
                existing_loans=c.existing_loans,
                preferred_loan_type=c.preferred_loan_type,
                intent_score=preds["intent_score"],
                income_score=preds["income_score"],
                repayment_score=preds["repayment_score"],
                lead_score=preds["lead_score"],
                recommended_product=preds["recommended_product"],
                feature_contributions=preds["feature_contributions"]
            )
        )
        
    # Sort leads
    if sort == "lead_score":
        leads.sort(key=lambda l: l.lead_score, reverse=True)
    elif sort == "intent_score":
        leads.sort(key=lambda l: l.intent_score, reverse=True)
    elif sort == "income_score":
        leads.sort(key=lambda l: l.income_score, reverse=True)
    elif sort == "repayment_score":
        leads.sort(key=lambda l: l.repayment_score, reverse=True)
        
    return leads

@app.get("/api/score/{customer_id}")
def get_customer_score(customer_id: str, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    row_dict = {
        "age": customer.age,
        "occupation_type": customer.occupation_type,
        "monthly_credits": customer.monthly_credits,
        "monthly_debits": customer.monthly_debits,
        "salary_credit_flag": customer.salary_credit_flag,
        "num_income_sources": customer.num_income_sources,
        "existing_emis": customer.existing_emis,
        "avg_balance": customer.avg_balance,
        "txn_frequency": customer.txn_frequency,
        "loan_app_visits": customer.loan_app_visits,
        "emi_calculator_uses": customer.emi_calculator_uses,
        "credit_score": customer.credit_score,
        "existing_loans": customer.existing_loans,
        "preferred_loan_type": customer.preferred_loan_type
    }
    
    preds = run_predictions_on_row(row_dict)
    
    # Calculate some helper percentages and explanations for judge display
    disposable_income = customer.monthly_credits - customer.monthly_debits - customer.existing_emis
    spend_to_income = (customer.monthly_debits / max(1.0, customer.monthly_credits)) * 100.0
    emi_to_income = (customer.existing_emis / max(1.0, customer.monthly_credits)) * 100.0
    
    return {
        "customer": row_dict,
        "name": customer.name,
        "customer_id": customer.customer_id,
        "scores": {
            "intent": preds["intent_score"],
            "income": preds["income_score"],
            "repayment": preds["repayment_score"],
            "lead": preds["lead_score"]
        },
        "recommendation": {
            "product": preds["recommended_product"],
            "reasoning": f"Grounded recommendation based on Intent ({preds['intent_score']:.0f}/100) and Repayment capacity ({preds['repayment_score']:.0f}/100). Customer displays preferred interest in '{customer.preferred_loan_type}'."
        },
        "explainability": {
            "contributions": preds["feature_contributions"]
        },
        "financial_metrics": {
            "disposable_income": disposable_income,
            "spend_to_income_ratio": spend_to_income,
            "emi_to_income_ratio": emi_to_income
        }
    }

@app.post("/api/chatbot/query", response_model=ChatbotResponse)
@app.post("/chatbot/ask", response_model=ChatbotResponse)
def ask_chatbot(request: ChatbotRequest, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == request.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    row_dict = {
        "customer_id": customer.customer_id,
        "name": customer.name,
        "age": customer.age,
        "occupation_type": customer.occupation_type,
        "monthly_credits": customer.monthly_credits,
        "monthly_debits": customer.monthly_debits,
        "salary_credit_flag": customer.salary_credit_flag,
        "num_income_sources": customer.num_income_sources,
        "existing_emis": customer.existing_emis,
        "avg_balance": customer.avg_balance,
        "txn_frequency": customer.txn_frequency,
        "loan_app_visits": customer.loan_app_visits,
        "emi_calculator_uses": customer.emi_calculator_uses,
        "credit_score": customer.credit_score,
        "existing_loans": customer.existing_loans,
        "preferred_loan_type": customer.preferred_loan_type
    }
    
    preds = run_predictions_on_row(row_dict)
    
    # Query chatbot
    answer = generate_chatbot_response(row_dict, preds, request.question)
    return ChatbotResponse(answer=answer)

@app.post("/api/train")
def train_endpoint():
    """Triggers the training script to re-fit models and reload them in-memory."""
    try:
        metrics = train_models.train_and_serialize_models()
        # Reload models in memory
        load_ml_models()
        return {
            "status": "success",
            "message": "Models successfully re-trained and reloaded.",
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

# Serve Static files for React (if built)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

DIST_DIR = "C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform\\frontend\\dist"
FRONTEND_DIR = "C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform\\frontend"

if os.path.exists(os.path.join(DIST_DIR, "index.html")):
    print("Serving compiled production React app from frontend/dist...")
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")
    @app.get("/")
    def serve_dist_index():
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
    @app.get("/{catchall:path}")
    def serve_dist_catchall(catchall: str):
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
else:
    print("Production build not found. Serving static frontend assets folder...")
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
    @app.get("/")
    def serve_raw_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
