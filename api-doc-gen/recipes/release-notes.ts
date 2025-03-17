import { copy, copyText, exec, tmpdir, vars } from "@vertesia/memory-commands";

const { start, end, milestone } = vars();
if (!start || !end) {
    console.error("Please provide start and end tags using --var-start and --var-end");
    process.exit(1);
}

const cwd = tmpdir();

console.log(`Retrieving issues between ${start} and ${end}...`)

// Get GitHub reference IDs (issue or pull-request) from commit messages
// Commits having the hashtag, like "Fix #123" => 123
const hashtagIds = await exec(`git log ${start}..${end} --oneline | grep -o -E '#[0-9]+' | sed 's/#//'`) as string;
// Commits with patterns like "fix(456) ..." or "feat(456) ..." => 456
const patternIds = await exec(`git log ${start}..${end} --oneline | grep -o -E '\\([0-9]+\\)' | sed 's/[()]//g'`) as string;

const issueIds = new Set<string>();
if (milestone) {
    console.log(`Retrieving issues for milestone ${milestone}...`)
    const content = await exec(`gh issue list --milestone "${milestone}" --state all --json number --jq '.[].number'`) as string;
    content.trim().split("\n").forEach(v => issueIds.add(v));
}

const unsortedReferenceIds = new Set(`${hashtagIds}\n${patternIds}`.trim().split("\n").map(v => v.trim()).map(Number));
const referenceIds = Array.from(unsortedReferenceIds).sort((a, b) => a - b);
console.log(`Found ${referenceIds.length} references`);

for (const reference of referenceIds) {
    console.log(`Processing reference #${reference}`)
    let content = await exec(`gh pr view ${reference}`) as string;
    if (content) {
        copyText(content, `pull_requests/${reference}.txt`);
    } else {
        console.debug(`Failed to get content as pull-request for #${reference}, trying as issue`);
        content = await exec(`gh issue view ${reference}`) as string;
        copyText(content, `issues/${reference}.txt`);
        issueIds.delete(`${reference}`);
    }
}

for (const issue of issueIds) {
    console.log(`Processing reference #${issue}`)
    let content = await exec(`gh issue view ${issue}`) as string;
    copyText(content, `issues/${issue}.txt`);
}

console.log("Generating commits and diff");

// We use git-log to get authors and commit messages.
// We don't include the diff in this file, as it's too much information for the LLM.
// We use ".." to see the commits that are unique to the right side (end)
await exec(`git log --submodule=diff ${start}..${end} -- ':!docs/changelog/*' > ${cwd}/commits.txt`)
copy(`${cwd}/commits.txt`, "commits.txt");

// We use "..." to compare the right side (end) to the merge base. We don't use ".."
// because we don't want to compare two refs directly.
await exec(`git diff --submodule=diff ${start}...${end} -- ':!docs/changelog/*' > ${cwd}/range_diff.txt`)
copy(`${cwd}/range_diff.txt`, "range_diff.txt");

export default {
    from_version: start,
    release_version: end,
}
