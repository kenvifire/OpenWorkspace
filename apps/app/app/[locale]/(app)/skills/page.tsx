'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillsApi, myAgentsApi } from '@/lib/api';
import type { Skill, CreateSkillDto, UpdateSkillDto } from '@/lib/api';
import type { Agent } from '@openworkspace/api-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Zap, Plus, Pencil, Trash2, Bot, X, Check, Globe, MessageSquare,
  Github, LayoutDashboard, Search, Download, Code2, Database, Mail,
  Calendar, FileText, GitBranch, Slack, Chrome, BarChart3, Shield, Cpu,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Hub catalogue ────────────────────────────────────────────────────────────

type HubSkill = {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  gradient: string;
  preset: Partial<CreateSkillDto>;
};

const SKILL_HUB: HubSkill[] = [
  // Developer Tools
  {
    key: 'project-context',
    name: 'Project Context',
    description: 'Fetch project info, team members, and task assignments at the start of every run.',
    category: 'Developer Tools',
    icon: <LayoutDashboard size={18} />,
    gradient: 'from-violet-600 to-indigo-600',
    preset: {
      name: 'project_context',
      type: 'PROMPT',
      description: 'Gives the agent awareness of the current project, its team members, and all tasks on the board.',
      instructions: `At the start of every task, call get_project_info to load the project name, description, hired agents, and task counts by status.

Use get_project_tasks to list all tasks when you need to understand the full board, coordinate with other agents, or identify blocked/unassigned work. You can filter by status (BACKLOG, TODO, IN_PROGRESS, BLOCKED, DONE).

Use get_task to retrieve the full details of a specific task including its description and current assignee.

Guidelines:
- Always call get_project_info first before starting work so you understand the project scope and team composition.
- Reference other agents by name when leaving comments or updating tasks.
- If your task depends on another task being completed first, check its status with get_task before proceeding.
- When creating subtasks or follow-up tasks with create_task, assign them the appropriate priority based on the project context.`,
    },
  },
  {
    key: 'github',
    name: 'GitHub',
    description: 'Create issues, comment on PRs, push files, and trigger workflows via the GitHub REST API.',
    category: 'Developer Tools',
    icon: <Github size={18} />,
    gradient: 'from-zinc-800 to-zinc-600',
    preset: {
      name: 'github',
      type: 'PROMPT',
      description: 'Interact with GitHub repositories — create issues, comment on pull requests, read file contents, and trigger workflows.',
      instructions: `Use the http_request tool to interact with the GitHub REST API. Always retrieve the GitHub token first using get_resource_key("GitHub Token") and include it as: {"Authorization": "token <value>", "Accept": "application/vnd.github+json"}.

Base URL: https://api.github.com

Common operations:
- Create repo: POST /user/repos  {"name":"...","private":false}
- Create issue: POST /repos/{owner}/{repo}/issues  {"title":"...","body":"..."}
- List open PRs: GET /repos/{owner}/{repo}/pulls?state=open
- Post PR comment: POST /repos/{owner}/{repo}/issues/{number}/comments  {"body":"..."}
- Get file contents: GET /repos/{owner}/{repo}/contents/{path}
- Create/update file: PUT /repos/{owner}/{repo}/contents/{path}  {"message":"...","content":"<base64>","sha":"<existing sha if update>"}
- Trigger workflow: POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches  {"ref":"main"}

Always summarise what you did after each API call.`,
    },
  },
  {
    key: 'gitlab',
    name: 'GitLab',
    description: 'Manage issues, merge requests, and pipelines via the GitLab REST API.',
    category: 'Developer Tools',
    icon: <GitBranch size={18} />,
    gradient: 'from-orange-500 to-red-500',
    preset: {
      name: 'gitlab',
      type: 'PROMPT',
      description: 'Interact with GitLab projects — create issues, review MRs, trigger CI/CD pipelines.',
      instructions: `Use the http_request tool to interact with the GitLab REST API. Retrieve the GitLab token with get_resource_key("GitLab Token") and set header: {"PRIVATE-TOKEN": "<value>"}.

Base URL: https://gitlab.com/api/v4

Common operations:
- List projects: GET /projects?membership=true
- Create issue: POST /projects/{id}/issues  {"title":"...","description":"..."}
- List MRs: GET /projects/{id}/merge_requests?state=opened
- Trigger pipeline: POST /projects/{id}/pipeline  {"ref":"main"}
- Get file: GET /projects/{id}/repository/files/{file_path}?ref=main`,
    },
  },
  {
    key: 'code-review',
    name: 'Code Review',
    description: 'Structured code review checklist: security, performance, readability, and test coverage.',
    category: 'Developer Tools',
    icon: <Code2 size={18} />,
    gradient: 'from-cyan-500 to-blue-600',
    preset: {
      name: 'code_review',
      type: 'PROMPT',
      description: 'Systematic code review covering security, performance, readability, and test coverage.',
      instructions: `When reviewing code, always evaluate across these dimensions:

1. **Security**: Look for injection vulnerabilities, hardcoded secrets, improper auth, unvalidated inputs.
2. **Performance**: Identify N+1 queries, unnecessary loops, missing indexes, blocking I/O.
3. **Readability**: Check naming, function length (<30 lines), single responsibility, comments on non-obvious logic.
4. **Error handling**: Verify errors are caught, logged, and surfaced appropriately.
5. **Test coverage**: Flag untested edge cases, missing unit/integration tests.

Format your review as:
- ✅ Strengths
- ⚠️ Issues (with line references if available)
- 💡 Suggestions`,
    },
  },
  {
    key: 'jira',
    name: 'Jira',
    description: 'Create, update, and transition Jira issues via the REST API.',
    category: 'Developer Tools',
    icon: <FileText size={18} />,
    gradient: 'from-blue-600 to-blue-800',
    preset: {
      name: 'jira',
      type: 'PROMPT',
      description: 'Manage Jira issues — create tickets, update status, add comments.',
      instructions: `Use the http_request tool to interact with the Jira REST API. Retrieve credentials with get_resource_key("Jira Token") and set header: {"Authorization": "Basic <base64(email:token)>", "Content-Type": "application/json"}.

Base URL: https://{your-domain}.atlassian.net/rest/api/3

Common operations:
- Create issue: POST /issue  {"fields":{"project":{"key":"PROJ"},"summary":"...","issuetype":{"name":"Task"}}}
- Get issue: GET /issue/{issueKey}
- Update issue: PUT /issue/{issueKey}  {"fields":{"summary":"..."}}
- Transition issue: POST /issue/{issueKey}/transitions  {"transition":{"id":"..."}}
- Add comment: POST /issue/{issueKey}/comment  {"body":{"type":"doc","version":1,"content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}}`,
    },
  },
  {
    key: 'linear',
    name: 'Linear',
    description: 'Create and update Linear issues via the GraphQL API.',
    category: 'Developer Tools',
    icon: <Cpu size={18} />,
    gradient: 'from-indigo-500 to-purple-600',
    preset: {
      name: 'linear',
      type: 'PROMPT',
      description: 'Manage Linear issues and cycles via GraphQL.',
      instructions: `Use the http_request tool to interact with the Linear GraphQL API. Retrieve the token with get_resource_key("Linear Token") and set header: {"Authorization": "<value>", "Content-Type": "application/json"}.

Endpoint: POST https://api.linear.app/graphql

Create issue:
{"query":"mutation { issueCreate(input: {title: \"...\", teamId: \"...\"}) { success issue { id identifier } } }"}

List issues:
{"query":"query { issues(first: 20) { nodes { id title state { name } assignee { name } } } }"}

Update issue state:
{"query":"mutation { issueUpdate(id: \"...\", input: {stateId: \"...\"}) { success } }"}`,
    },
  },
  // Productivity
  {
    key: 'web-search',
    name: 'Web Search',
    description: 'Search the web and summarise results to answer questions or gather research.',
    category: 'Productivity',
    icon: <Search size={18} />,
    gradient: 'from-emerald-500 to-teal-600',
    preset: {
      name: 'web_search',
      type: 'PROMPT',
      description: 'Search the web using Brave Search or similar APIs and summarise findings.',
      instructions: `Use the http_request tool to search the web via the Brave Search API. Retrieve the key with get_resource_key("Brave Search Key") and set header: {"X-Subscription-Token": "<value>", "Accept": "application/json"}.

Search endpoint: GET https://api.search.brave.com/res/v1/web/search?q={query}&count=5

After fetching results, extract the top 3-5 most relevant results and summarise their key points. Always cite sources with URLs.`,
    },
  },
  {
    key: 'notion',
    name: 'Notion',
    description: 'Read and write Notion pages and databases via the API.',
    category: 'Productivity',
    icon: <FileText size={18} />,
    gradient: 'from-zinc-700 to-zinc-900',
    preset: {
      name: 'notion',
      type: 'PROMPT',
      description: 'Read Notion pages and append content to databases.',
      instructions: `Use the http_request tool to interact with the Notion API. Retrieve the token with get_resource_key("Notion Token") and set headers: {"Authorization": "Bearer <value>", "Notion-Version": "2022-06-28", "Content-Type": "application/json"}.

Base URL: https://api.notion.com/v1

Common operations:
- Get page: GET /pages/{page_id}
- Get database: GET /databases/{database_id}
- Query database: POST /databases/{database_id}/query  {"filter":{...},"sorts":[...]}
- Create page: POST /pages  {"parent":{"database_id":"..."},"properties":{...}}
- Append blocks: PATCH /blocks/{block_id}/children  {"children":[{"object":"block","type":"paragraph","paragraph":{"rich_text":[{"text":{"content":"..."}}]}}]}`,
    },
  },
  {
    key: 'calendar',
    name: 'Google Calendar',
    description: 'Read events, create meetings, and check availability via the Google Calendar API.',
    category: 'Productivity',
    icon: <Calendar size={18} />,
    gradient: 'from-blue-400 to-blue-600',
    preset: {
      name: 'google_calendar',
      type: 'PROMPT',
      description: 'Manage Google Calendar events — read, create, and update.',
      instructions: `Use the http_request tool to interact with the Google Calendar API. Retrieve the token with get_resource_key("Google OAuth Token") and set header: {"Authorization": "Bearer <value>"}.

Base URL: https://www.googleapis.com/calendar/v3

Common operations:
- List calendars: GET /users/me/calendarList
- List events: GET /calendars/{calendarId}/events?timeMin=<ISO>&timeMax=<ISO>
- Create event: POST /calendars/{calendarId}/events  {"summary":"...","start":{"dateTime":"...","timeZone":"UTC"},"end":{"dateTime":"...","timeZone":"UTC"},"attendees":[{"email":"..."}]}
- Update event: PUT /calendars/{calendarId}/events/{eventId}  {...}
- Delete event: DELETE /calendars/{calendarId}/events/{eventId}`,
    },
  },
  // Communication
  {
    key: 'slack',
    name: 'Slack',
    description: 'Send messages, post to channels, and read thread replies via the Slack API.',
    category: 'Communication',
    icon: <Slack size={18} />,
    gradient: 'from-purple-500 to-pink-500',
    preset: {
      name: 'slack',
      type: 'PROMPT',
      description: 'Post messages and interact with Slack channels and DMs.',
      instructions: `Use the http_request tool to interact with the Slack API. Retrieve the bot token with get_resource_key("Slack Token") and set header: {"Authorization": "Bearer <value>", "Content-Type": "application/json"}.

Base URL: https://slack.com/api

Common operations:
- Post message: POST /chat.postMessage  {"channel":"#channel-name","text":"..."}
- Reply to thread: POST /chat.postMessage  {"channel":"...","thread_ts":"...","text":"..."}
- List channels: GET /conversations.list
- Get messages: GET /conversations.history?channel={channel_id}&limit=10
- Upload file: POST /files.upload  {"channels":"...","content":"...","filename":"..."}`,
    },
  },
  {
    key: 'email',
    name: 'Email (SendGrid)',
    description: 'Send transactional emails via the SendGrid API.',
    category: 'Communication',
    icon: <Mail size={18} />,
    gradient: 'from-teal-500 to-cyan-600',
    preset: {
      name: 'email_sendgrid',
      type: 'PROMPT',
      description: 'Send emails via SendGrid with HTML or plain text content.',
      instructions: `Use the http_request tool to send emails via SendGrid. Retrieve the API key with get_resource_key("SendGrid API Key") and set headers: {"Authorization": "Bearer <value>", "Content-Type": "application/json"}.

Send email: POST https://api.sendgrid.com/v3/mail/send
Body:
{
  "personalizations": [{"to": [{"email": "recipient@example.com"}]}],
  "from": {"email": "sender@yourdomain.com"},
  "subject": "...",
  "content": [{"type": "text/plain", "value": "..."}]
}

For HTML emails use: {"type": "text/html", "value": "<h1>...</h1>"}`,
    },
  },
  // Data & Analytics
  {
    key: 'data-analysis',
    name: 'Data Analysis',
    description: 'Analyse datasets, compute statistics, and produce clear summaries and insights.',
    category: 'Data & Analytics',
    icon: <BarChart3 size={18} />,
    gradient: 'from-rose-500 to-pink-600',
    preset: {
      name: 'data_analysis',
      type: 'PROMPT',
      description: 'Systematically analyse data and produce clear, actionable summaries.',
      instructions: `When analysing data, follow this structured approach:

1. **Understand the data**: Identify shape, types, missing values, and key columns.
2. **Descriptive stats**: Compute min, max, mean, median, std dev for numeric columns.
3. **Distributions**: Note skew, outliers (>3σ), and data quality issues.
4. **Correlations**: Identify relationships between variables.
5. **Key insights**: Summarise 3-5 actionable findings in plain language.
6. **Recommendations**: Suggest next steps or further analysis.

Always present numbers with appropriate precision and include units where relevant.`,
    },
  },
  {
    key: 'web-scrape',
    name: 'Web Scrape',
    description: 'Fetch and extract structured data from web pages.',
    category: 'Data & Analytics',
    icon: <Chrome size={18} />,
    gradient: 'from-yellow-500 to-orange-500',
    preset: {
      name: 'web_scrape',
      type: 'PROMPT',
      description: 'Fetch web pages and extract structured information using http_request.',
      instructions: `Use the http_request tool to fetch web pages. Use GET requests with appropriate headers:
{"User-Agent": "Mozilla/5.0", "Accept": "text/html,application/xhtml+xml"}

When extracting data:
1. Fetch the page HTML via http_request
2. Identify the relevant data patterns in the response
3. Extract and structure the data (tables, lists, key-value pairs)
4. Return a clean, structured summary

For JSON APIs, parse the response directly. For HTML, look for data in <table>, <ul>, <dl>, or structured <div> elements.

Note: Respect robots.txt and rate limits. Do not scrape sites that prohibit it.`,
    },
  },
  // Security
  {
    key: 'security-review',
    name: 'Security Review',
    description: 'OWASP-based security review checklist for code and infrastructure.',
    category: 'Security',
    icon: <Shield size={18} />,
    gradient: 'from-red-500 to-rose-600',
    preset: {
      name: 'security_review',
      type: 'PROMPT',
      description: 'Systematic security review based on OWASP Top 10 and common vulnerability patterns.',
      instructions: `When conducting a security review, evaluate against OWASP Top 10 and common patterns:

**OWASP Top 10 checks:**
1. Injection (SQL, NoSQL, command, LDAP)
2. Broken authentication (weak sessions, missing MFA)
3. Sensitive data exposure (unencrypted PII, secrets in code)
4. XML External Entities (XXE)
5. Broken access control (privilege escalation, IDOR)
6. Security misconfiguration (default creds, open ports, verbose errors)
7. XSS (reflected, stored, DOM-based)
8. Insecure deserialization
9. Using components with known vulnerabilities
10. Insufficient logging & monitoring

**Additional checks:**
- CSRF tokens on state-changing endpoints
- Rate limiting and brute-force protection
- Input validation and output encoding
- Dependency audit (outdated packages with CVEs)

Format findings as: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low with remediation steps.`,
    },
  },
  {
    key: 'sql-query',
    name: 'SQL Query',
    description: 'Write and review SQL queries with best practices for performance and safety.',
    category: 'Data & Analytics',
    icon: <Database size={18} />,
    gradient: 'from-blue-500 to-indigo-600',
    preset: {
      name: 'sql_query',
      type: 'PROMPT',
      description: 'Write optimised, safe SQL queries with performance and security best practices.',
      instructions: `When writing or reviewing SQL:

**Writing queries:**
- Use parameterised queries / prepared statements — never string interpolation
- Add LIMIT clauses to avoid unbounded result sets
- Use indexes on WHERE, JOIN, and ORDER BY columns
- Prefer CTEs over nested subqueries for readability
- Explain query plan for complex queries (EXPLAIN ANALYZE)

**Performance:**
- Avoid SELECT * — name columns explicitly
- Use EXISTS instead of IN for subqueries on large tables
- Push filters as early as possible
- Consider partial indexes for filtered queries

**Safety:**
- Validate all inputs before they reach the query
- Use read-only database users where writes aren't needed
- Audit logs for sensitive data access`,
    },
  },
];

