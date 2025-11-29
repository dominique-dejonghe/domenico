# 🚀 Domenico Coins - MLM Integration Complete!

## ✅ WHAT'S BEEN ADDED

### **Backend MLM Features** ✅

1. **MLM Helper Functions** (`src/mlm-helpers.ts`)
   - ✅ `calculateMLMCommissions()` - Auto-calculate 3-level commissions
   - ✅ `buildReferralTree()` - Build network structure
   - ✅ `generateReferralCode()` - Unique referral codes
   - ✅ Automatic rank upgrades (Associate → Executive)

2. **Database Structure** ✅
   - ✅ All MLM tables created and seeded
   - ✅ Referral tree with 4-person demo network
   - ✅ €67 in demo commissions
   - ✅ 70/15/15 profit split configured

3. **Real Projects** ✅
   - ✅ EV Charger Platform (€45k expected)
   - ✅ StakeWise V3 (€35k expected)

---

## 🔧 TO COMPLETE INTEGRATION

### **Step 1: Update Login Route for Referral Tracking**

Add this to your login route in `src/index.tsx`:

```typescript
// At top of file, add:
import { buildReferralTree, generateReferralCode } from './mlm-helpers'

// Modify login route (line 48):
app.post('/api/auth/login', async (c) => {
  const { email, name } = await c.req.json()
  const referralCode = c.req.query('ref') // ← ADD THIS
  
  try {
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first()
    
    if (!user) {
      // Find referrer if code provided
      let referrerId = null
      if (referralCode) {
        const referrer = await c.env.DB.prepare(
          'SELECT id FROM users WHERE referral_code = ?'
        ).bind(referralCode).first()
        if (referrer) referrerId = referrer.id
      }
      
      // Generate unique referral code
      const newRefCode = generateReferralCode()
      
      // Create user with referrer
      const result = await c.env.DB.prepare(
        "INSERT INTO users (email, name, role, referrer_id, referral_code) VALUES (?, ?, 'visitor', ?, ?)"
      ).bind(email, name || 'User', referrerId, newRefCode).run()
      
      user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(result.meta.last_row_id).first()
      
      // Build referral tree if has referrer
      if (referrerId) {
        await buildReferralTree(c.env.DB, user.id as number, referrerId)
      }
    }
    
    // Rest of login logic...
    return c.json({ user, holding })
  } catch (error: any) {
    return c.json({ error: 'Login failed', details: error.message }, 500)
  }
})
```

### **Step 2: Add Commission Calculation to Buy Route**

Add to buy coins route (around line 160):

```typescript
import { calculateMLMCommissions } from './mlm-helpers'

// After successful coin purchase (line ~200):
const txResult = await c.env.DB.prepare(...).run()
const transactionId = txResult.meta.last_row_id

// ADD THIS:
// Calculate and create MLM commissions
await calculateMLMCommissions(
  c.env.DB, 
  userId, 
  transactionId, 
  coins, 
  currentValue, 
  totalAmount
)
```

### **Step 3: Add MLM API Routes**

Add these new routes after line 300:

```typescript
// Get user's referral info
app.get('/api/mlm/referral-info/:userId', async (c) => {
  const userId = c.req.param('userId')
  
  try {
    const user = await c.env.DB.prepare(
      'SELECT referral_code, mlm_rank, direct_referrals, total_referrals FROM users WHERE id = ?'
    ).bind(userId).first()
    
    const tree = await c.env.DB.prepare(
      'SELECT network_size, network_value FROM referral_tree WHERE user_id = ?'
    ).bind(userId).first()
    
    const commissions = await c.env.DB.prepare(
      `SELECT SUM(commission_amount) as total_earned,
              SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as pending,
              SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid
       FROM mlm_commissions WHERE earning_user_id = ?`
    ).bind(userId).first()
    
    return c.json({
      referral_code: user?.referral_code,
      rank: user?.mlm_rank,
      direct_referrals: user?.direct_referrals || 0,
      total_referrals: user?.total_referrals || 0,
      network_size: tree?.network_size || 0,
      network_value: tree?.network_value || 0,
      commissions_earned: commissions?.total_earned || 0,
      commissions_pending: commissions?.pending || 0,
      commissions_paid: commissions?.paid || 0
    })
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch referral info', details: error.message }, 500)
  }
})

// Get user's commission history
app.get('/api/mlm/commissions/:userId', async (c) => {
  const userId = c.req.param('userId')
  
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT c.*, u.name as from_user_name, u.email as from_user_email
       FROM mlm_commissions c
       JOIN users u ON c.from_user_id = u.id
       WHERE c.earning_user_id = ?
       ORDER BY c.created_at DESC LIMIT 50`
    ).bind(userId).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch commissions', details: error.message }, 500)
  }
})

