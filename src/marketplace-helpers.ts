// ============================================================================
// MARKETPLACE HELPER FUNCTIONS
// ============================================================================
// Utilities for project-specific investment platform
// ============================================================================

/**
 * Calculate dynamic coin value based on weighted portfolio performance
 * Formula: Base Value + (Weighted ROI across all projects)
 */
export async function calculateDynamicCoinValue(db: D1Database): Promise<number> {
  // Get all completed projects with investments
  const { results: projects } = await db.prepare(`
    SELECT 
      p.id,
      p.target_capital_eur,
      p.expected_revenue,
      p.cost,
      p.actual_revenue,
      p.profit,
      COALESCE(SUM(pi.amount_eur), 0) as total_invested
    FROM projects p
    LEFT JOIN project_investments pi ON p.id = pi.project_id AND pi.status = 'active'
    WHERE p.status = 'completed'
    GROUP BY p.id
  `).all();

  if (!projects || projects.length === 0) {
    return 10.0; // Base value if no completed projects
  }

  let totalInvested = 0;
  let weightedROI = 0;

  for (const project of projects) {
    const invested = project.total_invested as number;
    const profit = project.profit as number || 0;
    
    if (invested > 0) {
      const projectROI = (profit / invested) * 100; // ROI as percentage
      weightedROI += projectROI * invested; // Weight by investment amount
      totalInvested += invested;
    }
  }

  if (totalInvested === 0) {
    return 10.0;
  }

  // Calculate weighted average ROI
  const avgROI = weightedROI / totalInvested;
  
  // Coin value = Base + (Average ROI percentage converted to euro value)
  // If avg ROI is 15%, coin gains 15% of base value
  const baseValue = 10.0;
  const valueIncrease = baseValue * (avgROI / 100);
  
  return baseValue + valueIncrease;
}

/**
 * Calculate investor's ROI for a specific project
 */
export async function calculateProjectROI(
  db: D1Database, 
  userId: number, 
  projectId: number
): Promise<{ invested: number, currentValue: number, roi: number }> {
  // Get investor's investment in this project
  const investment = await db.prepare(`
    SELECT SUM(amount_eur) as total_invested, SUM(amount_dmc) as total_dmc
    FROM project_investments
    WHERE user_id = ? AND project_id = ? AND status = 'active'
  `).bind(userId, projectId).first();

  if (!investment || !investment.total_invested) {
    return { invested: 0, currentValue: 0, roi: 0 };
  }

  // Get all revenue distributed for this project
  const revenue = await db.prepare(`
    SELECT COALESCE(SUM(amount_eur), 0) as total_revenue
    FROM investor_revenue_payouts
    WHERE user_id = ? AND project_id = ?
  `).bind(userId, projectId).first();

  const invested = investment.total_invested as number;
  const earned = revenue?.total_revenue as number || 0;
  const currentValue = invested + earned;
  const roi = invested > 0 ? ((earned / invested) * 100) : 0;

  return { invested, currentValue, roi };
}

/**
 * Distribute project revenue to investors proportionally
 */
export async function distributeProjectRevenue(
  db: D1Database,
  projectId: number,
  revenueAmount: number,
  distributionDate: string
): Promise<{ investorShare: number, adminShare: number, investorCount: number }> {
  // 80% to investors, 20% to admin
  const investorShare = revenueAmount * 0.8;
  const adminShare = revenueAmount * 0.2;

  // Get all investors in this project
  const { results: investments } = await db.prepare(`
    SELECT user_id, SUM(amount_eur) as total_invested
    FROM project_investments
    WHERE project_id = ? AND status = 'active'
    GROUP BY user_id
  `).bind(projectId).all();

  if (!investments || investments.length === 0) {
    throw new Error('No investors found for this project');
  }

  // Calculate total investment in project
  const totalInvested = investments.reduce((sum, inv) => sum + (inv.total_invested as number), 0);

  // Create project revenue record
  const revenueResult = await db.prepare(`
    INSERT INTO project_revenue (project_id, revenue_date, amount, distributed_to_investors, distributed_to_admin, distribution_completed)
    VALUES (?, ?, ?, ?, ?, 1)
  `).bind(projectId, distributionDate, revenueAmount, investorShare, adminShare).run();

  const revenueId = revenueResult.meta.last_row_id;

  // Distribute to each investor proportionally
  for (const investment of investments) {
    const invested = investment.total_invested as number;
    const share = (invested / totalInvested) * investorShare;
    const roiPercentage = (share / invested) * 100;

    await db.prepare(`
      INSERT INTO investor_revenue_payouts (user_id, project_id, project_revenue_id, amount_eur, payout_method, roi_percentage)
      VALUES (?, ?, ?, ?, 'cash', ?)
    `).bind(investment.user_id, projectId, revenueId, share, roiPercentage).run();
  }

  return { investorShare, adminShare, investorCount: investments.length };
}

/**
 * Get investor's complete portfolio across all projects
 */
