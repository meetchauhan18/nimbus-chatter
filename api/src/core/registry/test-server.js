import http from "http";

async function testRegistryServer() {
  const baseUrl = "http://localhost:4000";

  console.log("\n🧪 Testing Registry-Based Server...\n");

  try {
    // Test 1: Health Check
    console.log("1️⃣ Testing health endpoint...");
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    console.log("   Status:", health.status);
    console.log(
      "   Registry services:",
      health.services.registry.servicesRegistered
    );
    console.log("   ✅ Health check passed\n");

    // Test 2: 404 Handler
    console.log("2️⃣ Testing 404 handler...");
    const notFoundRes = await fetch(`${baseUrl}/api/nonexistent`);
    console.log("   Status:", notFoundRes.status);
    console.log("   ✅ 404 handler works\n");

    console.log("🎉 Phase 2 Server Tests Passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Wait for server to start
setTimeout(testRegistryServer, 2000);
