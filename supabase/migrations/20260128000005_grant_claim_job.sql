-- Grant permissions for claim_job_atomic function
GRANT EXECUTE ON FUNCTION claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) TO service_role;
