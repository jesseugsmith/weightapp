# Weight App

A weight tracking and competition platform built with Next.js and Supabase.

## Deployment Instructions

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project
- (Optional) A Vercel account for deployment

### Environment Setup

1. Copy the environment variables template:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your environment variables in `.env.local`:
   - Get Supabase credentials from your project dashboard
   - Set up Google OAuth if using social login
   - Configure your production APP_URL

### Database Setup

1. Apply migrations to your Supabase project:
   ```bash
   # Install Supabase CLI if you haven't already
   npm install -g supabase-cli

   # Link to your project
   supabase link --project-ref your-project-ref

   # Push the migrations
   supabase db push
   ```

2. Create your first admin user:
   ```sql
   -- Run this in Supabase SQL editor after signing up
   update profiles set is_admin = true where id = 'your-user-id';
   ```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

# FitClash - Open Source Weight Competition App

FitClash is a fully open-source weight tracking and competition platform built with Next.js and PocketBase.

## 🚀 Features

- 📊 **Weight Tracking**: Log and visualize your weight progress
- 🏆 **Competitions**: Create or join weight loss competitions
- 📈 **Real-time Leaderboards**: Track your ranking against competitors
- 👥 **Social Features**: Invite friends and compete together
- 🔐 **Secure Authentication**: Email/password and OAuth support
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔔 **Smart Notifications**: Daily email/push notifications via Novu with PocketBase cron hooks
  - Daily weight log reminders
  - Progress updates with rankings
  - Competition milestone alerts
  - Multi-channel delivery (Email, In-App, Push)

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: PocketBase (SQLite)
- **Authentication**: PocketBase Auth (Email/Password, OAuth)
- **Notifications**: Novu (Email, Push, In-App)
- **Charts**: Chart.js, Recharts
- **UI Components**: Radix UI, Shadcn UI
- **Animations**: Framer Motion

## 🔔 Notification System

FitClash includes a comprehensive notification system powered by Novu and PocketBase cron hooks:

### Features
- **Daily Weight Reminders**: Automatic reminders at 9:00 AM for users who haven't logged
- **Progress Updates**: Daily stats for users who logged their weight
- **Competition Milestones**: Notifications for competition start, ending soon, and completion
- **Multi-channel Delivery**: Email, Push notifications, and In-App notifications
- **Personalized Content**: Includes rank, weight change, and days remaining

