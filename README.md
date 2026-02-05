# Zeeventory Backend

Backend service for the Zeeventory inventory management system.

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`
4. Start the development server: `npm run dev`

## Database Seeding

The system includes data seeders to populate your database with initial data for testing and development. The seeders will create default roles, users, categories, warehouses, and sample products.

### Default Admin User

When running the user seeder, a default admin user will be created with:
- Email: admin@example.com
- Password: admin123

### Available Seed Commands

- Seed all data: `npm run seed`
- Seed specific data:
  - Roles: `npm run seed:roles`
  - Users: `npm run seed:users`
  - Categories: `npm run seed:categories`
  - Warehouses: `npm run seed:warehouses`
  - Products: `npm run seed:products`

### Recommended Seeding Order

If seeding collections individually, it's recommended to follow this order:
1. Roles: `npm run seed:roles`
2. Users: `npm run seed:users`
3. Categories: `npm run seed:categories`
4. Warehouses: `npm run seed:warehouses`
5. Products: `npm run seed:products`

## API Routes

- Auth: `/api/auth`
- Users: `/api/users`
- Roles: `/api/roles`
- Products: `/api/products`
- Categories: `/api/categories`
- Warehouses: `/api/warehouses`
- Stock Adjustments: `/api/stock-adjustments`
- Stock Transfers: `/api/stock-transfers`
- Stock Alerts: `/api/stock-alerts`

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:
```
Authorization: Bearer YOUR_TOKEN
```

## Role-Based Access Control

The system implements role-based access control with the following default roles:
- admin: Full system access
- manager: Manage inventory, sales, and purchases
- accountant: Manage financial aspects
- salesperson: Manage sales and view inventory
- staff: Basic staff access

Custom roles can be created and managed via the API. 