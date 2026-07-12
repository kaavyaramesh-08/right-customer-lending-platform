# Right Customer, Right Loan, Right Time
### IDBI Bank - Smart Lending Intelligence Platform (Innovate 2026 Hackathon)

This repository contains the complete end-to-end prototype of the **Smart Lending Intelligence Platform**. The platform leverages trained Machine Learning models (not static rules) to estimate credit risk, true income, repayment capacity, and lending intent from raw transaction logs. It also incorporates a personalized LLM chatbot grounded in real-time model outputs.

---

## Tech Stack & Architecture

1. **Backend**: FastAPI (Python) exposing REST API endpoints for scoring, recommendations, and chatbot queries.
2. **Database**: SQLite with SQLAlchemy ORM. The generated synthetic dataset is seeded automatically at FastAPI startup.
3. **Machine Learning Layer (XGBoost Regressors)**:
   - **Intent Model**: XGBoost Regressor predicting 0-100 likelihood of loan interest from behavioral patterns (loan app visits, EMI calculator uses, active loans).
   - **Income Model**: XGBoost Regressor estimating 0-100 income stability from credits, salary credit flag, and deposit velocity.
   - **Repayment Model**: XGBoost Regressor predicting 0-100 repayment capacity from CIBIL score, DTI, expenses-to-income, and balance reserves.
   - **Lead Prioritization Score**: Configurable weighted average of the above three scores (default: 35% Intent + 35% Repayment + 30% Income).
4. **Explainability**: Outputs global feature importances and customer-specific feature contributions (SHAP-style) for audit verification.
5. **Frontend**: A high-fidelity, responsive desktop dashboard built in React + Tailwind CSS, served directly by FastAPI via Babel standalone (zero Node/npm install dependencies needed, completely self-contained for easy hackathon judging!).
6. **Chatbot**: Powered by Gemini API, grounded dynamically in customer data, predictions, and SHAP drivers.

---

## Folder Structure

```
right-customer-lending-platform/
├── .env                       # Local environment file (API Keys)
├── .env.example               # Template environment configuration
├── .gitignore                 # Git ignore file
├── README.md                  # This documentation
├── requirements.txt           # Python backend dependencies
├── lending_platform.db        # SQLite database (generated on start)
├── data/
│   └── raw_customers.csv      # Seeded synthetic dataset (150 customers)
├── models/                    # Serialized .pkl models and json metadata
│   ├── intent_model.pkl
│   ├── income_model.pkl
│   ├── repayment_model.pkl
│   └── models_metadata.json
├── scripts/
│   ├── generate_data.py       # Synthesizes 150 customer profiles with 14 columns
│   ├── feature_engineering.py # Shared feature mapping pipeline
│   └── train_models.py        # Fits, evaluates, and serializes the 3 XGBoost models
├── backend/
│   ├── app.py                 # Main FastAPI router and static assets server
│   ├── database.py            # SQLite database schema, connections, and seeder
│   ├── schemas.py             # Pydantic schemas for REST contracts
│   ├── config.json            # Configurable weights for lead score
│   └── chatbot.py             # Service calling Gemini API grounded in predictions
└── frontend/                  # Static SPA assets served by FastAPI
    ├── index.html             # React + Tailwind standalone app (Babel)
    ├── src/                   # React source files (Vite-ready)
    │   ├── App.jsx            
    │   ├── main.jsx
    │   └── index.css
    ├── tailwind.config.js     
    └── vite.config.js
```

---

## Setup & Running Guide

### 1. Install Backend Dependencies
Ensure Python 3.10+ is installed. Install packages:
```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file in the root folder and add your Gemini API key:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If the key is missing at startup, the backend logs a warning and the chatbot operates in Demo-Fallback mode, ensuring the dashboard remains fully testable.)*

### 3. Generate Data & Train Models
Run the training pipeline script. This will automatically synthesize 150 customer profiles and train the 3 XGBoost ML scoring models:
```bash
python scripts/generate_data.py
python scripts/train_models.py
```
*Output files will be saved in `data/` and `models/` folders.*

### 4. Start the Application Server
Run the FastAPI development server:
```bash
python -m uvicorn backend.app:app --port 8000
```

### 5. Access the Platform Dashboard
Open your browser and navigate to:
**[http://localhost:8000/](http://localhost:8000/)**

Log in using the pre-configured credentials:
* **Email**: `admin@idbibank.co.in`
* **Password**: `password` (Click the **Access Workspace** button)

---

## Machine Learning & Feature Engineering Details

The platform uses real trained models that learn from transaction and behavioral features:
- **Intent**: Learns correlations from app activity, calculator hits, and stated preferences.
- **Income**: Estimates stability by mapping credits, deposit volatility, and salary indicators.
- **Repayment**: Maps CIBIL score, debt obligations (EMIs), and monthly spend ratios to evaluate safety margins.
- **SHAP Auditing**: Renders custom local feature weights per customer to explain how their specific transaction pattern drove their scores.
