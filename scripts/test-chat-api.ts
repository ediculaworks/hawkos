#!/usr/bin/env bun
/**
 * Test script to diagnose chat API issues
 * Run with: bun scripts/test-chat-api.ts
 */
// biome-ignore lint/suspicious/noConsole: diagnostic test script
// biome-ignore lint/style/noUnusedTemplateLiteral: diagnostic test script

const API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';

async function test(name: string, fn: () => Promise<void>) {
  try {
    console.log(`\n✓ Testing: ${name}`);
    await fn();
    console.log(`  ✅ Passed`);
  } catch (err) {
    console.error(`  ❌ Failed:`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log(`\n🧪 Chat API Diagnostic Tests\n`);
  console.log(`API URL: ${API_URL}\n`);

  // Test 1: Health check
  await test('Health endpoint', async () => {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    const data = await res.json();
    console.log(`  Response: ${JSON.stringify(data)}`);
  });

  // Test 2: Status endpoint
  await test('Status endpoint', async () => {
    const res = await fetch(`${API_URL}/status`);
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    const data = await res.json();
    console.log(`  Agent status: ${data.status}`);
    console.log(`  Sessions: ${data.sessions.length}`);
  });

  // Test 3: List sessions
  await test('List chat sessions', async () => {
    const res = await fetch(`${API_URL}/chat/sessions`);
    if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`  Sessions found: ${data.sessions.length}`);
    if (data.error) console.log(`  Error: ${data.error}`);
    if (data.sessions.length > 0) {
      console.log(`  First session: ${JSON.stringify(data.sessions[0])}`);
    }
  });

  // Test 4: Create session
  let sessionId = '';
  await test('Create new chat session', async () => {
    const res = await fetch(`${API_URL}/chat/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.error) throw new Error(`Create session error: ${data.error}`);
    sessionId = data.sessionId;
    console.log(`  Created session: ${sessionId}`);
  });

  // Test 5: List agents
  await test('List agents', async () => {
    const res = await fetch(`${API_URL}/agents`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    console.log(`  Agents found: ${data.agents.length}`);
  });

  // Test 6: Get activity logs
  await test('Get activity logs', async () => {
    const res = await fetch(`${API_URL}/logs?limit=10`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    console.log(`  Logs found: ${data.logs.length}`);
    if (data.error) console.log(`  Error: ${data.error}`);
    if (data.logs.length > 0) {
      const latest = data.logs[0];
      console.log(`  Latest: [${latest.event_type}] ${latest.summary}`);
    }
  });

  // Test 7: Send message (if session created successfully)
  if (sessionId) {
    await test('Send chat message via WebSocket', async () => {
      console.log(`  [Note: This requires WebSocket connection - manual test needed]`);
      console.log(`  Session ID: ${sessionId}`);
      console.log(`  Connect to: ws://localhost:3001/ws`);
      console.log(`  Send: {"type":"chat_join","sessionId":"${sessionId}"}`);
      console.log(`  Then: {"type":"chat_message","sessionId":"${sessionId}","content":"Olá"}`);
    });
  }

  console.log(`\n✅ Diagnostic complete\n`);
}

main().catch(console.error);
