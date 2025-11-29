import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { calculateMLMCommissions, buildReferralTree, generateReferralCode } from './mlm-helpers'
import { 
  calculateDynamicCoinValue, 
  calculateProjectROI, 
  distributeProjectRevenue,
  getInvestorPortfolio,
  processServiceRedemption,
  updateInvestorPortfolioSummary
} from './marketplace-helpers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Static files not supported in Workers - use inline HTML instead

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function getCurrentCoinValue(db: D1Database): Promise<number> {
  const setting = await db.prepare(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'current_coin_value'"
  ).first()
  
  return setting ? parseFloat(setting.setting_value as string) : 10.0
}

async function getTotalCoinsOutstanding(db: D1Database): Promise<number> {
  const result = await db.prepare(
    "SELECT SUM(coins_owned) as total FROM holdings"
  ).first()
  
  return result?.total || 0
}

async function updateCoinValue(db: D1Database, newValue: number) {
  await db.prepare(
    "UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'current_coin_value'"
  ).bind(newValue.toString()).run()
}

// ============================================
// API ROUTES - Authentication & Users
// ============================================

// Simple login (email-based, no password for now)
app.post('/api/auth/login', async (c) => {
  const { email, name } = await c.req.json()
  
  try {
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first()
    
    if (!user) {
      // Create new visitor
      const result = await c.env.DB.prepare(
        "INSERT INTO users (email, name, role) VALUES (?, ?, 'visitor')"
      ).bind(email, name || 'User').run()
      
      user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(result.meta.last_row_id).first()
    }
    
    // Update last login
    await c.env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run()
    
    // Get holding if investor
    let holding = null
    if (user.role === 'investor') {
      holding = await c.env.DB.prepare(
        'SELECT * FROM holdings WHERE user_id = ?'
      ).bind(user.id).first()
    }
    
    return c.json({ user, holding })
  } catch (error: any) {
    return c.json({ error: 'Login failed', details: error.message }, 500)
  }
})

// ============================================
// API ROUTES - Dashboard Statistics
// ============================================

// Get platform statistics (public)
app.get('/api/stats', async (c) => {
  // Mock data for Workers deployment (no D1 database)
  // For full functionality, deploy to Cloudflare Pages with D1
  return c.json({
    current_coin_value: 197.07,
    coins_outstanding: 50,
    total_investors: 4,
    completed_projects: 2,
    total_profit_generated: 31000,
    total_distributed: 21700,
    message: "Demo data - Deploy to Cloudflare Pages for live database"
  })
})

// Get coin value history (for graph)
app.get('/api/stats/history', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM coin_value_history ORDER BY created_at ASC'
    ).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch history', details: error.message }, 500)
  }
})

// ============================================
// API ROUTES - Coin Transactions
// ============================================

// Buy coins
app.post('/api/coins/buy', async (c) => {
  const { userId, coins, paymentMethod } = await c.req.json()
  
  try {
    const currentValue = await getCurrentCoinValue(c.env.DB)
    const totalAmount = coins * currentValue
    
    // Create transaction record
    const txResult = await c.env.DB.prepare(
      `INSERT INTO coin_transactions (user_id, transaction_type, coins, price_per_coin, total_amount, payment_method, payment_status)
       VALUES (?, 'buy', ?, ?, ?, ?, 'pending')`
    ).bind(userId, coins, currentValue, totalAmount, paymentMethod || 'bank_transfer').run()
    
    // For demo, auto-complete the transaction
    await c.env.DB.prepare(
      "UPDATE coin_transactions SET payment_status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(txResult.meta.last_row_id).run()
    
    // Check if user has holding record
    const holding = await c.env.DB.prepare(
      'SELECT * FROM holdings WHERE user_id = ?'
    ).bind(userId).first()
    
    if (holding) {
      // Update existing holding
      const newCoins = (holding.coins_owned as number) + coins
      const newTotalInvested = (holding.total_invested as number) + totalAmount
      const newAvgPrice = newTotalInvested / newCoins
      
      await c.env.DB.prepare(
        'UPDATE holdings SET coins_owned = ?, total_invested = ?, avg_purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).bind(newCoins, newTotalInvested, newAvgPrice, userId).run()
    } else {
      // Create new holding
      await c.env.DB.prepare(
        'INSERT INTO holdings (user_id, coins_owned, total_invested, avg_purchase_price) VALUES (?, ?, ?, ?)'
      ).bind(userId, coins, totalAmount, currentValue).run()
      
      // Upgrade user to investor
      await c.env.DB.prepare(
        "UPDATE users SET role = 'investor' WHERE id = ?"
      ).bind(userId).run()
    }
    
    return c.json({
      success: true,
      transactionId: txResult.meta.last_row_id,
      coins,
      pricePerCoin: currentValue,
      totalAmount,
      message: `Successfully purchased ${coins} DMC for €${totalAmount.toFixed(2)}`
    })
  } catch (error: any) {
    return c.json({ error: 'Purchase failed', details: error.message }, 500)
  }
})

// Request buyback (sell coins)
app.post('/api/coins/sell', async (c) => {
  const { userId, coins } = await c.req.json()
  
  try {
    const holding = await c.env.DB.prepare(
      'SELECT * FROM holdings WHERE user_id = ?'
    ).bind(userId).first()
    
    if (!holding || (holding.coins_owned as number) < coins) {
      return c.json({ error: 'Insufficient coins' }, 400)
    }
    
    const currentValue = await getCurrentCoinValue(c.env.DB)
    const totalAmount = coins * currentValue
    
    // Create buyback request
    const result = await c.env.DB.prepare(
      `INSERT INTO buyback_requests (user_id, coins_to_sell, requested_price, total_amount, status)
       VALUES (?, ?, ?, ?, 'pending')`
    ).bind(userId, coins, currentValue, totalAmount).run()
    
    return c.json({
      success: true,
      requestId: result.meta.last_row_id,
      coins,
      pricePerCoin: currentValue,
      totalAmount,
      message: `Buyback request for ${coins} DMC (€${totalAmount.toFixed(2)}) submitted. Pending admin approval.`
    })
  } catch (error: any) {
    return c.json({ error: 'Buyback request failed', details: error.message }, 500)
  }
})

// Get user's transaction history
app.get('/api/transactions/:userId', async (c) => {
  const userId = c.req.param('userId')
  
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC'
    ).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch transactions', details: error.message }, 500)
  }
})

// ============================================
// API ROUTES - Investor Dashboard
// ============================================

// Get investor portfolio
app.get('/api/investor/:userId/portfolio', async (c) => {
  const userId = c.req.param('userId')
  
  try {
    const holding = await c.env.DB.prepare(
      'SELECT * FROM holdings WHERE user_id = ?'
    ).bind(userId).first()
    
    if (!holding) {
      return c.json({ error: 'No holdings found' }, 404)
    }
    
    const currentValue = await getCurrentCoinValue(c.env.DB)
    const currentWorth = (holding.coins_owned as number) * currentValue
    const totalInvested = holding.total_invested as number
    const unrealizedGain = currentWorth - totalInvested
    const gainPercentage = (unrealizedGain / totalInvested) * 100
    
    return c.json({
      ...holding,
      current_coin_value: currentValue,
      current_worth: currentWorth,
      unrealized_gain: unrealizedGain,
      gain_percentage: gainPercentage
    })
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch portfolio', details: error.message }, 500)
  }
})

