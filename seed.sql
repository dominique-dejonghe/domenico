-- Seed data for Domenico Coins with MLM Phase 2

-- Insert admin user (Dominique Dejonghe)
INSERT OR IGNORE INTO users (id, email, name, role, mlm_rank, referral_code) VALUES 
  (1, 'dominique.dejonghe@iutum.be', 'Dominique Dejonghe', 'admin', 'executive', 'domenico');

-- Insert demo investors with MLM structure
-- Alice: Direct referral of Dominique
INSERT OR IGNORE INTO users (email, name, role, referrer_id, mlm_rank, referral_code, direct_referrals, total_referrals) VALUES 
  ('alice@example.com', 'Alice Johnson', 'investor', 1, 'partner', 'alice123', 2, 4);

-- Bob: Direct referral of Alice (Level 2 for Dominique)
INSERT OR IGNORE INTO users (email, name, role, referrer_id, mlm_rank, referral_code, direct_referrals, total_referrals) VALUES 
  ('bob@example.com', 'Bob Smith', 'investor', 2, 'associate', 'bob456', 1, 1);

-- Carol: Direct referral of Alice (Level 2 for Dominique)
INSERT OR IGNORE INTO users (email, name, role, referrer_id, mlm_rank, referral_code, direct_referrals, total_referrals) VALUES 
  ('carol@example.com', 'Carol Williams', 'investor', 2, 'associate', 'carol789', 0, 0);

-- David: Direct referral of Bob (Level 3 for Dominique, Level 2 for Alice)
INSERT OR IGNORE INTO users (email, name, role, referrer_id, mlm_rank, referral_code, direct_referrals, total_referrals) VALUES 
  ('david@example.com', 'David Brown', 'investor', 3, 'associate', 'david101', 0, 0);

-- Create holdings for demo investors
INSERT OR IGNORE INTO holdings (user_id, coins_owned, total_invested, avg_purchase_price) VALUES 
  (2, 50, 500, 10.0),   -- Alice: 50 coins @ €10
  (3, 30, 300, 10.0),   -- Bob: 30 coins @ €10
  (4, 20, 200, 10.0),   -- Carol: 20 coins @ €10
  (5, 10, 100, 10.0);   -- David: 10 coins @ €10

-- Insert referral tree
INSERT OR IGNORE INTO referral_tree (user_id, parent_id, level_1_parent_id, level_2_parent_id, level_3_parent_id, depth_level, network_size, network_value) VALUES 
  (1, NULL, NULL, NULL, NULL, 0, 4, 1100),  -- Dominique (root)
  (2, 1, 1, NULL, NULL, 1, 3, 600),         -- Alice
  (3, 2, 2, 1, NULL, 2, 1, 400),            -- Bob
  (4, 2, 2, 1, NULL, 2, 0, 200),            -- Carol
  (5, 3, 3, 2, 1, 3, 0, 100);               -- David

-- Insert coin transactions
INSERT OR IGNORE INTO coin_transactions (user_id, transaction_type, coins, price_per_coin, total_amount, payment_status, completed_at) VALUES 
  (2, 'buy', 50, 10.0, 500, 'completed', CURRENT_TIMESTAMP),
  (3, 'buy', 30, 10.0, 300, 'completed', CURRENT_TIMESTAMP),
  (4, 'buy', 20, 10.0, 200, 'completed', CURRENT_TIMESTAMP),
  (5, 'buy', 10, 10.0, 100, 'completed', CURRENT_TIMESTAMP);

-- Insert REAL projects (EV Charger & StakeWise)
INSERT OR IGNORE INTO projects (name, description, category, expected_revenue, cost, status, start_date, expected_completion, client_name) VALUES 
  ('EV Charger Management Platform',
   'Complete white-label solution for EV charging station operators. Features: real-time monitoring, dynamic pricing, user management, payment processing, analytics dashboard, mobile app integration.',
   'Software Development',
   45000, 15000, 'in_progress', '2025-12-01', '2026-03-31', 'EV Charging Solutions BV'),
  
  ('StakeWise V3 Integration & Dashboard',
   'Advanced staking platform integration with custom dashboard for institutional clients. Real-time APY tracking, portfolio analytics, automated compound strategies, risk management tools.',
   'Blockchain Development',
   35000, 10000, 'in_progress', '2025-12-15', '2026-02-28', 'StakeWise DAO'),
  
  ('AI Content Generator Platform',
   'GPT-powered content generation platform for marketing agencies. Automated blog posts, social media content, email campaigns with brand voice training.',
   'AI Development',
   15000, 5000, 'completed', '2025-01-15', '2025-02-28', 'ContentFlow Agency'),
  
  ('Client CRM System',
   'Bespoke CRM with AI-powered lead scoring and automated follow-ups for consultancy firm.',
   'Software Development',
   8000, 3000, 'completed', '2024-11-01', '2024-12-15', 'Business Dynamics Consulting'),
  
  ('E-commerce Platform Redesign',
   'Full-stack e-commerce solution with inventory management, payment integration, and analytics dashboard.',
   'Software Development',
   12000, 4000, 'completed', '2024-10-01', '2024-11-30', 'ShopEasy Belgium'),
  
  ('AI Chatbot Integration',
   'Custom ChatGPT integration for customer support automation. Reduced support tickets by 60%.',
   'AI Development',
   6000, 2000, 'completed', '2024-09-01', '2024-10-15', 'TechSupport Pro');