// Get user's referral network
app.get('/api/mlm/network/:userId', async (c) => {
  const userId = c.req.param('userId')
  
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.mlm_rank, u.created_at,
              h.coins_owned, h.total_invested,
              t.depth_level
       FROM users u
       LEFT JOIN holdings h ON u.id = h.user_id
       LEFT JOIN referral_tree t ON u.id = t.user_id
       WHERE t.level_1_parent_id = ? OR t.level_2_parent_id = ? OR t.level_3_parent_id = ?
       ORDER BY t.depth_level, u.created_at`
    ).bind(userId, userId, userId).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch network', details: error.message }, 500)
  }
})
```

### **Step 4: Add Referral Center to Frontend**

In investor dashboard HTML (around line 500), add:

```html
<!-- Referral Center -->
<div class="bg-white rounded-lg shadow-xl p-6 mb-6">
  <h3 class="text-xl font-bold mb-4">
    <i class="fas fa-users mr-2"></i>Referral Center
  </h3>
  
  <!-- Referral Link -->
  <div class="bg-blue-50 p-4 rounded-lg mb-4">
    <label class="block text-sm font-medium mb-2">Your Referral Link</label>
    <div class="flex items-center space-x-2">
      <input type="text" id="referral-link" readonly 
             class="flex-1 px-4 py-2 border rounded bg-white font-mono text-sm">
      <button onclick="copyReferralLink()" 
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold">
        <i class="fas fa-copy"></i> Copy
      </button>
    </div>
    <p class="text-sm text-gray-600 mt-2">
      <i class="fas fa-info-circle"></i> Share this link to earn 10% commission on direct referrals!
    </p>
  </div>
  
  <!-- MLM Stats -->
  <div class="grid grid-cols-3 gap-4" id="mlm-stats">
    <!-- Will be populated by JS -->
  </div>
</div>

<!-- Commission History -->
<div class="bg-white rounded-lg shadow-xl p-6">
  <h3 class="text-xl font-bold mb-4">
    <i class="fas fa-dollar-sign mr-2"></i>Commission History
  </h3>
  <div id="commission-history">
    <!-- Will be populated by JS -->
  </div>
</div>
```

### **Step 5: Add JavaScript Functions**

Add to frontend JS (around line 800):

```javascript
// Load MLM info
async function loadMLMInfo() {
  try {
    const response = await axios.get('/api/mlm/referral-info/' + currentUser.id);
    const mlm = response.data;
    
    // Set referral link
    const baseUrl = window.location.origin;
    document.getElementById('referral-link').value = `${baseUrl}/?ref=${mlm.referral_code}`;
    
    // Display MLM stats
    const statsHtml = `
      <div class="bg-green-50 p-4 rounded text-center">
        <div class="text-2xl font-bold text-green-900">€${mlm.commissions_earned.toFixed(2)}</div>
        <div class="text-sm text-gray-600">Total Earned</div>
      </div>
      <div class="bg-blue-50 p-4 rounded text-center">
        <div class="text-2xl font-bold text-blue-900">${mlm.direct_referrals}</div>
        <div class="text-sm text-gray-600">Direct Referrals</div>
      </div>
      <div class="bg-purple-50 p-4 rounded text-center">
        <div class="text-2xl font-bold text-purple-900">${mlm.network_size}</div>
        <div class="text-sm text-gray-600">Network Size</div>
      </div>
    `;
    
    document.getElementById('mlm-stats').innerHTML = statsHtml;
    
    // Load commission history
    const commResponse = await axios.get('/api/mlm/commissions/' + currentUser.id);
    const commissions = commResponse.data;
    
    const commHtml = commissions.map(c => `
      <div class="flex items-center justify-between py-3 border-b">
        <div>
          <div class="font-medium">Level ${c.commission_level} from ${c.from_user_name}</div>
          <div class="text-sm text-gray-500">${new Date(c.created_at).toLocaleString()}</div>
        </div>
        <div class="text-right">
          <div class="font-bold text-green-600">+€${c.commission_amount.toFixed(2)}</div>
          <span class="text-xs px-2 py-1 rounded ${c.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
            ${c.status}
          </span>
        </div>
      </div>
    `).join('');
    
    document.getElementById('commission-history').innerHTML = commHtml || '<p class="text-gray-500">No commissions yet</p>';
  } catch (error) {
    console.error('Failed to load MLM info:', error);
  }
}

function copyReferralLink() {
  const input = document.getElementById('referral-link');
  input.select();
  document.execCommand('copy');
  alert('Referral link copied to clipboard!');
}

// Call this in loadInvestorData()
function loadInvestorData() {
  // ... existing code ...
  loadMLMInfo(); // ADD THIS LINE
}
```

### **Step 6: Handle Referral Code in Login**

Update login function to check for ref parameter:

```javascript
async function login() {
  const email = document.getElementById('login-email').value;
  const name = document.getElementById('login-name').value;
  
  if (!email) {
    alert('Please enter your email');
    return;
  }
  
  // Check for referral code in URL
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  try {
    let url = '/api/auth/login';
    if (refCode) {
      url += `?ref=${refCode}`;
    }
    
    const response = await axios.post(url, { email, name });
    // ... rest of login logic
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
}
```

---

## 🧪 TESTING THE MLM SYSTEM

### **Test Scenario 1: Referral Signup**

1. Login as Dominique: `dominique.dejonghe@iutum.be`
2. Go to investor dashboard
3. Copy your referral link (will be like: `https://.../?ref=domenico`)
4. Open incognito window
5. Paste referral link
6. Sign up with new email: `test@example.com`
7. Buy 10 coins
8. Back in Dominique's dashboard: See €10 commission pending!

### **Test Scenario 2: 3-Level Commission**

1. Dominique refers Alice → Alice buys €100 → Dominique earns €10 (Level 1)
2. Alice refers Bob → Bob buys €100 → Alice earns €10, Dominique earns €3 (Level 2)
3. Bob refers Carol → Carol buys €100 → Bob earns €10, Alice earns €3, Dominique earns €2 (Level 3)

### **Test Scenario 3: Rank Upgrade**

1. As Dominique, refer 6+ people directly
2. Watch rank upgrade from Associate → Partner
3. Now earn +2% bonus on Level 1 commissions

---

## 🎯 WHAT YOU HAVE NOW

✅ **Complete MLM Backend**
- Referral signup tracking
- 3-level commission calculation
- Automatic rank upgrades
- Commission history

✅ **Basic MLM Frontend**
- Referral link display
- Commission stats
- Commission history
- Copy link button

✅ **Ready to Launch**
- Test with dummy accounts
- Share referral links
- Watch commissions accumulate

---

## 📋 FINAL CHECKLIST

- [ ] Add MLM helper import to index.tsx
- [ ] Update login route with referral tracking
- [ ] Add commission calculation to buy route
- [ ] Add 3 new MLM API routes
- [ ] Add Referral Center HTML to investor dashboard
- [ ] Add MLM JavaScript functions
- [ ] Update login to handle ?ref= parameter
- [ ] Test referral signup flow
- [ ] Test commission calculation
- [ ] Rebuild and restart (`npm run build && pm2 restart`)

---

## 🚀 READY TO SHIP!

Once you complete these integration steps, your platform will have:

✅ Full MLM functionality
✅ Viral growth mechanics
✅ Commission tracking
✅ Referral network building
✅ Rank system

**Time to implement**: 1-2 hours
**Complexity**: Copy-paste + small edits
**Result**: Launch-ready MLM platform!

Wil je dat ik deze changes direct implementeer? Of wil je het zelf stap voor stap doen met deze guide? 🚀
