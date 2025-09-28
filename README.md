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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

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
   - `NEXT_PUBLIC_APP_URL`
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
