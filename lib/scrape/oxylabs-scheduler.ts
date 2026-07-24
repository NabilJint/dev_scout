import 'server-only';

// lib/scrape/oxylabs-scheduler.ts
// Oxylabs Scheduler API client — uses Push-Pull API (data.oxylabs.io)
// All schedule_id, run_id, and job_id values are large 64-bit integers
// that must be extracted from raw response text before JSON.parse.

const OXYLABS_BASE = 'https://data.oxylabs.io/v1';

function getAuthHeaders(): Record<string, string> {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;

  if (!username || !password) {
    throw new Error('OXY_WSA_USERNAME or OXY_WSA_PASSWORD not configured');
  }

  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${encoded}`,
  };
}

/**
 * Extract a large integer value from raw JSON response text as a string.
 * Oxylabs IDs (schedule_id, run_id, job id) are 64-bit integers that exceed
 * Number.MAX_SAFE_INTEGER. Parsing with JSON.parse silently corrupts them.
 * This function extracts the value as a string from the raw text before any parse.
 *
 * @param rawText - The raw HTTP response body text
 * @param key - The JSON key to extract (e.g., "schedule_id", "run_id", "id")
 * @returns The value as a string, or null if not found
 */
function extractLargeInt(rawText: string, key: string): string | null {
  // Match "key": <number> — capture the number as a string
  const pattern = new RegExp(`"${key}"\\s*:\\s*(\\d+)`);
  const match = rawText.match(pattern);
  return match ? match[1] : null;
}

/**
 * Extract an array of large integers from raw JSON response text.
 * Used for extracting schedule IDs from GET /v1/schedules response.
 */
function extractLargeIntArray(rawText: string, key: string): string[] {
  // Match "key": [<num1>, <num2>, ...]
  const pattern = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]+)\\]`);
  const match = rawText.match(pattern);
  if (!match) return [];

  // Extract all digit sequences from the array
  const numbers = match[1].match(/\d+/g);
  return numbers || [];
}

// ============================================================================
// Schedule CRUD
// ============================================================================

export interface CreateScheduleParams {
  cron: string;
  items: Array<{ source: string; url: string; render?: string }>;
  endTime: string; // ISO date string or "YYYY-MM-DD HH:mm:ss" format
}

export interface CreateScheduleResult {
  scheduleId: string; // Stored as string (large int)
  active: boolean;
  itemsCount: number;
  cron: string;
  endTime: string;
  nextRunAt: string | null;
}

/**
 * Create a new Oxylabs schedule.
 * POST /v1/schedules
 */
export async function createSchedule(params: CreateScheduleParams): Promise<CreateScheduleResult> {
  const headers = getAuthHeaders();

  const body = {
    cron: params.cron,
    items: params.items,
    end_time: params.endTime,
  };

  const response = await fetch(`${OXYLABS_BASE}/schedules`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Oxylabs create schedule failed (${response.status}): ${errorText}`);
  }

  const rawText = await response.text();

  // Extract large integers from raw text before JSON.parse
  const scheduleId = extractLargeInt(rawText, 'schedule_id');
  if (!scheduleId) {
    throw new Error('Oxylabs create schedule response missing schedule_id');
  }

  const data = JSON.parse(rawText);

  return {
    scheduleId,
    active: data.active ?? true,
    itemsCount: data.items_count ?? 0,
    cron: data.cron ?? params.cron,
    endTime: data.end_time ?? params.endTime,
    nextRunAt: data.next_run_at ?? null,
  };
}

/**
 * List all Oxylabs schedule IDs associated with the account.
 * GET /v1/schedules
 */
export async function listSchedules(): Promise<string[]> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Oxylabs list schedules failed (${response.status}): ${errorText}`);
  }

  const rawText = await response.text();
  return extractLargeIntArray(rawText, 'schedules');
}

/**
 * Get runs for a schedule.
 * GET /v1/schedules/{id}/runs
 * Returns runs with per-job result_status. Filter to result_status === 'done'.
 */
export interface ScheduleRun {
  runId: string; // Large int as string
  jobs: Array<{
    id: string; // Large int as string
    createStatusCode: number;
    resultStatus: 'done' | 'pending' | 'faulted' | string;
    createdAt: string;
    resultCreatedAt: string | null;
  }>;
  successRate: number;
}

