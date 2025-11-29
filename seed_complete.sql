-- Complete seed data for Domenico Coins Platform
-- Run this ONCE in Cloudflare D1 Console

-- ============================================
-- CLEANUP (optional - only if you want fresh start)
-- ============================================
-- DELETE FROM coin_transactions;
-- DELETE FROM coin_value_history;
-- DELETE FROM mlm_commissions;
-- DELETE FROM referral_tree;
-- DELETE FROM buyback_requests;
-- DELETE FROM distributions;
-- DELETE FROM holdings;
-- DELETE FROM projects;
-- DELETE FROM users WHERE id > 1;

-- ============================================
-- USERS DATA
-- ============================================
-- Already exists from previous inserts

-- ============================================
-- COIN TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS coin_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  coins REAL NOT NULL,
  price_per_coin REAL NOT NULL,
  total_amount REAL NOT NULL,
  payment_status TEXT DEFAULT 'completed',
  payment_method TEXT,
  transaction_ref TEXT,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO coin_transactions (id, user_id, transaction_type, coins, price_per_coin, total_amount, payment_status) VALUES
  (1, 2, 'buy', 50, 197.07, 9853.50, 'completed'),
  (2, 3, 'buy', 30, 197.07, 5912.10, 'completed'),
  (3, 4, 'buy', 20, 197.07, 3941.40, 'completed');

-- ============================================
-- COIN VALUE HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS coin_value_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin_value REAL NOT NULL,
  coins_outstanding REAL NOT NULL,
  total_distributed REAL,
  event_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO coin_value_history (id, coin_value, coins_outstanding, total_distributed, event_description) VALUES
  (1, 10.00, 100, 0, 'Initial coin value'),
  (2, 197.07, 100, 21000, 'After EV Charger project completion');

-- ============================================
-- BUYBACK REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS buyback_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  coins_to_sell REAL NOT NULL,
  price_per_coin REAL NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- No buyback requests yet (empty table ready for use)

-- ============================================
-- MLM REFERRAL TREE
-- ============================================
CREATE TABLE IF NOT EXISTS referral_tree (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  parent_id INTEGER,
  level_1_parent_id INTEGER,
  level_2_parent_id INTEGER,
  level_3_parent_id INTEGER,
  depth_level INTEGER DEFAULT 0,
  network_size INTEGER DEFAULT 0,
  network_value REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO referral_tree (user_id, parent_id, level_1_parent_id, depth_level, network_size, network_value) VALUES
  (1, NULL, NULL, 0, 3, 19707.00),
  (2, 1, 1, 1, 0, 9853.50),
  (3, 1, 1, 1, 0, 5912.10),
  (4, 1, 1, 1, 0, 3941.40);

-- ============================================
-- MLM COMMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS mlm_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  earning_user_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  commission_level INTEGER NOT NULL,
  commission_percentage REAL NOT NULL,
  investment_amount REAL NOT NULL,
  commission_amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (earning_user_id) REFERENCES users(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO mlm_commissions (id, earning_user_id, from_user_id, commission_level, commission_percentage, investment_amount, commission_amount, status, paid_at) VALUES
  (1, 1, 2, 1, 10.0, 9853.50, 985.35, 'paid', CURRENT_TIMESTAMP),
  (2, 1, 3, 1, 10.0, 5912.10, 591.21, 'paid', CURRENT_TIMESTAMP),
  (3, 1, 4, 1, 10.0, 3941.40, 394.14, 'paid', CURRENT_TIMESTAMP);

-- ============================================
-- MLM POOL
-- ============================================
CREATE TABLE IF NOT EXISTS mlm_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance REAL DEFAULT 0,
  added_from_distribution_id INTEGER,
  spent_on_commissions REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO mlm_pool (id, balance, spent_on_commissions) VALUES
  (1, 4500.00, 1970.70);

-- ============================================
-- VERIFICATION QUERY
-- ============================================
SELECT 'Setup Complete! Run this to verify:' as message;
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'holdings', COUNT(*) FROM holdings
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'project_categories', COUNT(*) FROM project_categories
UNION ALL SELECT 'distributions', COUNT(*) FROM distributions
UNION ALL SELECT 'transactions', COUNT(*) FROM coin_transactions
UNION ALL SELECT 'coin_history', COUNT(*) FROM coin_value_history
UNION ALL SELECT 'referral_tree', COUNT(*) FROM referral_tree
UNION ALL SELECT 'mlm_commissions', COUNT(*) FROM mlm_commissions
UNION ALL SELECT 'mlm_pool', COUNT(*) FROM mlm_pool
UNION ALL SELECT 'buyback_requests', COUNT(*) FROM buyback_requests;
