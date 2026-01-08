/**
 * Release-Blocking Tests for getIndustrySubmissionsList
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0
 * Function: functions/getIndustrySubmissionsList.js
 * 
 * These FIVE tests must pass before Function #6 can be released to production.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("BASE44_API_URL") || "http://localhost:8000";
const FUNCTION_URL = `${BASE_URL}/functions/getIndustrySubmissionsList`;

/**
 * Test 1: Industry-only gate enforced
 * 
 * Assertion: Only INDUSTRY_USER role can access, AUTHOR/ADMIN denied with 403
 */
Deno.test("getIndustrySubmissionsList - Industry-only gate enforced", async () => {
    // Test AUTHOR denied
    const authorResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(authorResponse.status, 403, "Authors must be denied with 403");
    const authorData = await authorResponse.json();
    assertEquals(authorData.code, "INDUSTRY_ACCESS_REQUIRED", "Error code must be INDUSTRY_ACCESS_REQUIRED");

    // Test ADMIN denied
    const adminResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(adminResponse.status, 403, "Admins must be denied with 403 (industry-only route)");

    // Test INDUSTRY_USER allowed
    const industryResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_INDUSTRY_USER")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(industryResponse.status, 200, "Industry users must be allowed");
});

/**
 * Test 2: Read-only guarantee - no mutations
 * 
 * Assertion: Function must not modify any entities (submissions unchanged before/after call)
 */
Deno.test("getIndustrySubmissionsList - Read-only guarantee (no mutations)", async () => {
    // Get submission count before call
    const beforeResponse = await fetch(`${BASE_URL}/functions/getSubmissionCount`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({})
    });
    const beforeData = await beforeResponse.json();
    const countBefore = beforeData.count;

    // Call the function
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_INDUSTRY_USER")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(response.status, 200, "Request must succeed");

    // Get submission count after call
    const afterResponse = await fetch(`${BASE_URL}/functions/getSubmissionCount`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({})
    });
    const afterData = await afterResponse.json();
    const countAfter = afterData.count;

    // Count must be unchanged
    assertEquals(
        countAfter,
        countBefore,
        "Submission count must not change (read-only guarantee)"
    );
});

/**
 * Test 3: Pagination support
 * 
 * Assertion: Function must respect limit/offset parameters and return pagination metadata
 */
Deno.test("getIndustrySubmissionsList - Pagination support", async () => {
    // Test with limit=5, offset=0
    const page1Response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_INDUSTRY_USER")}`
        },
        body: JSON.stringify({
            limit: 5,
            offset: 0
        })
    });

    assertEquals(page1Response.status, 200, "Request must succeed");
    const page1Data = await page1Response.json();

    // Verify pagination metadata
    assertExists(page1Data.pagination, "pagination metadata must be present");
    assertEquals(page1Data.pagination.limit, 5, "limit must match request");
    assertEquals(page1Data.pagination.offset, 0, "offset must match request");
    assertExists(page1Data.pagination.total, "total count must be present");
    assertExists(page1Data.pagination.hasMore, "hasMore flag must be present");

    // Verify submissions array
    assertExists(page1Data.submissions, "submissions array must be present");
    assertEquals(Array.isArray(page1Data.submissions), true, "submissions must be an array");
    assertEquals(
        page1Data.submissions.length <= 5,
        true,
        "submissions count must not exceed limit"
    );

    // Test with limit=5, offset=5 (next page)
    const page2Response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_INDUSTRY_USER")}`
        },
        body: JSON.stringify({
            limit: 5,
            offset: 5
        })
    });

    assertEquals(page2Response.status, 200, "Request must succeed");
    const page2Data = await page2Response.json();
    assertEquals(page2Data.pagination.offset, 5, "offset must match request");

    // Verify different results (no duplicate submissions across pages)
    if (page1Data.submissions.length > 0 && page2Data.submissions.length > 0) {
        const page1Ids = page1Data.submissions.map(s => s.id);
        const page2Ids = page2Data.submissions.map(s => s.id);
        const overlap = page1Ids.filter(id => page2Ids.includes(id));
        assertEquals(overlap.length, 0, "Pages must not contain duplicate submissions");
    }
});

/**
 * Test 4: Allowlist DTO - only safe fields
 * 
 * Assertion: Response must contain ONLY allowlist fields, no sensitive data
 */
Deno.test("getIndustrySubmissionsList - Allowlist DTO (safe fields only)", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_INDUSTRY_USER")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(response.status, 200, "Request must succeed");
    const data = await response.json();

    // If submissions exist, check DTO structure
    if (data.submissions.length > 0) {
        const submission = data.submissions[0];
        const actualKeys = Object.keys(submission).sort();
        const allowedKeys = ['evaluationScore', 'format', 'genre', 'id', 'primaryPath', 'projectStage', 'status', 'submittedAt', 'title'].sort();

        // Response must contain ONLY allowlist fields
        assertEquals(
            JSON.stringify(actualKeys),
            JSON.stringify(allowedKeys),
            "Submission DTO must contain only allowlist fields"
        );

        // Banned fields MUST be absent
        assertEquals(submission.email, undefined, "email must NOT be present");
        assertEquals(submission.first_name, undefined, "first_name must NOT be present");
        assertEquals(submission.last_name, undefined, "last_name must NOT be present");
        assertEquals(submission.phone, undefined, "phone must NOT be present");
        assertEquals(submission.description, undefined, "description must NOT be present");
        assertEquals(submission.why_storygate, undefined, "why_storygate must NOT be present");
        assertEquals(submission.queryLetterText, undefined, "queryLetterText must NOT be present");
        assertEquals(submission.internal_notes, undefined, "internal_notes must NOT be present");
    }
});

/**
 * Test 5: Error shape exactly {code, message, requestId}
 * 
 * Assertion: All errors must return canonical error shape with NO extra fields
 */
Deno.test("getIndustrySubmissionsList - Error shape keys exactly ['code','message','requestId']", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}`
        },
        body: JSON.stringify({})
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