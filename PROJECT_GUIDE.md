# LMS Project Master Guide

This document provides a comprehensive overview of the Library Management System (LMS) project, including its architecture, database schema, and key workflows.

## 🚀 Project Overview

This is a multi-site project built using **Next.js**, **Supabase**, and **Vanilla CSS**. It is designed to be fully static-export compatible and scales via Supabase Edge Functions.

### 🏢 Architecture (Multi-Site)

1.  **Site-1 (Marketing & Onboarding)**: [site-1](./site-1)
    -   Handles public landing pages, pricing displays, and the 4-step library registration flow.
    -   Includes the `lms-admin` portal for platform-wide administration.
2.  **Site-2 (Library App Portal)**: [site-2](./site-2)
    -   The main dashboard for individual library owners and staff.
    -   Handles student management, seat booking, shift planning, and financial tracking.

## 🛠️ Technology Stack

-   **Frontend**: Next.js (Static Export), TypeScript, Vanilla CSS (No Tailwind).
-   **Backend**: Supabase (Database, Auth, Edge Functions).
-   **Payments**: Razorpay (Integrated via Edge Functions).
-   **Icons**: Lucide React.
-   **Email/Notifications**: Integrated via Supabase Edge Functions.

## 🗄️ Database Schema Summary

The system uses a highly optimized schema with Row Level Security (RLS) to ensure data isolation between libraries.

### Core Tables
-   `libraries`: The central registry for all subscribed libraries.
-   `pricing_config`: Dynamic pricing and validity (tracking in **minutes**).
-   `students`: Individual library members with plan details.
-   `seats` & `shifts`: Physical resource management for booking.
-   `financial_events`: Ledger for all income and member renewals.

### Row Level Security (RLS)
Security is enforced at the database level:
-   **Owners**: Access all data belonging to their library.
-   **Staff**: Access restricted data for libraries they are assigned to.
-   **Public**: Can only view pricing and send contact messages.

## 🔄 Key Workflows

### 1. Library Onboarding
A multi-step registration flow on Site-1 that:
-   Collects library and owner details.
-   Configures seats and shifts.
-   Handles Secure Payment via Razorpay.
-   Auto-activates the library account via a Supabase RPC.

### 2. Subscription Management
-   **Validity**: Tracked in `duration_minutes` for absolute precision.
-   **Renewal**: Seamlessly handled via Site-2 with real-time database price fetching.

### 3. Student Registration
-   Library staff can add students, assign seats, and track fee payments.
-   Automated notifications for plan expirations.

## 📂 Master Files

-   **Latest Schema**: [supabase_master_schema.sql](./supabase_master_schema.sql)
-   **Secrets Reference**: [SECRETS_REFERENCE.md](./SECRETS_REFERENCE.md)
