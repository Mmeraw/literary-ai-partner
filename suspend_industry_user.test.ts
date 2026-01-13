/**
 * Release-Blocking Tests for suspendIndustryUser
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0
 * Function: functions/suspendIndustryUser.js
 * 
 * These SEVEN tests must pass before Function #5 can be released to production.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("BASE44_API_URL") || "http://localhost:8000";
const FUNCTION_URL = `${BASE_URL}/functions/suspendIndustryUser`;

/**
 * Test 1: Admin-only gate enforced
 * 
 * Assertion: Only admins can suspend, all other roles denied with 403
 */
Deno.test("suspendIndustryUser - Admin-only gate enforced", async () => {
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
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_INDUSTRY_USER")}`
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
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_VERIFIED")
        })
    });

    assertEquals(adminResponse.status, 200, "Admin must be allowed");
});

/**
 * Test 2: State machine - only VERIFIED→SUSPENDED allowed
 * 
 * Assertion: Cannot suspend from PENDING, UNVERIFIED, REJECTED, or already SUSPENDED states
 */
Deno.test("suspendIndustryUser - State machine enforces VERIFIED→SUSPENDED only", async () => {
    // Test 1: Try to suspend PENDING user (should fail)
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

    assertEquals(pendingResponse.status, 400, "Cannot suspend PENDING user");
    const pendingData = await pendingResponse.json();
    assertEquals(pendingData.code, "STATE_VIOLATION", "Must return STATE_VIOLATION error");

    // Test 2: Try to suspend UNVERIFIED user (should fail)
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

    assertEquals(unverifiedResponse.status, 400, "Cannot suspend UNVERIFIED user");
    const unverifiedData = await unverifiedResponse.json();
    assertEquals(unverifiedData.code, "STATE_VIOLATION", "Must return STATE_VIOLATION error");

    // Test 3: Suspend VERIFIED user (should succeed)
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

    assertEquals(verifiedResponse.status, 200, "VERIFIED→SUSPENDED transition must succeed");
    const verifiedData = await verifiedResponse.json();
    assertEquals(verifiedData.newState, "SUSPENDED", "New state must be SUSPENDED");
    assertEquals(verifiedData.previousState, "VERIFIED", "Previous state must be VERIFIED");
});

/**
 * Test 3: Access revoked - /agent/* returns 403 post-suspension
 * 
 * Assertion: After suspension, suspended user cannot access /agent/* routes
 */
Deno.test("suspendIndustryUser - Access revoked (/agent/* 403)", async () => {
    // Suspend the user
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_VERIFIED")
        })
    });

    assertEquals(response.status, 200, "Suspension must succeed");
    const data = await response.json();

    // Verify rolesRevoked and accessRevoked fields
    assertExists(data.rolesRevoked, "rolesRevoked must be present");
    assertEquals(Array.isArray(data.rolesRevoked), true, "rolesRevoked must be an array");
    assertEquals(
        data.rolesRevoked.includes('INDUSTRY_USER'),
        true,
        "INDUSTRY_USER role must be revoked"
    );

    assertExists(data.accessRevoked, "accessRevoked must be present");
    assertEquals(Array.isArray(data.accessRevoked), true, "accessRevoked must be an array");
    assertEquals(
        data.accessRevoked.includes('/agent/*'),
        true,
        "/agent/* access must be revoked"
    );

    // Wait for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Try to access /agent/* route with suspended user token
    const agentAccessResponse = await fetch(`${BASE_URL}/functions/getAgentDashboard`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_SUSPENDED_USER")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(
        agentAccessResponse.status,
        403,
        "Suspended user must be denied access to /agent/* routes with 403"
    );
});

/**
 * Test 4: Session invalidation enforced
 * 
 * Assertion: Existing sessions/tokens must be invalidated via revoked_at timestamp
 */
Deno.test("suspendIndustryUser - Session/token invalidation enforced", async () => {
    // Suspend the user
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_VERIFIED")
        })
    });

    assertEquals(response.status, 200, "Suspension must succeed");

    // Wait for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify that pre-existing token is now invalid
    const tokenCheckResponse = await fetch(`${BASE_URL}/functions/validateToken`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_PRE_SUSPENSION")}`
        },
        body: JSON.stringify({})
    });

    // Token validation should fail or return unauthorized
    const tokenData = await tokenCheckResponse.json();
    assertEquals(
        tokenData.valid,
        false,
        "Pre-existing tokens must be invalidated after suspension"
    );
});

/**
 * Test 5: Admin DTO keyset exact
 * 
 * Assertion: Response keys must be exactly admin suspension decision DTO fields
 */
Deno.test("suspendIndustryUser - Admin DTO keyset exact", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_VERIFIED")
        })
    });

    assertEquals(response.status, 200, "Request must succeed");
    
    const data = await response.json();
    const actualKeys = Object.keys(data).sort();
    const expectedKeys = ['accessRevoked', 'newState', 'previousState', 'requestId', 'rolesRevoked', 'targetUserId', 'updatedAt'].sort();

    // Response must contain EXACTLY admin suspension decision DTO keys
    assertEquals(
        JSON.stringify(actualKeys),
        JSON.stringify(expectedKeys),
        "Response keys must match admin suspension decision DTO exactly"
    );

    // Banned fields MUST be absent
    assertEquals(data.suspended, undefined, "Must NOT contain nested suspension object");
    assertEquals(data.industryUser, undefined, "Must NOT contain entity snapshot");
});

/**
 * Test 6: Audit events emitted
 * 
 * Assertion: verification_suspended and industry_access_revoked audit events must be emitted
 */
Deno.test("suspendIndustryUser - Audit events emitted", async () => {
    // Suspend the user
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            industry_user_id: Deno.env.get("BASE44_QA_USER_ID_VERIFIED")
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

    // Verify verification_suspended event exists
    const suspensionEvent = auditData.events?.find(e => e.event_type === 'verification_suspended');
    assertExists(suspensionEvent, "verification_suspended audit event must be emitted");

    // Verify industry_access_revoked event exists
    const accessRevokedEvent = auditData.events?.find(e => e.event_type === 'industry_access_revoked');
    assertExists(accessRevokedEvent, "industry_access_revoked audit event must be emitted");
});

/**
 * Test 7: Error shape exactly {code, message, requestId}
 * 
 * Assertion: All errors must return canonical error shape with NO extra fields
 */
Deno.test("suspendIndustryUser - Error shape keys exactly ['code','message','requestId']", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}`
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