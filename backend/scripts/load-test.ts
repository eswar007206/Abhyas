const apiUrl = process.env.API_URL ?? "http://localhost:8080";
const authToken = process.env.AUTH_TOKEN;
const testId = process.env.TEST_ID;
const requests = Number(process.env.REQUESTS ?? 25);
const concurrency = Number(process.env.CONCURRENCY ?? 5);

if (!authToken || !testId) {
  throw new Error("AUTH_TOKEN and TEST_ID are required.");
}

async function runOne(index: number) {
  const startedAt = performance.now();
  const response = await fetch(`${apiUrl}/api/tests/${testId}/session`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  const elapsedMs = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`Request ${index} failed with ${response.status}: ${await response.text()}`);
  }
  return elapsedMs;
}

async function main() {
  const latencies: number[] = [];
  let next = 0;

  async function worker() {
    while (next < requests) {
      const index = next;
      next += 1;
      latencies.push(await runOne(index));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const max = latencies.at(-1) ?? 0;

  console.info(
    JSON.stringify(
      {
        requests,
        concurrency,
        p50Ms: Math.round(p50),
        p95Ms: Math.round(p95),
        maxMs: Math.round(max),
      },
      null,
      2,
    ),
  );
}

await main();
