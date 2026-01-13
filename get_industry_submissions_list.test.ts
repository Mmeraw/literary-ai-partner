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
 * Test 1: Role gate enforced - INDUSTRY_USER + ADMIN allowed, AUTHOR denied
 * 
 * Assertion: AUTHOR denied 403; unauthenticated 401; INDUSTRY_USER allowed 200; admin allowed 200
 */
Deno.test("getIndustrySubmissionsList - Role gate enforced", async () => {
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

    // Test unauthenticated denied
    const unauthResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({})
    });

    assertEquals(unauthResponse.status, 401, "Unauthenticated requests must be denied with 401");

    // Test ADMIN allowed
    const adminResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(adminResponse.status, 200, "Admins must be allowed to review submissions");

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
 * Assertion: Submissions count and fields unchanged before/after call
 */
Deno.test("getIndustrySubmissionsList - Read-only guarantee (no mutations)", async () => {
    // Get all submissions before call
    const beforeResponse = await fetch(`${BASE_URL}/entities/StorygateSubmission`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        }
    });
    const beforeData = await beforeResponse.json();
    const countBefore = beforeData.length;
    const firstSubmissionBefore = beforeData[0];

    // Call the function
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(response.status, 200, "Request must succeed");

    // Get all submissions after call
    const afterResponse = await fetch(`${BASE_URL}/entities/StorygateSubmission`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        }
    });
    const afterData = await afterResponse.json();
    const countAfter = afterData.length;
    const firstSubmissionAfter = afterData[0];

    // Count must be unchanged
    assertEquals(countAfter, countBefore, "Submission count must not change (read-only guarantee)");
    
    // Fields must be unchanged
    if (firstSubmissionBefore) {
        assertEquals(
            JSON.stringify(firstSubmissionAfter),
            JSON.stringify(firstSubmissionBefore),
            "Submission data must not be modified"
        );
    }
});

/**
 * Test 3: Pagination support
 * 
 * Assertion: Limit/offset respected; MAX_PAGE_SIZE enforced; no duplicates across pages
 */
Deno.test("getIndustrySubmissionsList - Pagination support", async () => {
    // Test with limit=5, offset=0
    const page1Response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
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

    // Test MAX_PAGE_SIZE enforcement (request 1000, expect capped at 100)
    const maxPageResponse = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            limit: 1000,
            offset: 0
        })
    });

    const maxPageData = await maxPageResponse.json();
    assertEquals(
        maxPageData.pagination.limit <= 100,
        true,
        "limit must be capped at MAX_PAGE_SIZE (100)"
    );

    // Test with limit=5, offset=5 (next page)
    const page2Response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
        },
        body: JSON.stringify({
            limit: 5,
            offset: 5
        })
    });

    assertEquals(page2Response.status, 200, "Request must succeed");
    const page2Data = await page2Response.json();
    assertEquals(page2Data.pagination.offset, 5, "offset must match request");

    // Verify no duplicate submissions across pages
    if (page1Data.submissions.length > 0 && page2Data.submissions.length > 0) {
        const page1Ids = page1Data.submissions.map(s => s.id);
        const page2Ids = page2Data.submissions.map(s => s.id);
        const overlap = page1Ids.filter(id => page2Ids.includes(id));
        assertEquals(overlap.length, 0, "Pages must not contain duplicate submissions");
    }
});

/**
 * Test 4: Allowlist DTO keyset exact
 * 
 * Assertion: Response item keys exactly match allowlist; banned fields absent
 */
Deno.test("getIndustrySubmissionsList - Allowlist DTO keyset exact", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_ADMIN")}`
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
            "Submission DTO must contain exactly allowlist fields: ['evaluationScore','format','genre','id','primaryPath','projectStage','status','submittedAt','title']"
        );

        // Banned fields MUST be absent
        assertEquals(submission.email, undefined, "email must NOT be present");
        assertEquals(submission.first_name, undefined, "first_name must NOT be present");
        assertEquals(submission.last_name, undefined, "last_name must NOT be present");
        assertEquals(submission.phone, undefined, "phone must NOT be present");
        assertEquals(submission.description, undefined, "description must NOT be present");
        assertEquals(submission.why_storygate, undefined, "why_storygate must NOT be present");
        assertEquals(submission.queryLetterText, undefined, "queryLetterText must NOT be present");
        assertEquals(submission.synopsisText, undefined, "synopsisText must NOT be present");
        assertEquals(submission.internal_notes, undefined, "internal_notes must NOT be present");
    }
});

/**
 * Test 5: Error shape keys exact
 * 
 * Assertion: Error object keys exactly ['code','message','requestId']
 */
Deno.test("getIndustrySubmissionsList - Error shape keys exact", async () => {
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("BASE44_QA_TOKEN_AUTHOR")}`
        },
        body: JSON.stringify({})
    });

    assertEquals(response.status, 403, "Request must fail with 403 for AUTHOR");
    const data = await response.json();
    const actualKeys = Object.keys(data).sort();
    const expectedKeys = ['code', 'message', 'requestId'].sort();

    // Error response must contain EXACTLY these keys
    assertEquals(
        JSON.stringify(actualKeys),
        JSON.stringify(expectedKeys),
        "Error response keys must be exactly ['code','message','requestId']"
    );

    // Required fields
    assertExists(data.code, "Error must have 'code' field");
    assertExists(data.message, "Error must have 'message' field");
    assertExists(data.requestId, "Error must have 'requestId' field");

    // Banned fields
    assertEquals(data.stack, undefined, "stack trace must NOT be present");
    assertEquals(data.error, undefined, "raw error must NOT be present");
    assertEquals(data.details, undefined, "details must NOT be present");
});