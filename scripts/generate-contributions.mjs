import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_USERNAME = "pricilaoliveirarocha";

const QUERY = `
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

// PALETTE: keep these values aligned with the legend in the generated SVG.
const COLORS = {
  NONE: "#161B22",
  FIRST_QUARTILE: "#57102E",
  SECOND_QUARTILE: "#A30D55",
  THIRD_QUARTILE: "#FF1493",
  FOURTH_QUARTILE: "#FF10F0",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function calculateStreaks(days) {
  let longest = 0;
  let running = 0;

  for (const day of days) {
    if (day.contributionCount > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  // GitHub may return today before the user has contributed, so one trailing
  // empty day is ignored when calculating the current streak.
  let index = days.length - 1;
  if (days[index]?.contributionCount === 0) index -= 1;

  let current = 0;
  for (; index >= 0 && days[index].contributionCount > 0; index -= 1) {
    current += 1;
  }

  return { current, longest };
}

export function renderContributionSvg(calendar, username = DEFAULT_USERNAME) {
  if (!calendar?.weeks?.length) {
    throw new Error(`No contribution calendar was returned for @${username}.`);
  }

  const weeks = calendar.weeks;
  const days = weeks
    .flatMap((week) => week.contributionDays)
    .sort((a, b) => a.date.localeCompare(b.date));
  const { current, longest } = calculateStreaks(days);

  // CALENDAR GEOMETRY: one responsive 1000 px canvas, matching the other assets.
  const xStart = 66;
  const xEnd = 934;
  const yStart = 80;
  const rowStep = 18;
  const xStep = weeks.length > 1 ? (xEnd - xStart) / (weeks.length - 1) : 16;
  const cellSize = Math.min(13, Math.max(10, xStep - 3));

  const monthLabels = [];
  let previousMonth = -1;
  let previousX = -Infinity;

  for (let index = 0; index < weeks.length; index += 1) {
    const date = new Date(`${weeks[index].firstDay}T00:00:00Z`);
    const month = date.getUTCMonth();
    const x = xStart + index * xStep;

    if (month !== previousMonth && x - previousX >= 45) {
      monthLabels.push(
        `<text x="${x.toFixed(1)}" y="68" fill="#8B949E" font-size="11">${MONTHS[month]}</text>`,
      );
      previousX = x;
    }
    previousMonth = month;
  }

  const cells = [];
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const x = xStart + weekIndex * xStep;

    for (const day of weeks[weekIndex].contributionDays) {
      const y = yStart + day.weekday * rowStep;
      const count = day.contributionCount;
      const level = day.contributionLevel in COLORS ? day.contributionLevel : "NONE";
      const noun = count === 1 ? "contribution" : "contributions";
      const begin = 0.55 + weekIndex * 0.022 + day.weekday * 0.006;
      const glow = level === "THIRD_QUARTILE" || level === "FOURTH_QUARTILE"
        ? ' filter="url(#cellGlow)"'
        : "";

      cells.push(
        `<rect x="${x.toFixed(1)}" y="${y}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" rx="2.5" fill="${COLORS[level]}" opacity="0"${glow}>` +
          `<title>${escapeXml(day.date)}: ${count} ${noun}</title>` +
          `<animate attributeName="opacity" from="0" to="1" begin="${begin.toFixed(2)}s" dur=".55s" fill="freeze"/>` +
        `</rect>`,
      );
    }
  }

  const total = Number(calendar.totalContributions) || 0;
  const safeUsername = escapeXml(username);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="285" viewBox="0 0 1000 285" role="img" aria-labelledby="contributions-title contributions-description">
  <title id="contributions-title">${safeUsername} GitHub contributions</title>
  <desc id="contributions-description">Dynamic animated contribution calendar with ${total} contributions, a current streak of ${current} days and a longest streak of ${longest} days.</desc>
  <defs>
    <!-- PALETTE: black, neon pink, white and neutral gray only. -->
    <linearGradient id="pinkLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FF1493" stop-opacity=".45"/>
      <stop offset=".5" stop-color="#FF10F0"/>
      <stop offset="1" stop-color="#FF1493" stop-opacity=".45"/>
    </linearGradient>
    <radialGradient id="pinkField" cx="50%" cy="48%" r="70%">
      <stop offset="0" stop-color="#FF1493" stop-opacity=".08"/>
      <stop offset="1" stop-color="#FF1493" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" fill="none" stroke="#FF1493" stroke-opacity=".04"/>
    </pattern>
    <filter id="cellGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2.3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="panelClip"><rect x="1" y="1" width="998" height="283" rx="16"/></clipPath>
    <clipPath id="calendarClip"><rect x="58" y="76" width="892" height="124" rx="4"/></clipPath>
  </defs>

  <!-- TERMINAL PANEL -->
  <rect x=".75" y=".75" width="998.5" height="283.5" rx="16" fill="#0D1117" stroke="#57102E" stroke-width="1.5"/>
  <g clip-path="url(#panelClip)">
    <rect x="1" y="1" width="998" height="283" fill="url(#grid)"/>
    <ellipse cx="500" cy="145" rx="470" ry="230" fill="url(#pinkField)">
      <animate attributeName="opacity" values=".45;.8;.45" dur="8s" repeatCount="indefinite"/>
    </ellipse>
  </g>

  <!-- WINDOW BAR -->
  <path d="M0 43H1000M0 226H1000" stroke="#8B949E" stroke-opacity=".27"/>
  <circle cx="24" cy="22" r="6" fill="#FF1493"/>
  <circle cx="43" cy="22" r="6" fill="#FF1493" fill-opacity=".62"/>
  <circle cx="62" cy="22" r="6" fill="#FF1493" fill-opacity=".28"/>
  <text x="500" y="28" text-anchor="middle" fill="#FFFFFF" fill-opacity=".8" font-family="Consolas,Menlo,monospace" font-size="13">${safeUsername}@github:~$ ./contributions.sh</text>

  <!-- MONTH AND WEEKDAY LABELS -->
  <g font-family="Consolas,Menlo,monospace">
    ${monthLabels.join("\n    ")}
    <text x="51" y="108" text-anchor="end" fill="#8B949E" font-size="11">Mon</text>
    <text x="51" y="144" text-anchor="end" fill="#8B949E" font-size="11">Wed</text>
    <text x="51" y="180" text-anchor="end" fill="#8B949E" font-size="11">Fri</text>
  </g>

  <!-- DYNAMIC CELLS: generated from the GitHub GraphQL contribution calendar. -->
  <g>
    ${cells.join("\n    ")}
  </g>

  <!-- LEFT-TO-RIGHT REVEAL, played once. -->
  <g clip-path="url(#calendarClip)" pointer-events="none">
    <rect x="58" y="76" width="892" height="124" fill="#0D1117">
      <animate attributeName="x" from="58" to="950" begin=".35s" dur="1.7s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1"/>
      <animate attributeName="width" from="892" to="0" begin=".35s" dur="1.7s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1"/>
    </rect>
  </g>

  <!-- REAL METRICS: no placeholder or simulated values. -->
  <text x="62" y="257" fill="#8B949E" font-family="Consolas,Menlo,monospace" font-size="12">
    <tspan fill="#FF1493" font-weight="700">${total}</tspan> contributions
    <tspan dx="14">current streak </tspan><tspan fill="#FF1493" font-weight="700">${current}</tspan> days
    <tspan dx="14">longest streak </tspan><tspan fill="#FF1493" font-weight="700">${longest}</tspan> days
  </text>

  <!-- LEGEND: exact contribution-level colors. -->
  <g font-family="Consolas,Menlo,monospace" font-size="11">
    <text x="790" y="257" text-anchor="end" fill="#8B949E">Less</text>
    <rect x="801" y="247" width="12" height="12" rx="2.5" fill="#161B22"/>
    <rect x="819" y="247" width="12" height="12" rx="2.5" fill="#57102E"/>
    <rect x="837" y="247" width="12" height="12" rx="2.5" fill="#A30D55"/>
    <rect x="855" y="247" width="12" height="12" rx="2.5" fill="#FF1493" filter="url(#cellGlow)"/>
    <rect x="873" y="247" width="12" height="12" rx="2.5" fill="#FF10F0" filter="url(#cellGlow)"/>
    <text x="895" y="257" fill="#8B949E">More</text>
  </g>
</svg>
`;
}

export async function fetchContributionCalendar(username, token) {
  if (!token) {
    throw new Error("Set GH_TOKEN or GITHUB_TOKEN before generating the contribution graph.");
  }

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `${username}-profile-readme`,
    },
    body: JSON.stringify({ query: QUERY, variables: { login: username } }),
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
  return calendar;
}

async function main() {
  const username = process.env.GITHUB_USERNAME || DEFAULT_USERNAME;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const outputPath = resolve(process.env.OUTPUT_PATH || "assets/contributions.svg");
  const calendar = await fetchContributionCalendar(username, token);
  const svg = renderContributionSvg(calendar, username);

  await writeFile(outputPath, svg, "utf8");
  console.log(`Updated ${outputPath} with ${calendar.totalContributions} contributions for @${username}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