export async function getScheduleRuns(scheduleId: string): Promise<ScheduleRun[]> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules/${scheduleId}/runs`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Oxylabs get schedule runs failed (${response.status}): ${errorText}`);
  }

  const rawText = await response.text();

  // Extract run_ids and job IDs from raw text before JSON.parse corrupts them
  const runIdPattern = /"run_id"\s*:\s*(\d+)/g;
  const runIds: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = runIdPattern.exec(rawText)) !== null) {
    runIds.push(match[1]);
  }

  const jobIdPattern = /"id"\s*:\s*(\d+)/g;
  const jobIds: string[] = [];
  while ((match = jobIdPattern.exec(rawText)) !== null) {
    jobIds.push(match[1]);
  }

  const data = JSON.parse(rawText);

  if (!data.runs || !Array.isArray(data.runs)) {
    return [];
  }

  return data.runs.map((run: Record<string, unknown>, runIdx: number) => {
    const runId = runIds[runIdx] ?? String(run.run_id);

    // Compute the absolute job index offset for this run
    let jobOffset = 0;
    for (let r = 0; r < runIdx; r++) {
      jobOffset += (data.runs[r].jobs as Array<unknown>).length;
    }

    const jobs = (run.jobs as Array<Record<string, unknown>> || []).map((job, jobIdx) => {
      const absoluteJobIdx = jobOffset + jobIdx;
      const jobId = jobIds[absoluteJobIdx] ?? String(job.id);

      return {
        id: jobId,
        createStatusCode: (job.create_status_code as number) ?? 202,
        resultStatus: (job.result_status as string) ?? 'pending',
        createdAt: (job.created_at as string) ?? '',
        resultCreatedAt: (job.result_created_at as string | null) ?? null,
      };
    });

    return {
      runId,
      jobs,
      successRate: (run.success_rate as number) ?? 0,
    };
  });
}

/**
 * Get job results from Oxylabs.
 * GET /v1/queries/{jobId}/results
 */
export interface JobResult {
  content: string;
  statusCode: number;
  url: string;
  jobId: string;
}

export async function getJobResults(jobId: string): Promise<JobResult | null> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/queries/${jobId}/results`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    console.error(`  ❌ [Oxylabs] Failed to get job results for ${jobId}: HTTP ${response.status}`);
    return null;
  }

  // Use raw text to extract large ints before JSON.parse corrupts them
  const rawText = await response.text();
  const jobIdFromResponse = extractLargeInt(rawText, 'job_id');

  const data = JSON.parse(rawText);

  const result = data?.results?.[0];
  if (!result) {
    console.error(`  ❌ [Oxylabs] No results for job ${jobId}`);
    return null;
  }

  return {
    content: typeof result.content === 'string' ? result.content : '',
    statusCode: result.status_code ?? 200,
    url: result.url ?? '',
    jobId: jobIdFromResponse ?? jobId,
  };
}

/**
 * Activate a schedule on Oxylabs.
 * PUT /v1/schedules/{id}/state with { active: true }
 */
export async function activateSchedule(scheduleId: string): Promise<void> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules/${scheduleId}/state`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ active: true }),
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.warn(`  ⚠️ [Oxylabs] Failed to reactivate schedule ${scheduleId}: HTTP ${response.status} — ${errorText}`);
    // Non-fatal — log and continue
  }
}

/**
 * Deactivate a schedule on Oxylabs.
 * PUT /v1/schedules/{id}/state with { active: false }
 */
export async function deactivateSchedule(scheduleId: string): Promise<void> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules/${scheduleId}/state`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ active: false }),
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`  ⚠️ [Oxylabs] Failed to deactivate schedule ${scheduleId}: HTTP ${response.status} — ${errorText}`);
    // Non-fatal — log and continue
  }
}

/**
 * Get schedule info.
 * GET /v1/schedules/{id}
 */
export async function getScheduleInfo(scheduleId: string): Promise<Record<string, unknown> | null> {
  const headers = getAuthHeaders();

  const response = await fetch(`${OXYLABS_BASE}/schedules/${scheduleId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}