// MLM Helper Functions for Domenico Coins
// 3-Level Commission Structure: 10% / 3% / 2%

export async function calculateMLMCommissions(
  db: D1Database, 
  userId: number, 
  transactionId: number, 
  coinsAmount: number, 
  coinValue: number, 
  totalAmount: number
) {
  // Get referral tree for this user
  const tree = await db.prepare(
    'SELECT * FROM referral_tree WHERE user_id = ?'
  ).bind(userId).first()
  
  if (!tree) return [] // No referrer, no commissions
  
  const commissions = []
  
  // Define 3-level commission structure
  const levels = [
    { level: 1, parentId: tree.level_1_parent_id, rate: 0.10 },
    { level: 2, parentId: tree.level_2_parent_id, rate: 0.03 },
    { level: 3, parentId: tree.level_3_parent_id, rate: 0.02 }
  ]
  
  for (const { level, parentId, rate } of levels) {
    if (!parentId) continue
    
    const commissionAmount = totalAmount * rate
    
    // Create commission record
    await db.prepare(
      `INSERT INTO mlm_commissions (
        earning_user_id, from_user_id, from_transaction_id, 
        commission_level, commission_percentage, 
        coins_purchased, coin_value, investment_amount, commission_amount, 
        status, payout_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'reinvest')`
    ).bind(
      parentId, userId, transactionId,
      level, rate * 100,
      coinsAmount, coinValue, totalAmount, commissionAmount
    ).run()
    
    commissions.push({
      level,
      parentId,
      amount: commissionAmount
    })
    
    // Update referrer stats
    await db.prepare(
      'UPDATE users SET total_referrals = total_referrals + 1 WHERE id = ?'
    ).bind(parentId).run()
    
    // Update direct referrals count for level 1
    if (level === 1) {
      await db.prepare(
        'UPDATE users SET direct_referrals = direct_referrals + 1 WHERE id = ?'
      ).bind(parentId).run()
      
      // Check for rank upgrade
      const parent = await db.prepare(
        'SELECT direct_referrals, mlm_rank FROM users WHERE id = ?'
      ).bind(parentId).first()
      
      if (parent) {
        const directRefs = parent.direct_referrals as number
        let newRank = parent.mlm_rank as string
        
        if (directRefs >= 31 && newRank !== 'executive') {
          newRank = 'executive'
        } else if (directRefs >= 16 && newRank === 'associate' || newRank === 'partner') {
          newRank = 'director'
        } else if (directRefs >= 6 && newRank === 'associate') {
          newRank = 'partner'
        }
        
        if (newRank !== parent.mlm_rank) {
          await db.prepare(
            'UPDATE users SET mlm_rank = ? WHERE id = ?'
          ).bind(newRank, parentId).run()
          
          await db.prepare(
            `INSERT INTO mlm_rank_history (user_id, old_rank, new_rank, direct_referrals, total_referrals)
             VALUES (?, ?, ?, ?, ?)`
          ).bind(parentId, parent.mlm_rank, newRank, directRefs, directRefs).run()
        }
      }
    }
  }
  
  return commissions
}

export async function buildReferralTree(
  db: D1Database,
  userId: number,
  referrerId: number
) {
  // Get referrer's tree position
  const referrerTree = await db.prepare(
    'SELECT * FROM referral_tree WHERE user_id = ?'
  ).bind(referrerId).first()
  
  // Build new user's tree position
  await db.prepare(
    `INSERT INTO referral_tree (
      user_id, parent_id, 
      level_1_parent_id, level_2_parent_id, level_3_parent_id, 
      depth_level, network_size, network_value
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`
  ).bind(
    userId,
    referrerId,
    referrerId,
    referrerTree?.level_1_parent_id || null,
    referrerTree?.level_2_parent_id || null,
    (referrerTree?.depth_level || 0) + 1
  ).run()
  
  // Update network sizes up the tree
  const parents = [referrerId, referrerTree?.level_1_parent_id, referrerTree?.level_2_parent_id].filter(Boolean)
  
  for (const parentId of parents) {
    if (parentId) {
      await db.prepare(
        'UPDATE referral_tree SET network_size = network_size + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).bind(parentId).run()
    }
  }
}

export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toLowerCase()
}
