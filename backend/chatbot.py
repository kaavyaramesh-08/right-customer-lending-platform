import os
import json
from dotenv import load_dotenv

load_dotenv()

# Check for API key and log warnings if missing
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("\n" + "="*80)
    print("WARNING: GEMINI_API_KEY is missing from environment variables!")
    print("The Grounded Chatbot assistant will operate in Demo-Fallback Mode.")
    print("Please set GEMINI_API_KEY in your .env file to enable live Gemini AI queries.")
    print("="*80 + "\n")

HAS_GENAI_NEW = False
try:
    from google import genai
    from google.genai import types
    HAS_GENAI_NEW = True
    print("Detected new google-genai SDK for Chatbot.")
except ImportError:
    try:
        import google.generativeai as legacy_genai
        print("Detected legacy google-generativeai SDK for Chatbot.")
    except ImportError:
        print("Neither google-genai nor google-generativeai is installed. Chatbot will run in fallback mode.")

def call_llm(system_prompt: str, user_question: str) -> str:
    """
    Calls the Gemini API using the available SDK.
    Returns a warning if the API key is missing.
    """
    api_key_check = os.getenv("GEMINI_API_KEY")
    if not api_key_check:
        # Grounded mock response generator for demo fallback
        return generate_mock_fallback_response(system_prompt, user_question)
        
    try:
        if HAS_GENAI_NEW:
            client = genai.Client(api_key=api_key_check)
            response = client.models.generate_content(
                model='gemini-3.5-flash',
                contents=user_question,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.3
                )
            )
            return response.text
        else:
            legacy_genai.configure(api_key=api_key_check)
            model = legacy_genai.GenerativeModel(
                model_name='gemini-1.5-flash',
                system_instruction=system_prompt
            )
            response = model.generate_content(
                user_question,
                generation_config={"temperature": 0.3}
            )
            return response.text
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return f"Error interacting with the Gemini API: {str(e)}. (Note: Using demo fallback because API execution failed. Please verify your GEMINI_API_KEY.)"

def generate_mock_fallback_response(system_prompt: str, question: str) -> str:
    """Generates a smart mock response grounded in the customer data parsed from the system prompt."""
    # We parse the customer name and scores from the prompt to make it realistic
    name = "Customer"
    lead_score = "50"
    intent_score = "50"
    repayment_score = "50"
    income_score = "50"
    rec_loan = "Personal Loan"
    
    # Simple regex-free parsing of the prompt text
    for line in system_prompt.split('\n'):
        if "Name:" in line:
            name = line.split("Name:")[-1].strip()
        elif "Lead Score:" in line:
            lead_score = line.split("Lead Score:")[-1].split("/100")[0].strip()
        elif "Intent Score:" in line:
            intent_score = line.split("Intent Score:")[-1].split("/100")[0].strip()
        elif "Repayment Capacity Score:" in line:
            repayment_score = line.split("Repayment Capacity Score:")[-1].split("/100")[0].strip()
        elif "Income Stability Score:" in line:
            income_score = line.split("Income Stability Score:")[-1].split("/100")[0].strip()
        elif "Recommended Loan Product:" in line:
            rec_loan = line.split("Recommended Loan Product:")[-1].strip()

    question_lower = question.lower()
    
    response_header = "[DEMO MODE - GEMINI API KEY MISSING]\n\n"
    
    if "why" in question_lower or "score" in question_lower or "repayment" in question_lower:
        return (
            f"{response_header}Hello! Because the GEMINI_API_KEY is not set in the `.env` file, I am answering in Demo Grounded Fallback Mode.\n\n"
            f"Regarding **{name}**, their scores are: Lead Score: **{lead_score}**, Repayment Capacity Score: **{repayment_score}**, "
            f"Income Stability Score: **{income_score}**, and Intent Score: **{intent_score}**.\n\n"
            f"The ML model suggests a **{rec_loan}** for this customer. "
            f"Their repayment score is influenced by their debt obligations (EMIs) compared to monthly credits, and their credit score. "
            f"In a live demo, a configured Gemini model would provide full explainability here."
        )
    elif "recommend" in question_lower or "product" in question_lower or "loan" in question_lower:
        return (
            f"{response_header}Based on {name}'s transaction history and behavioral metrics, the system recommends a **{rec_loan}**.\n\n"
            f"This recommendation is grounded in an Intent Score of **{intent_score}/100** and a Repayment Score of **{repayment_score}/100**. "
            f"Set up the Gemini API key to see natural-language conversational justifications."
        )
    else:
        return (
            f"{response_header}Hello! I am IDBI SmartLend Bot. I am running in Demo Fallback Mode since no `GEMINI_API_KEY` was found.\n\n"
            f"Under review: **{name}**\n"
            f"- Lead Score: **{lead_score}/100**\n"
            f"- Recommended Loan: **{rec_loan}**\n"
            f"- Repayment Score: **{repayment_score}/100**\n"
            f"- Income Stability Score: **{income_score}/100**\n\n"
            f"Ask me about this customer's scores or why they were recommended this loan!"
        )

