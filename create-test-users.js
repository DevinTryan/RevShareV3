import fetch from 'node-fetch';

async function createUsers() {
  // Create admin user
  const adminUser = {
    username: 'admin',
    password: 'password123',
    email: 'admin@talkrealty.com',
    role: 'admin'
  };

  try {
    // Register admin user
    const adminResponse = await fetch('http://localhost:8080/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adminUser)
    });
    const adminResult = await adminResponse.json();
    console.log('Admin user created:', adminResult);
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createUsers();