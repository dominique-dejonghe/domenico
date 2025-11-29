-- Domenico Coins MLM Enhancement
-- Phase 2: Multi-Level Marketing System

-- Add referral fields to users table
ALTER TABLE users ADD COLUMN referrer_id INTEGER;
ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN mlm_rank TEXT DEFAULT 'associate';
ALTER TABLE users ADD COLUMN total_referrals INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN direct_referrals INTEGER DEFAULT 0;

-- MLM Commissions table
CREATE TABLE IF NOT EXISTS mlm_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  earning_user_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  from_transaction_id INTEGER NOT NULL,
  commission_level INTEGER NOT NULL,
  commission_percentage REAL NOT NULL,
  coins_purchased REAL NOT NULL,
  coin_value REAL NOT NULL,
  investment_amount REAL NOT NULL,
  commission_amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  payout_type TEXT DEFAULT 'reinvest',
  bonus_coins REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  FOREIGN KEY (earning_user_id) REFERENCES users(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (from_transaction_id) REFERENCES coin_transactions(id)
);

-- Referral Tree table
CREATE TABLE IF NOT EXISTS referral_tree (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  parent_id INTEGER,
  level_1_parent_id INTEGER,
  level_2_parent_id INTEGER,
  level_3_parent_id INTEGER,
  depth_level INTEGER DEFAULT 0,
  network_size INTEGER DEFAULT 0,
  network_value REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES users(id)
);

-- MLM Rank History
CREATE TABLE IF NOT EXISTS mlm_rank_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  old_rank TEXT NOT NULL,
  new_rank TEXT NOT NULL,
  direct_referrals INTEGER NOT NULL,
  total_referrals INTEGER NOT NULL,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  bonus_amount REAL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Commission Payouts
CREATE TABLE IF NOT EXISTS commission_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_commissions REAL NOT NULL,
  cash_amount REAL DEFAULT 0,
  reinvest_amount REAL DEFAULT 0,
  bonus_coins REAL DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- MLM Pool Tracking
CREATE TABLE IF NOT EXISTS mlm_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance REAL NOT NULL,
  added_from_distribution_id INTEGER,
  spent_on_commissions REAL DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (added_from_distribution_id) REFERENCES distributions(id)
);

-- Update system settings for MLM
INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES 
  ('mlm_enabled', 'true'),
  ('mlm_level_1_commission', '10'),
  ('mlm_level_2_commission', '3'),
  ('mlm_level_3_commission', '2'),
  ('mlm_reinvest_bonus', '20'),
  ('profit_split_coin_pool', '70'),
  ('profit_split_mlm_pool', '15'),
  ('profit_split_admin', '15');

-- Update existing profit split
UPDATE system_settings SET setting_value = '70' WHERE setting_key = 'profit_split_coin_pool';
UPDATE system_settings SET setting_value = '15' WHERE setting_key = 'profit_split_admin';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mlm_commissions_earning_user ON mlm_commissions(earning_user_id);
CREATE INDEX IF NOT EXISTS idx_mlm_commissions_from_user ON mlm_commissions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_mlm_commissions_status ON mlm_commissions(status);
CREATE INDEX IF NOT EXISTS idx_referral_tree_user ON referral_tree(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_tree_parent ON referral_tree(parent_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);

-- Generate referral codes for existing users
UPDATE users SET referral_code = lower(hex(randomblob(4))) WHERE referral_code IS NULL;

-- Create unique index on referral_code after data is populated
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique ON users(referral_code) WHERE referral_code IS NOT NULL;
