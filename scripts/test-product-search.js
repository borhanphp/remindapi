const axios = require('axios');

async function testProductSearch() {
  const baseUrl = 'http://localhost:5000/api';
  const adminEmail = 'admin@inventory.com';
  const adminPassword = 'admin123';

  try {
    // 1. Login
    console.log('🔑 Logging in...');
    const loginRes = await axios.post(`${baseUrl}/auth/login`, {
      email: adminEmail,
      password: adminPassword
    });

    if (!loginRes.data.success) {
      throw new Error('Login failed');
    }

    // Check if organization selection is required
    if (loginRes.data.requiresOrgSelection) {
      console.log('⚠️ Organization selection required. Selecting first available organization...');
      const orgId = loginRes.data.organizations[0]._id;
      const tempToken = loginRes.data.tempToken;

      const selectOrgRes = await axios.post(`${baseUrl}/auth/select-organization`, {
        organizationId: orgId,
        tempToken: tempToken
      });

      if (!selectOrgRes.data.success) throw new Error('Organization selection failed');

      console.log(`✅ Organization selected: ${loginRes.data.organizations[0].name}`);
      token = selectOrgRes.data.token;
    } else {
      token = loginRes.data.token;
      console.log('✅ Login successful (No org selection required)');
    }


    // 2. Create Test Product
    const testSku = `TEST-${Date.now()}`;
    const testName = `Searchable Item ${Date.now()}`;

    console.log(`\n📦 Creating product: "${testName}" (SKU: ${testSku})`);
    const createRes = await axios.post(`${baseUrl}/products`, {
      name: testName,
      sku: testSku,
      category: 'Test Category',
      price: 100,
      quantity: 10,
      description: 'This is a test product for search functionality'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!createRes.data.success) throw new Error('Product creation failed');
    const product = createRes.data.data;
    console.log('✅ Product created');

    // 3. Test Search Scenarios
    const scenarios = [
      { term: testName, desc: 'Full Name Exact Match' },
      { term: testName.substring(0, 7), desc: 'Partial Name (Start)' },
      { term: testName.substring(5, 10), desc: 'Partial Name (Middle)' },
      { term: testSku, desc: 'Full SKU Exact Match' },
      { term: 'Searchable', desc: 'Word Match' },
      { term: 'searchable', desc: 'Case Insensitive Match' }
    ];

    console.log('\n🔍 Running Search Tests...');
    let passed = 0;

    for (const scenario of scenarios) {
      try {
        const searchRes = await axios.get(`${baseUrl}/products?search=${encodeURIComponent(scenario.term)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const found = searchRes.data.data.some(p => p._id === product._id);
        const status = found ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${scenario.desc} [Term: "${scenario.term}"]`);
        if (found) passed++;
      } catch (e) {
        console.log(`❌ ERROR - ${scenario.desc}: ${e.message}`);
      }
    }

    // 4. Cleanup
    console.log('\n🧹 Cleaning up...');
    await axios.delete(`${baseUrl}/products/${product._id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Test product deleted');

    console.log(`\nResults: ${passed}/${scenarios.length} passed`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testProductSearch();
