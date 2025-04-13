import fetch from 'node-fetch';
import fs from 'fs';

// Store cookies for session management
let adminCookies = '';
let agentCookies = '';

// Helper function to make authenticated requests
async function authenticatedRequest(url, method = 'GET', body = null, cookies = '') {
  const headers = {
    'Cookie': cookies,
    'Content-Type': 'application/json'
  };

  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  };

  const response = await fetch(url, options);
  
  // Update cookies if they're in the response
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    return {
      response,
      cookies: setCookieHeader
    };
  }
  
  return { response, cookies };
}

// Login and get cookies
async function login(username, password) {
  const { response, cookies } = await authenticatedRequest(
    'http://localhost:5000/api/auth/login',
    'POST',
    { username, password }
  );
  
  const data = await response.json();
  console.log(`Logged in as ${username}:`, data);
  
  return cookies;
}

// Test admin functions
async function testAdminFunctions() {
  console.log('\n----- TESTING ADMIN FUNCTIONS -----');
  
  // Get all agents (admin only)
  const { response: agentsResponse } = await authenticatedRequest(
    'http://localhost:5000/api/agents',
    'GET',
    null,
    adminCookies
  );
  
  if (agentsResponse.ok) {
    const agents = await agentsResponse.json();
    console.log('Agents retrieved successfully:', agents.length, 'agents found');
  } else {
    console.log('Failed to retrieve agents:', await agentsResponse.text());
  }
  
  // Get agents with downline
  const { response: downlineResponse } = await authenticatedRequest(
    'http://localhost:5000/api/agents/downline',
    'GET',
    null,
    adminCookies
  );
  
  if (downlineResponse.ok) {
    const downline = await downlineResponse.json();
    console.log('Agent downlines retrieved successfully:', downline.length, 'agents with downlines found');
  } else {
    console.log('Failed to retrieve agent downlines:', await downlineResponse.text());
  }
  
  // Get transactions
  const { response: transactionsResponse } = await authenticatedRequest(
    'http://localhost:5000/api/transactions',
    'GET',
    null,
    adminCookies
  );
  
  if (transactionsResponse.ok) {
    const transactions = await transactionsResponse.json();
    console.log('Transactions retrieved successfully:', transactions.length, 'transactions found');
  } else {
    console.log('Failed to retrieve transactions:', await transactionsResponse.text());
  }
}

// Test agent functions
async function testAgentFunctions() {
  console.log('\n----- TESTING AGENT FUNCTIONS -----');
  
  // Get current agent's data
  const { response: agentResponse } = await authenticatedRequest(
    'http://localhost:5000/api/agents/1', // Agent ID 1 (linked to agent1 user)
    'GET',
    null,
    agentCookies
  );
  
  if (agentResponse.ok) {
    const agent = await agentResponse.json();
    console.log('Agent data retrieved successfully:', agent);
  } else {
    console.log('Failed to retrieve agent data:', await agentResponse.text());
  }
  
  // Get agent's transactions
  const { response: transactionsResponse } = await authenticatedRequest(
    'http://localhost:5000/api/agents/1/transactions', // Agent ID 1 (linked to agent1 user)
    'GET',
    null,
    agentCookies
  );
  
  if (transactionsResponse.ok) {
    const transactions = await transactionsResponse.json();
    console.log('Agent transactions retrieved successfully:', transactions.length, 'transactions found');
  } else {
    console.log('Failed to retrieve agent transactions:', await transactionsResponse.text());
  }
  
  // Try to access a different agent's data (should fail)
  const { response: unauthorizedResponse } = await authenticatedRequest(
    'http://localhost:5000/api/agents/2', // Different agent ID
    'GET',
    null,
    agentCookies
  );
  
  if (unauthorizedResponse.status === 403) {
    console.log('Authorization working correctly: Agent cannot access another agent\'s data');
  } else {
    console.log('Authorization issue: Agent could access another agent\'s data or received unexpected status:', unauthorizedResponse.status);
  }
}

// Test authorization failures
async function testAuthorizationFailures() {
  console.log('\n----- TESTING AUTHORIZATION FAILURES -----');
  
  // Try to access admin-only endpoint with agent account
  const { response: webhooksResponse } = await authenticatedRequest(
    'http://localhost:5000/api/webhooks',
    'GET',
    null,
    agentCookies
  );
  
  if (webhooksResponse.status === 403) {
    console.log('Authorization working correctly: Agent cannot access admin-only webhooks endpoint');
  } else {
    console.log('Authorization issue: Agent could access admin-only webhooks endpoint or received unexpected status:', webhooksResponse.status);
  }
}

// Main test function
async function runTests() {
  try {
    // Login with admin user
    adminCookies = await login('admin', 'password123');
    
    // Login with agent user
    agentCookies = await login('agent1', 'password123');
    
    // Run tests
    await testAdminFunctions();
    await testAgentFunctions();
    await testAuthorizationFailures();
    
    console.log('\n----- TESTING COMPLETED SUCCESSFULLY -----');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

runTests();