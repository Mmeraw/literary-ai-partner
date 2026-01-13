/**
 * Release-Blocking Tests for rejectAgentVerification
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0
 * Function: functions/rejectAgentVerification.js
 * 
 * These SIX tests must pass before Function #4 can be released to production.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("BASE44_API_URL") || "http://localhost:8000";
const FUNCTION_URL = `${BASE_URL}/functions/rejectAgentVerification`;

/**
 * Test 1: Admin-only gate (ADMIN_REVIEWER allowed; others denied)
 * 
 * Assertion: Only admins can reject, all other roles denied with 403
 */
Deno.test("rejectAgentVerification - Admin-only gate enforced", async () => {
    // Test AUTHOR denied
    const authorResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}`
        },
        body: JSON.stringify({
            industry_user_id: "test_user_id"
        })
    });

    assertEquals(authorResponse.status, 403, "Authors must be denied with 403");
    const authorData = await authorResponse.json();
    assertEquals(authorData.code, "ADMIN_REQUIRED", "Error code must be ADMIN_REQUIRED");

    // Test INDUSTRY_USER denied
    const industryResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AGENT_PENDING")}`
        },
        body: JSON.stringify({
            industry_user_id: "test_user_id"
        })
    });

    assertEquals(industryResponse.status, 403, "Industry users must be denied with 403");

    // Test ADMIN allowed
    const adminResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_PENDING")
        })
    });

    assertEquals(adminResponse.status, 200, "Admin must be allowed");
});

/**
 * Test 2: State machine - only PENDING→REJECTED allowed
 * 
 * Assertion: Cannot reject from UNVERIFIED, VERIFIED, or already REJECTED states
 */
Deno.test("rejectAgentVerification - State machine enforces PENDING→REJECTED only", async () => {
    // Test 1: Try to reject UNVERIFIED user (should fail)
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

    assertEquals(unverifiedResponse.status, 400, "Cannot reject UNVERIFIED user");
    const unverifiedData = await unverifiedResponse.json();
    assertEquals(unverifiedData.code, "STATE_VIOLATION", "Must return STATE_VIOLATION error");

    // Test 2: Try to reject VERIFIED user (should fail)
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

    assertEquals(verifiedResponse.status, 400, "Cannot reject VERIFIED user");
    const verifiedData = await verifiedResponse.json();
    assertEquals(verifiedData.code, "STATE_VIOLATION", "Must return STATE_VIOLATION error");

    // Test 3: Reject PENDING user (should succeed)
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

    assertEquals(pendingResponse.status, 200, "PENDING→REJECTED transition must succeed");
    const pendingData = await pendingResponse.json();
    assertEquals(pendingData.newState, "REJECTED", "New state must be REJECTED");
    assertEquals(pendingData.previousState, "PENDING", "Previous state must be PENDING");
});

/**
 * Test 3: No side effects - no roles, org, or access changes
 * 
 * Assertion: Rejection must not grant roles, modify org, or change access
 */
Deno.test("rejectAgentVerification - No side effects (no roles/org/access)", async () => {
    // Get target user before rejection
    const userBeforeResponse = await fetch(`${BASE_URL}/functions/getUser`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            user_email: Deno.env.get("BASE44_QA_USER_EMAIL_PENDING")
        })
    });

    const userBefore = await userBeforeResponse.json();
    const roleBefore = userBefore.user?.role;

    // Reject the user
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

    // Response must NOT contain rolesGranted field
    assertEquals(data.rolesGranted, undefined, "rolesGranted must NOT be present");
    assertEquals(data.agencyOrgId, undefined, "agencyOrgId must NOT be present");
    assertEquals(data.accessGranted, undefined, "accessGranted must NOT be present");

    // Get target user after rejection
    const userAfterResponse = await fetch(`${BASE_URL}/functions/getUser`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            user_email: Deno.env.get("BASE44_QA_USER_EMAIL_PENDING")
        })
    });

    const userAfter = await userAfterResponse.json();
    const roleAfter = userAfter.user?.role;

    // Role must NOT have changed
    assertEquals(roleAfter, roleBefore, "User role must not change on rejection");
});

/**
 * Test 4: Admin DTO keyset exact - no entity snapshots
 * 
 * Assertion: Response keys must be exactly admin decision DTO fields
 */
Deno.test("rejectAgentVerification - Admin DTO keyset exact", async () => {
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
    const actualKeys = Object.keys(data).sort();
    const expectedKeys = ['newState', 'previousState', 'requestId', 'targetUserId', 'updatedAt'].sort();

    // Response must contain EXACTLY admin decision DTO keys (no rolesGranted for rejection)
    assertEquals(
        JSON.stringify(actualKeys),
        JSON.stringify(expectedKeys),
        "Response keys must match admin decision DTO exactly"
    );

    // Banned fields MUST be absent
    assertEquals(data.rolesGranted, undefined, "Must NOT contain rolesGranted");
    assertEquals(data.agencyOrgId, undefined, "Must NOT contain agencyOrgId");
    assertEquals(data.rejected, undefined, "Must NOT contain nested rejection object");
});

/**
 * Test 5: Error shape exactly {code, message, requestId}
 * 
 * Assertion: All errors must return canonical error shape with NO extra fields
 */
Deno.test("rejectAgentVerification - Error shape keys exactly ['code','message','requestId']", async () => {
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

/**
 * Test 6: Audit event verification_rejected emitted
 * 
 * Assertion: verification_rejected audit event must be emitted
 */
Deno.test("rejectAgentVerification - Audit event verification_rejected emitted", async () => {
    // Reject a pending user
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
    const requestId = data.requestId;

    // Wait for audit events to be written (async)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Query audit events using the request_id from the response
    const auditResponse = await fetch(`${BASE_URL}/functions/queryAuditEvents`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            request_id: requestId
        })
    });

    assertEquals(auditResponse.status, 200, "Audit query must succeed");
    const auditData = await auditResponse.json();

    // Verify verification_rejected event exists
    const rejectionEvent = auditData.events?.find(e => e.event_type === 'verification_rejected');
    assertExists(rejectionEvent, "verification_rejected audit event must be emitted");
});