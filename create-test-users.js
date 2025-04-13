import fetch from 'node-fetch';

async function createUsers() {
  // Create admin user
  const adminUser = {
    username: 'admin',
    password: 'password123',
    email: 'admin@talkrealty.com',
    role: 'admin'
  };

  // Create agent user (linked to agent ID 1 - replace with an existing agent ID)
  const agentUser = {
    username: 'agent1',
    password: 'password123',
    email: 'agent1@talkrealty.com',
    role: 'agent',
    agentId: 1
  };

  try {
    // Register admin user
    const adminResponse = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adminUser)
    });
    
    const adminResult = await adminResponse.json();
    console.log('Admin user created:', adminResult);

    // Register agent user
    const agentResponse = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentUser)
    });
    
    const agentResult = await agentResponse.json();
    console.log('Agent user created:', agentResult);

  } catch (error) {
    console.error('Error creating test users:', error);
  }
}

createUsers();