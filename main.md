# MASTER BUILD PROMPT
# WEBRECON AI — Browser Inspection + Scraping + AI Rebuilder Platform

You are a senior full-stack architect, browser automation engineer,
AI infrastructure engineer, MCP engineer, security engineer,
DevOps engineer, and UI/UX engineer.

Build a production-ready platform called:

WEBRECON AI

The platform provides:

1. Browser automation
2. Website crawling/scraping
3. DOM inspection
4. HTML/source inspection
5. Network inspection
6. Public/client-observable API analysis
7. Asset discovery
8. Automatic scrolling
9. Screenshot capture
10. Responsive analysis
11. AI-powered website analysis
12. AI implementation planning
13. MCP integration
14. Coding-agent integration
15. Website reimplementation/rebuild workflow
16. Visual comparison and iterative improvement
17. OpenAI-compatible AI provider system
18. Automatic FREE / BEST CODING / AUTO model selection

IMPORTANT:

The system is intended for websites that the user owns,
has permission to inspect/reimplement, or public resources
that may legally be analyzed.

DO NOT implement:

- authentication bypass
- CAPTCHA bypass
- paywall bypass
- DRM bypass
- credential theft
- cookie theft
- private API exploitation
- server-side source-code extraction
- secret/environment-variable extraction
- unauthorized access
- vulnerability exploitation

Only inspect information legitimately exposed to the browser
and information the user is authorized to access.


============================================================
1. CORE WORKFLOW
============================================================

The main workflow must be:

USER
 ↓
Enter website URL
 ↓
Create project
 ↓
Validate URL and domain
 ↓
Create isolated Chromium session
 ↓
Playwright browser
 ↓
Explore website
 ↓
Auto-scroll
 ↓
Discover internal pages
 ↓
Inspect DOM
 ↓
Inspect HTML
 ↓
Inspect publicly observable network activity
 ↓
Analyze public/client-accessible API calls
 ↓
Discover assets
 ↓
Capture screenshots
 ↓
Analyze responsive behavior
 ↓
Store results
 ↓
AI analysis
 ↓
Implementation plan
 ↓
MCP
 ↓
Coding Agent
 ↓
Generate independent implementation
 ↓
Run generated website
 ↓
Capture generated screenshots
 ↓
Compare with reference
 ↓
Generate correction report
 ↓
Coding Agent fixes implementation
 ↓
Repeat
 ↓
Final project


============================================================
2. TECHNOLOGY STACK
============================================================

Primary language:

TypeScript

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Monaco Editor where appropriate

Backend:

- Node.js
- TypeScript
- Fastify
- REST API
- WebSocket

Browser:

- Playwright
- Chromium
- Chrome DevTools Protocol where useful

Database:

- Firebase Authentication
- Cloud Firestore

Storage:

- Firebase Storage

Background processing:

- Redis
- BullMQ

AI:

- OpenAI-compatible API architecture
- OpenRouter support
- Custom OpenAI-compatible endpoints
- Provider-independent architecture

Agent:

- MCP server
- REST API
- WebSocket

Testing:

- Vitest
- Playwright
- API integration tests


============================================================
3. MONOREPO
============================================================

Create this structure:

webrecon-ai/

├── apps/
│   ├── web/
│   ├── api/
│   ├── browser-worker/
│   └── mcp-server/
│
├── packages/
│   ├── shared/
│   ├── types/
│   ├── firebase/
│   ├── browser/
│   ├── crawler/
│   ├── network-inspector/
│   ├── dom-inspector/
│   ├── asset-analyzer/
│   ├── screenshot-engine/
│   ├── responsive-analyzer/
│   ├── ai/
│   ├── ai-providers/
│   ├── ai-router/
│   ├── mcp-tools/
│   ├── security/
│   └── logger/
│
├── infrastructure/
│   ├── docker/
│   └── redis/
│
├── docs/
│
├── implementation_plan.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md


============================================================
4. FIREBASE
============================================================

Use Firebase for:

- Authentication
- Firestore
- Storage

Use Firebase Admin SDK only on backend.

Never expose Firebase Admin credentials
to the frontend.

Authentication:

- Email/password
- Google login if configured

Users must only access their own:

- projects
- browser sessions
- jobs
- screenshots
- assets
- reports
- API keys
- generated projects


============================================================
5. FIRESTORE DATABASE
============================================================

Collections:

