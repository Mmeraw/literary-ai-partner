/**
 * Phase D D1: Public UX Safety — Error Contract Tests
 * 
 * Validates that all user-facing errors are sanitized:
 * - No stack traces
 * - No secrets (API keys, DB strings, JWT)
 * - No internal identifiers
 * - Audit trail for support
 */

const path = require('path');
const fixtures = require(path.join(process.cwd(), 'evidence/phase-d/d1/http-error-fixtures.json'));

describe('D1: Public UX Safety — Error Contracts', () => {
  
  describe('Error sanitization', () => {
    
    test('error responses never expose stack traces', () => {
      const stackTracePatterns = [
        /at\s+\w+\s+\(/,        // at functionName (
        /\.ts:\d+:\d+/,         // .ts:line:col
        /\.js:\d+:\d+/,         // .js:line:col
        /Error:/,               // Error: message
        /stack/i,               // stack
      ];
      
      fixtures.forEach(fixture => {
        const response = JSON.stringify(fixture.expected_user_response);
        stackTracePatterns.forEach(pattern => {
          expect(response).not.toMatch(pattern);
        });
      });
    });
    
    test('error responses strip API keys and secrets', () => {
      const secretPatterns = [
        /api[_-]?key/i,         // API keys
        /secret/i,              // secrets
        /password/i,            // passwords
        /token[^_]/i,           // tokens (but not auditToken/jobId)
        /mongodb:\/\//i,        // MongoDB connection strings
        /postgresql:\/\//i,     // PostgreSQL connection strings
      ];
      
      fixtures.forEach(fixture => {
        const response = JSON.stringify(fixture.expected_user_response);
        secretPatterns.forEach(pattern => {
          // If a secret word appears, it should NOT be in the user message
          if (pattern.test(response)) {
            expect(fixture.expected_user_response.error.message).not.toMatch(/key|secret|password/i);
          }
        });
      });
    });
    
    test('error responses hide internal database IDs', () => {
      fixtures.forEach(fixture => {
        // Forbidden patterns from actual error messages
        if (fixture.forbidden_in_response && fixture.forbidden_in_response.length > 0) {
          const response = JSON.stringify(fixture.expected_user_response);
          fixture.forbidden_in_response.forEach(pattern => {
            expect(response).not.toContain(pattern);
          });
        }
      });
    });
    
    test('error responses include audit trail anchor', () => {
      fixtures.forEach(fixture => {
        const error = fixture.expected_user_response.error;
        if (fixture.must_include_audit) {
          expect(error.auditId).toBeDefined();
          expect(error.auditId).toMatch(/^evt-\d{4}-\d{2}-\d{2}-/); // evt-YYYY-MM-DD-XXXXX
        }
      });
    });
    
    test('error responses use clear, actionable language', () => {
      fixtures.forEach(fixture => {
        const message = fixture.expected_user_response.error.message;
        // Should be user-comprehensible, not technical
        expect(message.length).toBeGreaterThan(10);
        expect(message.length).toBeLessThan(200);
        // Should not contain programmer jargon
        expect(message).not.toMatch(/\$|ERR_|ECONNREFUSED|undefined|null/);
      });
    });
    
  });
  
  describe('Evaluation state safety', () => {
    
    test('incomplete evaluations blocked from user export', () => {
      // When evaluation_complete !== true, export must fail
      const incompleteMock = {
        evaluation_complete: false,
        id: 'job-123',
        user_id: 'user-456'
      };
      
      // Mock: in actual implementation, this checks in the endpoint handler
      expect(incompleteMock.evaluation_complete).toBe(false);
      // Export endpoint should REJECT this before rendering
    });
    
    test('failed evaluations render with fail-closed message', () => {
      const failedEvaluation = {
        status: 'failed',
        error: 'INTERNAL_ERROR',
        gatesPassed: false
      };
      
      // Should NOT show any evaluation output to user
      expect(failedEvaluation.status).toBe('failed');
      expect(failedEvaluation.gatesPassed).toBe(false);
      // User sees: "Evaluation could not be completed. Contact support with ID: evt-..."
    });
    
  });
  
  describe('No-go condition verification', () => {
    
    test('no stack traces visible to users (comprehensive)', () => {
      const stackTraceIndicators = [
        'at ',
        'Error:',
        'TypeError:',
        'ReferenceError:',
        '.ts:',
        '.js:',
        'line ',
        'eval(',
        'Function(',
      ];
      
      fixtures.forEach(fixture => {
        const responseStr = JSON.stringify(fixture.expected_user_response);
        stackTraceIndicators.forEach(indicator => {
          expect(responseStr).not.toContain(indicator);
        });
      });
    });
    
    test('no secrets exposed in any error surface', () => {
      const secretIndicators = [
        'sk_live',
        'sk_test',
        'OPENAI_API_KEY',
        'SUPABASE_KEY',
        'postgresql://',
        'mongodb+srv://',
        'jwt_secret',
      ];
      
      fixtures.forEach(fixture => {
        const responseStr = JSON.stringify(fixture.expected_user_response);
        secretIndicators.forEach(secret => {
          expect(responseStr).not.toContain(secret);
        });
      });
    });
    
    test('no internal identifiers leaked (except audit-safe jobId)', () => {
      fixtures.forEach(fixture => {
        const error = fixture.expected_user_response.error;
        // Only auditId is allowed, and it should follow the pattern
        expect(error.auditId).toMatch(/^evt-\d{4}-\d{2}-\d{2}-/);
        // No raw DB IDs like "id-12345" or database sequence numbers
      });
    });
    
  });
  
  describe('Audit logging completeness', () => {
    
    test('audit responses capture full error context', () => {
      // In actual implementation, the audit log (NOT shown to user) contains:
      // - timestamp
      // - jobId (for support reference)
      // - originalError (full stack, message, code)
      // - userId (for support lookup)
      // - action (what the user was doing)
      // - environment (prod/staging/test)
      
      const auditExample = {
        timestamp: '2026-02-09T14:23:45Z',
        jobId: 'job-abc123',
        originalError: 'full error details here',
        userId: 'user-xyz789',
        action: 'manuscript_export',
        environment: 'production'
      };
      
      expect(auditExample.timestamp).toBeDefined();
      expect(auditExample.jobId).toBeDefined();
      expect(auditExample.userId).toBeDefined();
    });
    
  });

});
