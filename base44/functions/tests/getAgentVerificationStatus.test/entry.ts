/**
 * Release-Blocking Tests for getAgentVerificationStatus
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0
 * Function: functions/getAgentVerificationStatus.js
 * 
 * These four tests must pass before Function #2 can be released to production.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("BASE44_API_URL") || "http://localhost:8000";
const FUNCTION_URL = `${BASE_URL}/functions/getAgentVerificationStatus`;

/**
 * Test 1: AUTHOR role denied (403)
 * 
 * Assertion: Authors/users cannot check industry verification status
 */
Deno.test("getAgentVerificationStatus - AUTHOR role denied with 403", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}`
        }
    });

    assertEquals(response.status, 403, "Authors must be denied with 403 Forbidden");
    
    const data = await response.json();
    assertEquals(data.code, "ROLE_FORBIDDEN", "Error code must be ROLE_FORBIDDEN");
    assertExists(data.requestId, "Request ID must be present in error response");
});

/**
 * Test 2: Read-only guarantee (no mutations)
 * 
 * Assertion: Function must not create, update, or delete any records
 */
Deno.test("getAgentVerificationStatus - Read-only guarantee with no mutations", async () => {
    // Get initial state
    const initialResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_PENDING")}`
        }
    });

    assertEquals(initialResponse.status, 200, "Initial request must succeed");
    const initialData = await initialResponse.json();

    // Call again - state must be identical (no side effects)
    const secondResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_PENDING")}`
        }
    });

    assertEquals(secondResponse.status, 200, "Second request must succeed");
    const secondData = await secondResponse.json();

    // Verify state is identical (no mutations occurred)
    assertEquals(
        JSON.stringify(initialData.status),
        JSON.stringify(secondData.status),
        "State must be identical - no mutations allowed"
    );

    // Verify verification_status has not changed (critical invariant)
    assertEquals(
        initialData.status.verification_status,
        secondData.status.verification_status,
        "Verification status must not change on read"
    );
});

/**
 * Test 3: Allowlist DTO - banned fields must be absent
 * 
 * Assertion: Response must contain ONLY allowlist fields, NO banned fields
 */
Deno.test("getAgentVerificationStatus - Allowlist DTO with no banned fields", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_VERIFIED")}`
        }
    });

    assertEquals(response.status, 200, "Request must succeed");
    
    const data = await response.json();
    const status = data.status;

    // Allowlist fields MUST be present
    assertExists(status.id, "id must be present");
    assertExists(status.full_name, "full_name must be present");
    assertExists(status.company, "company must be present");
    assertExists(status.role_type, "role_type must be present");
    assertExists(status.verification_status, "verification_status must be present");
    assertExists(status.bio, "bio must be present");
    assertExists(status.last_updated, "last_updated must be present");

    // Banned fields MUST be absent
    assertEquals(status.user_email, undefined, "user_email must NOT be present");
    assertEquals(status.verification_date, undefined, "verification_date must NOT be present");
    assertEquals(status.verified_by, undefined, "verified_by must NOT be present");
    assertEquals(status.linkedin_url, undefined, "linkedin_url must NOT be present");
    assertEquals(status.imdb_url, undefined, "imdb_url must NOT be present");
    assertEquals(status.rate_limit_flags, undefined, "rate_limit_flags must NOT be present");
    assertEquals(status.suspended, undefined, "suspended must NOT be present");
});

/**
 * Test 4: Error shape exactly {code, message, requestId}
 * 
 * Assertion: All errors must return canonical error shape with NO extra fields
 */
Deno.test("getAgentVerificationStatus - Error shape exactly code+message+requestId", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}`
        }
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