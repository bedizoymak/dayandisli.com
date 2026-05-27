# DAYAN Gear — Quotation and Management System

## Short Description
This project is a modern, web-based quotation and operations management system built for DAYAN Gear. The application unifies customer/company information, quotation workflows, PDF output, and admin processes in a secure architecture.

Production environment: https://dayandisli.com

## Features
- Secure login (email/password)
- Admin authorization
- Customer/company information management
- Quotation creation and editing
- PDF quotation generation
- Recent quotations history
- Supabase database integration
- Production deployment with GitHub Actions

## Tech Stack
- React
- Vite
- TypeScript
- Supabase
- Tailwind CSS / shadcn-ui
- GitHub Actions

## Architecture Overview
The system uses a React + Vite frontend. The frontend communicates with Supabase for authentication and data operations. Changes pushed to the `main` branch are automatically deployed to production through the GitHub Actions pipeline.

Flow summary:
Frontend (React/Vite) -> Supabase (Auth + DB) -> GitHub Actions -> Production

## Environment Variables
Define the following placeholders in your `.env` file:

```env
VITE_SUPABASE_URL=https://meauutjsnnggzcigyvfp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_PUBLIC_BASE_URL=https://dayandisli.com
VITE_ERP_BASE_URL=https://erp.dayandisli.com
VITE_APP_TARGET=erp
```

## Local Development
```bash
npm install
npm run dev
npm run build
```

## Deployment
When code is pushed to the `main` branch, GitHub Actions automatically triggers the deployment pipeline and publishes the application to production.

## Security Notes
- No secrets should be committed to the repository.
- Authentication is handled via Supabase Auth.
- Admin control is handled through a separate authorization layer in the application.
- Row Level Security (RLS) policies must be configured on the Supabase side.

## Project Status
Production is active and development is ongoing.

## Maintainer
Eclipse Engineering & IT Solutions