users
projects
browserSessions
pages
networkRequests
assets
screenshots
jobs
aiAnalyses
implementationPlans
generatedProjects
aiProviders
aiUsage
apiKeys


Project example:

{
  "id": "project_123",
  "userId": "user_123",
  "url": "https://example.com",
  "status": "analyzing",
  "pagesScanned": 0,
  "createdAt": "...",
  "updatedAt": "..."
}


============================================================
6. FIREBASE STORAGE
============================================================

Store:

/users/{userId}/projects/{projectId}/screenshots/
/users/{userId}/projects/{projectId}/assets/
/users/{userId}/projects/{projectId}/reports/


Use Firestore for metadata.

Use Firebase Storage for binary files.


============================================================
7. DASHBOARD
============================================================

Create a modern developer-tool dashboard.

Main navigation:

Dashboard
Projects
Browser
Network
DOM
Screenshots
Assets
AI Analysis
Rebuild
Jobs
AI Providers
API Keys
MCP
Settings


Dashboard must display:

- projects
- active browser sessions
- running jobs
- completed jobs
- failed jobs
- AI usage
- estimated AI cost
- worker status


============================================================
8. CREATE PROJECT
============================================================

Page:

/projects/new

Input:

Website URL

Options:

Maximum pages
Maximum crawl depth
Auto-scroll
Screenshots
Network inspection
Asset discovery
Responsive inspection
AI analysis

Button:

START ANALYSIS


On submit:

1. Validate URL.
2. Validate domain.
3. Create Firestore project.
4. Create BullMQ job.
5. Return job ID immediately.

Do not perform long-running crawling
inside an HTTP request.


============================================================
9. BROWSER SESSION MANAGER
============================================================

Create:

BrowserSessionManager

Use isolated Playwright BrowserContext.

Features:

create
navigate
reload
back
forward
close
click
type
hover
scroll
screenshot
getPageInfo

REST:

POST /browser/session
POST /browser/session/:id/navigate
POST /browser/session/:id/click
POST /browser/session/:id/type
POST /browser/session/:id/scroll
POST /browser/session/:id/screenshot
POST /browser/session/:id/reload
POST /browser/session/:id/back
POST /browser/session/:id/forward
DELETE /browser/session/:id


============================================================
10. CRAWLER
============================================================

Create:

CrawlerEngine

Workflow:

Open URL
 ↓
Wait for page
 ↓
Capture DOM
 ↓
Capture screenshot
 ↓
Capture network
 ↓
Extract links
 ↓
Determine internal links
 ↓
Visit allowed pages
 ↓
Auto-scroll
 ↓
Capture dynamic content
 ↓
Repeat


Limits:

maxPages
maxDepth
maxSessionTime
maxScrollIterations
maxResponseSize
allowedDomains

Prevent infinite crawling.


============================================================
11. AUTO-SCROLL
============================================================

Create:

AutoScrollEngine

Process:

1. Detect document height.
2. Scroll viewport-sized increments.
3. Wait for loading.
4. Detect DOM changes.
5. Detect lazy-loaded content.
6. Continue.
7. Stop when content stops changing.
8. Stop at configured maximum.

Record:

scroll position
page height
new elements
new network activity
screenshots


============================================================
12. DOM INSPECTOR
============================================================

Collect:

- HTML
- DOM tree
- headings
- buttons
- links
- forms
- inputs
- images
- videos
- navigation
- cards
- tables
- dialogs
- modals

For relevant elements:

tag
id
classes
text
attributes
bounding box
selector
accessibility information

Normalize large DOM trees before AI processing.


============================================================
13. HTML / SOURCE INSPECTION
============================================================

Provide:

GET /page/html
GET /page/dom
GET /page/styles
GET /page/scripts
GET /page/links

Clearly distinguish:

1. HTML delivered/rendered to browser
2. Public assets
3. Client-side JavaScript
4. Browser-observable network activity

Do not attempt to retrieve:

server-side source
private repositories
private environment variables
credentials
secret keys
unauthorized endpoints


============================================================
14. NETWORK INSPECTOR
============================================================

Use Playwright request/response events.

Use CDP where useful.

Capture:

URL
method
status
resource type
request headers
response headers
query parameters
request body where legitimately observable
response body where legitimately observable
timing
initiator information where available


Classify:

document
stylesheet
script
image
font
fetch
xhr
websocket
media
other


Network UI:

Method
Status
Type
URL
Size
Duration


Click request:

Headers
Query
Request
Response
Timing


============================================================
15. SECRET REDACTION
============================================================

This is mandatory.

Automatically redact:

Authorization
Bearer tokens
Cookies
Set-Cookie
API keys
Passwords
Session IDs
JWTs
Secret-looking query parameters


Example:

Authorization:
Bearer abc123

becomes:

Authorization:
Bearer [REDACTED]


Do not send secrets to AI.

Do not log secrets.

Do not store raw secrets in Firestore.


============================================================
16. PUBLIC API ANALYSIS
============================================================

If browser legitimately observes an API request:

GET /api/products

or:

POST /api/search

create a sanitized API summary.

Store:

method
endpoint
contentType
status
sanitized request
sanitized response
schema inference


Do not attempt to discover or exploit
private/hidden APIs through unauthorized means.


============================================================
17. ASSET DISCOVERY
============================================================

Detect:

images
SVG
fonts
CSS
JavaScript
video
favicon
public files


Metadata:

URL
MIME type
size
dimensions
source page


Do not automatically reuse copyrighted assets
unless the user has rights.

Allow placeholders.


============================================================
18. SCREENSHOTS
============================================================

Capture:

full page
viewport

Desktop:

1440x900

Tablet:

768x1024

Mobile:

390x844


Store binary files in Firebase Storage.

Store metadata in Firestore.


============================================================
19. RESPONSIVE ANALYSIS
============================================================

Analyze:

desktop
tablet
mobile

Record:

navigation changes
hidden elements
stacking
card widths
typography
spacing
breakpoints


Generate:

responsive-analysis.json


============================================================
20. AI GATEWAY
============================================================

Create a completely provider-independent AI Gateway.

Architecture:

AI Gateway
 ↓
AI Provider Registry
 ↓
AI Model Registry
 ↓
AI Router
 ↓
Selected Provider
 ↓
Model


Interfaces:

AIProvider

AIModel

AIRequest

AIResponse

AIProviderRegistry

AIModelRegistry

AIRouter


Example:

interface AIProvider {
  id: string;
  name: string;
  baseURL: string;
  listModels(): Promise<AIModel[]>;
  chat(request: AIRequest): Promise<AIResponse>;
  stream(request: AIRequest): AsyncIterable<AIChunk>;
}


============================================================
21. OPENAI-COMPATIBLE API
============================================================

The AI Gateway MUST support OpenAI-compatible APIs.

Configuration:

{
  "provider": "custom",
  "baseURL": "https://provider.example/v1",
  "apiKey": "server-side-secret",
  "model": "model-name"
}


Do not assume all providers support:

tools
vision
structured output
streaming
reasoning


Check capabilities dynamically when possible.


============================================================
22. OPENROUTER
============================================================

Implement OpenRouter as a built-in provider.

Base URL:

https://openrouter.ai/api/v1


Support:

- manually selected models
- automatic model discovery
- free model routing
- openrouter/free


Fetch model catalog dynamically.

Do not hardcode the free-model list.


============================================================
23. AI MODES
============================================================

The UI must provide:

AUTO
FREE
BEST CODING
CUSTOM


-------------------------
AUTO
-------------------------

Automatically choose the best available model
for the current task.

Consider:

task type
context length
coding capability
reasoning capability
tool support
vision support
structured output
availability
cost


-------------------------
FREE
-------------------------

Only use models with zero effective cost.

If using OpenRouter:

support:

openrouter/free


Never silently use paid models
when the user selected FREE.


-------------------------
BEST CODING
-------------------------

Choose the highest-ranked available coding-capable
model according to configured model rankings.


Consider:

coding
reasoning
context length
tool calling
structured output
vision


-------------------------
CUSTOM
-------------------------

Allow user to select:

provider
base URL
API key
model


============================================================
24. AUTOMATIC MODEL DISCOVERY
============================================================

Fetch model information dynamically.

Track:

model ID
provider
context length
input modalities
output modalities
tool calling
structured output
vision
reasoning
streaming
pricing
availability


Do not hardcode model capabilities
when the provider exposes them dynamically.


============================================================
25. AI TASK TYPES
============================================================

Support:

WEBSITE_ANALYSIS
DOM_ANALYSIS
SCREENSHOT_ANALYSIS
NETWORK_ANALYSIS
IMPLEMENTATION_PLAN
CODE_GENERATION
CODE_REVIEW
VISUAL_COMPARISON
DEBUGGING