const SKILL_CATEGORIES = ['All', ...Array.from(new Set(SKILL_HUB.map((s) => s.category)))];

// ─── Skill Form ───────────────────────────────────────────────────────────────

function SkillForm({
  initial,
  preset,
  onClose,
  onSuccess,
}: {
  initial?: Skill;
  preset?: Partial<CreateSkillDto>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? preset?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? preset?.description ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? preset?.instructions ?? '');
  const [type, setType] = useState<'PROMPT' | 'WEBHOOK'>(initial?.type ?? preset?.type ?? 'PROMPT');
  const [webhookUrl, setWebhookUrl] = useState(initial?.webhookUrl ?? preset?.webhookUrl ?? '');
  const [webhookMethod, setWebhookMethod] = useState(initial?.webhookMethod ?? preset?.webhookMethod ?? 'POST');
  const [webhookHeaders, setWebhookHeaders] = useState(initial?.webhookHeaders ?? preset?.webhookHeaders ?? '');

  const buildDto = (): CreateSkillDto | UpdateSkillDto => ({
    name, description, instructions, type,
    ...(type === 'WEBHOOK' ? {
      webhookUrl: webhookUrl || undefined,
      webhookMethod: webhookMethod || undefined,
      webhookHeaders: webhookHeaders || undefined,
    } : {}),
  });

  const createMutation = useMutation({
    mutationFn: () => skillsApi.create(buildDto() as CreateSkillDto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-skills'] }); onSuccess(); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: () => skillsApi.update(initial!.id, buildDto()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-skills'] }); onSuccess(); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initial) updateMutation.mutate(); else createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="web_search"
            required
            minLength={2}
            maxLength={80}
            className="bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50 font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Type</Label>
          <Select value={type} onValueChange={(v) => setType((v ?? 'PROMPT') as 'PROMPT' | 'WEBHOOK')}>
            <SelectTrigger className="w-full bg-[#0f0f1a] border-[#1e1e3a] text-white focus:border-violet-500/50"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="PROMPT">Prompt</SelectItem>
              <SelectItem value="WEBHOOK">Webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          required
          minLength={5}
          maxLength={500}
          className="bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Instructions</Label>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={type === 'PROMPT' ? 'When the user asks about X, you should…' : 'Call this webhook with…'}
          rows={6}
          maxLength={8000}
          className="resize-none font-mono text-sm bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
          required
        />
        <p className="text-xs text-zinc-600 font-mono">{instructions.length}/8000</p>
      </div>

      {type === 'WEBHOOK' && (
        <div className="space-y-3 rounded-xl border border-[#1e1e3a] bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">Webhook Config</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">URL</Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.example.com/endpoint"
                type="url"
                className="bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Method</Label>
              <Select value={webhookMethod} onValueChange={(v) => setWebhookMethod(v ?? 'POST')}>
                <SelectTrigger className="bg-[#0f0f1a] border-[#1e1e3a] text-white focus:border-violet-500/50"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs font-medium uppercase tracking-wide">Headers <span className="text-zinc-600 normal-case">(JSON)</span></Label>
            <Input
              value={webhookHeaders}
              onChange={(e) => setWebhookHeaders(e.target.value)}
              placeholder='{"Authorization": "Bearer sk-..."}'
              className="font-mono text-sm bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400 font-mono">{(error as any)?.response?.data?.message ?? 'Something went wrong'}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all duration-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Create skill'}
        </button>
      </div>
    </form>
  );
}

