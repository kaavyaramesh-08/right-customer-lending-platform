import os
import csv
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform\\lending_platform.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Customer(Base):
    __tablename__ = "customers"
    
    customer_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100))
    age = Column(Integer)
    occupation_type = Column(String(100))
    monthly_credits = Column(Float)
    monthly_debits = Column(Float)
    salary_credit_flag = Column(Integer)
    num_income_sources = Column(Integer)
    existing_emis = Column(Float)
    avg_balance = Column(Float)
    txn_frequency = Column(Integer)
    loan_app_visits = Column(Integer)
    emi_calculator_uses = Column(Integer)
    credit_score = Column(Integer)
    existing_loans = Column(Integer)
    preferred_loan_type = Column(String(50))
    
    # Ground truth targets from generator (to train/evaluate models)
    intent_score_gt = Column(Float)
    income_score_gt = Column(Float)
    repayment_score_gt = Column(Float)

def init_db_and_seed():
    # If the database file exists, let's delete it or overwrite it to re-seed cleanly
    db_path = "C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform\\lending_platform.db"
    
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    # Check if database is already seeded
    if db.query(Customer).first() is not None:
        print("Database already seeded. Skipping CSV import.")
        db.close()
        return
        
    csv_path = "C:\\Users\\KAAVYA\\.gemini\\antigravity\\scratch\\right-customer-lending-platform\\data\\raw_customers.csv"
    if not os.path.exists(csv_path):
        print(f"CSV file not found at {csv_path}. Seeding will run during startup if raw_customers.csv is generated.")
        db.close()
        return
        
    print(f"Seeding database from {csv_path}...")
    try:
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                cust = Customer(
                    customer_id=row["customer_id"],
                    name=row["name"],
                    age=int(row["age"]),
                    occupation_type=row["occupation_type"],
                    monthly_credits=float(row["monthly_credits"]),
                    monthly_debits=float(row["monthly_debits"]),
                    salary_credit_flag=int(row["salary_credit_flag"]),
                    num_income_sources=int(row["num_income_sources"]),
                    existing_emis=float(row["existing_emis"]),
                    avg_balance=float(row["avg_balance"]),
                    txn_frequency=int(row["txn_frequency"]),
                    loan_app_visits=int(row["loan_app_visits"]),
                    emi_calculator_uses=int(row["emi_calculator_uses"]),
                    credit_score=int(row["credit_score"]),
                    existing_loans=int(row["existing_loans"]),
                    preferred_loan_type=row["preferred_loan_type"],
                    intent_score_gt=float(row["intent_score_gt"]),
                    income_score_gt=float(row["income_score_gt"]),
                    repayment_score_gt=float(row["repayment_score_gt"])
                )
                db.add(cust)
                count += 1
            db.commit()
            print(f"Successfully seeded {count} customer records.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