// Get buyback requests for user
app.get('/api/investor/:userId/buybacks', async (c) => {
  const userId = c.req.param('userId')
  
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM buyback_requests WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch buyback requests', details: error.message }, 500)
  }
})

// ============================================
// API ROUTES - Projects (Public)
// ============================================

// Get all projects (with marketplace metadata)
app.get('/api/projects', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        p.*,
        pc.name as category_name,
        pc.icon as category_icon,
        pc.color as category_color,
        ROUND((p.current_funding_eur * 100.0 / NULLIF(p.target_capital_eur, 0)), 1) as funding_percentage
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.id
      ORDER BY p.is_featured DESC, p.created_at DESC
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch projects', details: error.message }, 500)
  }
})

// Get single project with detailed info
app.get('/api/projects/:id', async (c) => {
  const projectId = c.req.param('id')
  
  try {
    const project = await c.env.DB.prepare(`
      SELECT 
        p.*,
        pc.name as category_name,
        pc.icon as category_icon,
        ROUND((p.current_funding_eur * 100.0 / NULLIF(p.target_capital_eur, 0)), 1) as funding_percentage
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.id
      WHERE p.id = ?
    `).bind(projectId).first()
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }
    
    // Get investors list
    const { results: investors } = await c.env.DB.prepare(`
      SELECT 
        u.name,
        SUM(pi.amount_dmc) as dmc_invested,
        SUM(pi.amount_eur) as eur_invested
      FROM project_investments pi
      JOIN users u ON pi.user_id = u.id
      WHERE pi.project_id = ? AND pi.status = 'active'
      GROUP BY u.id
      ORDER BY eur_invested DESC
    `).bind(projectId).all()
    
    // Get revenue history
    const { results: revenue } = await c.env.DB.prepare(`
      SELECT * FROM project_revenue
      WHERE project_id = ?
      ORDER BY revenue_date DESC
    `).bind(projectId).all()
    
    return c.json({
      project,
      investors: investors || [],
      revenueHistory: revenue || []
    })
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch project', details: error.message }, 500)
  }
})

// Invest DMC in specific project
app.post('/api/projects/:id/invest', async (c) => {
  const projectId = c.req.param('id')
  const { userId, dmcAmount } = await c.req.json()
  
  try {
    // Get current coin value
    const currentValue = await getCurrentCoinValue(c.env.DB)
    const eurAmount = dmcAmount * currentValue
    
    // Get project
    const project = await c.env.DB.prepare(
      'SELECT * FROM projects WHERE id = ?'
    ).bind(projectId).first()
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }
    
    // Check min/max investment
    if (project.min_investment_eur && eurAmount < (project.min_investment_eur as number)) {
      return c.json({ error: `Minimum investment is €${project.min_investment_eur}` }, 400)
    }
    
    if (project.max_investment_eur && eurAmount > (project.max_investment_eur as number)) {
      return c.json({ error: `Maximum investment is €${project.max_investment_eur}` }, 400)
    }
    
    // Check if user has enough DMC
    const holding = await c.env.DB.prepare(
      'SELECT * FROM holdings WHERE user_id = ?'
    ).bind(userId).first()
    
    if (!holding || (holding.coins_owned as number) < dmcAmount) {
      return c.json({ error: 'Insufficient DMC balance' }, 400)
    }
    
    // Deduct DMC from general holdings
    const newBalance = (holding.coins_owned as number) - dmcAmount
    await c.env.DB.prepare(
      'UPDATE holdings SET coins_owned = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(newBalance, userId).run()
    
    // Create project investment
    await c.env.DB.prepare(`
      INSERT INTO project_investments (user_id, project_id, amount_dmc, amount_eur, dmc_price_at_investment, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(userId, projectId, dmcAmount, eurAmount, currentValue).run()
    
    // Update project funding
    const newFunding = (project.current_funding_eur as number || 0) + eurAmount
    const newInvestorCount = (project.investor_count as number || 0) + 1
    
    await c.env.DB.prepare(`
      UPDATE projects 
      SET current_funding_eur = ?, investor_count = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(newFunding, newInvestorCount, projectId).run()
    
    // Update portfolio summary
    await updateInvestorPortfolioSummary(c.env.DB, userId)
    
    return c.json({
      success: true,
      dmcInvested: dmcAmount,
      eurInvested: eurAmount,
      projectName: project.name,
      message: `Successfully invested ${dmcAmount} DMC (€${eurAmount.toFixed(2)}) in ${project.name}`
    })
  } catch (error: any) {
    return c.json({ error: 'Investment failed', details: error.message }, 500)
  }
})

// Get investor's portfolio (all projects)
app.get('/api/investor/:userId/portfolio/projects', async (c) => {
  const userId = c.req.param('userId')
  
  try {
    const portfolio = await getInvestorPortfolio(c.env.DB, parseInt(userId))
    
    return c.json({ portfolio })
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch portfolio', details: error.message }, 500)
  }
})

// Get project categories
app.get('/api/categories', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM project_categories ORDER BY name'
    ).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch categories', details: error.message }, 500)
  }
})

// Get service tiers
app.get('/api/services', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM service_tiers 
      WHERE active = 1 
      ORDER BY display_order
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch services', details: error.message }, 500)
  }
})

// Redeem service with DMC
app.post('/api/services/redeem', async (c) => {
  const { userId, tierId, projectTitle, projectDescription } = await c.req.json()
  
  try {
    const result = await processServiceRedemption(
      c.env.DB,
      userId,
      tierId,
      projectTitle,
      projectDescription
    )
    
    return c.json({
      success: true,
      dmcSpent: result.dmcSpent,
      message: `Service redemption request submitted! ${result.dmcSpent} DMC spent.`
    })
  } catch (error: any) {
    return c.json({ error: 'Redemption failed', details: error.message }, 500)
  }
})

// Get user's service redemptions
app.get('/api/investor/:userId/redemptions', async (c) => {
  const userId = c.req.param('userId')
  
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        sr.*,
        st.name as tier_name,
        st.service_hours
      FROM service_redemptions sr
      JOIN service_tiers st ON sr.tier_id = st.id
      WHERE sr.user_id = ?
      ORDER BY sr.requested_at DESC
    `).bind(userId).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch redemptions', details: error.message }, 500)
  }
})

// ============================================
// API ROUTES - Admin Panel
// ============================================

// Get all investors
app.get('/api/admin/investors', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT u.*, h.coins_owned, h.total_invested, h.avg_purchase_price
      FROM users u
      LEFT JOIN holdings h ON u.id = h.user_id
      WHERE u.role = 'investor'
      ORDER BY h.coins_owned DESC
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch investors', details: error.message }, 500)
  }
})

// Create new project
app.post('/api/admin/projects', async (c) => {
  const { name, description, category, expectedRevenue, cost, startDate, expectedCompletion, clientName } = await c.req.json()
  
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO projects (name, description, category, expected_revenue, cost, status, start_date, expected_completion, client_name)
       VALUES (?, ?, ?, ?, ?, 'planned', ?, ?, ?)`
    ).bind(name, description, category, expectedRevenue, cost, startDate, expectedCompletion, clientName).run()
    
    return c.json({
      success: true,
      projectId: result.meta.last_row_id,
      message: 'Project created successfully'
    })
  } catch (error: any) {
    return c.json({ error: 'Failed to create project', details: error.message }, 500)
  }
})

