import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const username = process.env.GITHUB_USERNAME || "pricilaoliveirarocha";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const outputPath = resolve(process.env.OUTPUT_PATH || "assets/contributions.svg");

if (!token) {
  throw new Error("Set GH_TOKEN or GITHUB_TOKEN before generating the contribution graph.");
}

const query = `
  query ContributionCalendar($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays {
              contributionCount
              contributionLevel
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": `${username}-profile-readme`,
  },
  body: JSON.stringify({ query, variables: { login: username } }),
});

if (!response.ok) {
  throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();

if (payload.errors?.length) {
  throw new Error(`GitHub GraphQL error: ${payload.errors.map(({ message }) => message).join("; ")}`);
}

const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;

if (!calendar?.weeks?.length) {
  throw new Error(`No contribution calendar was returned for @${username}.`);
}

const colors = {
  NONE: "#11162a",
  FIRST_QUARTILE: "#31205f",
  SECOND_QUARTILE: "#6d28d9",
  THIRD_QUARTILE: "#db2777",
  FOURTH_QUARTILE: "#53e3ff",
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weeks = calendar.weeks;
const allDays = weeks
  .flatMap((week) => week.contributionDays)
  .sort((a, b) => a.date.localeCompare(b.date));

const total = calendar.totalContributions;
const bestDay = allDays.reduce((maximum, day) => Math.max(maximum, day.contributionCount), 0);

let longestStreak = 0;
let runningStreak = 0;
for (const day of allDays) {
  if (day.contributionCount > 0) {
    runningStreak += 1;
    longestStreak = Math.max(longestStreak, runningStreak);
  } else {
    runningStreak = 0;
  }
}

let currentIndex = allDays.length - 1;
if (allDays[currentIndex]?.contributionCount === 0) currentIndex -= 1;

let currentStreak = 0;
for (; currentIndex >= 0; currentIndex -= 1) {
  if (allDays[currentIndex].contributionCount === 0) break;
  currentStreak += 1;
}

const xStart = 62;
const xEnd = 738;
const xStep = weeks.length > 1 ? (xEnd - xStart) / (weeks.length - 1) : 13;
const cellSize = Math.min(10, Math.max(8, xStep - 3));

const monthLabels = [];
let previousMonth = -1;
let previousLabelX = -Infinity;

for (let index = 0; index < weeks.length; index += 1) {
  const weekDate = new Date(`${weeks[index].firstDay}T00:00:00Z`);
  const month = weekDate.getUTCMonth();
  const x = xStart + index * xStep;

  if (month !== previousMonth && x - previousLabelX >= 38) {
    monthLabels.push(`<text x="${x.toFixed(1)}" y="56" font-size="10.5" fill="#94a3b8">${monthNames[month]}</text>`);
    previousLabelX = x;
  }

  previousMonth = month;
}

const cells = [];

for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
  const x = xStart + weekIndex * xStep;

  for (const day of weeks[weekIndex].contributionDays) {
    const y = 66 + day.weekday * 13;
    const count = day.contributionCount;
    const noun = count === 1 ? "contribution" : "contributions";
    const begin = 0.25 + weekIndex * 0.018 + day.weekday * 0.008;

    cells.push(
      `<rect x="${x.toFixed(1)}" y="${y}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" rx="2" fill="${colors[day.contributionLevel] || colors.NONE}" opacity="0">` +
        `<title>${day.date}: ${count} ${noun}</title>` +
        `<animate attributeName="opacity" from="0" to="1" begin="${begin.toFixed(2)}s" dur="0.9s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>` +
      `</rect>`,
    );
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" width="800" height="200" role="img" aria-label="Animated contribution matrix for Pricila Oliveira" font-family="Consolas,Menlo,monospace">
<defs>
  <linearGradient id="panelBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#030712"/><stop offset="0.62" stop-color="#0b1022"/><stop offset="1" stop-color="#170820"/></linearGradient>
  <linearGradient id="panelBorder" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="0.5" stop-color="#7c3aed" stop-opacity=".45"/><stop offset="1" stop-color="#ff3cac"/></linearGradient>
  <pattern id="panelGrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#53e3ff" stroke-opacity=".05"/><animateTransform attributeName="patternTransform" type="translate" from="0 0" to="26 26" dur="10s" repeatCount="indefinite"/></pattern>
  <clipPath id="calendarGrid"><rect x="60" y="64" width="690" height="92" rx="3"/></clipPath>
  <clipPath id="panel"><rect x="1" y="1" width="798" height="198" rx="12"/></clipPath>
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#53e3ff" stop-opacity="0"/><stop offset="0.5" stop-color="#53e3ff" stop-opacity="0.14"/><stop offset="1" stop-color="#53e3ff" stop-opacity="0"/></linearGradient>
  <linearGradient id="scan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#53e3ff" stop-opacity="0"/><stop offset=".5" stop-color="#a78bfa" stop-opacity=".18"/><stop offset="1" stop-color="#ff4fb3" stop-opacity="0"/></linearGradient>
  <radialGradient id="cyanField"><stop offset="0" stop-color="#22d3ee" stop-opacity=".2"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
  <radialGradient id="pinkField"><stop offset="0" stop-color="#ff3cac" stop-opacity=".18"/><stop offset="1" stop-color="#ff3cac" stop-opacity="0"/></radialGradient>
