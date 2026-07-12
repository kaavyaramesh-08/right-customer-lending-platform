import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add project path to python path
sys.path.append("C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform")

from backend.app import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_api_status(client):
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "intent_model" in data["loaded_models"]
    assert "income_model" in data["loaded_models"]
    assert "repayment_model" in data["loaded_models"]
    assert "weights_config" in data

def test_get_customer_leads(client):
    response = client.get("/api/leads")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 150  # Should be exactly 150 seeded customers
    
    first_lead = data[0]
    # Check updated schema columns
    assert "customer_id" in first_lead
    assert "name" in first_lead
    assert "age" in first_lead
    assert "occupation_type" in first_lead
    assert "monthly_credits" in first_lead
    assert "monthly_debits" in first_lead
    
    # Check 4 scores
    assert "intent_score" in first_lead
    assert "income_score" in first_lead
    assert "repayment_score" in first_lead
    assert "lead_score" in first_lead
    
    # Check recommendations & explainability
    assert "recommended_product" in first_lead
    assert "feature_contributions" in first_lead
    assert "intent" in first_lead["feature_contributions"]
    assert "income" in first_lead["feature_contributions"]
    assert "repayment" in first_lead["feature_contributions"]

def test_get_single_customer_score(client):
    # Fetch lead list first to get an ID
    leads_res = client.get("/api/leads")
    cust_id = leads_res.json()[0]["customer_id"]
    
    response = client.get(f"/api/score/{cust_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["customer_id"] == cust_id
    assert "scores" in data
    assert "recommendation" in data
    assert "explainability" in data
    assert "financial_metrics" in data

def test_chatbot_query(client):
    # Fetch lead list first to get an ID
    leads_res = client.get("/api/leads")
    cust_id = leads_res.json()[0]["customer_id"]
    
    response = client.post(
        "/api/chatbot/query",
        json={"customer_id": cust_id, "question": "Why is their intent score high?"}
      )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["answer"]) > 0
