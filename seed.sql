-- Seed data for Domenico Coins Investment Platform

-- Insert admin user (Dominique Dejonghe)
INSERT OR IGNORE INTO users (id, email, name, role) VALUES 
  (1, 'dominique.dejonghe@iutum.be', 'Dominique Dejonghe', 'admin');

-- Insert demo investors
INSERT OR IGNORE INTO users (email, name, role) VALUES 
  ('investor1@example.com', 'Alice Johnson', 'investor'),
  ('investor2@example.com', 'Bob Smith', 'investor'),
  ('investor3@example.com', 'Carol Williams', 'investor');

-- Create holdings for demo investors
INSERT OR IGNORE INTO holdings (user_id, coins_owned, total_invested, avg_purchase_price) VALUES 
  (2, 50, 500, 10.0),  -- Alice: 50 coins @ €10
  (3, 30, 300, 10.0),  -- Bob: 30 coins @ €10
  (4, 20, 200, 10.0);  -- Carol: 20 coins @ €10

-- Insert initial coin transactions
INSERT OR IGNORE INTO coin_transactions (user_id, transaction_type, coins, price_per_coin, total_amount, payment_status, completed_at) VALUES 
  (2, 'buy', 50, 10.0, 500, 'completed', CURRENT_TIMESTAMP),
  (3, 'buy', 30, 10.0, 300, 'completed', CURRENT_TIMESTAMP),
  (4, 'buy', 20, 10.0, 200, 'completed', CURRENT_TIMESTAMP);

-- Insert demo AI/Software projects
INSERT OR IGNORE INTO projects (name, description, category, expected_revenue, cost, status, start_date, expected_completion) VALUES 
  ('AI Content Generator', 
   'Custom GPT-powered content generation platform for marketing agency. Automated blog posts, social media content, and email campaigns.',
   'AI Development',
   15000, 5000, 'in_progress', '2025-01-15', '2025-02-28'),
  
  ('Client CRM System',
   'Bespoke CRM system with AI-powered lead scoring and automated follow-up sequences for consultancy firm.',
   'Software Development',
   8000, 3000, 'completed', '2024-11-01', '2024-12-15'),
  
  ('E-commerce Platform',
   'Full-stack e-commerce solution with inventory management, payment integration, and analytics dashboard.',
   'Software Development',
   12000, 4000, 'completed', '2024-10-01', '2024-11-30'),
  
  ('AI Chatbot Integration',
   'Custom ChatGPT integration for customer support automation. Reduced support tickets by 60%.',
   'AI Development',
   6000, 2000, 'completed', '2024-09-01', '2024-10-15');

-- Add completed project revenues and profits
UPDATE projects SET actual_revenue = 8500, profit = 5500, actual_completion = '2024-12-15' WHERE name = 'Client CRM System';
UPDATE projects SET actual_revenue = 13500, profit = 9500, actual_completion = '2024-11-30' WHERE name = 'E-commerce Platform';
UPDATE projects SET actual_revenue = 7000, profit = 5000, actual_completion = '2024-10-15' WHERE name = 'AI Chatbot Integration';

-- Insert profit distributions for completed projects
INSERT OR IGNORE INTO distributions (project_id, total_profit, to_coin_pool, to_admin, coins_outstanding, value_increase_per_coin) VALUES 
  (2, 5500, 4400, 1100, 100, 44.0),   -- CRM: €5,500 profit, 80% = €4,400, 100 coins = +€44/coin
  (3, 9500, 7600, 1900, 100, 76.0),   -- E-commerce: €9,500 profit, 80% = €7,600 = +€76/coin
  (4, 5000, 4000, 1000, 100, 40.0);   -- Chatbot: €5,000 profit, 80% = €4,000 = +€40/coin

-- Insert coin value history
INSERT OR IGNORE INTO coin_value_history (coin_value, coins_outstanding, total_coin_pool, reason, reference_id) VALUES 
  (10.0, 100, 0, 'initial', NULL),
  (54.0, 100, 4400, 'project_distribution', 2),   -- After CRM: €10 + €44 = €54
  (130.0, 100, 12000, 'project_distribution', 3),  -- After E-commerce: €54 + €76 = €130
  (170.0, 100, 16000, 'project_distribution', 4);  -- After Chatbot: €130 + €40 = €170

-- Insert system settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES 
  ('current_coin_value', '170.0'),
  ('total_coins_issued', '100'),
  ('base_coin_price', '10.0'),
  ('profit_split_coin_pool', '80'),
  ('profit_split_admin', '20'),
  ('platform_status', 'active');