// Update project
app.put('/api/admin/projects/:id', async (c) => {
  const projectId = c.req.param('id')
  const updates = await c.req.json()
  
  try {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ')
    const values = Object.values(updates)
    
    await c.env.DB.prepare(
      `UPDATE projects SET ${fields} WHERE id = ?`
    ).bind(...values, projectId).run()
    
    return c.json({ success: true, message: 'Project updated' })
  } catch (error: any) {
    return c.json({ error: 'Failed to update project', details: error.message }, 500)
  }
})

// Complete project and distribute profits
app.post('/api/admin/projects/:id/complete', async (c) => {
  const projectId = c.req.param('id')
  const { actualRevenue } = await c.req.json()
  
  try {
    // Get project details
    const project = await c.env.DB.prepare(
      'SELECT * FROM projects WHERE id = ?'
    ).bind(projectId).first()
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }
    
    const cost = project.cost as number
    const profit = actualRevenue - cost
    
    if (profit <= 0) {
      return c.json({ error: 'No profit to distribute' }, 400)
    }
    
    // Calculate distribution (80/20 split)
    const toCoinPool = profit * 0.8
    const toAdmin = profit * 0.2
    
    // Get total coins outstanding
    const coinsOutstanding = await getTotalCoinsOutstanding(c.env.DB)
    const valueIncreasePerCoin = toCoinPool / coinsOutstanding
    
    // Update project
    await c.env.DB.prepare(
      `UPDATE projects SET actual_revenue = ?, profit = ?, status = 'completed', actual_completion = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(actualRevenue, profit, projectId).run()
    
    // Create distribution record
    await c.env.DB.prepare(
      `INSERT INTO distributions (project_id, total_profit, to_coin_pool, to_admin, coins_outstanding, value_increase_per_coin)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(projectId, profit, toCoinPool, toAdmin, coinsOutstanding, valueIncreasePerCoin).run()
    
    // Update coin value
    const currentValue = await getCurrentCoinValue(c.env.DB)
    const newValue = currentValue + valueIncreasePerCoin
    await updateCoinValue(c.env.DB, newValue)
    
    // Record in history
    await c.env.DB.prepare(
      `INSERT INTO coin_value_history (coin_value, coins_outstanding, total_coin_pool, reason, reference_id)
       SELECT ?, ?, SUM(to_coin_pool), 'project_distribution', ?
       FROM distributions`
    ).bind(newValue, coinsOutstanding, projectId).run()
    
    return c.json({
      success: true,
      profit,
      toCoinPool,
      toAdmin,
      valueIncreasePerCoin,
      newCoinValue: newValue,
      message: `Project completed! Coin value increased by €${valueIncreasePerCoin.toFixed(2)} to €${newValue.toFixed(2)}`
    })
  } catch (error: any) {
    return c.json({ error: 'Failed to complete project', details: error.message }, 500)
  }
})

// Get pending buyback requests
app.get('/api/admin/buybacks', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT b.*, u.name, u.email
      FROM buyback_requests b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch buyback requests', details: error.message }, 500)
  }
})

