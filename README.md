# Digital E-Book Marketplace

A full-stack web application for selling digital books with multi-payment processing, admin dashboard, and wallet management.

## Features

### Customer Features
- **Browse Books**: View collection of e-books with categories and prices
- **Guest Checkout**: Purchase without registration
- **Shopping Cart**: Add/remove books with quantity management
- **Payment Methods**: Mastercard, Visa, Prepaid Cards, Google Pay, Apple Pay
- **Instant Download**: Get download links via email after purchase

### Admin Features
- **Dashboard**: View revenue, orders, and sales analytics
- **Book Management**: Add, edit, and delete books with prices ($10-$1000)
- **Transaction Management**: View all payments with search/filter
- **Refund Processing**: Issue refunds directly from dashboard
- **Wallet System**: Track earnings, pending payments, and completed transactions
- **Bank Transfers**: Transfer funds to local bank account

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL (Neon)
- **Authentication**: JWT for admin access
- **State Management**: Zustand, TanStack Query
- **Validation**: Zod

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (or use Replit's built-in database)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for JWT tokens

4. Initialize the database:
```bash
npm run db:push
npm run db:seed
```

5. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5000`

## Default Admin Credentials

After seeding the database:
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change these credentials in production!

## API Endpoints

### Public Endpoints
- `GET /api/books` - List all books
- `POST /api/orders` - Create order and process payment

### Admin Endpoints (Requires Authentication)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard-stats` - Dashboard statistics
- `POST /api/admin/books` - Create book
- `PUT /api/admin/books/:id` - Update book
- `DELETE /api/admin/books/:id` - Delete book
- `GET /api/admin/transactions` - List transactions
- `POST /api/admin/transactions/:id/refund` - Process refund
- `GET /api/admin/wallet` - Wallet balance and transactions
- `POST /api/admin/wallet/transfer` - Transfer to bank account

## Payment Integration Status

### Current Implementation
The application has a complete payment processing flow with:
- ✅ Full request validation (email, payment method, book verification)
- ✅ Price verification against catalog
- ✅ Transaction recording and wallet updates
- ✅ Order status management
- ✅ Refund processing

### Payment SDK Integration

✅ **Visa CyberSource Integration - ACTIVE**
- Real transaction processing enabled via CyberSource REST API
- Supports Visa credit/debit cards
- Handles authorization and capture in single request
- Environment: API Test (Sandbox) - switch to production URL when ready

🔧 **Mastercard Integration - In Progress**
- Will use CyberSource gateway (same as Visa)
- Awaiting Mastercard sandbox credentials from `attached_assets/mastercard_sandbox/`
- Integration ready, needs credential configuration

✅ **Digital Wallets - Supported**
- Google Pay and Apple Pay route through CyberSource
- Frontend tokenization required for production
- Currently processes as card-not-present transactions

**Security Note**: 
- Store API credentials in Replit Secrets (not in code)
- Use environment variables: `VISA_API_KEY`, `VISA_SHARED_SECRET`, `VISA_MERCHANT_ID`
- Private key loaded from `attached_assets/` directory

## Database Schema

### Core Tables
- **books**: E-book catalog with prices and metadata
- **orders**: Customer orders with email and status
- **order_items**: Individual items in each order
- **transactions**: Payment records with method and status
- **admins**: Admin user accounts
- **wallet_transactions**: Financial ledger for seller wallet

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Sync database schema
- `npm run db:seed` - Seed sample data
- `npm run check` - TypeScript type checking

## Security Notes

- Admin routes protected with JWT authentication
- Passwords hashed with bcrypt
- All API inputs validated before processing
- Book prices verified server-side to prevent tampering
- SQL injection prevented through Drizzle ORM parameterization

## Design System

The application follows a professional e-commerce design with:
- **Primary Color**: Professional blue (#3B82F6)
- **Accent Color**: Premium purple (#9333EA)
- **Typography**: Inter font family
- **Components**: Shadcn UI with consistent spacing and interactions
- **Responsive**: Mobile-first design with breakpoints

## License

MIT
