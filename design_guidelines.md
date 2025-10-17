# Digital E-Book Marketplace - Design Guidelines

## Design Approach: Reference-Based (E-Commerce Excellence)

**Primary Inspiration**: Amazon's clarity + Gumroad's simplicity + Apple Books' elegance

**Justification**: E-commerce platform requiring trust, discoverability, and seamless purchasing flow. Visual appeal drives conversions while maintaining functional efficiency for both customers and admin operations.

**Key Design Principles**:
- Trust-first: Clean, professional aesthetic that inspires confidence in transactions
- Clarity over complexity: Information hierarchy that guides users to purchase
- Dual-purpose excellence: Customer-facing polish meets admin functionality
- Friction-free checkout: Streamlined payment experience without authentication barriers

---

## Core Design Elements

### A. Color Palette

**Light Mode**:
- Primary: 221 83% 53% (Professional blue - trust and reliability)
- Surface: 0 0% 100% (Pure white)
- Surface Secondary: 220 14% 96% (Soft gray for cards/sections)
- Text Primary: 222 47% 11% (Deep charcoal)
- Text Secondary: 215 16% 47% (Muted slate)
- Border: 214 32% 91% (Subtle dividers)
- Success: 142 71% 45% (Transaction confirmation)
- Accent: 262 83% 58% (Premium purple for highlights, CTAs)

**Dark Mode**:
- Primary: 221 83% 53% (Consistent blue)
- Surface: 222 47% 11% (Deep charcoal)
- Surface Secondary: 217 33% 17% (Elevated dark)
- Text Primary: 0 0% 98% (Near white)
- Text Secondary: 215 20% 65% (Soft gray)
- Border: 217 33% 17% (Subtle dark dividers)
- Success: 142 71% 45% (Same green)
- Accent: 262 83% 58% (Same purple)

### B. Typography

**Font Families** (via Google Fonts CDN):
- Display/Headings: 'Inter', sans-serif (700, 600 weights)
- Body/UI: 'Inter', sans-serif (400, 500 weights)
- Price/Numbers: 'Inter', sans-serif (600 weight for emphasis)

**Type Scale**:
- Hero/Page Titles: text-5xl md:text-6xl font-bold
- Section Headers: text-3xl md:text-4xl font-semibold
- Card Titles: text-xl font-semibold
- Body Text: text-base
- Captions/Meta: text-sm text-secondary
- Price Display: text-2xl md:text-3xl font-semibold

### C. Layout System

**Spacing Primitives**: Consistent rhythm using Tailwind units of **4, 6, 8, 12, 16, 24**
- Component padding: p-6 or p-8
- Section spacing: py-16 md:py-24
- Card gaps: gap-6 or gap-8
- Tight spacing: space-y-4
- Generous spacing: space-y-8

**Grid Structure**:
- Container: max-w-7xl mx-auto px-4 md:px-6
- Book Grid: grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6
- Dashboard: Two-column split on lg screens (sidebar + main)
- Checkout: Single column max-w-2xl for focus

### D. Component Library

**Customer-Facing Components**:

*Book Cards*:
- Cover image with subtle shadow and hover lift effect
- Title (text-lg font-semibold, 2-line clamp)
- Price prominent (text-2xl font-bold text-primary)
- Quick "Add to Cart" button (primary colored, rounded-lg)
- Minimal metadata (category badge, rating if applicable)

*Navigation*:
- Fixed top nav with logo, search bar, cart icon with badge
- Category filters as horizontal pills (bg-surface-secondary, rounded-full)
- Sticky cart summary on scroll (mobile bottom sheet, desktop sidebar)

*Shopping Cart*:
- Sliding panel (mobile: bottom sheet, desktop: right sidebar)
- Item rows with thumbnail, title, price, quantity controls
- Prominent total display
- Primary "Checkout" CTA button

*Checkout Flow*:
- Single-page form with clear sections
- Email input for receipt
- Payment method selector with icons (Mastercard, Visa, GPay, Apple Pay)
- Billing address fields (pre-filled country selector)
- Order summary sidebar (desktop) or collapsible (mobile)
- Trust badges near payment (secure checkout indicators)

**Admin Dashboard Components**:

*Sidebar Navigation*:
- Dark sidebar (bg-surface-secondary) with icon + label items
- Active state: accent color left border + bg highlight
- Sections: Overview, Transactions, Books, Wallet, Settings

*Transaction Table*:
- Sortable columns: Date, Customer, Books, Amount, Status, Payment Method
- Status badges (success: green, pending: yellow, refund: red)
- Inline action buttons (view details, refund)
- Pagination at bottom
- Export CSV button

*Wallet Dashboard*:
- Large balance card at top (available, pending breakdown)
- Transfer to bank button (primary, prominent)
- Transaction timeline below (chronological feed)
- Filter by date range, transaction type

*Book Management*:
- Table view with cover thumbnail, title, price, stock status
- Quick edit inline or modal
- Add new book: comprehensive form with cover upload, price selection, description
- Bulk actions (delete, price update)

*Analytics Cards*:
- Revenue chart (line graph, last 30 days)
- Order count, average order value, conversion rate
- Top selling books (cover + sales number)
- Clean card design with icons and metrics

### E. Visual Enhancements

**Minimal Animations** (use sparingly):
- Book card hover: subtle lift (translate-y-1) + shadow increase
- Button hover: slight color darken (no transform)
- Cart slide-in: smooth translate transition (300ms)
- Loading states: subtle pulse on skeletons

**Shadows**:
- Cards: shadow-sm (subtle)
- Modals/Panels: shadow-xl
- Hover elevate: shadow-md

**Images**:
- Hero section: Full-width banner showcasing featured books in artistic layout (NOT a large hero image, but rather a curated book showcase)
- Book covers: Consistent aspect ratio (2:3), lazy loaded, with loading skeleton
- Payment icons: Official brand SVGs for Mastercard, Visa, GPay, Apple Pay
- Admin: Minimal imagery, icon-driven interface

**Interactive States**:
- Focus rings: ring-2 ring-primary ring-offset-2
- Disabled: opacity-50 cursor-not-allowed
- Active/Selected: border-primary bg-primary/10

**Forms**:
- Input fields: Rounded borders (rounded-lg), focus state with primary ring
- Labels above inputs, helper text below
- Error states: border-red-500 with error message
- Dark mode: Inputs with bg-surface-secondary, text-primary

---

## Page-Specific Guidelines

**Homepage/Browse**:
- Featured books carousel (3-4 prominent selections)
- Category quick filters
- Book grid (responsive columns)
- Footer with trust signals, payment methods, links

**Checkout**:
- Progress indicator if multi-step (or single page with sections)
- Clear section headers (Contact, Payment, Review)
- Payment method cards with radio selection
- Prominent security badges
- Mobile: Collapsible order summary

**Admin Dashboard**:
- Consistent sidebar navigation
- Page header with title + primary action
- Data tables with search, filter, sort
- Modals for detailed actions
- Toast notifications for confirmations

**Iconography**: Font Awesome (CDN) for universal icons - shopping cart, user, dashboard, wallet, transaction, book icons