def generate_chatbot_response(customer_data: dict, model_outputs: dict, question: str) -> str:
    """
    Builds the prompt context and queries Gemini.
    """
    cust = customer_data
    pred = model_outputs
    
    # Formulate grounding prompt
    system_prompt = f"""You are "IDBI SmartLend Bot", an advanced AI-powered lending assistant built for the IDBI Innovate 2026 Hackathon.
Your purpose is to explain machine learning scoring predictions to Bank Relationship Managers (RMs).
You must be professional, factual, and explain model decisions using transaction-derived feature patterns and behavioral attributes.

Here is the profile of the customer under review:
- Customer ID: {cust["customer_id"]}
- Name: {cust["name"]}
- Age: {cust["age"]}
- Occupation Type: {cust["occupation_type"]}
- Credit Bureau Score (CIBIL): {cust["credit_score"]} (Scale: 300-850)

--- RAW FINANCIAL & BEHAVIORAL FEATURES ---
- Monthly Credit Transactions (Income): Rs. {cust["monthly_credits"]:,}
- Monthly Debit Transactions (Expenses): Rs. {cust["monthly_debits"]:,}
- Regular Salary Credit Flag: {"Yes (1)" if cust["salary_credit_flag"] == 1 else "No (0)"}
- Number of Active Income Streams: {cust["num_income_sources"]}
- Existing Monthly EMIs: Rs. {cust["existing_emis"]:,}
- Average Bank Balance: Rs. {cust["avg_balance"]:,}
- Average Monthly Transaction Count: {cust["txn_frequency"]}
- Active Loans Count: {cust["existing_loans"]}
- Loan App visits (past month): {cust["loan_app_visits"]}
- EMI Calculator uses (past month): {cust["emi_calculator_uses"]}
- Stated Loan Preference: {cust["preferred_loan_type"]}

--- TRAINED ML MODEL PREDICTIONS ---
- Intent Score: {pred["intent_score"]:.1f}/100 (Likelihood the customer is shopping for a loan)
- Income Stability Score: {pred["income_score"]:.1f}/100 (Based on salary credits, sources, and balance buffer)
- Repayment Capacity Score: {pred["repayment_score"]:.1f}/100 (Based on disposable income and credit score)
- Composite Lead Score: {pred["lead_score"]:.1f}/100 (Weighted average: 35% Intent, 35% Repayment, 30% Income)
- Recommended Loan Product: {pred["recommended_product"]}

--- LOCAL MODEL EXPLAINABILITY (SHAP CONTRIBUTIONS) ---
Features driving this customer's predictions (positive values increase the score, negative values lower it):
{json.dumps(pred["feature_contributions"], indent=2)}

--- INSTRUCTIONS FOR RESPONSE ---
1. Ground your answers strictly in the numbers and metrics listed above.
2. If asked why a score is high or low, connect it to the features. For example: "The customer has an Intent Score of 85 because they visited the loan app 18 times and used the EMI calculator 12 times." Or: "Repayment Capacity is low (32) because their existing EMIs of Rs. 40,000 absorb a large fraction of their monthly credits of Rs. 60,000."
3. If asked why a specific loan product was recommended, refer to their stated loan preference or their CIBIL score/income.
4. Keep answers concise, professional, and directly useful to a banking relationship manager.
"""
    
    return call_llm(system_prompt, question)
