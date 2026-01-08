/**
 * Release-Blocking Tests for createAgentVerificationRequest
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0
 * Function: functions/createAgentVerificationRequest.js
 * 
 * These four tests must pass before Function #1 can be released to production.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("BASE44_API_URL") || "http://localhost:8000";
const FUNCTION_URL = `${BASE_URL}/functions/createAgentVerificationRequest`;

/**
 * Test 1: AUTHOR role denied (403)
 * 
 * Assertion: Authors/users cannot request industry verification
 */
Deno.test("createAgentVerificationRequest - AUTHOR role denied with 403", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}` // Mock author token
        },
        body: JSON.stringify({
            full_name: "Test Author",
            company: "Test Publisher",
            role_type: "agent"
        })
    });

    assertEquals(response.status, 403, "Authors must be denied with 403 Forbidden");
    
    const data = await response.json();
    assertEquals(data.code, "ROLE_FORBIDDEN", "Error code must be ROLE_FORBIDDEN");
    assertExists(data.requestId, "Request ID must be present in error response");
});

/**
 * Test 2: Only UNVERIFIED → PENDING transition succeeds
 * 
 * Assertion: State machine only allows UNVERIFIED → PENDING, blocks all other transitions
 */
Deno.test("createAgentVerificationRequest - Only UNVERIFIED to PENDING succeeds", async () => {
    // Test 2a: UNVERIFIED → PENDING (should succeed)
    const unverifiedResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_UNVERIFIED")}`
        },
        body: JSON.stringify({
            full_name: "Test Agent",
            company: "Test Agency",
            role_type: "agent",
            bio: "Test bio"
        })
    });

    assertEquals(unverifiedResponse.status, 200, "UNVERIFIED → PENDING must succeed");
    
    const unverifiedData = await unverifiedResponse.json();
    assertEquals(unverifiedData.request.verification_status, "PENDING", "Status must be PENDING");

    // Test 2b: VERIFIED → PENDING (should fail with STATE_VIOLATION)
    const verifiedResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_VERIFIED")}`
        },
        body: JSON.stringify({
            full_name: "Verified Agent",
            company: "Verified Agency",
            role_type: "agent"
        })
    });

    assertEquals(verifiedResponse.status, 400, "VERIFIED → PENDING must fail");
    
    const verifiedData = await verifiedResponse.json();
    assertEquals(verifiedData.code, "STATE_VIOLATION", "Must return STATE_VIOLATION error");
});

/**
 * Test 3: Allowlist DTO - banned fields must be absent
 * 
 * Assertion: Response must contain ONLY allowlist fields, NO banned fields
 */
Deno.test("createAgentVerificationRequest - Allowlist DTO with no banned fields", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_UNVERIFIED")}`
        },
        body: JSON.stringify({
            full_name: "Test Agent",
            company: "Test Agency",
            role_type: "producer",
            bio: "Test bio",
            linkedin_url: "https://linkedin.com/in/test",
            imdb_url: "https://imdb.com/name/test"
        })
    });

    assertEquals(response.status, 200, "Request must succeed");
    
    const data = await response.json();
    const request = data.request;

    // Allowlist fields MUST be present
    assertExists(request.id, "id must be present");
    assertExists(request.full_name, "full_name must be present");
    assertExists(request.company, "company must be present");
    assertExists(request.role_type, "role_type must be present");
    assertExists(request.verification_status, "verification_status must be present");
    assertExists(request.bio, "bio must be present");

    // Banned fields MUST be absent
    assertEquals(request.user_email, undefined, "user_email must NOT be present");
    assertEquals(request.verification_date, undefined, "verification_date must NOT be present");
    assertEquals(request.verified_by, undefined, "verified_by must NOT be present");
    assertEquals(request.linkedin_url, undefined, "linkedin_url must NOT be present");
    assertEquals(request.imdb_url, undefined, "imdb_url must NOT be present");
    assertEquals(request.rate_limit_flags, undefined, "rate_limit_flags must NOT be present");
    assertEquals(request.suspended, undefined, "suspended must NOT be present");
});

/**
 * Test 4: Error shape exactly {code, message, requestId}
 * 
 * Assertion: All errors must return canonical error shape with NO extra fields
 */
Deno.test("createAgentVerificationRequest - Error shape exactly code+message+requestId", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}`
        },
        body: JSON.stringify({
            full_name: "Test",
            company: "Test",
            role_type: "invalid_role"
        })
    });

    const data = await response.json();

    // Required fields
    assertExists(data.code, "Error must have 'code' field");
    assertExists(data.message, "Error must have 'message' field");
    assertExists(data.requestId, "Error must have 'requestId' field");

    // NO extra fields allowed
    const allowedKeys = ["code", "message", "requestId"];
    const actualKeys = Object.keys(data);
    
    actualKeys.forEach(key => {
        assertEquals(
            allowedKeys.includes(key),
            true,
            `Error response must not contain field: ${key}`
        );
    });

    // NO stack traces
    assertEquals(data.stack, undefined, "Error must NOT include stack trace");
    assertEquals(data.stackTrace, undefined, "Error must NOT include stackTrace");
    
    // NO internal IDs
    assertEquals(data.userId, undefined, "Error must NOT include userId");
    assertEquals(data.recordId, undefined, "Error must NOT include recordId");
});