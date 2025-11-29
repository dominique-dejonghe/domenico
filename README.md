# 💎 Domenico Coins (DMC) - Phase 1 Investment Platform

**Invest in Dominique Dejonghe's AI & Software Development Projects**

A professional investment platform where investors purchase Domenico Coins (DMC) that appreciate in value as AI and software projects deliver profits. Transparent, fair, and built for growth.

---

## 🌐 Live Production Deployment

**🚀 LIVE URL**: https://domenico-coins.dominique-dejonghe.workers.dev  
**📊 API Stats**: https://domenico-coins.dominique-dejonghe.workers.dev/api/stats  
**💾 GitHub Repo**: https://github.com/dominique-dejonghe/domenico  

**Deployment Status**: ✅ **LIVE** on Cloudflare Workers  
**Last Updated**: November 29, 2025  
**Version**: Phase 3 Complete (Marketplace + MLM)

---

## 💼 Business Model

### **Core Concept**
Domenico Coins (DMC) are investment tokens backed by real AI/software project profits. Each coin represents a fractional ownership in the collective profit pool.

### **Tokenomics**

```
INITIAL COIN VALUE: €10.00 per DMC
CURRENT VALUE: €170.00 per DMC (based on demo data)

PROFIT DISTRIBUTION:
- 80% → Coin Value Pool (increases DMC value)
- 20% → Dominique Operational Income

COIN VALUE CALCULATION:
Current Value = Base (€10) + (Total Distributed Profits / Coins Outstanding)

EXAMPLE:
- 100 coins sold @ €10 = €1,000 capital
- Project earns €500 profit
- 80% = €400 to coin pool
- New value = €10 + (€400/100) = €14 per coin
- Investors' coins now worth €14 each (40% ROI!)
```

### **How It Works**

1. **Investors Buy DMC** at current market value
2. **Capital Funds Projects** (AI development, software, consulting)
3. **Projects Generate Profit** (sold to clients)
4. **Profit Distributed** (80/20 split)
5. **Coin Value Increases** automatically
6. **Investors Profit** from appreciation

---

## ✨ Platform Features

### **🎯 Three User Roles**

#### **1. VISITOR** (Not Yet Invested)
- View live platform statistics
- See project portfolio
- View current DMC value
- Purchase coins to become investor
- **Demo**: Any new email becomes visitor

#### **2. INVESTOR** (Active Coin Holders)
- **Portfolio Dashboard**
  - Real-time coin value
  - Total investment tracking
  - Unrealized gains (€ and %)
  - ROI calculation
- **Interactive Charts**
  - Historical coin value graph
  - Visual performance tracking
- **Transaction History**
  - All purchases and sales
  - Price per coin tracking
- **Buyback Requests**
  - Request to sell coins back
  - Admin approval workflow
- **Project Updates**
  - View active projects
  - See completed projects and their profits

#### **3. ADMIN** (Dominique)
- **Dashboard Overview**
  - Total investors
  - Capital raised
  - Completed projects
  - Admin earnings (20% pool)
  - Current coin value
- **Project Management**
  - Create new projects
  - Update project status
  - Complete projects with profit entry
  - Automatic profit distribution
- **Investor Management**
  - View all investors
  - Track holdings and investments
- **Buyback Management**
  - Approve/reject sell requests
  - Process transactions
  - Add admin notes

---

## 📊 Current Platform Statistics (Phase 3)

**Live demo data from production deployment:**

- **Current DMC Value**: €197.07 (performance-based pricing)
- **Total Investors**: 4 active investors
- **Coins Outstanding**: 50 DMC
- **Completed Projects**: 2 (StakeWise V3, EV Charger Platform)
- **Total Profit Generated**: €31,000
- **Distributed to Investors**: €21,700 (70% to investors, 15% to MLM pool, 15% to admin)
- **MLM Commission Pool**: €4,350

**Featured Projects:**
1. **StakeWise V3 Integration** (FinTech) - €35k target, 12-20% ROI
2. **EV Charger Management Platform** (SaaS) - €5k target, 6-12% ROI

### **Demo Projects**

1. **AI Content Generator** - In Progress
   - Expected: €15,000
   - Category: AI Development

2. **Client CRM System** - Completed
   - Revenue: €8,500
   - Profit: €5,500
   - Distributed: €4,400 to coin pool