// Approve/reject buyback request
app.post('/api/admin/buybacks/:id/:action', async (c) => {
  const requestId = c.req.param('id')
  const action = c.req.param('action') // 'approve' or 'reject'
  const { adminNotes } = await c.req.json()
  
  try {
    const request = await c.env.DB.prepare(
      'SELECT * FROM buyback_requests WHERE id = ?'
    ).bind(requestId).first()
    
    if (!request) {
      return c.json({ error: 'Request not found' }, 404)
    }
    
    if (action === 'approve') {
      // Update holding
      const holding = await c.env.DB.prepare(
        'SELECT * FROM holdings WHERE user_id = ?'
      ).bind(request.user_id).first()
      
      const newCoins = (holding.coins_owned as number) - (request.coins_to_sell as number)
      const newInvested = (holding.total_invested as number) - ((request.coins_to_sell as number) * (holding.avg_purchase_price as number))
      
      await c.env.DB.prepare(
        'UPDATE holdings SET coins_owned = ?, total_invested = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).bind(newCoins, newInvested, request.user_id).run()
      
      // Create sell transaction
      await c.env.DB.prepare(
        `INSERT INTO coin_transactions (user_id, transaction_type, coins, price_per_coin, total_amount, payment_status, completed_at)
         VALUES (?, 'sell', ?, ?, ?, 'completed', CURRENT_TIMESTAMP)`
      ).bind(request.user_id, request.coins_to_sell, request.requested_price, request.total_amount).run()
      
      // Update request status
      await c.env.DB.prepare(
        "UPDATE buyback_requests SET status = 'completed', admin_notes = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(adminNotes || 'Approved', requestId).run()
      
      return c.json({ success: true, message: 'Buyback approved and processed' })
    } else {
      // Reject
      await c.env.DB.prepare(
        "UPDATE buyback_requests SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(adminNotes || 'Rejected', requestId).run()
      
      return c.json({ success: true, message: 'Buyback rejected' })
    }
  } catch (error: any) {
    return c.json({ error: 'Failed to process buyback', details: error.message }, 500)
  }
})

// Admin dashboard stats
app.get('/api/admin/dashboard', async (c) => {
  try {
    const stats = await c.env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'investor') as total_investors,
        (SELECT SUM(coins_owned) FROM holdings) as total_coins_sold,
        (SELECT SUM(total_invested) FROM holdings) as total_capital_raised,
        (SELECT COUNT(*) FROM projects WHERE status = 'in_progress') as active_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'completed') as completed_projects,
        (SELECT SUM(profit) FROM projects WHERE status = 'completed') as total_profit,
        (SELECT SUM(to_admin) FROM distributions) as admin_earnings,
        (SELECT COUNT(*) FROM buyback_requests WHERE status = 'pending') as pending_buybacks
    `).first()
    
    const currentValue = await getCurrentCoinValue(c.env.DB)
    
    return c.json({ ...stats, current_coin_value: currentValue })
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch dashboard stats', details: error.message }, 500)
  }
})

// ============================================
// API ROUTES - Admin Marketplace Management
// ============================================

// Add project revenue and distribute to investors
app.post('/api/admin/projects/:id/revenue', async (c) => {
  const projectId = c.req.param('id')
  const { revenueAmount, revenueDate } = await c.req.json()
  
  try {
    const result = await distributeProjectRevenue(
      c.env.DB,
      parseInt(projectId),
      revenueAmount,
      revenueDate || new Date().toISOString().split('T')[0]
    )
    
    // Update all investor portfolio summaries
    const { results: investors } = await c.env.DB.prepare(`
      SELECT DISTINCT user_id FROM project_investments WHERE project_id = ?
    `).bind(projectId).all()
    
    for (const inv of investors || []) {
      await updateInvestorPortfolioSummary(c.env.DB, inv.user_id as number)
    }
    
    return c.json({
      success: true,
      investorShare: result.investorShare,
      adminShare: result.adminShare,
      investorCount: result.investorCount,
      message: `Revenue distributed: €${result.investorShare.toFixed(2)} to ${result.investorCount} investors, €${result.adminShare.toFixed(2)} to admin`
    })
  } catch (error: any) {
    return c.json({ error: 'Revenue distribution failed', details: error.message }, 500)
  }
})

// Get all service redemption requests
app.get('/api/admin/redemptions', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        sr.*,
        u.name as user_name,
        u.email as user_email,
        st.name as tier_name,
        st.service_hours
      FROM service_redemptions sr
      JOIN users u ON sr.user_id = u.id
      JOIN service_tiers st ON sr.tier_id = st.id
      ORDER BY sr.requested_at DESC
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch redemptions', details: error.message }, 500)
  }
})

// Update service redemption status
app.post('/api/admin/redemptions/:id/:action', async (c) => {
  const redemptionId = c.req.param('id')
  const action = c.req.param('action') // 'approve', 'reject', 'complete'
  const { adminNotes } = await c.req.json()
  
  try {
    let status = 'pending'
    if (action === 'approve') status = 'in_progress'
    else if (action === 'reject') status = 'rejected'
    else if (action === 'complete') status = 'completed'
    
    const timestampField = action === 'approve' ? 'approved_at' : 'completed_at'
    
    await c.env.DB.prepare(`
      UPDATE service_redemptions 
      SET status = ?, admin_notes = ?, ${timestampField} = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(status, adminNotes || '', redemptionId).run()
    
    return c.json({ success: true, message: `Redemption ${action}d` })
  } catch (error: any) {
    return c.json({ error: 'Failed to update redemption', details: error.message }, 500)
  }
})

// Get marketplace analytics
app.get('/api/admin/marketplace/analytics', async (c) => {
  try {
    const stats = await c.env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM projects WHERE status = 'funding') as funding_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
        (SELECT COALESCE(SUM(current_funding_eur), 0) FROM projects) as total_funding,
        (SELECT COALESCE(SUM(target_capital_eur), 0) FROM projects WHERE status IN ('funding', 'active')) as total_target,
        (SELECT COALESCE(SUM(amount_eur), 0) FROM project_revenue) as total_revenue_distributed,
        (SELECT COUNT(DISTINCT user_id) FROM project_investments) as active_investors,
        (SELECT COUNT(*) FROM service_redemptions WHERE status = 'pending') as pending_redemptions
    `).first()
    
    return c.json(stats)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch analytics', details: error.message }, 500)
  }
})

// ============================================
// MAIN FRONTEND PAGE
// ============================================

// ============================================
// MAIN FRONTEND PAGE
// ============================================

app.get('/', (c) => {
  // Simplified marketplace interface - NO DATABASE (Workers doesn't have D1 in free tier)
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Domenico Marketplace - AI Investment Platform</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
    <nav class="bg-gradient-to-r from-blue-900 to-blue-600 text-white shadow-xl">
        <div class="container mx-auto px-4 py-4">
            <div class="flex items-center space-x-4">
                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e3a8a 100%); border: 4px solid #1e40af; border-radius: 50%; width: 60px; height: 60px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px; box-shadow: 0 6px 12px rgba(0,0,0,0.4);">DMC</div>
                <div>
                    <h1 class="text-2xl font-bold">Domenico Marketplace</h1>
                    <p class="text-sm opacity-90">Project-Specific AI Investment Platform</p>
                </div>
            </div>
        </div>
    </nav>
    
    <div class="container mx-auto px-4 py-12">
        <div class="max-w-4xl mx-auto">
            <div class="bg-white rounded-2xl shadow-2xl p-12 text-center">
                <i class="fas fa-rocket text-6xl text-blue-600 mb-6"></i>
                <h2 class="text-4xl font-bold text-gray-800 mb-4">Platform Successfully Deployed!</h2>
                <p class="text-xl text-gray-600 mb-8">Domenico Coins Marketplace is LIVE on Cloudflare Workers 🎉</p>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-blue-50 p-6 rounded-xl">
                        <div class="text-3xl font-bold text-blue-600">€197.07</div>
                        <div class="text-sm text-gray-600">DMC Value</div>
                    </div>
                    <div class="bg-green-50 p-6 rounded-xl">
                        <div class="text-3xl font-bold text-green-600">2</div>
                        <div class="text-sm text-gray-600">Projects</div>
                    </div>
                    <div class="bg-purple-50 p-6 rounded-xl">
                        <div class="text-3xl font-bold text-purple-600">€9,851</div>
                        <div class="text-sm text-gray-600">Total Invested</div>
                    </div>
                </div>
                
                <div class="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg mb-8">
                    <p class="text-left text-gray-700">
                        <strong>⚠️ Note:</strong> Full marketplace functionality (database, auth, investments) requires Cloudflare Pages with D1 database. 
                        This Workers deployment shows the platform is live and accessible. To enable full functionality, redeploy to Cloudflare Pages.
                    </p>
                </div>
                
                <div class="space-y-4">
                    <a href="/api/stats" class="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition">
                        <i class="fas fa-chart-line mr-2"></i>Test API Stats
                    </a>
                    <br>
                    <a href="https://github.com/dominique-dejonghe/domenico" class="inline-block bg-gray-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-900 transition">
                        <i class="fab fa-github mr-2"></i>View Source Code
                    </a>
                </div>
            </div>
        </div>
    </div>
    
    <footer class="bg-gray-800 text-white text-center py-6 mt-12">
        <p>&copy; 2025 Domenico Marketplace. Deployed on Cloudflare Workers.</p>
        <p class="text-sm opacity-75 mt-2">🚀 Built with Hono + TypeScript + Cloudflare</p>
    </footer>
</body>
</html>`)
})

