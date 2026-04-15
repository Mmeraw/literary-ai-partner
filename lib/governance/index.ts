/**
 * Phase 2: Runtime Governance — barrel export
 */
export { transitionJobState, failJob, quarantineJob, type TransitionRequest, type TransitionResult } from './transitionWriter';
export { LeaseService, type LeaseResult } from './leaseService';
export { SEVERITY_POLICIES, getSeverityPolicy, classifyError, type SeverityPolicy } from './severityPolicy';