3. **E-commerce Platform** - Completed
   - Revenue: €13,500
   - Profit: €9,500
   - Distributed: €7,600 to coin pool

4. **AI Chatbot Integration** - Completed
   - Revenue: €7,000
   - Profit: €5,000
   - Distributed: €4,000 to coin pool

---

## 🚀 Key Features Implemented

### ✅ **Investment System**
- [x] Buy coins at current market value
- [x] Automatic investor role upgrade
- [x] Portfolio tracking with real-time updates
- [x] Transaction history
- [x] Buyback request system

### ✅ **Project Management**
- [x] Create projects with details
- [x] Track project status (planned/in_progress/completed)
- [x] Complete projects with profit entry
- [x] Automatic 80/20 profit distribution
- [x] Coin value recalculation

### ✅ **Transparency & Trust**
- [x] Public statistics dashboard
- [x] Historical coin value tracking
- [x] Complete project visibility
- [x] Clear profit distribution rules

### ✅ **Admin Controls**
- [x] Full project CRUD operations
- [x] Investor overview
- [x] Buyback approval workflow
- [x] Dashboard analytics

---

## 💻 Technical Stack

- **Backend**: Hono (Cloudflare Workers/Pages)
- **Database**: Cloudflare D1 (SQLite) - for Pages deployment
- **Frontend**: Vanilla JavaScript + TailwindCSS + FontAwesome
- **Charts**: Chart.js
- **Deployment**: Cloudflare Workers (current) / Pages (for full DB features)
- **Build Tool**: Vite
- **Version Control**: Git + GitHub
- **Process Manager**: PM2 (sandbox development)

---

## 📋 Database Schema

### **users**
User accounts with roles (visitor/investor/admin)

### **holdings**
Investor coin portfolios (coins owned, total invested, avg price)

### **coin_transactions**
All buy/sell transactions with payment tracking

### **projects**
AI/Software projects with revenue, cost, profit tracking

### **distributions**
Project profit distributions to coin value pool

### **coin_value_history**
Historical coin values for graphing

### **buyback_requests**
Investor sell requests with admin approval workflow

### **system_settings**
Platform configuration (current coin value, etc.)

---

## 🧪 Testing the Platform

### **Login as Different Roles**

**ADMIN (Dominique)**
- Email: `dominique.dejonghe@iutum.be`
- Access: Full admin panel

**INVESTOR (Demo)**
- Email: `investor1@example.com` (Alice - 50 coins)
- Email: `investor2@example.com` (Bob - 30 coins)
- Email: `investor3@example.com` (Carol - 20 coins)

**VISITOR (New)**
- Email: Any new email address
- Starts as visitor, can purchase coins

### **Test Scenarios**

**As Visitor:**
1. View platform stats
2. Purchase coins (10, 50, or 100 DMC packages)
3. Auto-upgrade to investor role

**As Investor:**
1. View portfolio with ROI
2. See transaction history
3. Request buyback (sell coins)
4. Track active projects

**As Admin:**
1. View dashboard statistics
2. Create new project
3. Complete project with profit
4. Watch coin value increase automatically
5. Approve/reject buyback requests

---

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Database setup (local)
npm run db:migrate:local
npm run db:seed

# Build project
npm run build

# Start development server (sandbox)
npm run dev:sandbox

# Or with PM2
pm2 start ecosystem.config.cjs

# Test API
curl http://localhost:3000/api/stats