### Quick Setup
1. Sign up at [novu.co](https://novu.co) and get your API key
2. Configure in PocketBase Admin → Settings → Meta → `novuApiKey`
3. Set up workflows in Novu dashboard (see [`docs/NOVU_WORKFLOWS.md`](./docs/NOVU_WORKFLOWS.md))
4. The cron hooks will automatically run daily at 9:00 AM

### Documentation
- 📖 [Complete Setup Guide](./pocketbase/hooks/NOTIFICATIONS_SETUP.md)
- 📧 [Email Templates & Workflows](./docs/NOVU_WORKFLOWS.md)
- 🧪 [Testing Guide](./pocketbase/hooks/README.md#testing)

## 📦 Project Structure

## 📦 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd weightapp
npm install
```

### 2. Set Up PocketBase

Run the automated setup script:

```bash
chmod +x setup-pocketbase.sh
./setup-pocketbase.sh
```

This will:
- Download and install PocketBase
- Import the database schema
- Seed roles and permissions
- Start the PocketBase server

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Update `.env.local` with your configuration:

```env
NEXT_PUBLIC_POCKETBASE_URL=http://localhost:8090
```

### 4. Start Development Server

```bash
npm run dev
```

Visit:
- **App**: http://localhost:3000
- **PocketBase Admin**: http://localhost:8090/_/

## 🔧 Manual PocketBase Setup

If you prefer manual setup:

### 1. Download PocketBase

```bash
# Download for your platform from https://pocketbase.io/docs/
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_darwin_amd64.zip
unzip pocketbase_0.22.0_darwin_amd64.zip
```

### 2. Import Schema

```bash
./pocketbase serve --dir=./pb_data
# In another terminal:
./pocketbase admin create admin@example.com admin123456 --dir=./pb_data
```

Then import `collections_schema.json` via the admin UI at http://localhost:8090/_/

### 3. Seed Data

```bash
node seed_roles.js
```

## 📋 Database Schema

The application uses 13 PocketBase collections:

### Core Collections
- **users**: Authentication and user data
- **user_profiles**: Extended user profile information
- **weight_entries**: Daily weight logs
- **competitions**: Weight loss competitions
- **competition_participants**: Competition membership
- **competition_standings**: Leaderboard calculations

### Permission System
- **roles**: User roles (admin, user, etc.)
- **permissions**: Granular permissions
- **role_permissions**: Role-permission mappings
- **user_roles**: User-role assignments

### Features
- **competition_invite_codes**: Invitation system
- **notifications**: In-app notifications
- **audit_logs**: System activity tracking

## 🔐 Authentication

### Email/Password
Users can register with email and password. Email verification is handled by PocketBase.

### OAuth Providers
Configure OAuth providers in PocketBase admin:
1. Go to http://localhost:8090/_/settings/auth-providers
2. Enable Google OAuth
3. Add your OAuth credentials

### Role-Based Permissions
- **super_admin**: Full system access
- **admin**: Competition and user management
- **competition_creator**: Can create competitions
- **user**: Basic app access

## 🚀 Deployment

### Self-Hosted (Recommended)

1. **Build the application**:
```bash
npm run build
```

2. **Set up production PocketBase**:
```bash
# Copy PocketBase binary to server
./pocketbase serve --http=0.0.0.0:8090 --dir=./pb_data
```

3. **Serve Next.js**:
```bash
npm start
# Or use PM2, Docker, etc.
```

4. **Configure reverse proxy** (nginx/Apache) to handle SSL and routing

### Environment Variables (Production)

```env
NEXT_PUBLIC_POCKETBASE_URL=https://api.yourdomain.com
```

## 🧪 Development

### Database Migrations

When you update the schema:
1. Export from PocketBase admin: Collections → Export collections
2. Update `collections_schema.json`
3. Test import on fresh PocketBase instance

### Adding Permissions

Update `seed_roles.js` to add new roles or permissions:

```javascript
await createPermission(pb, 'new_permission', 'Description');
await assignPermissionToRole(pb, 'admin', 'new_permission');
```

## 🔍 API Examples

### Creating a Weight Entry

```typescript
import { pb } from '@/lib/pocketbase';

const entry = await pb.collection('weight_entries').create({
  user_id: user.id,
  weight: 175.5,
  date: '2024-01-15',
  notes: 'Morning weigh-in'
});
```

### Joining a Competition

```typescript
const participation = await pb.collection('competition_participants').create({
  competition_id: 'comp123',
  user_id: user.id,
  start_weight: 180.0
});
```

## 🎯 Roadmap

- [ ] Mobile app (React Native + PocketBase)
- [ ] Advanced analytics and charts
- [ ] Team competitions
- [ ] Achievement system
- [ ] Data export/import
- [ ] Multi-language support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [PocketBase](https://pocketbase.io/) - Amazing backend-as-a-service
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS

## 📞 Support

- 📖 [Documentation](./docs/)
- 🐛 [Issue Tracker](https://github.com/yourusername/fitclash/issues)
- 💬 [Discussions](https://github.com/yourusername/fitclash/discussions)

---

**Built with ❤️ for the open source community**

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Production Deployment

### Option 1: Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in Vercel
3. Configure environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   # App URL is automatically provided by Vercel
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (if using Google OAuth)
4. Deploy!

### Post-Deployment Checklist

1. Configure Supabase Authentication settings:
   - Add your production domain to the Site URL
   - Configure OAuth providers if using
   - Update email templates

2. Test user flows:
   - Sign up process
   - Admin invite system
   - Competition creation
   - Weight logging

3. Monitor:
   - Set up error tracking (e.g., Sentry)
   - Configure logging
   - Set up uptime monitoring

## Security Considerations

1. All database access is controlled through RLS policies
2. Admin access is restricted through database policies
3. Authentication is handled by Supabase
4. All API routes validate admin status for protected operations
