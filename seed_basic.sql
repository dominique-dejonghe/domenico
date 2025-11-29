-- Basic seed data
INSERT INTO users (id, email, name, role, mlm_rank, referral_code) VALUES 
  (1, 'dominique.dejonghe@iutum.be', 'Dominique Dejonghe', 'admin', 'executive', 'domenico');

INSERT INTO users (email, name, role, referrer_id, mlm_rank, referral_code, direct_referrals, total_referrals) VALUES 
  ('alice@example.com', 'Alice Johnson', 'investor', 1, 'partner', 'alice123', 2, 4),
  ('bob@example.com', 'Bob Smith', 'investor', 2, 'associate', 'bob456', 1, 1),
  ('carol@example.com', 'Carol Williams', 'investor', 2, 'associate', 'carol789', 0, 0),
  ('david@example.com', 'David Brown', 'investor', 3, 'associate', 'david101', 0, 0);

INSERT INTO holdings (user_id, coins_owned, total_invested, avg_purchase_price) VALUES 
  (2, 56, 500, 8.93),
  (3, 30, 300, 10.0),
  (4, 20, 200, 10.0),
  (5, 10, 100, 10.0);

INSERT INTO referral_tree (user_id, parent_id, level_1_parent_id, level_2_parent_id, level_3_parent_id, depth_level, network_size, network_value) VALUES 
  (1, NULL, NULL, NULL, NULL, 0, 4, 1100),
  (2, 1, 1, NULL, NULL, 1, 3, 600),
  (3, 2, 2, 1, NULL, 2, 1, 400),
  (4, 2, 2, 1, NULL, 2, 0, 200),
  (5, 3, 3, 2, 1, 3, 0, 100);

INSERT INTO coin_transactions (user_id, transaction_type, coins, price_per_coin, total_amount, payment_status, completed_at) VALUES 
  (2, 'buy', 50, 10.0, 500, 'completed', CURRENT_TIMESTAMP),
  (3, 'buy', 30, 10.0, 300, 'completed', CURRENT_TIMESTAMP),
  (4, 'buy', 20, 10.0, 200, 'completed', CURRENT_TIMESTAMP),
  (5, 'buy', 10, 10.0, 100, 'completed', CURRENT_TIMESTAMP);

INSERT INTO projects (name, description, category, expected_revenue, cost, status, start_date, expected_completion, client_name) VALUES 
  ('EV Charger Management Platform',
   'Complete white-label solution for EV charging station operators. Real-time monitoring, dynamic pricing, user management.',
   'Software Development',
   45000, 15000, 'in_progress', '2025-12-01', '2026-03-31', 'EV Charging Solutions BV'),
  
  ('StakeWise V3 Integration',
   'Advanced staking platform with custom dashboard. Real-time APY tracking, portfolio analytics, automated strategies.',
   'Blockchain Development',
   35000, 10000, 'in_progress', '2025-12-15', '2026-02-28', 'StakeWise DAO'),
  
  ('AI Content Generator',
   'GPT-powered content generation for marketing agencies.',
   'AI Development',
   16000, 5000, 'completed', '2025-01-15', '2025-02-28', 'ContentFlow Agency'),
  
  ('Client CRM System',
   'CRM with AI-powered lead scoring and automation.',
   'Software Development',
   8500, 3000, 'completed', '2024-11-01', '2024-12-15', 'Business Dynamics'),
  
  ('E-commerce Platform',
   'Full-stack e-commerce with inventory and analytics.',
   'Software Development',
   13500, 4000, 'completed', '2024-10-01', '2024-11-30', 'ShopEasy Belgium'),
  
  ('AI Chatbot Integration',
   'Custom ChatGPT for customer support automation.',
   'AI Development',
   7000, 2000, 'completed', '2024-09-01', '2024-10-15', 'TechSupport Pro');

-- Mark projects as completed with revenues
UPDATE projects SET profit = 11000, actual_revenue = 16000, actual_completion = '2025-02-28' WHERE name = 'AI Content Generator';
UPDATE projects SET profit = 5500, actual_revenue = 8500, actual_completion = '2024-12-15' WHERE name = 'Client CRM System';
UPDATE projects SET profit = 9500, actual_revenue = 13500, actual_completion = '2024-11-30' WHERE name = 'E-commerce Platform';
UPDATE projects SET profit = 5000, actual_revenue = 7000, actual_completion = '2024-10-15' WHERE name = 'AI Chatbot Integration';

-- Distributions (70/15/15 split)
INSERT INTO distributions (project_id, total_profit, to_coin_pool, to_admin, coins_outstanding, value_increase_per_coin) VALUES 
  (3, 11000, 7700, 1650, 116, 66.38),
  (4, 5500, 3850, 825, 116, 33.19),
  (5, 9500, 6650, 1425, 116, 57.33),
  (6, 5000, 3500, 750, 116, 30.17);

-- MLM Pool
INSERT INTO mlm_pool (balance, added_from_distribution_id, spent_on_commissions) VALUES 
  (1485, 1, 165),
  (780, 2, 45),
  (1365, 3, 60),
  (720, 4, 30);

-- MLM Commissions
INSERT INTO mlm_commissions (earning_user_id, from_user_id, from_transaction_id, commission_level, commission_percentage, coins_purchased, coin_value, investment_amount, commission_amount, status, payout_type, bonus_coins, paid_at) VALUES 
  (1, 2, 1, 1, 10, 50, 10, 500, 50, 'paid', 'cash', 0, CURRENT_TIMESTAMP),
  (2, 3, 2, 1, 10, 30, 10, 300, 30, 'paid', 'reinvest', 3.6, CURRENT_TIMESTAMP),
  (1, 3, 2, 2, 3, 30, 10, 300, 9, 'paid', 'cash', 0, CURRENT_TIMESTAMP),
  (2, 4, 3, 1, 10, 20, 10, 200, 20, 'paid', 'reinvest', 2.4, CURRENT_TIMESTAMP),
  (1, 4, 3, 2, 3, 20, 10, 200, 6, 'paid', 'cash', 0, CURRENT_TIMESTAMP),
  (3, 5, 4, 1, 10, 10, 10, 100, 10, 'pending', 'cash', 0, NULL),
  (2, 5, 4, 2, 3, 10, 10, 100, 3, 'pending', 'reinvest', 0, NULL),
  (1, 5, 4, 3, 2, 10, 10, 100, 2, 'pending', 'cash', 0, NULL);

-- Coin value history
INSERT INTO coin_value_history (coin_value, coins_outstanding, total_coin_pool, reason, reference_id) VALUES 
  (10.0, 116, 0, 'initial', NULL),
  (76.38, 116, 7700, 'project_distribution', 1),
  (109.57, 116, 11550, 'project_distribution', 2),
  (166.90, 116, 18200, 'project_distribution', 3),
  (197.07, 116, 21700, 'project_distribution', 4);

-- System settings
UPDATE system_settings SET setting_value = '197.07' WHERE setting_key = 'current_coin_value';
UPDATE system_settings SET setting_value = '116' WHERE setting_key = 'total_coins_issued';
