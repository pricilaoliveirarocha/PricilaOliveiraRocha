import assert from "node:assert/strict";
import { renderContributionSvg } from "./generate-contributions.mjs";

const days = Array.from({ length: 14 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 0, 4 + index));
  const contributionCount = index % 4;
  return {
    date: date.toISOString().slice(0, 10),
    weekday: date.getUTCDay(),
    contributionCount,
    contributionLevel: ["NONE", "FIRST_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"][contributionCount],
  };
});

const weeks = [0, 7].map((offset) => ({
  firstDay: days[offset].date,
  contributionDays: days.slice(offset, offset + 7),
}));
const svg = renderContributionSvg({ totalContributions: 19, weeks }, "test-user");

assert.match(svg, /width="1000" height="285"/);
assert.match(svg, /19<\/tspan> contributions/);
assert.match(svg, /test-user@github/);
assert.equal((svg.match(/<title>2026-/g) ?? []).length, 14);
assert.ok(["#161B22", "#57102E", "#A30D55", "#FF1493", "#FF10F0"].every((color) => svg.includes(color)));
console.log("Contribution renderer test passed.");