// ─── Assign Agents Panel ──────────────────────────────────────────────────────

function AssignAgentsPanel({ skill }: { skill: Skill }) {
  const qc = useQueryClient();
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ['my-agents'], queryFn: myAgentsApi.list });
  const { data: agentSkills = [] } = useQuery<any[]>({
    queryKey: ['skill-agents', skill.id],
    queryFn: async () => {
      const results = await Promise.all(agents.map((a) => myAgentsApi.listSkills(a.id)));
      return agents.map((a, i) => ({ agent: a, assigned: results[i].some((as: any) => as.skillId === skill.id) }));
    },
    enabled: agents.length > 0,
  });

  const assign = useMutation({
    mutationFn: (agentId: string) => myAgentsApi.assignSkill(agentId, skill.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skill-agents', skill.id] }); qc.invalidateQueries({ queryKey: ['my-skills'] }); },
  });
  const remove = useMutation({
    mutationFn: (agentId: string) => myAgentsApi.removeSkill(agentId, skill.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skill-agents', skill.id] }); qc.invalidateQueries({ queryKey: ['my-skills'] }); },
  });

  if (agents.length === 0) return <p className="text-sm text-zinc-500">No personal agents yet.</p>;

  return (
    <div className="space-y-2">
      {agentSkills.map(({ agent, assigned }: { agent: Agent; assigned: boolean }) => (
        <div key={agent.id} className="flex items-center justify-between rounded-xl border border-[#1e1e3a] bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
              <Bot size={11} className="text-white" />
            </div>
            <span className="text-sm font-medium text-zinc-200">{agent.name}</span>
            {agent.modelName && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {agent.modelName}
              </span>
            )}
          </div>
          <button
            onClick={() => assigned ? remove.mutate(agent.id) : assign.mutate(agent.id)}
            disabled={assign.isPending || remove.isPending}
            className={`h-7 px-3 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 disabled:opacity-50 ${
              assigned
                ? 'bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-zinc-400 hover:text-red-400'
                : 'bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300'
            }`}
          >
            {assigned ? <><X size={11} />Remove</> : <><Check size={11} />Assign</>}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Skill Card ───────────────────────────────────────────────────────────────

function SkillCard({ skill }: { skill: Skill }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showAgents, setShowAgents] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => skillsApi.delete(skill.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-skills'] }),
  });

  if (editing) {
    return (
      <div className="rounded-2xl bg-[#0f0f1a] border border-[#1e1e3a] p-5">
        <h3 className="text-base font-semibold text-white mb-4">Edit Skill</h3>
        <SkillForm initial={skill} onClose={() => setEditing(false)} onSuccess={() => setEditing(false)} />
      </div>
    );
  }

  const isWebhook = skill.type === 'WEBHOOK';
  const agentCount = skill._count?.agents ?? 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="group relative overflow-hidden rounded-2xl bg-[#0f0f1a] border border-[#1e1e3a] hover:border-violet-500/30 p-5 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]"
    >
      <div className="absolute right-0 top-0 h-32 w-32 -translate-y-10 translate-x-10 rounded-full bg-violet-500/5 blur-2xl group-hover:bg-violet-500/10 transition-opacity" />
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm text-white ${isWebhook ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-violet-500 to-purple-600'}`}>
          {isWebhook ? <Globe size={18} /> : <Zap size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{skill.name}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${isWebhook ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-violet-500/10 text-violet-400 border-violet-500/20'}`}>
              {isWebhook ? <Globe size={10} className="mr-1" /> : <MessageSquare size={10} className="mr-1" />}
              {skill.type}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-400 line-clamp-1">{skill.description}</p>
          <p className="mt-1.5 text-xs text-zinc-600">Assigned to <span className="font-medium text-zinc-400">{agentCount}</span> agent{agentCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowAgents((v) => !v)}
            className={`h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 border ${
              showAgents
                ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {showAgents ? 'Hide agents' : 'Assign agents'}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-200"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${skill.name}"?`)) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {skill.instructions && (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
          <p className="text-xs text-zinc-500 font-mono line-clamp-2">{skill.instructions}</p>
        </div>
      )}
      {showAgents && (
        <div className="mt-4 border-t border-[#1e1e3a] pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Agents</p>
          <AssignAgentsPanel skill={skill} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Hub Card ─────────────────────────────────────────────────────────────────

function HubSkillCard({ item, installed, onInstall, installing }: {
  item: HubSkill;
  installed: boolean;
  onInstall: () => void;
  installing: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="group relative overflow-hidden rounded-2xl bg-[#0f0f1a] border border-[#1e1e3a] hover:border-violet-500/30 p-5 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} shadow-sm text-white`}>
          {item.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{item.name}</h3>
            <span className="rounded-full bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-zinc-500">{item.category}</span>
            <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[11px] font-medium text-violet-400">{item.preset.type ?? 'PROMPT'}</span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">{item.description}</p>
        </div>
        <button
          disabled={installed || installing}
          onClick={onInstall}
          className={`shrink-0 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 border disabled:cursor-not-allowed ${
            installed
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-default'
              : installing
                ? 'bg-white/5 text-zinc-500 border-white/10 opacity-60'
                : 'bg-violet-600 hover:bg-violet-500 text-white border-transparent'
          }`}
        >
          {installed ? <><Check size={11} />Installed</> : installing ? 'Installing…' : <><Download size={11} />Install</>}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const qc = useQueryClient();
  const [pageTab, setPageTab] = useState<'mine' | 'hub'>('mine');
  const [creating, setCreating] = useState(false);
  const [activePreset, setActivePreset] = useState<Partial<CreateSkillDto> | undefined>();
  const [hubSearch, setHubSearch] = useState('');
  const [hubCategory, setHubCategory] = useState('All');
  const [installing, setInstalling] = useState<string | null>(null);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['my-skills'],
    queryFn: skillsApi.list,
  });

  const installMutation = useMutation({
    mutationFn: (preset: Partial<CreateSkillDto>) => skillsApi.create(preset as CreateSkillDto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-skills'] }),
    onSettled: () => setInstalling(null),
  });

  const installedNames = new Set(skills.map((s) => s.name));

  const filteredHub = SKILL_HUB.filter((item) => {
    const matchesCategory = hubCategory === 'All' || item.category === hubCategory;
    const q = hubSearch.toLowerCase();
    const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const openBlank = () => { setActivePreset(undefined); setCreating(true); };
  const closeForm = () => { setCreating(false); setActivePreset(undefined); };

  return (
    <div className="min-h-full p-8 bg-[#080810] bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:64px_64px]">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Skills</h1>
          <p className="mt-1 text-sm text-zinc-500">Reusable capabilities you can assign to your agents.</p>
        </div>
        {pageTab === 'mine' && !creating && (
          <button
            onClick={openBlank}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all duration-200"
          >
            <Plus size={14} />New skill
          </button>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[#0f0f1a] border border-[#1e1e3a] p-1 w-fit">
        {(['mine', 'hub'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setPageTab(t); setCreating(false); }}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              pageTab === t
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'mine' ? (
              `My Skills (${skills.length})`
            ) : (
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent font-semibold">
                ✦ Skill Hub
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My Skills tab */}
      {pageTab === 'mine' && (
        <>
          {creating && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div className="rounded-2xl bg-[#0f0f1a] border border-[#1e1e3a] p-5">
                <h3 className="text-base font-semibold text-white mb-4">
                  {activePreset ? 'Create skill from hub' : 'Create Skill'}
                </h3>
                <SkillForm preset={activePreset} onClose={closeForm} onSuccess={closeForm} />
              </div>
            </motion.div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse bg-white/5 rounded-2xl" />)}
            </div>
          ) : skills.length === 0 && !creating ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#1e1e3a] bg-white/[0.02] py-24 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600">
                <Zap size={26} className="text-white" />
              </div>
              <p className="font-semibold text-zinc-300">No skills yet</p>
              <p className="mt-1 text-sm text-zinc-500">Create your own or install one from the Skill Hub.</p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={openBlank}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all duration-200"
                >
                  <Plus size={14} />New skill
                </button>
                <button
                  onClick={() => setPageTab('hub')}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all duration-200"
                >
                  Browse hub
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill, i) => (
                <motion.div key={skill.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.25 }}>
                  <SkillCard skill={skill} />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Hub tab */}
      {pageTab === 'hub' && (
        <div>
          {/* Search + category filter */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <Input
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Search skills…"
                className="pl-9 bg-[#0f0f1a] border-[#1e1e3a] text-white placeholder:text-zinc-600 focus:border-violet-500/50"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {SKILL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setHubCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 border ${
                    hubCategory === cat
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      : 'bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:border-white/20 hover:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredHub.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">No skills match your search.</p>
          ) : (
            <div className="space-y-3">
              {filteredHub.map((item, i) => (
                <motion.div key={item.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}>
                  <HubSkillCard
                    item={item}
                    installed={installedNames.has(item.preset.name ?? '')}
                    installing={installing === item.key}
                    onInstall={() => {
                      setInstalling(item.key);
                      installMutation.mutate(item.preset);
                    }}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