Different task types can use different models.


============================================================
26. AI FALLBACK
============================================================

Implement fallback.

Example:

Primary
 ↓ failure
Secondary
 ↓ failure
Fallback
 ↓ failure
Structured error


Respect selected mode.

If FREE:

Only fallback to FREE models.

If CUSTOM:

Do not silently switch providers.


============================================================
27. AI PROVIDER UI
============================================================

Create:

/ai-providers

Show:

Provider
Status
Base URL
Models
Capabilities
Last tested
Usage


Buttons:

Add Provider
Test Connection
Fetch Models
Edit
Disable
Delete


Built-in provider:

OpenRouter


Custom provider:

OpenAI-compatible


============================================================
28. API KEY MANAGEMENT
============================================================

Allow users to create API keys
for WebRecon API.

Example:

wr_live_xxxxxxxxx


Store only hashed keys.

Never store raw API keys.

Support:

create
revoke
rotate
lastUsed
createdAt


Authentication:

Authorization: Bearer <API_KEY>


Provider AI keys must remain server-side
and must never be exposed to the browser.


============================================================
29. AI USAGE
============================================================

Track:

userId
projectId
provider
model
taskType
inputTokens
outputTokens
estimatedCost
latency
status
timestamp


Dashboard:

Total requests
Tokens
Estimated cost
Free requests
Paid requests
Provider usage


============================================================
30. AI WEBSITE ANALYZER
============================================================

Input:

sanitized DOM
HTML
screenshots
CSS metadata
network summaries
asset metadata
responsive information


Output:

{
  "siteType": "",
  "pages": [],
  "components": [],
  "navigation": {},
  "layout": {},
  "colors": [],
  "fonts": [],
  "spacing": {},
  "responsiveBehavior": {},
  "forms": [],
  "dataSources": [],
  "apiSummary": [],
  "assetSummary": [],
  "implementationPlan": []
}


Never send secrets.


============================================================
31. MCP SERVER
============================================================

Create MCP server.

Tools:

browser_create_session
browser_navigate
browser_get_page_info
browser_get_dom
browser_get_html
browser_get_network
browser_get_api_summary
browser_get_assets
browser_screenshot
browser_scroll
browser_click
browser_type
browser_get_links
browser_analyze_page
browser_close_session

Project tools:

project_create
project_get_status
project_get_analysis
project_get_screenshots
project_get_assets
project_get_network_report
project_get_implementation_plan


Validate every tool request.


============================================================
32. CODING AGENT WORKFLOW
============================================================

Coding agents such as Claude Code
should be able to connect through MCP.

Expected workflow:

Claude Code
 ↓
MCP
 ↓
WebRecon AI
 ↓
Browser
 ↓
Website


Agent can:

open
inspect
scroll
discover pages
inspect DOM
inspect network
inspect screenshots
analyze responsive layout
get implementation plan
generate code
test code


The browser inspection API must return structured data,
not only raw HTML.


============================================================
33. REBUILD SYSTEM
============================================================

Create:

POST /projects/:id/rebuild

The rebuild system generates:

implementationPlan

Routes
Components
Pages
State management
API integration
Responsive behavior
Testing plan


Generated code must be an independent implementation.


Do not directly copy proprietary source code.


============================================================
34. VISUAL COMPARISON
============================================================

Workflow:

Reference screenshot
 ↓
Generated screenshot
 ↓
Comparison
 ↓
Difference report
 ↓
AI correction
 ↓
Agent modifies code
 ↓
Screenshot again


Generate:

visual-diff.json


Analyze:

layout
spacing
typography
component dimensions
missing components
responsive differences


============================================================
35. BACKGROUND JOB SYSTEM
============================================================

Use:

Redis + BullMQ


Queues:

crawl
network-analysis
asset-analysis
screenshot
ai-analysis
project-generation
visual-test


Job states:

pending
active
completed
failed
cancelled


Implement:

retries
exponential backoff
timeouts
cancellation
concurrency limits
progress tracking


Example:

POST /projects/:id/analyze

Response:

{
  "jobId": "job_123",
  "status": "queued"
}


WebSocket:

/ws/jobs/:jobId


Events:

job.started
job.progress
job.completed
job.failed


============================================================
36. API
============================================================

Projects:

POST /projects
GET /projects
GET /projects/:id
DELETE /projects/:id


Analysis:

POST /projects/:id/analyze
GET /projects/:id/analysis


Browser:

POST /browser/session
POST /browser/session/:id/navigate
POST /browser/session/:id/click
POST /browser/session/:id/type
POST /browser/session/:id/scroll
POST /browser/session/:id/screenshot
DELETE /browser/session/:id


Inspection:

GET /projects/:id/pages
GET /projects/:id/dom
GET /projects/:id/network
GET /projects/:id/assets
GET /projects/:id/screenshots


Jobs:

GET /jobs/:id
POST /jobs/:id/cancel


AI:

GET /ai/providers
POST /ai/providers
POST /ai/providers/:id/test
POST /ai/providers/:id/models
DELETE /ai/providers/:id


MCP:

GET /mcp/config


============================================================
37. SECURITY
============================================================

Implement strong SSRF protection.

Block:

localhost
127.0.0.1
0.0.0.0
::1
private IP ranges
link-local ranges
cloud metadata endpoints


Protect against:

SSRF
DNS rebinding
malicious redirects
oversized responses
browser resource exhaustion
infinite pages
infinite scrolling


Implement:

authentication
authorization
rate limiting
timeouts
memory limits
CPU limits
session expiration
request limits
response limits


Never allow the browser worker
to become a proxy into internal infrastructure.


============================================================
38. DOMAIN RESTRICTIONS
============================================================

Each project must maintain:

allowedDomains


Only navigate to:

- original domain
- explicitly allowed subdomains
- explicitly configured domains


Do not blindly follow external links.


============================================================
39. RATE LIMITING
============================================================

Per user:

max browser sessions
requests/minute
crawl jobs/day
maximum pages
maximum browser runtime
maximum storage
AI requests


Make limits configurable.


============================================================
40. LIVE BROWSER UI
============================================================

Create:

/browser

UI:

URL bar
live browser preview
browser controls
inspection controls


Controls:

Back
Forward
Reload
Scroll
Screenshot
Inspect


============================================================
41. NETWORK UI
============================================================

DevTools-style interface.

Columns:

Method
Status
Type
URL
Size
Duration


Request detail:

Headers
Query
Request
Response
Timing


Secrets:

[REDACTED]


============================================================
42. DOM UI
============================================================

Tree viewer.

Features:

expand/collapse
search
element details
attributes
text
selector
metadata


============================================================
43. SCREENSHOT UI
============================================================

Show:

Desktop
Tablet
Mobile


Features:

zoom
fullscreen
comparison mode


============================================================
44. PROJECT EXPORT
============================================================

Generate:

website-analysis.json
network-report.json
dom-report.json
asset-report.json
responsive-report.json
implementation-plan.json


Allow ZIP export.


============================================================
45. DOCKER
============================================================

Provide:

docker-compose.yml


Services:

web
api
browser-worker
mcp-server
redis


Firebase remains external.


============================================================
46. ENVIRONMENT
============================================================

Create:

.env.example


Include:

FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET

REDIS_URL

OPENROUTER_API_KEY

OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY

AI_PROVIDER

API_PORT
WEB_URL

MAX_CRAWL_PAGES
MAX_CRAWL_DEPTH
MAX_BROWSER_TIME


Never commit secrets.


============================================================
47. ERROR HANDLING
============================================================

Standard format:

{
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL is not allowed."
  }
}


Implement:

structured logging
request IDs
project IDs
job IDs
browser session IDs


Never log secrets.


============================================================
48. TESTING
============================================================

Test:

URL validation
SSRF protection
authentication
authorization
browser sessions
crawler
auto-scroll
network inspection
secret redaction
Firebase
BullMQ
MCP
AI providers
AI router
FREE mode
AUTO mode
BEST_CODING mode
CUSTOM mode
fallback
API endpoints


End-to-end:

Login
 ↓
Create project
 ↓
Enter authorized test website
 ↓
Create browser
 ↓
Crawl
 ↓
DOM
 ↓
Network
 ↓
Screenshots
 ↓
AI analysis
 ↓
Implementation plan
 ↓
MCP
 ↓
Rebuild
 ↓
Visual test


============================================================
49. CODE QUALITY
============================================================

Use:

strict TypeScript
ESLint
Prettier
Zod
typed APIs
clean architecture
modular services
reusable components


Do not create giant files.