// Old interface (kept for backwards compatibility)
app.get('/legacy', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Domenico Coins - Invest in AI Innovation</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          .coin-logo {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e3a8a 100%);
            border: 4px solid #1e40af;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 24px;
            box-shadow: 0 6px 12px rgba(0,0,0,0.4);
          }
          .gradient-bg {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          }
          .stat-card {
            transition: transform 0.3s;
          }
          .stat-card:hover {
            transform: translateY(-5px);
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="gradient-bg text-white shadow-xl">
            <div class="container mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="coin-logo">DMC</div>
                        <div>
                            <h1 class="text-2xl font-bold">Domenico Coins</h1>
                            <p class="text-sm opacity-90">Invest in AI Innovation</p>
                        </div>
                    </div>
                    <div id="user-nav" class="hidden">
                        <div class="flex items-center space-x-4">
                            <div class="text-right">
                                <div class="text-xs opacity-80">Welcome</div>
                                <div id="nav-user-name" class="font-bold"></div>
                            </div>
                            <div class="bg-white text-blue-900 px-4 py-2 rounded-lg font-bold" id="nav-role-badge"></div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <div class="container mx-auto px-4 py-8">
            <!-- Login Section -->
            <div id="login-section" class="max-w-2xl mx-auto">
                <!-- Hero Section -->
                <div class="bg-white rounded-lg shadow-xl p-8 mb-8 text-center">
                    <div class="coin-logo mx-auto mb-6"></div>
                    <h2 class="text-3xl font-bold text-gray-800 mb-4">
                        Invest in Dominique Dejonghe's AI Projects
                    </h2>
                    <p class="text-gray-600 mb-6">
                        Join the investment platform where your capital funds cutting-edge AI & software development projects. 
                        Watch your investment grow as projects deliver profits.
                    </p>
                    
                    <!-- Live Stats -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" id="public-stats">
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <div class="text-2xl font-bold text-blue-900" id="stat-coin-value">€10.00</div>
                            <div class="text-sm text-gray-600">Coin Value</div>
                        </div>
                        <div class="bg-green-50 p-4 rounded-lg">
                            <div class="text-2xl font-bold text-green-900" id="stat-investors">0</div>
                            <div class="text-sm text-gray-600">Investors</div>
                        </div>
                        <div class="bg-purple-50 p-4 rounded-lg">
                            <div class="text-2xl font-bold text-purple-900" id="stat-projects">0</div>
                            <div class="text-sm text-gray-600">Projects</div>
                        </div>
                        <div class="bg-orange-50 p-4 rounded-lg">
                            <div class="text-2xl font-bold text-orange-900" id="stat-profit">€0</div>
                            <div class="text-sm text-gray-600">Distributed</div>
                        </div>
                    </div>
                    
                    <!-- Login Form -->
                    <div class="bg-gray-50 p-6 rounded-lg">
                        <h3 class="text-xl font-bold mb-4">Get Started</h3>
                        <div class="space-y-4">
                            <input type="email" id="login-email" placeholder="Your email" 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            <input type="text" id="login-name" placeholder="Your name" 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            <button onclick="login()" 
                                    class="w-full gradient-bg text-white font-bold py-3 rounded-lg hover:opacity-90 transition">
                                Sign In / Register
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main App (hidden until login) -->
            <div id="app" class="hidden">
                <!-- Role-based content will be loaded here -->
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          let currentUser = null;
          
          // Load public stats on page load
          loadPublicStats();
          
          async function loadPublicStats() {
            try {
              const response = await axios.get('/api/stats');
              const stats = response.data;
              
              document.getElementById('stat-coin-value').textContent = '€' + stats.current_coin_value.toFixed(2);
              document.getElementById('stat-investors').textContent = stats.total_investors || 0;
              document.getElementById('stat-projects').textContent = stats.completed_projects || 0;
              document.getElementById('stat-profit').textContent = '€' + ((stats.total_distributed || 0).toFixed(0));
            } catch (error) {
              console.error('Failed to load stats:', error);
            }
          }
          
          async function login() {
            const email = document.getElementById('login-email').value;
            const name = document.getElementById('login-name').value;
            
            if (!email) {
              alert('Please enter your email');
              return;
            }
            
            try {
              const response = await axios.post('/api/auth/login', { email, name });
              currentUser = response.data.user;
              
              document.getElementById('login-section').classList.add('hidden');
              document.getElementById('app').classList.remove('hidden');
              document.getElementById('user-nav').classList.remove('hidden');
              document.getElementById('nav-user-name').textContent = currentUser.name;
              
              // Load appropriate interface based on role
              if (currentUser.role === 'admin') {
                document.getElementById('nav-role-badge').textContent = 'ADMIN';
                document.getElementById('nav-role-badge').classList.add('bg-red-100', 'text-red-900');
                loadAdminInterface();
              } else if (currentUser.role === 'investor') {
                document.getElementById('nav-role-badge').textContent = 'INVESTOR';
                document.getElementById('nav-role-badge').classList.add('bg-green-100', 'text-green-900');
                loadInvestorInterface();
              } else {
                document.getElementById('nav-role-badge').textContent = 'VISITOR';
                document.getElementById('nav-role-badge').classList.add('bg-gray-100', 'text-gray-900');
                loadVisitorInterface();
              }
            } catch (error) {
              alert('Login failed: ' + error.message);
            }
          }
          
          function loadVisitorInterface() {
            document.getElementById('app').innerHTML = \`
              <div class="max-w-4xl mx-auto">
                <div class="bg-white rounded-lg shadow-xl p-8 mb-8">
                  <h2 class="text-2xl font-bold mb-4">
                    <i class="fas fa-shopping-cart mr-2"></i>Become an Investor
                  </h2>
                  <p class="text-gray-600 mb-6">
                    Purchase Domenico Coins (DMC) to start building your portfolio. Each coin represents a share in the collective profit pool from AI & software projects.
                  </p>
                  
                  <div class="bg-blue-50 p-6 rounded-lg mb-6">
                    <h3 class="font-bold text-lg mb-2">Current Coin Value</h3>
                    <div class="text-4xl font-bold text-blue-900" id="visitor-coin-value">Loading...</div>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="border-2 border-blue-500 rounded-lg p-4 cursor-pointer hover:bg-blue-50" onclick="buyCoins(10)">
                      <div class="text-center">
                        <div class="text-2xl font-bold">10 DMC</div>
                        <div class="text-gray-600" id="package-10">€100</div>
                      </div>
                    </div>
                    <div class="border-2 border-blue-500 rounded-lg p-4 cursor-pointer hover:bg-blue-50" onclick="buyCoins(50)">
                      <div class="text-center">
                        <div class="text-2xl font-bold">50 DMC</div>
                        <div class="text-gray-600" id="package-50">€500</div>
                      </div>
                    </div>
                    <div class="border-2 border-blue-500 rounded-lg p-4 cursor-pointer hover:bg-blue-50" onclick="buyCoins(100)">
                      <div class="text-center">
                        <div class="text-2xl font-bold">100 DMC</div>
                        <div class="text-gray-600" id="package-100">€1000</div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="space-y-2">
                    <label class="block font-medium">Or enter custom amount:</label>
                    <div class="flex space-x-2">
                      <input type="number" id="custom-coins" class="flex-1 px-4 py-2 border rounded-lg" placeholder="Number of coins" min="1">
                      <button onclick="buyCoinsCustom()" class="gradient-bg text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90">
                        Purchase
                      </button>
                    </div>
                  </div>
                </div>
                
                <div class="bg-white rounded-lg shadow-xl p-8">
                  <h2 class="text-2xl font-bold mb-4">
                    <i class="fas fa-project-diagram mr-2"></i>View Projects
                  </h2>
                  <div id="visitor-projects"></div>
                </div>
              </div>
            \`;
            
            loadVisitorData();
          }
          
          async function loadVisitorData() {
            try {
              const statsResponse = await axios.get('/api/stats');
              const value = statsResponse.data.current_coin_value;
              document.getElementById('visitor-coin-value').textContent = '€' + value.toFixed(2);
              document.getElementById('package-10').textContent = '€' + (10 * value).toFixed(2);
              document.getElementById('package-50').textContent = '€' + (50 * value).toFixed(2);
              document.getElementById('package-100').textContent = '€' + (100 * value).toFixed(2);
              
              const projectsResponse = await axios.get('/api/projects');
              const projects = projectsResponse.data;
              
              const html = projects.map(p => \`
                <div class="border-l-4 border-blue-500 bg-gray-50 p-4 mb-4 rounded">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <h3 class="font-bold text-lg">\${p.name}</h3>
                      <p class="text-gray-600 text-sm mb-2">\${p.description || 'No description'}</p>
                      <div class="flex items-center space-x-4 text-sm">
                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">\${p.category}</span>
                        <span class="bg-\${p.status === 'completed' ? 'green' : p.status === 'in_progress' ? 'yellow' : 'gray'}-100 text-\${p.status === 'completed' ? 'green' : p.status === 'in_progress' ? 'yellow' : 'gray'}-800 px-2 py-1 rounded uppercase">\${p.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                    \${p.profit ? \`<div class="text-right"><div class="text-green-600 font-bold">+€\${p.profit.toFixed(0)} profit</div></div>\` : ''}
                  </div>
                </div>
              \`).join('');
              
              document.getElementById('visitor-projects').innerHTML = html;
            } catch (error) {
              console.error('Failed to load visitor data:', error);
            }
          }
          
          async function buyCoins(coins) {
            if (!currentUser) return;
            
            if (!confirm(\`Purchase \${coins} Domenico Coins?\`)) return;
            
            try {
              const response = await axios.post('/api/coins/buy', {
                userId: currentUser.id,
                coins: coins,
                paymentMethod: 'demo'
              });
              
              alert(response.data.message);
              
              // Reload as investor
              const loginResponse = await axios.post('/api/auth/login', { 
                email: currentUser.email, 
                name: currentUser.name 
              });
              currentUser = loginResponse.data.user;
              loadInvestorInterface();
            } catch (error) {
              alert('Purchase failed: ' + error.response?.data?.error);
            }
          }
          
          async function buyCoinsCustom() {
            const coins = parseFloat(document.getElementById('custom-coins').value);
            if (!coins || coins <= 0) {
              alert('Please enter a valid amount');
              return;
            }
            await buyCoins(coins);
          }
          
          function loadInvestorInterface() {
            document.getElementById('app').innerHTML = \`
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Portfolio Overview -->
                <div class="lg:col-span-2 space-y-6">
                  <div class="bg-white rounded-lg shadow-xl p-8">
                    <h2 class="text-2xl font-bold mb-6">
                      <i class="fas fa-wallet mr-2"></i>My Portfolio
                    </h2>
                    <div id="portfolio-data"></div>
                  </div>
                  
                  <div class="bg-white rounded-lg shadow-xl p-8">
                    <h2 class="text-2xl font-bold mb-6">
                      <i class="fas fa-chart-line mr-2"></i>Coin Value History
                    </h2>
                    <canvas id="value-chart"></canvas>
                  </div>
                  
                  <div class="bg-white rounded-lg shadow-xl p-8">
                    <h2 class="text-2xl font-bold mb-6">
                      <i class="fas fa-history mr-2"></i>Transaction History
                    </h2>
                    <div id="transactions-list"></div>
                  </div>
                </div>
                
                <!-- Actions Sidebar -->
                <div class="space-y-6">
                  <div class="bg-white rounded-lg shadow-xl p-6">
                    <h3 class="text-xl font-bold mb-4">Quick Actions</h3>
                    <div class="space-y-3">
                      <button onclick="showBuyMore()" class="w-full gradient-bg text-white py-3 rounded-lg font-semibold hover:opacity-90">
                        <i class="fas fa-plus-circle mr-2"></i>Buy More Coins
                      </button>
                      <button onclick="showSellCoins()" class="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold">
                        <i class="fas fa-money-bill-wave mr-2"></i>Request Buyback
                      </button>
                    </div>
                  </div>
                  
                  <div class="bg-white rounded-lg shadow-xl p-6">
                    <h3 class="text-xl font-bold mb-4">Active Projects</h3>
                    <div id="active-projects-sidebar"></div>
                  </div>
                  
                  <div class="bg-white rounded-lg shadow-xl p-6">
                    <h3 class="text-xl font-bold mb-4">My Buyback Requests</h3>
                    <div id="buyback-requests-list"></div>
                  </div>
                </div>
              </div>
            \`;
            
            loadInvestorData();
          }
          
          async function loadInvestorData() {
            try {
              // Load portfolio
              const portfolioResponse = await axios.get('/api/investor/' + currentUser.id + '/portfolio');
              const portfolio = portfolioResponse.data;
              
              const portfolioHtml = \`
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div class="stat-card bg-blue-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-blue-900">\${portfolio.coins_owned.toFixed(2)}</div>
                    <div class="text-sm text-gray-600">DMC Owned</div>
                  </div>
                  <div class="stat-card bg-green-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-green-900">€\${portfolio.current_worth.toFixed(2)}</div>
                    <div class="text-sm text-gray-600">Current Value</div>
                  </div>
                  <div class="stat-card bg-purple-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-purple-900">€\${portfolio.unrealized_gain.toFixed(2)}</div>
                    <div class="text-sm text-gray-600">Unrealized Gain</div>
                  </div>
                  <div class="stat-card bg-orange-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-orange-900">\${portfolio.gain_percentage > 0 ? '+' : ''}\${portfolio.gain_percentage.toFixed(1)}%</div>
                    <div class="text-sm text-gray-600">ROI</div>
                  </div>
                </div>
                <div class="border-t pt-4">
                  <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span class="text-gray-600">Total Invested:</span>
                      <span class="font-bold ml-2">€\${portfolio.total_invested.toFixed(2)}</span>
                    </div>
                    <div>
                      <span class="text-gray-600">Avg Purchase Price:</span>
                      <span class="font-bold ml-2">€\${portfolio.avg_purchase_price.toFixed(2)}</span>
                    </div>
                    <div>
                      <span class="text-gray-600">Current Coin Value:</span>
                      <span class="font-bold ml-2">€\${portfolio.current_coin_value.toFixed(2)}</span>
                    </div>
                    <div>
                      <span class="text-gray-600">Value Increase:</span>
                      <span class="font-bold ml-2 text-green-600">€\${(portfolio.current_coin_value - portfolio.avg_purchase_price).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              \`;
              
              document.getElementById('portfolio-data').innerHTML = portfolioHtml;
              
              // Load chart
              const historyResponse = await axios.get('/api/stats/history');
              const history = historyResponse.data;
              
              const ctx = document.getElementById('value-chart').getContext('2d');
              new Chart(ctx, {
                type: 'line',
                data: {
                  labels: history.map(h => new Date(h.created_at).toLocaleDateString()),
                  datasets: [{
                    label: 'Coin Value (€)',
                    data: history.map(h => h.coin_value),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                  }]
                },
                options: {
                  responsive: true,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    y: {
                      beginAtZero: false,
                      ticks: {
                        callback: function(value) {
                          return '€' + value.toFixed(0);
                        }
                      }
                    }
                  }
                }
              });
              
              // Load transactions
              const txResponse = await axios.get('/api/transactions/' + currentUser.id);
              const transactions = txResponse.data;
              
              const txHtml = transactions.map(tx => \`
                <div class="flex items-center justify-between py-3 border-b">
                  <div>
                    <div class="font-medium">
                      <i class="fas fa-\${tx.transaction_type === 'buy' ? 'arrow-down text-green-600' : 'arrow-up text-red-600'}"></i>
                      \${tx.transaction_type === 'buy' ? 'Purchased' : 'Sold'} \${tx.coins.toFixed(2)} DMC
                    </div>
                    <div class="text-sm text-gray-500">\${new Date(tx.created_at).toLocaleString()}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold">€\${tx.total_amount.toFixed(2)}</div>
                    <div class="text-sm text-gray-500">@€\${tx.price_per_coin.toFixed(2)}/coin</div>
                  </div>
                </div>
              \`).join('');
              
              document.getElementById('transactions-list').innerHTML = txHtml || '<p class="text-gray-500">No transactions yet</p>';
              
              // Load active projects
              const projectsResponse = await axios.get('/api/projects');
              const activeProjects = projectsResponse.data.filter(p => p.status === 'in_progress');
              
              const projectsHtml = activeProjects.map(p => \`
                <div class="bg-gray-50 p-3 rounded mb-2">
                  <div class="font-medium text-sm">\${p.name}</div>
                  <div class="text-xs text-gray-500">\${p.category}</div>
                </div>
              \`).join('');
              
              document.getElementById('active-projects-sidebar').innerHTML = projectsHtml || '<p class="text-sm text-gray-500">No active projects</p>';
              
              // Load buyback requests
              const buybackResponse = await axios.get('/api/investor/' + currentUser.id + '/buybacks');
              const buybacks = buybackResponse.data;
              
              const buybackHtml = buybacks.map(b => \`
                <div class="bg-gray-50 p-3 rounded mb-2">
                  <div class="flex justify-between items-start">
                    <div>
                      <div class="font-medium text-sm">\${b.coins_to_sell} DMC</div>
                      <div class="text-xs text-gray-500">€\${b.total_amount.toFixed(2)}</div>
                    </div>
                    <span class="text-xs px-2 py-1 rounded bg-\${b.status === 'completed' ? 'green' : b.status === 'rejected' ? 'red' : 'yellow'}-100 text-\${b.status === 'completed' ? 'green' : b.status === 'rejected' ? 'red' : 'yellow'}-800 uppercase">\${b.status}</span>
                  </div>
                </div>
              \`).join('');
              
              document.getElementById('buyback-requests-list').innerHTML = buybackHtml || '<p class="text-sm text-gray-500">No requests</p>';
            } catch (error) {
              console.error('Failed to load investor data:', error);
            }
          }
          
          async function showBuyMore() {
            const coins = prompt('How many DMC do you want to purchase?');
            if (!coins || parseFloat(coins) <= 0) return;
            
            await buyCoins(parseFloat(coins));
          }
          
          async function showSellCoins() {
            const coins = prompt('How many DMC do you want to sell?');
            if (!coins || parseFloat(coins) <= 0) return;
            
            try {
              const response = await axios.post('/api/coins/sell', {
                userId: currentUser.id,
                coins: parseFloat(coins)
              });
              
              alert(response.data.message);
              loadInvestorData();
            } catch (error) {
              alert('Sell request failed: ' + error.response?.data?.error);
            }
          }
          
          function loadAdminInterface() {
            document.getElementById('app').innerHTML = \`
              <div class="space-y-8">
                <!-- Admin Dashboard -->
                <div class="bg-white rounded-lg shadow-xl p-8">
                  <h2 class="text-2xl font-bold mb-6">
                    <i class="fas fa-tachometer-alt mr-2"></i>Admin Dashboard
                  </h2>
                  <div id="admin-stats"></div>
                </div>
                
                <!-- Tabs -->
                <div class="bg-white rounded-lg shadow-xl">
                  <div class="flex border-b">
                    <button onclick="showAdminTab('projects')" id="tab-projects" class="flex-1 py-4 px-6 font-semibold text-blue-600 border-b-2 border-blue-600">
                      <i class="fas fa-project-diagram mr-2"></i>Projects
                    </button>
                    <button onclick="showAdminTab('investors')" id="tab-investors" class="flex-1 py-4 px-6 font-semibold text-gray-600 hover:text-blue-600">
                      <i class="fas fa-users mr-2"></i>Investors
                    </button>
                    <button onclick="showAdminTab('buybacks')" id="tab-buybacks" class="flex-1 py-4 px-6 font-semibold text-gray-600 hover:text-blue-600">
                      <i class="fas fa-money-check-alt mr-2"></i>Buyback Requests
                    </button>
                  </div>
                  
                  <div class="p-8">
                    <!-- Projects Tab -->
                    <div id="content-projects">
                      <div class="mb-6">
                        <button onclick="showNewProjectForm()" class="gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90">
                          <i class="fas fa-plus mr-2"></i>New Project
                        </button>
                      </div>
                      <div id="projects-list"></div>
                    </div>
                    
                    <!-- Investors Tab -->
                    <div id="content-investors" class="hidden">
                      <div id="investors-list"></div>
                    </div>
                    
                    <!-- Buybacks Tab -->
                    <div id="content-buybacks" class="hidden">
                      <div id="buybacks-list"></div>
                    </div>
                  </div>
                </div>
              </div>
            \`;
            
            loadAdminData();
          }
          
          async function loadAdminData() {
            try {
              // Load dashboard stats
              const statsResponse = await axios.get('/api/admin/dashboard');
              const stats = statsResponse.data;
              
              const statsHtml = \`
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div class="stat-card bg-blue-50 p-6 rounded-lg">
                    <div class="text-3xl font-bold text-blue-900">\${stats.total_investors || 0}</div>
                    <div class="text-sm text-gray-600">Total Investors</div>
                  </div>
                  <div class="stat-card bg-green-50 p-6 rounded-lg">
                    <div class="text-3xl font-bold text-green-900">€\${(stats.total_capital_raised || 0).toFixed(0)}</div>
                    <div class="text-sm text-gray-600">Capital Raised</div>
                  </div>
                  <div class="stat-card bg-purple-50 p-6 rounded-lg">
                    <div class="text-3xl font-bold text-purple-900">\${stats.completed_projects || 0}</div>
                    <div class="text-sm text-gray-600">Projects Done</div>
                  </div>
                  <div class="stat-card bg-orange-50 p-6 rounded-lg">
                    <div class="text-3xl font-bold text-orange-900">€\${(stats.admin_earnings || 0).toFixed(0)}</div>
                    <div class="text-sm text-gray-600">Your Earnings (20%)</div>
                  </div>
                </div>
                <div class="mt-6 grid grid-cols-3 gap-4 text-center border-t pt-6">
                  <div>
                    <div class="text-2xl font-bold">€\${stats.current_coin_value.toFixed(2)}</div>
                    <div class="text-sm text-gray-600">Current Coin Value</div>
                  </div>
                  <div>
                    <div class="text-2xl font-bold">\${stats.active_projects || 0}</div>
                    <div class="text-sm text-gray-600">Active Projects</div>
                  </div>
                  <div>
                    <div class="text-2xl font-bold text-yellow-600">\${stats.pending_buybacks || 0}</div>
                    <div class="text-sm text-gray-600">Pending Buybacks</div>
                  </div>
                </div>
              \`;
              
              document.getElementById('admin-stats').innerHTML = statsHtml;
              
              // Load projects
              const projectsResponse = await axios.get('/api/projects');
              const projects = projectsResponse.data;
              
              const projectsHtml = projects.map(p => \`
                <div class="border rounded-lg p-6 mb-4 \${p.status === 'completed' ? 'bg-green-50' : p.status === 'in_progress' ? 'bg-blue-50' : 'bg-gray-50'}">
                  <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                      <h3 class="text-xl font-bold">\${p.name}</h3>
                      <p class="text-gray-600">\${p.description || 'No description'}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm font-semibold bg-\${p.status === 'completed' ? 'green' : p.status === 'in_progress' ? 'blue' : 'gray'}-200 text-\${p.status === 'completed' ? 'green' : p.status === 'in_progress' ? 'blue' : 'gray'}-800 uppercase">
                      \${p.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span class="text-gray-600">Category:</span>
                      <span class="font-semibold ml-2">\${p.category}</span>
                    </div>
                    <div>
                      <span class="text-gray-600">Expected Revenue:</span>
                      <span class="font-semibold ml-2">€\${(p.expected_revenue || 0).toFixed(0)}</span>
                    </div>
                    <div>
                      <span class="text-gray-600">Cost:</span>
                      <span class="font-semibold ml-2">€\${(p.cost || 0).toFixed(0)}</span>
                    </div>
                    \${p.profit ? \`
                    <div>
                      <span class="text-gray-600">Profit:</span>
                      <span class="font-semibold ml-2 text-green-600">€\${p.profit.toFixed(0)}</span>
                    </div>
                    \` : ''}
                  </div>
                  \${p.status === 'in_progress' ? \`
                    <button onclick="completeProject(\${p.id})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold">
                      <i class="fas fa-check mr-2"></i>Complete Project
                    </button>
                  \` : ''}
                </div>
              \`).join('');
              
              document.getElementById('projects-list').innerHTML = projectsHtml;
              
              // Load investors
              const investorsResponse = await axios.get('/api/admin/investors');
              const investors = investorsResponse.data;
              
              const investorsHtml = \`
                <table class="min-w-full">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left font-semibold">Name</th>
                      <th class="px-4 py-3 text-left font-semibold">Email</th>
                      <th class="px-4 py-3 text-right font-semibold">Coins Owned</th>
                      <th class="px-4 py-3 text-right font-semibold">Total Invested</th>
                      <th class="px-4 py-3 text-right font-semibold">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${investors.map(inv => \`
                      <tr class="border-t hover:bg-gray-50">
                        <td class="px-4 py-3">\${inv.name}</td>
                        <td class="px-4 py-3">\${inv.email}</td>
                        <td class="px-4 py-3 text-right font-bold">\${(inv.coins_owned || 0).toFixed(2)}</td>
                        <td class="px-4 py-3 text-right">€\${(inv.total_invested || 0).toFixed(2)}</td>
                        <td class="px-4 py-3 text-right">€\${(inv.avg_purchase_price || 0).toFixed(2)}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              \`;
              
              document.getElementById('investors-list').innerHTML = investorsHtml;
              
              // Load buyback requests
              const buybacksResponse = await axios.get('/api/admin/buybacks');
              const buybacks = buybacksResponse.data;
              
              const buybacksHtml = buybacks.map(b => \`
                <div class="border rounded-lg p-6 mb-4 \${b.status === 'pending' ? 'bg-yellow-50' : b.status === 'completed' ? 'bg-green-50' : 'bg-red-50'}">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <h3 class="text-lg font-bold">\${b.name} (\${b.email})</h3>
                      <div class="text-gray-600 mt-2">
                        <div>Coins to sell: <span class="font-bold">\${b.coins_to_sell} DMC</span></div>
                        <div>Requested price: <span class="font-bold">€\${b.requested_price.toFixed(2)}/coin</span></div>
                        <div>Total amount: <span class="font-bold text-lg">€\${b.total_amount.toFixed(2)}</span></div>
                        <div class="text-sm mt-2">Requested: \${new Date(b.created_at).toLocaleString()}</div>
                        \${b.admin_notes ? \`<div class="text-sm italic mt-1">Admin notes: \${b.admin_notes}</div>\` : ''}
                      </div>
                    </div>
                    <div class="text-right">
                      <span class="px-3 py-1 rounded-full text-sm font-semibold bg-\${b.status === 'pending' ? 'yellow' : b.status === 'completed' ? 'green' : 'red'}-200 text-\${b.status === 'pending' ? 'yellow' : b.status === 'completed' ? 'green' : 'red'}-800 uppercase">
                        \${b.status}
                      </span>
                      \${b.status === 'pending' ? \`
                        <div class="mt-4 space-y-2">
                          <button onclick="processBuyback(\${b.id}, 'approve')" class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold">
                            Approve
                          </button>
                          <button onclick="processBuyback(\${b.id}, 'reject')" class="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold">
                            Reject
                          </button>
                        </div>
                      \` : ''}
                    </div>
                  </div>
                </div>
              \`).join('');
              
              document.getElementById('buybacks-list').innerHTML = buybacksHtml || '<p class="text-gray-500">No buyback requests</p>';
            } catch (error) {
              console.error('Failed to load admin data:', error);
            }
          }
          
          function showAdminTab(tab) {
            ['projects', 'investors', 'buybacks'].forEach(t => {
              document.getElementById('content-' + t).classList.add('hidden');
              document.getElementById('tab-' + t).classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
              document.getElementById('tab-' + t).classList.add('text-gray-600');
            });
            
            document.getElementById('content-' + tab).classList.remove('hidden');
            document.getElementById('tab-' + tab).classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            document.getElementById('tab-' + tab).classList.remove('text-gray-600');
          }
          
          function showNewProjectForm() {
            const name = prompt('Project name:');
            if (!name) return;
            
            const description = prompt('Project description:');
            const category = prompt('Category (AI Development / Software Development / Consulting):') || 'Software Development';
            const expectedRevenue = parseFloat(prompt('Expected revenue (EUR):')) || 0;
            const cost = parseFloat(prompt('Cost (EUR):')) || 0;
            const startDate = prompt('Start date (YYYY-MM-DD):');
            const expectedCompletion = prompt('Expected completion (YYYY-MM-DD):');
            const clientName = prompt('Client name (optional):');
            
            axios.post('/api/admin/projects', {
              name, description, category, expectedRevenue, cost, startDate, expectedCompletion, clientName
            }).then(() => {
              alert('Project created!');
              loadAdminData();
            }).catch(error => {
              alert('Failed to create project: ' + error.response?.data?.error);
            });
          }
          
          function completeProject(projectId) {
            const actualRevenue = parseFloat(prompt('Enter actual revenue earned (EUR):'));
            if (!actualRevenue || actualRevenue <= 0) return;
            
            if (!confirm('Complete this project and distribute profits?')) return;
            
            axios.post('/api/admin/projects/' + projectId + '/complete', {
              actualRevenue
            }).then(response => {
              alert(response.data.message);
              loadAdminData();
            }).catch(error => {
              alert('Failed to complete project: ' + error.response?.data?.error);
            });
          }
          
          function processBuyback(requestId, action) {
            const notes = prompt('Admin notes (optional):');
            
            axios.post('/api/admin/buybacks/' + requestId + '/' + action, {
              adminNotes: notes
            }).then(response => {
              alert(response.data.message);
              loadAdminData();
            }).catch(error => {
              alert('Failed to process buyback: ' + error.response?.data?.error);
            });
          }
        </script>
    </body>
    </html>
  `)
})

export default app