export async function getInvestorPortfolio(db: D1Database, userId: number) {
  // Get all project investments
  const { results: investments } = await db.prepare(`
    SELECT 
      pi.project_id,
      p.name as project_name,
      p.status,
      p.category_id,
      pc.name as category_name,
      SUM(pi.amount_dmc) as dmc_invested,
      SUM(pi.amount_eur) as eur_invested,
      AVG(pi.dmc_price_at_investment) as avg_price
    FROM project_investments pi
    JOIN projects p ON pi.project_id = p.id
    LEFT JOIN project_categories pc ON p.category_id = pc.id
    WHERE pi.user_id = ? AND pi.status = 'active'
    GROUP BY pi.project_id
  `).bind(userId).all();

  // Get revenue earned per project
  const { results: revenue } = await db.prepare(`
    SELECT 
      project_id,
      SUM(amount_eur) as total_earned,
      AVG(roi_percentage) as avg_roi
    FROM investor_revenue_payouts
    WHERE user_id = ?
    GROUP BY project_id
  `).bind(userId).all();

  // Combine data
  const portfolioMap = new Map();
  
  for (const inv of investments || []) {
    portfolioMap.set(inv.project_id, {
      projectId: inv.project_id,
      projectName: inv.project_name,
      projectStatus: inv.status,
      category: inv.category_name,
      dmcInvested: inv.dmc_invested,
      eurInvested: inv.eur_invested,
      avgPrice: inv.avg_price,
      revenue: 0,
      roi: 0
    });
  }

  for (const rev of revenue || []) {
    const project = portfolioMap.get(rev.project_id);
    if (project) {
      project.revenue = rev.total_earned;
      project.roi = rev.avg_roi;
      project.currentValue = project.eurInvested + project.revenue;
    }
  }

  return Array.from(portfolioMap.values());
}

/**
 * Process service redemption request
 */
export async function processServiceRedemption(
  db: D1Database,
  userId: number,
  tierId: number,
  projectTitle: string,
  projectDescription: string
): Promise<{ success: boolean, dmcSpent: number }> {
  // Get service tier info
  const tier = await db.prepare(`
    SELECT * FROM service_tiers WHERE id = ? AND active = 1
  `).bind(tierId).first();

  if (!tier) {
    throw new Error('Invalid service tier');
  }

  const dmcCost = tier.dmc_cost as number;

  // Check if user has enough DMC
  const holding = await db.prepare(`
    SELECT coins_owned FROM holdings WHERE user_id = ?
  `).bind(userId).first();

  if (!holding || (holding.coins_owned as number) < dmcCost) {
    throw new Error('Insufficient DMC balance');
  }

  // Deduct DMC from holdings
  const newBalance = (holding.coins_owned as number) - dmcCost;
  await db.prepare(`
    UPDATE holdings SET coins_owned = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
  `).bind(newBalance, userId).run();

  // Create redemption request
  await db.prepare(`
    INSERT INTO service_redemptions (user_id, tier_id, dmc_spent, project_title, project_description, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).bind(userId, tierId, dmcCost, projectTitle, projectDescription).run();

  // Create transaction record
  await db.prepare(`
    INSERT INTO coin_transactions (user_id, transaction_type, coins, price_per_coin, total_amount, payment_status, completed_at)
    VALUES (?, 'service_redemption', ?, 0, 0, 'completed', CURRENT_TIMESTAMP)
  `).bind(userId, dmcCost).run();

  return { success: true, dmcSpent: dmcCost };
}

/**
 * Update investor portfolio summary (for quick access)
 */
export async function updateInvestorPortfolioSummary(db: D1Database, userId: number) {
  // Calculate totals
  const investments = await db.prepare(`
    SELECT 
      SUM(amount_dmc) as total_dmc,
      SUM(amount_eur) as total_eur,
      COUNT(DISTINCT project_id) as active_projects
    FROM project_investments
    WHERE user_id = ? AND status = 'active'
  `).bind(userId).first();

  const revenue = await db.prepare(`
    SELECT SUM(amount_eur) as total_revenue
    FROM investor_revenue_payouts
    WHERE user_id = ?
  `).bind(userId).first();

  const completedProjects = await db.prepare(`
    SELECT COUNT(DISTINCT project_id) as count
    FROM project_investments pi
    JOIN projects p ON pi.project_id = p.id
    WHERE pi.user_id = ? AND p.status = 'completed'
  `).bind(userId).first();

  const totalInvested = investments?.total_eur as number || 0;
  const totalRevenue = revenue?.total_revenue as number || 0;
  const totalROI = totalInvested > 0 ? ((totalRevenue / totalInvested) * 100) : 0;
  const activeProjects = investments?.active_projects as number || 0;
  const avgReturn = activeProjects > 0 ? (totalROI / activeProjects) : 0;

  // Upsert portfolio summary
  await db.prepare(`
    INSERT OR REPLACE INTO investor_portfolios 
    (user_id, total_invested_dmc, total_invested_eur, total_revenue_received, total_roi_percentage, active_projects_count, completed_projects_count, avg_project_return, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    userId,
    investments?.total_dmc || 0,
    totalInvested,
    totalRevenue,
    totalROI,
    activeProjects,
    completedProjects?.count || 0,
    avgReturn
  ).run();
}