Do not duplicate logic.

Do not hardcode credentials.

Do not use fake browser results
in production.


============================================================
50. DOCUMENTATION
============================================================

Create:

README.md

docs/architecture.md
docs/api.md
docs/browser.md
docs/crawler.md
docs/network.md
docs/ai.md
docs/ai-providers.md
docs/mcp.md
docs/security.md
docs/deployment.md


README must explain:

Firebase setup
Redis setup
Playwright setup
AI provider setup
OpenRouter setup
MCP setup
Claude Code integration
local development
Docker
production deployment


============================================================
51. DEVELOPMENT PHASES
============================================================

Do NOT generate the entire project in one uncontrolled operation.

Work phase by phase.

PHASE 1

Create:

monorepo
Next.js
Fastify
Firebase
authentication
dashboard
Firestore

Run:

typecheck
lint
tests


PHASE 2

Create:

Playwright
Chromium
BrowserSessionManager
navigation
screenshots


PHASE 3

Create:

CrawlerEngine
AutoScrollEngine
link discovery
page storage


PHASE 4

Create:

DOM Inspector
HTML extraction
DOM normalization


PHASE 5

Create:

Network Inspector
request/response capture
sanitization
API summary


PHASE 6

Create:

asset discovery
screenshot engine
responsive analyzer


PHASE 7

Create:

Redis
BullMQ
workers
job progress
retries
timeouts


PHASE 8

Create:

AI Gateway
AI Provider Registry
OpenRouter
OpenAI-compatible providers
Model Registry
AI Router


PHASE 9

Create:

FREE mode
AUTO mode
BEST_CODING mode
CUSTOM mode
model discovery
fallback
usage tracking


PHASE 10

Create:

AI website analyzer
implementation planner


PHASE 11

Create:

MCP server
coding-agent integration


PHASE 12

Create:

rebuild workflow
visual comparison
iteration loop


PHASE 13

Security hardening.


PHASE 14

Testing.


PHASE 15

Documentation and deployment.


============================================================
52. IMPLEMENTATION PLAN FIRST
============================================================

Before writing production code:

1. Inspect repository.
2. Create implementation_plan.md.
3. Define architecture.
4. Define packages.
5. Define Firestore schema.
6. Define API contracts.
7. Define MCP tools.
8. Define AI provider interfaces.
9. Define AI routing strategy.
10. Define security model.
11. Define background jobs.
12. Define testing strategy.

Then implement Phase 1.


============================================================
53. IMPORTANT AGENT BEHAVIOR
============================================================

After every phase:

1. Run TypeScript compiler.
2. Run lint.
3. Run unit tests.
4. Run integration tests where applicable.
5. Fix all errors.
6. Update documentation.
7. Show a concise implementation report.

Do not silently skip failures.

Do not replace working functionality
with placeholders.

Do not mark a feature complete until
it has been tested.


============================================================
54. FINAL ACCEPTANCE TEST
============================================================

The completed system must support:

User logs in
 ↓
Creates project
 ↓
Enters authorized website
 ↓
URL validation
 ↓
Isolated browser
 ↓
Crawler
 ↓
Auto-scroll
 ↓
DOM inspection
 ↓
HTML inspection
 ↓
Network inspection
 ↓
Secret redaction
 ↓
Public API summary
 ↓
Asset discovery
 ↓
Screenshots
 ↓
Responsive analysis
 ↓
Firestore
 ↓
Firebase Storage
 ↓
AI Gateway
 ↓
AUTO/FREE/BEST CODING/CUSTOM model selection
 ↓
AI analysis
 ↓
Implementation plan
 ↓
MCP
 ↓
Coding Agent
 ↓
Independent implementation
 ↓
Run project
 ↓
Screenshots
 ↓
Visual comparison
 ↓
AI correction
 ↓
Iteration
 ↓
Export


============================================================
55. START NOW
============================================================

First:

Inspect the existing repository.

Then create:

implementation_plan.md

Then create the monorepo structure.

Then implement ONLY PHASE 1.

Do not move to Phase 2 until Phase 1:

- builds successfully
- passes tests
- has no TypeScript errors
- has no critical lint errors
- has working Firebase authentication
- has working Firestore connection
- has working dashboard

After Phase 1, provide:

1. Files created
2. Features implemented
3. Tests passed
4. Remaining work
5. Commands used to run the project

Then wait for the next phase instruction.