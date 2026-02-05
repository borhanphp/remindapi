# Role and Permission Management System

## Overview

This inventory management system implements a comprehensive Role-Based Access Control (RBAC) system that provides fine-grained control over user permissions and access to different parts of the application.

## Architecture

### Core Components

1. **Models**
   - `Role.js` - Defines roles with permissions
   - `User.js` - Users with role references

2. **Middleware**
   - `auth.js` - Authentication and authorization middleware

3. **Controllers**
   - `roles.js` - Role management operations
   - `users.js` - User management with role assignment

4. **Frontend Components**
   - `Permission.js` - Conditional rendering based on permissions
   - `RoleManager.js` - Comprehensive role management interface

## Permission Structure

### Permission Format

Permissions follow the format: `module:action`

Examples:
- `users:view` - View users
- `inventory:create` - Create inventory items
- `reports:export` - Export reports

### Available Permissions

#### User Management
- `users:view` - View user list and details
- `users:create` - Create new users
- `users:edit` - Edit user information
- `users:delete` - Delete users

#### Role Management
- `roles:view` - View roles and permissions
- `roles:create` - Create new roles
- `roles:edit` - Edit existing roles
- `roles:delete` - Delete custom roles

#### Inventory Management
- `inventory:view` - View inventory items
- `inventory:create` - Add new inventory items
- `inventory:edit` - Edit inventory items
- `inventory:delete` - Remove inventory items

#### Sales Management
- `sales:view` - View sales data
- `sales:create` - Create sales orders/invoices
- `sales:edit` - Edit sales records
- `sales:delete` - Delete sales records

#### Purchase Management
- `purchase:view` - View purchase data
- `purchase:create` - Create purchase orders
- `purchase:edit` - Edit purchase records
- `purchase:delete` - Delete purchase records
- `purchase:approve` - Approve purchase orders

#### Stock Management
- `stock-adjustment:view` - View stock adjustments
- `stock-adjustment:create` - Create stock adjustments
- `stock-adjustment:delete` - Delete stock adjustments
- `stock-transfer:view` - View stock transfers
- `stock-transfer:create` - Create stock transfers
- `stock-transfer:edit` - Edit stock transfers
- `stock-transfer:delete` - Delete stock transfers
- `stock-alert:view` - View stock alerts
- `stock-alert:manage` - Manage stock alert settings

#### Reports & Analytics
- `reports:view` - View reports
- `reports:export` - Export reports to files

#### System Settings
- `settings:view` - View system settings
- `settings:edit` - Modify system settings

## Built-in Roles

### Admin
- **Description**: Full system access
- **Permissions**: All available permissions
- **Use Case**: System administrators, owners

### Manager
- **Description**: Manage inventory, sales, and purchases with limited user management
- **Permissions**: All permissions except `users:delete` and `settings:edit`
- **Use Case**: Store managers, department heads

### Accountant
- **Description**: Manage financial aspects, reports, and accounting functions
- **Permissions**: 
  - All view permissions
  - Sales create/edit
  - Purchase create/edit/approve
  - Reports view/export
  - Stock adjustment view/create
- **Use Case**: Financial staff, accountants

### Salesperson
- **Description**: Manage sales and view inventory
- **Permissions**:
  - Inventory view
  - Sales view/create/edit
  - Reports view
  - Stock adjustment view/create
- **Use Case**: Sales staff, customer service

### Staff
- **Description**: Basic staff access with limited permissions
- **Permissions**:
  - Inventory view
  - Sales view
  - Purchase view
  - Stock adjustment view
- **Use Case**: General staff, interns

## API Endpoints

### Role Management

#### Get All Roles
```
GET /api/roles
Authorization: Bearer <token>
Required Permission: roles:view
```

#### Get Custom Roles Only
```
GET /api/roles/custom
Authorization: Bearer <token>
Required Permission: roles:view
```

#### Get Single Role
```
GET /api/roles/:id
Authorization: Bearer <token>
Required Permission: roles:view
```

#### Create Role
```
POST /api/roles
Authorization: Bearer <token>
Required Permission: roles:create

Body:
{
  "name": "custom-role",
  "description": "Custom role description",
  "permissions": ["users:view", "inventory:view"]
}
```

#### Update Role
```
PUT /api/roles/:id
Authorization: Bearer <token>
Required Permission: roles:edit

Body:
{
  "name": "updated-role",
  "description": "Updated description",
  "permissions": ["users:view", "inventory:view", "sales:view"]
}
```

#### Delete Role
```
DELETE /api/roles/:id
Authorization: Bearer <token>
Required Permission: roles:delete
```

### User Management

#### Get All Users
```
GET /api/users
Authorization: Bearer <token>
Required Permission: users:view
```

#### Create User with Role
```
POST /api/users
Authorization: Bearer <token>
Required Permission: users:create

Body:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "roleId": "role_object_id",
  "isActive": true
}
```

#### Assign Role to User
```
PUT /api/users/:id/role
Authorization: Bearer <token>
Required Permission: users:edit

Body:
{
  "roleId": "new_role_object_id"
}
```

