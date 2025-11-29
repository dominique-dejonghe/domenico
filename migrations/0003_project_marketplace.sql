-- ============================================================================
-- PHASE 3: PROJECT MARKETPLACE SYSTEM
-- ============================================================================
-- Transforms Domenico Coins from "trust-based investment" to 
-- "project-specific marketplace" with selective investing per project
-- ============================================================================

-- Project Categories (AI/ML, SaaS, FinTech, etc.)
CREATE TABLE IF NOT EXISTS project_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Font Awesome icon class
  color TEXT, -- Tailwind color class
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project Investments (User's holdings per project)
CREATE TABLE IF NOT EXISTS project_investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  amount_dmc REAL NOT NULL, -- How many DMC invested
  amount_eur REAL NOT NULL, -- Euro value at time of investment
  dmc_price_at_investment REAL NOT NULL, -- DMC price when invested
  invested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active', -- active, redeemed, withdrawn
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Project Revenue Tracking (When projects make money)
CREATE TABLE IF NOT EXISTS project_revenue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  revenue_date DATE NOT NULL,
  amount REAL NOT NULL, -- Total revenue earned
  distributed_to_investors REAL NOT NULL, -- 80% to investors
  distributed_to_admin REAL NOT NULL, -- 20% to Dominique
  distribution_completed BOOLEAN DEFAULT 0,
  distributed_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Investor Revenue Payouts (Individual investor's share from project revenue)
CREATE TABLE IF NOT EXISTS investor_revenue_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  project_revenue_id INTEGER NOT NULL,
  amount_eur REAL NOT NULL, -- Their share of revenue
  amount_dmc REAL, -- If they chose DMC payout
  payout_method TEXT NOT NULL, -- 'cash', 'dmc', or 'mixed'
  roi_percentage REAL, -- % return on their investment
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (project_revenue_id) REFERENCES project_revenue(id)
);

-- Investor Portfolio Summary (Calculated view for performance)
CREATE TABLE IF NOT EXISTS investor_portfolios (
  user_id INTEGER PRIMARY KEY,
  total_invested_dmc REAL DEFAULT 0,
  total_invested_eur REAL DEFAULT 0,
  total_revenue_received REAL DEFAULT 0,
  total_roi_percentage REAL DEFAULT 0,
  active_projects_count INTEGER DEFAULT 0,
  completed_projects_count INTEGER DEFAULT 0,
  avg_project_return REAL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Service Redemption Tiers (DMC → Service Hours)
CREATE TABLE IF NOT EXISTS service_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, -- Bronze, Silver, Gold, Platinum
  dmc_cost REAL NOT NULL,
  service_hours INTEGER NOT NULL,
  description TEXT,
  features TEXT, -- JSON array of features
  max_slots_per_month INTEGER,
  active BOOLEAN DEFAULT 1,
  display_order INTEGER DEFAULT 0
);

-- Service Redemption Requests
CREATE TABLE IF NOT EXISTS service_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tier_id INTEGER NOT NULL,
  dmc_spent REAL NOT NULL,
  project_title TEXT NOT NULL,
  project_description TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, in_progress, completed, rejected
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME,
  completed_at DATETIME,
  admin_notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tier_id) REFERENCES service_tiers(id)
);

-- Update projects table with marketplace-specific fields
-- Note: We'll add these columns only if they don't exist
ALTER TABLE projects ADD COLUMN category_id INTEGER REFERENCES project_categories(id);
ALTER TABLE projects ADD COLUMN min_investment_eur REAL DEFAULT 0;
ALTER TABLE projects ADD COLUMN max_investment_eur REAL;
ALTER TABLE projects ADD COLUMN target_capital_eur REAL;
ALTER TABLE projects ADD COLUMN current_funding_eur REAL DEFAULT 0;
ALTER TABLE projects ADD COLUMN investor_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN expected_return_min REAL; -- Worst case %
ALTER TABLE projects ADD COLUMN expected_return_target REAL; -- Realistic %
ALTER TABLE projects ADD COLUMN expected_return_max REAL; -- Best case %
ALTER TABLE projects ADD COLUMN risk_level TEXT DEFAULT 'medium'; -- low, medium, high
ALTER TABLE projects ADD COLUMN comparable_projects TEXT; -- JSON array
ALTER TABLE projects ADD COLUMN pitch_deck_url TEXT;
ALTER TABLE projects ADD COLUMN funding_deadline DATE;
ALTER TABLE projects ADD COLUMN is_featured BOOLEAN DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_investments_user ON project_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_investments_project ON project_investments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_investments_status ON project_investments(status);
CREATE INDEX IF NOT EXISTS idx_project_revenue_project ON project_revenue(project_id);
CREATE INDEX IF NOT EXISTS idx_project_revenue_date ON project_revenue(revenue_date);
CREATE INDEX IF NOT EXISTS idx_investor_payouts_user ON investor_revenue_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_payouts_project ON investor_revenue_payouts(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(is_featured);
