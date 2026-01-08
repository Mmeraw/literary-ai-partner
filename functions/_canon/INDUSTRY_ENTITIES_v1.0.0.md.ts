# Industry Entities Specification v1.0.0

## Entity: IndustryUser

### Purpose
Tracks industry professionals (agents, producers, executives, managers) who request verification to access Storygate submissions.

### Schema Authority
Canonical schema: `entities/IndustryUser.json`

### Key Fields
- `user_email` - Email of the authenticated user (links to User entity)
- `full_name` - Full legal or professional name
- `company` - Company/agency name
- `role_type` - One of: `agent`, `producer`, `executive`, `manager`
- `verification_status` - State machine value (see AGENT_ONBOARDING_VERIFICATION_SPEC)
- `bio` - Professional bio (optional)
- `linkedin_url` - LinkedIn profile for verification (optional)
- `imdb_url` - IMDb profile for verification (optional)
- `verified_by` - Admin email who approved verification
- `verification_date` - Timestamp of verification approval

### Access Patterns
- Authors can only read filtered DTO (see AUTHOR_DTO_ALLOWLIST_RULE)
- Admins have full read/write access
- Industry users can read own record (filtered DTO)

### Related Entities
- `User` - Core authentication entity (read-only for industry users)
- `ProjectListing` - Projects visible to verified industry users
- `AccessLog` - Audit trail of industry user actions