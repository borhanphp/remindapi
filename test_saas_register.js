// Native fetch in Node 18+

const register = async () => {
    const email = `testuser${Date.now()}@example.com`;
    console.log('Registering with:', email);

    const response = await fetch('http://localhost:5000/api/saas/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Test User',
            organizationName: `Org ${Date.now()}`,
            email: email,
            password: 'Password123!',
            role: 'user'
        })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
};

register();