#### Get User Permissions
```
GET /api/users/:id/permissions
Authorization: Bearer <token>
Required Permission: users:view
```

## Frontend Usage

### Permission Component

Use the `Permission` component to conditionally render content based on user permissions:

```jsx
import Permission from '../components/auth/Permission';
import { PERMISSIONS } from '../utils/permissions';

// Single permission
<Permission require={PERMISSIONS.USERS_CREATE}>
  <button>Create User</button>
</Permission>

// Any of multiple permissions
<Permission require={[PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_CREATE]}>
  <button>Edit</button>
</Permission>

// All of multiple permissions
<Permission require={[PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_EDIT]} requireAll={true}>
  <button>Special Action</button>
</Permission>

// With fallback content
<Permission require={PERMISSIONS.ADMIN_ACCESS} fallback={<div>Access Denied</div>}>
  <AdminPanel />
</Permission>
```

### Permission Checking Functions

```jsx
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../utils/permissions';

// Check single permission
const canEdit = hasPermission(user, PERMISSIONS.USERS_EDIT);

// Check if user has any of the permissions
const canAccess = hasAnyPermission(user, [
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.ROLES_VIEW
]);

// Check if user has all permissions
const canPerformAction = hasAllPermissions(user, [
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_EDIT
]);
```

## Middleware Usage

### Protecting Routes

```javascript
const { protect, authorize, authorizeAny, authorizeAll } = require('../middleware/auth');

// Single permission
router.get('/users', protect, authorize(PERMISSIONS.USERS_VIEW), getUsers);

// Any of multiple permissions
router.get('/dashboard', protect, authorizeAny([
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.INVENTORY_VIEW
]), getDashboard);

// All of multiple permissions
router.post('/admin-action', protect, authorizeAll([
  PERMISSIONS.USERS_EDIT,
  PERMISSIONS.SETTINGS_EDIT
]), adminAction);
```

## Migration Guide

### From Legacy String Roles to Role-Based System

1. **Run Migration Script**
   ```bash
   node backend/scripts/migrateUsersToRoles.js
   ```

2. **The migration will:**
   - Create default roles in the database
   - Convert existing users from string roles to role references
   - Preserve legacy roles for backward compatibility
   - Verify migration success

3. **Manual Steps (if needed)**
   - Review custom role requirements
   - Create additional custom roles as needed
   - Assign appropriate roles to users

## Custom Role Creation

### Via API
```javascript
const newRole = await axios.post('/api/roles', {
  name: 'warehouse-manager',
  description: 'Manages warehouse operations',
  permissions: [
    'inventory:view',
    'inventory:edit',
    'stock-transfer:view',
    'stock-transfer:create',
    'stock-adjustment:view',
    'stock-adjustment:create'
  ]
});
```

### Via Frontend
1. Navigate to Admin → Roles
2. Click "Create Role"
3. Enter role name and description
4. Select appropriate permissions by category
5. Save the role

## Security Best Practices

### Permission Design
1. **Principle of Least Privilege**: Grant only necessary permissions
2. **Granular Permissions**: Use specific permissions rather than broad access
3. **Regular Review**: Periodically review and update role permissions

### Implementation
1. **Always Authenticate**: Use `protect` middleware on all protected routes
2. **Check Permissions**: Use appropriate authorization middleware
3. **Frontend Validation**: Use Permission component for UI elements
4. **Backend Enforcement**: Never rely solely on frontend permission checks

### Role Management
1. **Limit Role Creation**: Restrict role creation to administrators
2. **Audit Trail**: Log role and permission changes
3. **Built-in Role Protection**: Prevent modification of system roles

## Troubleshooting

### Common Issues

#### Users Can't Access Resources
1. Check if user has required role assigned
2. Verify role has necessary permissions
3. Ensure middleware is properly configured on routes

#### Migration Issues
1. Run migration verification: `node scripts/migrateUsersToRoles.js`
2. Check database connectivity
3. Verify default roles exist

#### Permission Errors
1. Check permission constants match between frontend and backend
2. Verify route protection is properly implemented
3. Ensure user token is valid and includes role information

### Debug Commands

```bash
# Check user roles and permissions
GET /api/users/:id/permissions

# Verify role permissions
GET /api/roles/:id

# Test route access
GET /api/protected-route (with Authorization header)
```

## Future Enhancements

### Planned Features
1. **Permission Groups**: Logical grouping of related permissions
2. **Conditional Permissions**: Context-based permission granting
3. **Permission Inheritance**: Role hierarchy with inherited permissions
4. **Audit Logging**: Comprehensive permission usage tracking
5. **Dynamic Permissions**: Runtime permission modification

### Extension Points
1. **Custom Permission Validators**: Plugin system for custom authorization logic
2. **External Role Providers**: Integration with LDAP, Active Directory
3. **Multi-tenant Support**: Organization-specific roles and permissions

## Conclusion

This role and permission system provides a robust foundation for access control in the inventory management system. It supports both built-in and custom roles, fine-grained permissions, and comprehensive management interfaces. The system is designed to be secure, scalable, and maintainable. 