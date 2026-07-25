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
  const width = 960;
  const height = 480;
  const left = 86;
  const right = 34;
  const top = 26;
  const bottom = 90;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxStars = Math.max(1, Math.ceil(starredAt.length / 10) * 10);
  const x = (time) => left + ((time - start) / (end - start)) * plotWidth;
  const y = (count) => top + plotHeight - (count / maxStars) * plotHeight;
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.time).toFixed(1)} ${y(point.count).toFixed(1)}`)
    .join(" ");
  const background = dark ? "#0d1117" : "#ffffff";
  const ink = dark ? "#f0f3f6" : "#111111";
  const muted = dark ? "#c2c8d0" : "#242424";
  const accent = "#e84424";
  const signature = "#70d42c";
  const font = "'Comic Sans MS','Segoe Print','Bradley Hand',cursive";
  const historyDays = (end - start) / 86_400_000;
  const date = new Intl.DateTimeFormat(historyDays > 90 ? "zh-CN" : "en-US", {
    timeZone: "UTC",
    ...(historyDays > 366
      ? { year: "2-digit", month: "2-digit" }
      : historyDays > 90
        ? { month: "short", day: "numeric" }
        : { weekday: "short", day: "numeric" }),
  });
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" });
  const dateLabel = (value) => historyDays <= 90
    ? `${weekday.format(value)} ${day.format(value)}`
    : date.format(value);
  const xTicks = Array.from({ length: 7 }, (_, index) => start + ((end - start) * index) / 6);
  const yStep = maxStars <= 20 ? 5 : 10;
  const yTicks = Array.from(
    { length: Math.floor(maxStars / yStep) },
    (_, index) => (index + 1) * yStep,
  );
  const axisBottom = top + plotHeight;
  const star = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? 12 : 4.8;
    return `${(width - 214 + Math.cos(angle) * radius).toFixed(1)},${(height - 30 + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${repository} Star History</title>
  <desc id="desc">GitHub Star 历史曲线，当前 ${starredAt.length} Stars，数据截至 ${new Date(latestEvent).toISOString()}</desc>
  <defs>
    <filter id="rough" x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.12" numOctaves="2" seed="17" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${background}"/>
  <g filter="url(#rough)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M ${left} ${axisBottom} C 225 ${axisBottom - 3}, 336 ${axisBottom + 3}, 478 ${axisBottom} S 720 ${axisBottom + 3}, ${width - right} ${axisBottom - 1}" stroke="${ink}" stroke-width="4.5"/>
    <path d="M ${left} ${axisBottom} C ${left - 4} 322, ${left + 3} 254, ${left - 1} 188 S ${left + 3} 88, ${left} ${top}" stroke="${ink}" stroke-width="4.5"/>
    <path d="${line}" stroke="${accent}" stroke-width="4" opacity="0.98"/>
  </g>
  ${yTicks.map((value) => `<text x="${left - 13}" y="${(y(value) + 7).toFixed(1)}" text-anchor="end" fill="${muted}" font-family="${font}" font-size="21">${value}</text>`).join("\n  ")}
  ${xTicks.map((value) => `<text x="${x(value).toFixed(1)}" y="${axisBottom + 29}" text-anchor="middle" fill="${muted}" font-family="${font}" font-size="17">${dateLabel(value)}</text>`).join("\n  ")}
  <text x="${width / 2}" y="${height - 18}" text-anchor="middle" fill="${ink}" font-family="${font}" font-size="22">Date</text>
  <text x="29" y="${top + plotHeight / 2}" text-anchor="middle" fill="${ink}" font-family="${font}" font-size="22" transform="rotate(-90 29 ${top + plotHeight / 2})">GitHub Stars</text>
  <polygon points="${star}" fill="none" stroke="${signature}" stroke-width="3" stroke-linejoin="round" filter="url(#rough)"/>
  <text x="${width - 192}" y="${height - 23}" fill="${muted}" font-family="${font}" font-size="16">dandandujie/Grox</text>
</svg>
`;
}

await Promise.all([
  writeFile(resolve(outputDirectory, "star-history.svg"), chart("light"), "utf8"),
  writeFile(resolve(outputDirectory, "star-history-dark.svg"), chart("dark"), "utf8"),
]);

console.log(`已生成 ${repository} Star History：${starredAt.length} Stars`);