-- Add completed project revenues and profits (with MLM-adjusted distribution)
UPDATE projects SET actual_revenue = 16000, profit = 11000, actual_completion = '2025-02-28' WHERE name = 'AI Content Generator Platform';
UPDATE projects SET actual_revenue = 8500, profit = 5500, actual_completion = '2024-12-15' WHERE name = 'Client CRM System';
UPDATE projects SET actual_revenue = 13500, profit = 9500, actual_completion = '2024-11-30' WHERE name = 'E-commerce Platform Redesign';
UPDATE projects SET actual_revenue = 7000, profit = 5000, actual_completion = '2024-10-15' WHERE name = 'AI Chatbot Integration';

-- Insert profit distributions with NEW 70/15/15 split
INSERT OR IGNORE INTO distributions (project_id, total_profit, to_coin_pool, to_admin, coins_outstanding, value_increase_per_coin) VALUES 
  (3, 11000, 7700, 1650, 110, 70.0),   -- AI Content: €11,000 profit, 70% = €7,700, 15% MLM = €1,650, 15% admin = €1,650
  (4, 5500, 3850, 825, 110, 35.0),     -- CRM: €5,500 profit, 70% = €3,850
  (5, 9500, 6650, 1425, 110, 60.45),   -- E-commerce: €9,500 profit, 70% = €6,650
  (6, 5000, 3500, 750, 110, 31.82);    -- Chatbot: €5,000 profit, 70% = €3,500

-- Insert MLM pool funding
INSERT OR IGNORE INTO mlm_pool (balance, added_from_distribution_id, spent_on_commissions) VALUES 
  (1650, 3, 165),   -- From AI Content project
  (825, 4, 45),     -- From CRM project
  (1425, 5, 60),    -- From E-commerce project
  (750, 6, 30);     -- From Chatbot project

-- Insert demo MLM commissions
INSERT OR IGNORE INTO mlm_commissions (earning_user_id, from_user_id, from_transaction_id, commission_level, commission_percentage, coins_purchased, coin_value, investment_amount, commission_amount, status, payout_type, bonus_coins, paid_at) VALUES 
  -- Dominique earns from Alice (Level 1 - Direct)
  (1, 2, 1, 1, 10, 50, 10, 500, 50, 'paid', 'cash', 0, CURRENT_TIMESTAMP),
  -- Alice earns from Bob (Level 1 - Direct)
  (2, 3, 2, 1, 10, 30, 10, 300, 30, 'paid', 'reinvest', 3.6, CURRENT_TIMESTAMP),
  -- Dominique earns from Bob (Level 2 - Indirect through Alice)
  (1, 3, 2, 2, 3, 30, 10, 300, 9, 'paid', 'cash', 0, CURRENT_TIMESTAMP),
  -- Alice earns from Carol (Level 1 - Direct)
  (2, 4, 3, 1, 10, 20, 10, 200, 20, 'paid', 'reinvest', 2.4, CURRENT_TIMESTAMP),
  -- Dominique earns from Carol (Level 2 - Indirect through Alice)
  (1, 4, 3, 2, 3, 20, 10, 200, 6, 'paid', 'cash', 0, CURRENT_TIMESTAMP),
  -- Bob earns from David (Level 1 - Direct)
  (3, 5, 4, 1, 10, 10, 10, 100, 10, 'pending', 'cash', 0, NULL),
  -- Alice earns from David (Level 2 - Indirect through Bob)
  (2, 5, 4, 2, 3, 10, 10, 100, 3, 'pending', 'reinvest', 0, NULL),
  -- Dominique earns from David (Level 3 - Indirect through Bob and Alice)
  (1, 5, 4, 3, 2, 10, 10, 100, 2, 'pending', 'cash', 0, NULL);

-- Insert coin value history (adjusted for 70/15/15 split)
INSERT OR IGNORE INTO coin_value_history (coin_value, coins_outstanding, total_coin_pool, reason, reference_id) VALUES 
  (10.0, 110, 0, 'initial', NULL),
  (80.0, 110, 7700, 'project_distribution', 3),    -- After AI Content: €10 + €70 = €80
  (115.0, 110, 11550, 'project_distribution', 4),  -- After CRM: €80 + €35 = €115
  (175.45, 110, 18200, 'project_distribution', 5), -- After E-commerce: €115 + €60.45 = €175.45
  (207.27, 110, 21700, 'project_distribution', 6); -- After Chatbot: €175.45 + €31.82 = €207.27

-- Update system settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES 
  ('current_coin_value', '207.27'),
  ('total_coins_issued', '110'),
  ('base_coin_price', '10.0'),
  ('platform_status', 'active');

-- Update Dominique's referral stats
UPDATE users SET direct_referrals = 1, total_referrals = 4 WHERE id = 1;

-- Update Alice's holding with reinvested commissions (30 + 20 + 3 commissions = 53 total bonus)
-- She got 30 from Bob, 20 from Carol = 50 EUR, with 20% bonus = 60 EUR / ~10 avg price = ~6 bonus coins
UPDATE holdings SET coins_owned = 56, total_invested = 500, avg_purchase_price = 8.93 WHERE user_id = 2;
