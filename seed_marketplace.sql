-- ============================================================================
-- SEED DATA: PROJECT MARKETPLACE
-- ============================================================================
-- Real projects: StakeWise V3 Integration + EV Charger Management Platform
-- Demo investments to show portfolio functionality
-- ============================================================================

-- Project Categories
INSERT OR IGNORE INTO project_categories (id, name, description, icon, color) VALUES
(1, 'AI/ML', 'Artificial Intelligence and Machine Learning projects', 'fa-brain', 'purple'),
(2, 'FinTech', 'Financial Technology and DeFi solutions', 'fa-coins', 'green'),
(3, 'SaaS', 'Software as a Service platforms', 'fa-cloud', 'blue'),
(4, 'E-Commerce', 'Online retail and marketplace solutions', 'fa-shopping-cart', 'orange'),
(5, 'Real Estate', 'Property management and rental platforms', 'fa-building', 'red');

-- Service Tiers (DMC → Service Hours)
INSERT OR IGNORE INTO service_tiers (id, name, dmc_cost, service_hours, description, features, max_slots_per_month, display_order) VALUES
(1, 'Bronze', 10, 4, '4-hour consultation + roadmap', 
  '["Initial consultation", "Problem analysis", "Solution roadmap", "Technology recommendations"]', 
  20, 1),
(2, 'Silver', 25, 20, 'MVP Development (2 weeks)', 
  '["Everything in Bronze", "MVP development", "Core features implementation", "Basic UI/UX design", "2 weeks delivery"]', 
  10, 2),
(3, 'Gold', 50, 40, 'Full Product Launch (4 weeks)', 
  '["Everything in Silver", "Full product development", "Advanced features", "Professional UI/UX", "Testing & QA", "4 weeks delivery", "1 month support"]', 
  5, 3),
(4, 'Platinum', 100, 100, 'Enterprise Solution + 6 months support', 
  '["Everything in Gold", "Enterprise-grade architecture", "Custom integrations", "Advanced security", "Performance optimization", "6 months support", "Priority updates"]', 
  2, 4);

-- Update existing projects with marketplace data
UPDATE projects SET
  category_id = 2,
  min_investment_eur = 5000,
  max_investment_eur = 50000,
  target_capital_eur = 35000,
  expected_return_min = 12,
  expected_return_target = 15,
  expected_return_max = 20,
  risk_level = 'medium',
  comparable_projects = '["Lido Finance", "Rocket Pool", "Stakewise V2"]',
  is_featured = 1,
  funding_deadline = '2025-12-31'
WHERE id = 1 AND name LIKE '%StakeWise%';

UPDATE projects SET
  category_id = 3,
  min_investment_eur = 500,
  max_investment_eur = 10000,
  target_capital_eur = 5000,
  expected_return_min = 6,
  expected_return_target = 8,
  expected_return_max = 12,
  risk_level = 'low',
  comparable_projects = '["ChargePoint", "EVgo", "Electrify America"]',
  is_featured = 1,
  funding_deadline = '2025-12-31'
WHERE id = 2 AND name LIKE '%EV%';

-- Calculate current funding for projects based on existing investments
-- (We'll do this programmatically, but let's set initial values)

-- StakeWise: Let's say demo investors put in €30k total (85% funded)
UPDATE projects SET current_funding_eur = 30000, investor_count = 3 WHERE id = 1;

-- EV Calculator: Let's say €3.5k funded (70% funded)
UPDATE projects SET current_funding_eur = 3500, investor_count = 2 WHERE id = 2;

-- Project Investments (Demo data - showing how investors allocated their DMC)
-- Investor 1 (investor1@example.com) - 50 DMC total
INSERT OR IGNORE INTO project_investments (user_id, project_id, amount_dmc, amount_eur, dmc_price_at_investment) VALUES
(2, 1, 30, 5910, 197.07), -- 30 DMC in StakeWise (€5,910)
(2, 2, 20, 3941.40, 197.07); -- 20 DMC in EV Calculator (€3,941)

-- Investor 2 (investor2@example.com) - 35 DMC total
INSERT OR IGNORE INTO project_investments (user_id, project_id, amount_dmc, amount_eur, dmc_price_at_investment) VALUES
(3, 1, 25, 4926.75, 197.07), -- 25 DMC in StakeWise
(3, 2, 10, 1970.70, 197.07); -- 10 DMC in EV Calculator

-- Investor 3 (investor3@example.com) - 31 DMC total
INSERT OR IGNORE INTO project_investments (user_id, project_id, amount_dmc, amount_eur, dmc_price_at_investment) VALUES
(4, 1, 31, 6109.17, 197.07); -- All-in on StakeWise (high risk tolerance)

-- Demo Revenue Event (Simulate StakeWise made first €2,000 profit)
INSERT OR IGNORE INTO project_revenue (id, project_id, revenue_date, amount, distributed_to_investors, distributed_to_admin, distribution_completed) VALUES
(1, 1, '2025-11-15', 2000, 1600, 400, 1);

-- Calculate investor payouts from this revenue
-- StakeWise has 86 DMC invested total (30+25+31)
-- Investor 1: 30/86 * €1,600 = €558.14 (18.9% ROI on €2,955)
-- Investor 2: 25/86 * €1,600 = €465.12 (18.9% ROI on €2,463)
-- Investor 3: 31/86 * €1,600 = €576.74 (18.9% ROI on €3,056)

INSERT OR IGNORE INTO investor_revenue_payouts (user_id, project_id, project_revenue_id, amount_eur, payout_method, roi_percentage) VALUES
(2, 1, 1, 558.14, 'cash', 9.4),
(3, 1, 1, 465.12, 'dmc', 9.4),
(4, 1, 1, 576.74, 'cash', 9.4);

-- Update investor portfolios (summary view)
INSERT OR REPLACE INTO investor_portfolios (user_id, total_invested_dmc, total_invested_eur, total_revenue_received, total_roi_percentage, active_projects_count) VALUES
(2, 50, 9851.40, 558.14, 5.66, 2),
(3, 35, 6897.45, 465.12, 6.74, 2),
(4, 31, 6109.17, 576.74, 9.44, 1);

-- Demo Service Redemption (Investor 2 redeemed Silver tier for a rental platform project)
INSERT OR IGNORE INTO service_redemptions (user_id, tier_id, dmc_spent, project_title, project_description, status, requested_at, approved_at) VALUES
(3, 2, 25, 'Vacation Rental Platform', 'Multi-property rental management system with booking calendar, payment processing, and guest communication.', 'approved', '2025-11-20 10:30:00', '2025-11-20 14:00:00');
