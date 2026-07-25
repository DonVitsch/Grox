import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = process.env.GITHUB_REPOSITORY || "dandandujie/Grox";
const token = process.env.STAR_HISTORY_TOKEN || process.env.GITHUB_TOKEN;
if (!token) throw new Error("缺少 STAR_HISTORY_TOKEN");

const headers = {
  Accept: "application/vnd.github.star+json",
  Authorization: `Bearer ${token}`,
  "User-Agent": "Grox-Star-History",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

const repo = await github(`/repos/${repository}`);
const stars = [];
for (let page = 1; ; page += 1) {
  const batch = await github(`/repos/${repository}/stargazers?per_page=100&page=${page}`);
  stars.push(...batch);
  if (batch.length < 100) break;
}

const starredAt = stars
  .map((entry) => Date.parse(entry.starred_at))
  .filter(Number.isFinite)
  .sort((a, b) => a - b);
const now = Date.now();
const start = Math.min(Date.parse(repo.created_at), starredAt[0] ?? now);
const latestEvent = starredAt.at(-1) ?? start;
const end = Math.max(latestEvent, start + 86_400_000);
const points = [{ time: start, count: 0 }];
for (let index = 0; index < starredAt.length; index += 1) {
  points.push({ time: starredAt[index], count: index + 1 });
}
points.push({ time: end, count: starredAt.length });

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "assets");
await mkdir(outputDirectory, { recursive: true });

function chart(theme) {
  const dark = theme === "dark";
  const width = 900;
  const height = 360;
  const left = 62;
  const right = 28;
  const top = 52;
  const bottom = 52;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxStars = Math.max(1, starredAt.length);
  const x = (time) => left + ((time - start) / (end - start)) * plotWidth;
  const y = (count) => top + plotHeight - (count / maxStars) * plotHeight;
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.time).toFixed(1)} ${y(point.count).toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${x(end).toFixed(1)} ${(top + plotHeight).toFixed(1)} L ${left} ${(top + plotHeight).toFixed(1)} Z`;
  const background = dark ? "#0d1117" : "#ffffff";
  const foreground = dark ? "#e6edf3" : "#24292f";
  const muted = dark ? "#8b949e" : "#57606a";
  const grid = dark ? "#30363d" : "#d8dee4";
  const accent = "#f05a28";
  const fill = dark ? "#f05a2838" : "#f05a2826";
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    ...(end - start > 366 * 86_400_000
      ? { year: "2-digit", month: "2-digit" }
      : { month: "2-digit", day: "2-digit" }),
  });
  const xTicks = Array.from({ length: 5 }, (_, index) => start + ((end - start) * index) / 4);
  const yTicks = Array.from({ length: 5 }, (_, index) => (maxStars * index) / 4);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${repository} Star History</title>
  <desc id="desc">GitHub Star 历史曲线，当前 ${starredAt.length} Stars，数据截至 ${new Date(latestEvent).toISOString()}</desc>
  <rect width="${width}" height="${height}" rx="14" fill="${background}"/>
  <text x="${left}" y="30" fill="${foreground}" font-family="system-ui,Segoe UI,sans-serif" font-size="17" font-weight="650">${repository} Star History</text>
  <text x="${width - right}" y="30" text-anchor="end" fill="${accent}" font-family="system-ui,Segoe UI,sans-serif" font-size="17" font-weight="700">★ ${starredAt.length}</text>
  ${yTicks.map((value) => {
    const position = y(value);
    return `<line x1="${left}" y1="${position.toFixed(1)}" x2="${width - right}" y2="${position.toFixed(1)}" stroke="${grid}" stroke-width="1"/>
  <text x="${left - 12}" y="${(position + 4).toFixed(1)}" text-anchor="end" fill="${muted}" font-family="system-ui,Segoe UI,sans-serif" font-size="11">${Math.round(value)}</text>`;
  }).join("\n  ")}
  ${xTicks.map((value) => `<text x="${x(value).toFixed(1)}" y="${height - 20}" text-anchor="middle" fill="${muted}" font-family="system-ui,Segoe UI,sans-serif" font-size="11">${date.format(value)}</text>`).join("\n  ")}
  <path d="${area}" fill="${fill}"/>
  <path d="${line}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x(end).toFixed(1)}" cy="${y(starredAt.length).toFixed(1)}" r="4.5" fill="${background}" stroke="${accent}" stroke-width="3"/>
  <text x="${left}" y="${height - 5}" fill="${muted}" font-family="system-ui,Segoe UI,sans-serif" font-size="9">每小时检查更新 · 最新 Star ${new Date(latestEvent).toISOString().slice(0, 16).replace("T", " ")} UTC</text>
</svg>
`;
}

await Promise.all([
  writeFile(resolve(outputDirectory, "star-history.svg"), chart("light"), "utf8"),
  writeFile(resolve(outputDirectory, "star-history-dark.svg"), chart("dark"), "utf8"),
]);

console.log(`已生成 ${repository} Star History：${starredAt.length} Stars`);
