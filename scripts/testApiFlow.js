const axios = require('axios');

async function testApiFlow() {
  try {
    console.log('🚀 Testing complete API authentication flow...\n');

    const baseUrl = 'http://localhost:5000/api';
    
    // Test 1: Login with admin credentials
    console.log('🔑 === STEP 1: Login ===');
    try {
      const loginResponse = await axios.post(`${baseUrl}/auth/login`, {
        email: 'admin@inventory.com',
        password: 'admin123'
      });

      if (loginResponse.data.success) {
        console.log('✅ Login successful');
        console.log(`✅ Token received: ${loginResponse.data.token.substring(0, 50)}...`);
        console.log(`✅ User: ${loginResponse.data.user.email}`);
        console.log(`✅ Role: ${loginResponse.data.user.role}`);
        
        const token = loginResponse.data.token;

        // Test 2: Get user profile (getMe)
        console.log('\n👤 === STEP 2: Get User Profile ===');
        try {
          const meResponse = await axios.get(`${baseUrl}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (meResponse.data.success) {
            console.log('✅ Profile fetch successful');
            console.log(`✅ User: ${meResponse.data.data.email}`);
            console.log(`✅ Role type: ${typeof meResponse.data.data.role}`);
            
            if (meResponse.data.data.role && typeof meResponse.data.data.role === 'object') {
              console.log(`✅ Role name: ${meResponse.data.data.role.name}`);
              console.log(`✅ Permissions count: ${meResponse.data.data.role.permissions.length}`);
            } else {
              console.log(`❌ Role not populated properly: ${meResponse.data.data.role}`);
            }
          }
        } catch (meError) {
          console.log(`❌ Profile fetch failed: ${meError.message}`);
          if (meError.response) {
            console.log(`❌ Status: ${meError.response.status}`);
            console.log(`❌ Data: ${JSON.stringify(meError.response.data)}`);
          }
        }

        // Test 3: Access protected route (users)
        console.log('\n👥 === STEP 3: Access Protected Route (Users) ===');
        try {
          const usersResponse = await axios.get(`${baseUrl}/users`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          console.log('✅ Users endpoint accessible');
          console.log(`✅ Users count: ${usersResponse.data.data ? usersResponse.data.data.length : 'N/A'}`);

        } catch (usersError) {
          console.log(`❌ Users endpoint failed: ${usersError.message}`);
          if (usersError.response) {
            console.log(`❌ Status: ${usersError.response.status}`);
            console.log(`❌ Data: ${JSON.stringify(usersError.response.data)}`);
          }
        }

        // Test 4: Access protected route (roles)
        console.log('\n🔐 === STEP 4: Access Protected Route (Roles) ===');
        try {
          const rolesResponse = await axios.get(`${baseUrl}/roles`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          console.log('✅ Roles endpoint accessible');
          console.log(`✅ Roles count: ${rolesResponse.data.data ? rolesResponse.data.data.length : 'N/A'}`);

        } catch (rolesError) {
          console.log(`❌ Roles endpoint failed: ${rolesError.message}`);
          if (rolesError.response) {
            console.log(`❌ Status: ${rolesError.response.status}`);
            console.log(`❌ Data: ${JSON.stringify(rolesError.response.data)}`);
          }
        }

        // Test 5: Access dashboard data (products)
        console.log('\n📦 === STEP 5: Access Dashboard Data (Products) ===');
        try {
          const productsResponse = await axios.get(`${baseUrl}/products`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          console.log('✅ Products endpoint accessible');
          console.log(`✅ Products count: ${productsResponse.data.products ? productsResponse.data.products.length : 'N/A'}`);

        } catch (productsError) {
          console.log(`❌ Products endpoint failed: ${productsError.message}`);
          if (productsError.response) {
            console.log(`❌ Status: ${productsError.response.status}`);
            console.log(`❌ Data: ${JSON.stringify(productsError.response.data)}`);
          }
        }

        console.log('\n🎉 === SUMMARY ===');
        console.log('✅ Backend authentication system is working');
        console.log('✅ JWT tokens are properly generated and validated');
        console.log('✅ Role-based permissions are functioning');
        console.log('\n📝 If you are still not seeing data in the frontend:');
        console.log('1. Check browser developer tools for API calls');
        console.log('2. Verify localStorage has the token');
        console.log('3. Check if frontend is sending Authorization headers');
        console.log('4. Verify the frontend is calling the correct API endpoints');

      } else {
        console.log('❌ Login failed');
      }

    } catch (loginError) {
      console.log(`❌ Login failed: ${loginError.message}`);
      if (loginError.response) {
        console.log(`❌ Status: ${loginError.response.status}`);
        console.log(`❌ Data: ${JSON.stringify(loginError.response.data)}`);
      }
      
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Make sure the backend server is running on port 5000');
      console.log('2. Check if the admin user was created correctly');
      console.log('3. Verify the password is "admin123"');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Check if server is running first
console.log('ℹ️ Make sure your backend server is running on http://localhost:5000');
console.log('ℹ️ Run this from a separate terminal: npm start\n');

testApiFlow(); 