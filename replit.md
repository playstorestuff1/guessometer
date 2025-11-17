# Guessometer Application

## Overview

This is a full-stack prediction tracking application built with React, Express.js, and PostgreSQL. The application allows users to create, track, and evaluate their predictions over time, with features for accuracy measurement, leaderboards, and community engagement. Users can submit predictions with confidence levels, track outcomes, and analyze their forecasting performance through detailed statistics and charts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React SPA**: Single-page application built with React 18 and TypeScript
- **Routing**: Client-side routing using Wouter for navigation between pages
- **UI Framework**: shadcn/ui components built on top of Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack React Query for server state management and caching
- **Form Handling**: React Hook Form with Zod validation for type-safe form processing
- **Charts**: Chart.js integration for displaying accuracy trends and analytics

### Backend Architecture
- **Express.js Server**: RESTful API server with TypeScript support
- **Database ORM**: Drizzle ORM for type-safe database operations and migrations
- **Authentication**: Replit Auth integration using OpenID Connect (OIDC) with session management
- **Session Storage**: PostgreSQL-based session storage using connect-pg-simple
- **API Structure**: RESTful endpoints for users, predictions, categories, and statistics

### Data Layer
- **Primary Database**: PostgreSQL with Drizzle ORM schema management
- **Connection Pool**: Neon serverless PostgreSQL connection pooling
- **Schema Design**: 
  - Users table with profile information
  - Predictions table with outcomes and confidence levels
  - Categories for prediction classification
  - User statistics with accuracy tracking
  - Session management for authentication

### Authentication & Authorization
- **Replit Auth**: OpenID Connect integration for user authentication
- **Session Management**: Server-side sessions stored in PostgreSQL
- **Protected Routes**: Middleware-based authentication checking for API endpoints
- **User Profiles**: Automatic user profile creation and management

### External Dependencies

- **Database**: Neon PostgreSQL serverless database via `@neondatabase/serverless`
- **Authentication**: Replit's OpenID Connect service for user authentication
- **Payment Processing**: Prepared for Stripe integration (referenced in requirements but not yet implemented)
- **External API Integration**: Airtable service layer for potential data synchronization
- **UI Components**: Radix UI primitives for accessible component foundation
- **Charts**: Chart.js for data visualization and trend analysis
- **Styling**: Tailwind CSS for utility-first styling approach