/**
 * Release-Blocking Tests for approveAgentVerification
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0
 * Function: functions/approveAgentVerification.js
 * 
 * These four tests must pass before Function #3 can be released to production.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("BASE44_API_URL") || "http://localhost:8000";
const FUNCTION_URL = `${BASE_URL}/functions/approveAgentVerification`;

/**
 * Test 1: Non-admin denied (403)
 * 
 * Assertion: Only admins can approve verification requests
 */
Deno.test("approveAgentVerification - Non-admin denied with 403", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_PENDING")}`
        },
        body: JSON.stringify({
            industry_user_id: "test_user_id"
        })
    });

    assertEquals(response.status, 403, "Non-admins must be denied with 403 Forbidden");
    
    const data = await response.json();
    assertEquals(data.code, "ADMIN_REQUIRED", "Error code must be ADMIN_REQUIRED");
    assertExists(data.requestId, "Request ID must be present in error response");
});

/**
 * Test 2: State machine - only PENDING→VERIFIED allowed
 * 
 * Assertion: Cannot approve from UNVERIFIED, VERIFIED, REJECTED, or SUSPENDED states
 */
Deno.test("approveAgentVerification - State machine enforces PENDING→VERIFIED only", async () => {
    // Test 1: Try to approve UNVERIFIED user (should fail)
    const unverifiedResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_UNVERIFIED")
        })
    });

    assertEquals(unverifiedResponse.status, 400, "Cannot approve UNVERIFIED user");
    const unverifiedData = await unverifiedResponse.json();
    assertEquals(unverifiedData.code, "STATE_VIOLATION", "Must return STATE_VIOLATION error");

    // Test 2: Try to approve already VERIFIED user (should fail)
    const verifiedResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_VERIFIED")
        })
    });

    assertEquals(verifiedResponse.status, 400, "Cannot approve already VERIFIED user");
    const verifiedData = await verifiedResponse.json();
    assertEquals(verifiedData.code, "STATE_VIOLATION", "Must return STATE_VIOLATION error");

    // Test 3: Approve PENDING user (should succeed)
    const pendingResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_PENDING")
        })
    });

    assertEquals(pendingResponse.status, 200, "PENDING→VERIFIED transition must succeed");
    const pendingData = await pendingResponse.json();
    assertEquals(pendingData.approved.verification_status, "VERIFIED", "Status must be VERIFIED after approval");
});

/**
 * Test 3: Allowlist DTO - banned fields must be absent
 * 
 * Assertion: Response must contain ONLY allowlist fields in approved object
 */
Deno.test("approveAgentVerification - Allowlist DTO with no banned fields", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_PENDING")
        })
    });

    assertEquals(response.status, 200, "Request must succeed");
    
    const data = await response.json();
    const approved = data.approved;

    // Allowlist fields MUST be present
    assertExists(approved.id, "id must be present");
    assertExists(approved.full_name, "full_name must be present");
    assertExists(approved.company, "company must be present");
    assertExists(approved.role_type, "role_type must be present");
    assertExists(approved.verification_status, "verification_status must be present");
    assertExists(approved.bio, "bio must be present");

    // Banned fields MUST be absent
    assertEquals(approved.user_email, undefined, "user_email must NOT be present");
    assertEquals(approved.linkedin_url, undefined, "linkedin_url must NOT be present");
    assertEquals(approved.imdb_url, undefined, "imdb_url must NOT be present");
    assertEquals(approved.rate_limit_flags, undefined, "rate_limit_flags must NOT be present");
    assertEquals(approved.suspended, undefined, "suspended must NOT be present");
    assertEquals(approved.verification_date, undefined, "verification_date must NOT be in DTO");
    assertEquals(approved.verified_by, undefined, "verified_by must NOT be in DTO");
});

/**
 * Test 4: Error shape exactly {code, message, requestId}
 * 
 * Assertion: All errors must return canonical error shape with NO extra fields
 */
Deno.test("approveAgentVerification - Error shape keys exactly ['code','message','requestId']", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_PENDING")}`
        },
        body: JSON.stringify({
            industry_user_id: "test_user_id"
        })
    });

    const data = await response.json();
    const actualKeys = Object.keys(data).sort();
    const expectedKeys = ['code', 'message', 'requestId'].sort();

    // Error response must contain EXACTLY these keys
    assertEquals(
        JSON.stringify(actualKeys),
        JSON.stringify(expectedKeys),
        "Error response keys must be exactly ['code', 'message', 'requestId']"
    );

    // Required fields
    assertExists(data.code, "Error must have 'code' field");
    assertExists(data.message, "Error must have 'message' field");
    assertExists(data.requestId, "Error must have 'requestId' field");
});