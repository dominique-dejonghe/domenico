-- Domenico Coins Investment Platform Database Schema
-- Phase 1: Pure Investment (no MLM)

-- Users table (3 roles: visitor, investor, admin)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'visitor', -- 'visitor', 'investor', 'admin'
  password_hash TEXT, -- For future authentication
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Coin Holdings (investor portfolios)
CREATE TABLE IF NOT EXISTS holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  coins_owned REAL DEFAULT 0,
  total_invested REAL DEFAULT 0, -- Total EUR invested
  avg_purchase_price REAL DEFAULT 10.0, -- Average price paid per coin
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id)
);

-- Coin Transactions (buy/sell history)
CREATE TABLE IF NOT EXISTS coin_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- 'buy', 'sell'
  coins REAL NOT NULL,
  price_per_coin REAL NOT NULL,
  total_amount REAL NOT NULL, -- EUR amount
  payment_method TEXT, -- 'bank_transfer', 'credit_card', etc.
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  payment_reference TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Projects (AI/Software development projects)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'AI Development', 'Software Development', 'Consulting'
  expected_revenue REAL,
  actual_revenue REAL,
  cost REAL,
  profit REAL,
  status TEXT DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'cancelled'
  start_date DATE,
  expected_completion DATE,
  actual_completion DATE,
  client_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Profit Distributions (project profits → coin value)
CREATE TABLE IF NOT EXISTS distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  total_profit REAL NOT NULL,
  to_coin_pool REAL NOT NULL, -- 80% of profit
  to_admin REAL NOT NULL, -- 20% of profit
  coins_outstanding REAL NOT NULL, -- Total coins in circulation at distribution time
  value_increase_per_coin REAL NOT NULL, -- to_coin_pool / coins_outstanding
  distribution_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Coin Value History (for graphs and tracking)
CREATE TABLE IF NOT EXISTS coin_value_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin_value REAL NOT NULL,
  coins_outstanding REAL NOT NULL,
  total_coin_pool REAL NOT NULL,
  reason TEXT, -- 'initial', 'project_distribution', 'manual_adjustment'
  reference_id INTEGER, -- project_id or distribution_id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Buyback Requests (investors selling coins back)
CREATE TABLE IF NOT EXISTS buyback_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  coins_to_sell REAL NOT NULL,
  requested_price REAL NOT NULL, -- Price at time of request
  total_amount REAL NOT NULL, -- coins * price
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'rejected'
  admin_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- System Settings (platform configuration)
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON coin_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_distributions_project ON distributions(project_id);
CREATE INDEX IF NOT EXISTS idx_buyback_status ON buyback_requests(status);
