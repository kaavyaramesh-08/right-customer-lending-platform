import os
import sys
import json
import pickle
import pandas as pd
import numpy as np

# Set search path for dependencies
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error

from scripts.generate_data import generate_synthetic_data
from scripts import feature_engineering

def train_and_serialize_models():
    data_dir = os.path.join(BASE_DIR, "data")
    models_dir = os.path.join(BASE_DIR, "models")
    csv_path = os.path.join(data_dir, "raw_customers.csv")
    
    os.makedirs(models_dir, exist_ok=True)
    
    # 1. Generate data if not exists
    if not os.path.exists(csv_path):
        print("Dataset not found. Generating synthetic dataset...")
        generate_synthetic_data(csv_path, num_customers=150)
        
    df = pd.read_csv(csv_path)
    print(f"Loaded dataset with {len(df)} rows.")
    
    # 2. Extract features
    print("Engineering features...")
    X_list = []
    for idx, row in df.iterrows():
        X_list.append(feature_engineering.row_to_feature_vector(row.to_dict()))
        
    feature_names = feature_engineering.get_feature_names()
    X = pd.DataFrame(X_list, columns=feature_names)
    
    # Target columns
    y_intent = df["intent_score_gt"]
    y_income = df["income_score_gt"]
    y_repayment = df["repayment_score_gt"]
    
    # ----------------------------------------------------
    # MODEL 1: Intent Regressor
    # ----------------------------------------------------
    print("\n--- Training Intent Score Regressor ---")
    X_train, X_test, y_train, y_test = train_test_split(X, y_intent, test_size=0.2, random_state=42)
    
    intent_model = XGBRegressor(
        n_estimators=80,
        max_depth=3,
        learning_rate=0.1,
        random_state=42
    )
    intent_model.fit(X_train, y_train)
    
    intent_preds = intent_model.predict(X_test)
    intent_r2 = r2_score(y_test, intent_preds)
    intent_rmse = np.sqrt(mean_squared_error(y_test, intent_preds))
    print(f"Intent Regressor R2: {intent_r2:.4f}, RMSE: {intent_rmse:.2f}")
    
    intent_importances = dict(zip(feature_names, [float(x) for x in intent_model.feature_importances_]))
    
    # ----------------------------------------------------
    # MODEL 2: Income Stability Regressor
    # ----------------------------------------------------
    print("\n--- Training Income Stability Regressor ---")
    X_train_inc, X_test_inc, y_train_inc, y_test_inc = train_test_split(X, y_income, test_size=0.2, random_state=42)
    
    income_model = XGBRegressor(
        n_estimators=80,
        max_depth=3,
        learning_rate=0.1,
        random_state=42
    )
    income_model.fit(X_train_inc, y_train_inc)
    
    income_preds = income_model.predict(X_test_inc)
    inc_r2 = r2_score(y_test_inc, income_preds)
    inc_rmse = np.sqrt(mean_squared_error(y_test_inc, income_preds))
    print(f"Income Regressor R2: {inc_r2:.4f}, RMSE: {inc_rmse:.2f}")
    
    income_importances = dict(zip(feature_names, [float(x) for x in income_model.feature_importances_]))
    
    # ----------------------------------------------------
    # MODEL 3: Repayment Capacity Regressor
    # ----------------------------------------------------
    print("\n--- Training Repayment Capacity Regressor ---")
    X_train_rep, X_test_rep, y_train_rep, y_test_rep = train_test_split(X, y_repayment, test_size=0.2, random_state=42)
    
    repayment_model = XGBRegressor(
        n_estimators=80,
        max_depth=3,
        learning_rate=0.1,
        random_state=42
    )
    repayment_model.fit(X_train_rep, y_train_rep)
    
    repayment_preds = repayment_model.predict(X_test_rep)
    rep_r2 = r2_score(y_test_rep, repayment_preds)
    rep_rmse = np.sqrt(mean_squared_error(y_test_rep, repayment_preds))
    print(f"Repayment Regressor R2: {rep_r2:.4f}, RMSE: {rep_rmse:.2f}")
    
    repayment_importances = dict(zip(feature_names, [float(x) for x in repayment_model.feature_importances_]))
    
    # ----------------------------------------------------
    # Serialize Models
    # ----------------------------------------------------
    print("\nSerializing trained models...")
    
    models = {
        "intent_model": {
            "model": intent_model,
            "importances": intent_importances,
            "metrics": {"r2": float(intent_r2), "rmse": float(intent_rmse)}
        },
        "income_model": {
            "model": income_model,
            "importances": income_importances,
            "metrics": {"r2": float(inc_r2), "rmse": float(inc_rmse)}
        },
        "repayment_model": {
            "model": repayment_model,
            "importances": repayment_importances,
            "metrics": {"r2": float(rep_r2), "rmse": float(rep_rmse)}
        }
    }
    
    for model_name, model_pkg in models.items():
        pkl_path = os.path.join(models_dir, f"{model_name}.pkl")
        with open(pkl_path, "wb") as f_out:
            pickle.dump(model_pkg, f_out)
        print(f"Saved model package: {pkl_path}")
        
    # Save a metadata JSON for easier visualization and loading in API
    metadata = {
        "features": feature_names,
        "metrics": {
            "intent_model": {"r2": float(intent_r2), "rmse": float(intent_rmse)},
            "income_model": {"r2": float(inc_r2), "rmse": float(inc_rmse)},
            "repayment_model": {"r2": float(rep_r2), "rmse": float(rep_rmse)}
        },
        "importances": {
            "intent_model": intent_importances,
            "income_model": income_importances,
            "repayment_model": repayment_importances
        }
    }
    
    metadata_path = os.path.join(models_dir, "models_metadata.json")
    with open(metadata_path, "w") as f_meta:
        json.dump(metadata, f_meta, indent=2)
    print(f"Saved metadata: {metadata_path}")
    
    print("\nModel training pipeline completed successfully!")
    
    return {
        "intent_r2": float(intent_r2),
        "intent_rmse": float(intent_rmse),
        "income_r2": float(inc_r2),
        "income_rmse": float(inc_rmse),
        "repayment_r2": float(rep_r2),
        "repayment_rmse": float(rep_rmse),
    }

if __name__ == "__main__":
    train_and_serialize_models()
