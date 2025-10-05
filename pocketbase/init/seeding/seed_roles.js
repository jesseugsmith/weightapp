#!/usr/bin/env node

/**
 * PocketBase Role Seeder
 * 
 * This script seeds the roles, permissions, and role_permissions tables
 * in your PocketBase instance with the necessary data for the weight
 * tracking competition app that uses Clerk for authentication.
 * 
 * Usage:
 * 1. Make sure PocketBase is running
 * 2. Get your admin credentials from PocketBase admin UI
 * 3. Update the POCKETBASE_URL and admin credentials below
 * 4. Run: node seed_roles.js
 */

const fs = require('fs');
const path = require('path');

// Configuration - Update these values for your setup
const POCKETBASE_URL = 'http://localhost:8090';
const ADMIN_EMAIL = 'jessieeugenejr@gmail.com';  // PocketBase admin email
const ADMIN_PASSWORD = 'Jessie44$$';  // PocketBase admin password

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', data = null, token = null) {
  const url = `${POCKETBASE_URL}/api${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(result)}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Request failed for ${endpoint}:`, error.message);
    throw error;
  }
}

// Authenticate PocketBase admin (superuser)
async function authenticateAdmin() {
  try {
    const result = await apiRequest('/collections/_superusers/auth-with-password', 'POST', {
      identity: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    return result.token;
  } catch (error) {
    console.error('Failed to authenticate PocketBase admin:', error.message);
    console.error('Make sure you have the correct admin credentials for PocketBase!');
    console.error('You can find/create admin credentials in the PocketBase admin UI.');
    throw error;
  }
}

// Create a role (only if it doesn't exist)
async function createRole(roleData, token, existingRoles) {
  const existingRole = existingRoles.find(r => r.name === roleData.name);
  if (existingRole) {
    return { created: false, record: existingRole };
  }
  
  try {
    const newRole = await apiRequest('/collections/roles/records', 'POST', roleData, token);
    return { created: true, record: newRole };
  } catch (error) {
    // Handle unique constraint violations
    if (error.message.includes('400') || error.message.includes('UNIQUE constraint')) {
      console.log(`    ⚠️  Role '${roleData.name}' creation failed - likely already exists`);
      // Try to fetch the existing role
      try {
        const roles = await apiRequest('/collections/roles/records?filter=(name="' + roleData.name + '")', 'GET', null, token);
        if (roles.items && roles.items.length > 0) {
          return { created: false, record: roles.items[0] };
        }
      } catch (fetchError) {
        console.log(`    ❌ Could not fetch existing role '${roleData.name}'`);
      }
      return { created: false, record: null };
    }
    throw error;
  }
}

// Create a permission (only if it doesn't exist)
async function createPermission(permissionData, token, existingPermissions) {
  const existingPermission = existingPermissions.find(p => p.name === permissionData.name);
  if (existingPermission) {
    return { created: false, record: existingPermission };
  }
  
  try {
    const newPermission = await apiRequest('/collections/permissions/records', 'POST', permissionData, token);
    return { created: true, record: newPermission };
  } catch (error) {
    // Handle unique constraint violations
    if (error.message.includes('400') || error.message.includes('UNIQUE constraint')) {
      console.log(`    ⚠️  Permission '${permissionData.name}' creation failed - likely already exists`);
      // Try to fetch the existing permission
      try {
        const permissions = await apiRequest('/collections/permissions/records?filter=(name="' + permissionData.name + '")', 'GET', null, token);
        if (permissions.items && permissions.items.length > 0) {
          return { created: false, record: permissions.items[0] };
        }
      } catch (fetchError) {
        console.log(`    ❌ Could not fetch existing permission '${permissionData.name}'`);
      }
      return { created: false, record: null };
    }
    throw error;
  }
}

// Create role-permission mapping (only if it doesn't exist)
async function createRolePermission(roleId, permissionId, token, existingRolePermissions) {
  const existingMapping = existingRolePermissions.find(
    rp => rp.role_id === roleId && rp.permission_id === permissionId
  );
  
  if (existingMapping) {
    return { created: false, record: existingMapping };
  }
  
  try {
    const newMapping = await apiRequest('/collections/role_permissions/records', 'POST', {
      role_id: roleId,
      permission_id: permissionId
    }, token);
    return { created: true, record: newMapping };
  } catch (error) {
    // Handle unique constraint violations
    if (error.message.includes('400') || error.message.includes('UNIQUE constraint')) {
      console.log(`    ⚠️  Role-permission mapping creation failed - likely already exists`);
      return { created: false, record: null };
    }
    throw error;
  }
}

// Get existing records to check for duplicates
async function getExistingRecords(collection, token) {
  try {
    const result = await apiRequest(`/collections/${collection}/records?perPage=500`, 'GET', null, token);
    return result.items || [];
  } catch (error) {
    console.log(`Could not fetch existing ${collection}, assuming empty collection`);
    return [];
  }
}

async function main() {
  try {
    console.log('🚀 Starting PocketBase role seeding...\n');

    // Load seed data
    const seedDataPath = path.join(__dirname, 'seed_roles.json');
    if (!fs.existsSync(seedDataPath)) {
      throw new Error('seed_roles.json file not found!');
    }

    const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));
    console.log('✅ Loaded seed data from seed_roles.json\n');

    // Authenticate
    console.log('🔐 Authenticating PocketBase admin...');
    const token = await authenticateAdmin();
    console.log('✅ Admin authenticated successfully\n');

    // Get existing data to avoid duplicates
    console.log('📋 Checking existing data...');
    const existingRoles = await getExistingRecords('roles', token);
    const existingPermissions = await getExistingRecords('permissions', token);
    const existingRolePermissions = await getExistingRecords('role_permissions', token);

    const roleMap = new Map();
    const permissionMap = new Map();
    
    // Statistics
    let rolesCreated = 0;
    let rolesSkipped = 0;
    let permissionsCreated = 0;
    let permissionsSkipped = 0;
    let mappingsCreated = 0;
    let mappingsSkipped = 0;

    // Create roles
    console.log('👥 Processing roles...');
    for (const roleData of seedData.roles) {
      const result = await createRole(roleData, token, existingRoles);
      if (result.record) {
        roleMap.set(roleData.name, result.record.id);
        if (result.created) {
          console.log(`  ✅ Created role: ${roleData.name}`);
          rolesCreated++;
        } else {
          console.log(`  ↳ Role '${roleData.name}' already exists`);
          rolesSkipped++;
        }
      } else {
        console.log(`  ❌ Failed to process role: ${roleData.name}`);
      }
    }

    // Create permissions
    console.log('\n🔐 Processing permissions...');
    for (const permissionData of seedData.permissions) {
      const result = await createPermission(permissionData, token, existingPermissions);
      if (result.record) {
        permissionMap.set(permissionData.name, result.record.id);
        if (result.created) {
          console.log(`  ✅ Created permission: ${permissionData.name}`);
          permissionsCreated++;
        } else {
          console.log(`  ↳ Permission '${permissionData.name}' already exists`);
          permissionsSkipped++;
        }
      } else {
        console.log(`  ❌ Failed to process permission: ${permissionData.name}`);
      }
    }

    // Create role-permission mappings
    console.log('\n🔗 Processing role-permission mappings...');
    for (const mapping of seedData.role_permissions) {
      const roleId = roleMap.get(mapping.role);
      if (!roleId) {
        console.log(`  ❌ Role '${mapping.role}' not found, skipping mappings`);
        continue;
      }

      console.log(`  📝 Processing mappings for role: ${mapping.role}`);
      for (const permissionName of mapping.permissions) {
        const permissionId = permissionMap.get(permissionName);
        if (!permissionId) {
          console.log(`    ❌ Permission '${permissionName}' not found, skipping`);
          continue;
        }

        const result = await createRolePermission(roleId, permissionId, token, existingRolePermissions);
        if (result.created) {
          console.log(`    ✅ Mapped ${mapping.role} -> ${permissionName}`);
          mappingsCreated++;
        } else {
          console.log(`    ↳ Mapping ${mapping.role} -> ${permissionName} already exists`);
          mappingsSkipped++;
        }
      }
    }

    console.log('\n🎉 Role seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  • Roles: ${rolesCreated} created, ${rolesSkipped} already existed`);
    console.log(`  • Permissions: ${permissionsCreated} created, ${permissionsSkipped} already existed`);
    console.log(`  • Role-Permission mappings: ${mappingsCreated} created, ${mappingsSkipped} already existed`);
    
    if (rolesCreated === 0 && permissionsCreated === 0 && mappingsCreated === 0) {
      console.log('\n✨ No changes needed - all data already exists!');
    }
    
    console.log('\n🔧 Next steps:');
    console.log('  1. Set up Clerk webhooks to sync users to PocketBase');
    console.log('  2. When users sign up via Clerk, they will be synced to PocketBase');
    console.log('  3. Use the "user_roles" collection to assign roles to synced users');
    console.log('  4. Implement permission checking in your application using Clerk user IDs');

  } catch (error) {
    console.error('\n❌ Error during seeding:', error.message);
    process.exit(1);
  }
}

// Check if running in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
  // Install fetch polyfill for Node.js if needed
  if (typeof fetch === 'undefined') {
    console.log('📦 Installing fetch polyfill...');
    global.fetch = require('node-fetch');
  }
  
  main().catch(console.error);
}

module.exports = { main, apiRequest, authenticateAdmin };