</defs>
<rect x=".75" y=".75" width="798.5" height="198.5" rx="13" fill="url(#panelBg)" stroke="url(#panelBorder)" stroke-width="1.5"/>
<g clip-path="url(#panel)">
  <ellipse cx="90" cy="105" rx="210" ry="135" fill="url(#cyanField)"><animate attributeName="cx" values="70;250;70" dur="10s" repeatCount="indefinite"/><animate attributeName="opacity" values=".35;.8;.35" dur="7s" repeatCount="indefinite"/></ellipse>
  <ellipse cx="710" cy="105" rx="210" ry="135" fill="url(#pinkField)"><animate attributeName="cx" values="730;550;730" dur="12s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;.3;.8" dur="8s" repeatCount="indefinite"/></ellipse>
  <rect x="1" y="1" width="798" height="198" rx="12" fill="url(#panelGrid)"/>
  <rect x="-220" y="0" width="180" height="200" fill="url(#scan)" transform="skewX(-16)"><animate attributeName="x" from="-220" to="920" dur="8s" repeatCount="indefinite"/></rect>
  <path d="M-40 47C120 25 220 70 380 46S650 22 840 48" fill="none" stroke="#53e3ff" stroke-opacity=".09" stroke-dasharray="8 14"><animate attributeName="stroke-dashoffset" from="44" to="0" dur="4s" repeatCount="indefinite"/></path>
</g>
<rect x="2" y="2" width="796" height="196" rx="11" fill="none" stroke="url(#panelBorder)" stroke-opacity=".6" stroke-dasharray="96 28"><animate attributeName="stroke-dashoffset" from="248" to="0" dur="7s" repeatCount="indefinite"/></rect>
<path d="M0 36H800" stroke="#23304e"/>
<circle cx="20" cy="18" r="5" fill="#ff5f57"/><circle cx="36" cy="18" r="5" fill="#febc2e"/><circle cx="52" cy="18" r="5" fill="#28c840"/>
<text x="400" y="22" text-anchor="middle" font-size="11" fill="#94a3b8">pricila@github: ~ $ ./contributions.sh</text>
${monthLabels.join("\n")}
<text x="52" y="87.5" font-size="10" fill="#94a3b8" text-anchor="end">Mon</text>
<text x="52" y="113.5" font-size="10" fill="#94a3b8" text-anchor="end">Wed</text>
<text x="52" y="139.5" font-size="10" fill="#94a3b8" text-anchor="end">Fri</text>
<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="2.2s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>
${cells.join("\n")}
</g>
<g clip-path="url(#calendarGrid)"><rect x="0" y="64" width="150" height="92" fill="url(#sweep)" opacity="0"><animate attributeName="opacity" values="0;.65;0" keyTimes="0;.5;1" dur="15s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" from="-160 0" to="860 0" dur="15s" repeatCount="indefinite"/></rect></g>
<text x="62" y="176" font-size="10.5" fill="#94a3b8"><tspan fill="#53e3ff" font-weight="700">${total}</tspan> contributions · current streak <tspan fill="#53e3ff">${currentStreak}</tspan>d · longest streak <tspan fill="#53e3ff">${longestStreak}</tspan>d · daily record <tspan fill="#53e3ff">${bestDay}</tspan></text>
<text x="612" y="176" font-size="10.5" fill="#94a3b8" text-anchor="end">Less</text>
<rect x="622" y="167" width="10" height="10" rx="2" fill="#11162a"/><rect x="636" y="167" width="10" height="10" rx="2" fill="#31205f"/><rect x="650" y="167" width="10" height="10" rx="2" fill="#6d28d9"/><rect x="664" y="167" width="10" height="10" rx="2" fill="#db2777"/><rect x="678" y="167" width="10" height="10" rx="2" fill="#53e3ff"/>
<text x="696" y="176" font-size="10.5" fill="#94a3b8">More</text>
</svg>
`;

await writeFile(outputPath, svg, "utf8");
console.log(`Updated ${outputPath} with ${total} contributions for @${username}.`);