# Reset database
npm run db:reset
```

---

## 📈 Platform Growth Roadmap

### **Phase 1: Pure Investment** ✅ (Current)
- [x] Core investment platform
- [x] 3-role system
- [x] Project management
- [x] Profit distribution
- [x] Buyback system

### **Phase 2: MLM Enhancement** ✅ **COMPLETED**
- [x] Referral system (3 levels: 10%/3%/2%)
- [x] Commission tracking and auto-calculation
- [x] Network visualization (referral tree)
- [x] Rank system (Associate → Executive)
- [x] Viral growth mechanics with bonuses
- [x] Re-investment bonus system (+20% coins)

### **Phase 3: Project Marketplace** ✅ **COMPLETED**
- [x] Project-specific investments (instead of general coin pool)
- [x] Minimum/maximum investment thresholds per project
- [x] Real-time project funding progress
- [x] Portfolio breakdown per project with individual ROI
- [x] Service redemption marketplace (10-100 DMC tiers)
- [x] Dynamic coin value based on portfolio performance
- [x] Revenue distribution system (80% investors, 20% admin)

### **Phase 3: Scale & Legal**
- [ ] Real payment gateway (Mollie/Stripe)
- [ ] Legal T&Cs and disclaimers
- [ ] GDPR compliance
- [ ] Financial reporting
- [ ] Automated email notifications

### **Phase 4: Advanced Features**
- [ ] Mobile app
- [ ] Secondary marketplace for coins
- [ ] Project voting for investors
- [ ] Quarterly reports generator
- [ ] LinkedIn integration

---

## ⚖️ Legal Disclaimer

**🚨 IMPORTANT: This is a DEMO platform in development.**

### **Current Status**
- **NOT registered** as investment platform
- **NO real payment processing**
- **NO legal entity** established
- **DEMO mode** only

### **Before Going Live**
You **MUST**:
1. ✅ Consult legal advisor (Belgium FSMA compliance)
2. ✅ Establish proper legal entity
3. ✅ Implement real payment gateway
4. ✅ Create comprehensive T&Cs
5. ✅ GDPR compliance check
6. ✅ Tax reporting structure
7. ✅ Investment prospectus (if required)

### **Risk Disclosure**
Investments carry risk. Past performance does not guarantee future returns. This platform is NOT regulated by financial authorities (yet).

---

## 💰 Why This Model Works

### **For Investors**
✅ **Transparent**: See every project and profit
✅ **Direct ROI**: Coin value tied to real projects
✅ **Low Entry**: Start with €10+ investment
✅ **Liquidity**: Buyback system for exit
✅ **Track Record**: Dominique's 20+ years expertise

### **For Dominique**
✅ **Capital**: Fund projects without loans
✅ **Income**: 20% operational fee
✅ **Scalable**: More projects = more growth
✅ **Network**: Engaged investor community
✅ **Credibility**: Harvard award winner, Anima Eterna board member

### **The Math**
```
SCENARIO (Conservative):
- 20 investors buy 10 coins each = 200 coins @ €10 = €2,000 capital
- Complete 2 projects:
  - Project A: €3,000 profit → €2,400 to pool (€12/coin increase)
  - Project B: €2,000 profit → €1,600 to pool (€8/coin increase)
- New coin value: €30 (200% ROI)
- Investor's 10 coins: €100 → €300 (+€200 gain)
- Your 20% earnings: €1,000
- Everyone wins!
```

---

## 🎯 Next Steps

1. **Review platform** at demo URL
2. **Test all three roles**:
   - Login as visitor and buy coins
   - Login as investor and explore dashboard
   - Login as admin and complete a project
3. **Decide on Phase 2** (MLM) timeline
4. **Legal consultation** if going live
5. **Real payment integration** when ready

---

## 📞 Contact

**Project Owner**: Dominique Dejonghe
**Email**: dominique.dejonghe@iutum.be
**Platform**: Domenico Coins Investment Platform

**Background**:
- 20+ years digital transformation & project management
- Harvard Business Review M-Prize Winner
- Anima Eterna Brugge Board Member
- AI & Software Development Specialist

---

## 📄 Project Structure

```
webapp/
├── src/
│   └── index.tsx           # Main application (3 role interfaces + API)
├── migrations/
│   └── 0001_initial_schema.sql  # Database schema
├── seed.sql                # Demo data
├── ecosystem.config.cjs    # PM2 configuration
├── wrangler.jsonc          # Cloudflare configuration
├── package.json            # Dependencies
└── README.md               # This file
```

---

## 🎉 Current Achievement

**Phase 1 COMPLETE** - Professional investment platform operational with:
- ✅ Three fully functional user roles
- ✅ Real-time coin value calculation
- ✅ Project management with profit distribution
- ✅ Portfolio tracking with ROI analytics
- ✅ Buyback request workflow
- ✅ Transparent statistics
- ✅ Historical value tracking
- ✅ Professional UI/UX

**Ready for MLM Phase 2 when you give the green light!** 🚀

---

**Built with expertise. Designed for growth. Ready to scale.** 💎
