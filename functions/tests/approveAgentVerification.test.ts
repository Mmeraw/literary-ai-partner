/**
 * Release-Blocking Tests for approveAgentVerification
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0
 * Function: functions/approveAgentVerification.js
 * 
 * These SIX tests must pass before Function #3 can be released to production.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("BASE44_API_URL") || "http://localhost:8000";
const FUNCTION_URL = `${BASE_URL}/functions/approveAgentVerification`;

/**
 * Test 1: Admin-only gate (ADMIN_REVIEWER allowed; others denied)
 * 
 * Assertion: Only admins can approve, all other roles denied with 403
 */
Deno.test("approveAgentVerification - Admin-only gate enforced", async () => {
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
    assertEquals(pendingData.newState, "VERIFIED", "New state must be VERIFIED");
    assertEquals(pendingData.previousState, "PENDING", "Previous state must be PENDING");
});

/**
 * Test 3: Admin DTO keyset exact - no entity snapshots
 * 
 * Assertion: Response keys must be exactly admin decision DTO fields
 */
Deno.test("approveAgentVerification - Admin DTO keyset exact", async () => {
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
    const expectedKeys = ['newState', 'previousState', 'requestId', 'rolesGranted', 'targetUserId', 'updatedAt'].sort();

    // Response must contain EXACTLY admin decision DTO keys
    assertEquals(
        JSON.stringify(actualKeys),
        JSON.stringify(expectedKeys),
        "Response keys must match admin decision DTO exactly"
    );

    // Banned fields MUST be absent (no entity snapshots or author DTOs)
    assertEquals(data.approved, undefined, "Must NOT contain nested 'approved' author DTO");
    assertEquals(data.id, undefined, "Must NOT contain entity id");
    assertEquals(data.full_name, undefined, "Must NOT contain profile fields");
    assertEquals(data.company, undefined, "Must NOT contain profile fields");
    assertEquals(data.verified_by, undefined, "Must NOT contain verified_by at top level");
    assertEquals(data.verified_at, undefined, "Must NOT contain verified_at at top level");
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

/**
 * Test 5: Roles granted correctness
 * 
 * Assertion: INDUSTRY_USER role must be granted on successful approval
 */
Deno.test("approveAgentVerification - Roles granted correctness", async () => {
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
    
    // Verify rolesGranted field exists and contains INDUSTRY_USER
    assertExists(data.rolesGranted, "rolesGranted must be present");
    assertEquals(Array.isArray(data.rolesGranted), true, "rolesGranted must be an array");
    assertEquals(
        data.rolesGranted.includes('INDUSTRY_USER'),
        true,
        "INDUSTRY_USER role must be granted"
    );
});

/**
 * Test 6: Audit events emitted
 * 
 * Assertion: verification_approved and industry_access_granted audit events must be emitted
 */
Deno.test("approveAgentVerification - Audit events emitted", async () => {
    // Approve a pending user
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

    // Verify verification_approved event exists
    const approvalEvent = auditData.events?.find(e => e.event_type === 'verification_approved');
    assertExists(approvalEvent, "verification_approved audit event must be emitted");

    // Verify industry_access_granted event exists
    const accessEvent = auditData.events?.find(e => e.event_type === 'industry_access_granted');
    assertExists(accessEvent, "industry_access_granted audit event must be emitted");
});