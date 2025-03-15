#!/usr/bin/env ts-node

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";
import { Octokit } from "@octokit/rest";
import * as dotenv from "dotenv";
import { VertesiaClient } from "@vertesia/client";
import { encoding_for_model, type TiktokenModel } from "tiktoken";

// Load environment variables from .env file
dotenv.config();

// Type definitions
interface Issue {
    number: number;
    title: string;
    body: string;
    state: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    labels: Array<{
        name: string;
        color: string;
    }>;
    user: {
        login: string;
        avatar_url?: string;
        html_url?: string;
    };
    assignees?: Array<{
        login: string;
        avatar_url?: string;
        html_url?: string;
    }>;
    pull_request?: {
        url: string;
        html_url: string;
    };
    milestone?: {
        title: string;
        number: number;
        html_url: string;
    };
}

interface Diff {
    filename: string;
    content: string;
}

interface IssueCache {
    issues: Record<number, Issue>;
    timestamp: number;
    repository: string;
}

// Set up command-line interface with Commander
const program = new Command();
program
    .name("release-notes-generator")
    .description("Generate release notes between two git tags")
    .version("1.0.0")
    .requiredOption("-r, --repo <owner/repo>", "GitHub repository in owner/repo format")
    .requiredOption("-s, --start-tag <tag>", "Starting tag for comparison")
    .requiredOption("-e, --end-tag <tag>", "Ending tag for comparison")
    .option("-o, --output-dir <directory>", "Output directory for generated files", "./output")
    .option("-g, --github-token <token>", "GitHub API token", process.env.GITHUB_TOKEN)
    .option("-v, --verbose", "Enable verbose output")
    .option("-t, --vertesia-auth-token <token>", "Vertesia auth token", process.env.VERTESIA_AUTH_TOKEN)
    .option("--token-limit <number>", "Maximum token limit for API requests", "18000")
    .option("--model <string>", "Model to use for AI generation")
    .option("--environment <string>", "Vertesia environment ID")

    .parse(process.argv);

const options = program.opts();

/**
 * Logger function that respects verbose flag
 */
function log(message: string, alwaysLog = false): void {
    if (options.verbose || alwaysLog) {
        console.log(message);
    }
}

/**
 * Extract GitHub repository owner and name
 */
function extractRepoInfo(repo: string): { owner: string; repo: string } {
    const parts = repo.split("/");
    if (parts.length !== 2) {
        throw new Error(`Invalid repository format: ${repo}. Expected format: owner/repo`);
    }
    if (!parts[0] || !parts[1]) {
        throw new Error(`Invalid repository format: ${repo}. Expected format: owner/repo`);
    }
    return { owner: parts[0], repo: parts[1] };
}

/**
 * Initialize GitHub client
 */
function initGitHubClient(token?: string): Octokit {
    if (!token) {
        console.warn("⚠️ No GitHub token provided. API requests may be rate-limited.");
        console.warn("Set GITHUB_TOKEN environment variable or use --github-token option.");
    }

    return new Octokit({
        auth: token,
        userAgent: "release-notes-generator",
        timeZone: "UTC",
        log: options.verbose ? console : undefined,
    });
}

/**
 * Count tokens in a string using tiktoken
 */
function countTokens(text: string, model: TiktokenModel = "gpt-4"): number {
    try {
        const encoder = encoding_for_model(model);
        const tokens = encoder.encode(text);
        encoder.free();
        return tokens.length;
    } catch (error) {
        log(`Error counting tokens: ${(error as any).message}`);
        // Fallback to rough estimation if tiktoken fails
        return Math.ceil(text.length / 4);
    }
}

/**
 * Checkout or update repository
 */
function checkoutRepo(repoUrl: string, repoPath: string): void {
    if (!fs.existsSync(repoPath)) {
        console.log(`Cloning repository: ${repoUrl}`);
        execSync(`git clone ${repoUrl} ${repoPath}`, { stdio: "inherit" });
    } else {
        console.log(`Pulling latest changes from: ${repoUrl}`);
        execSync("git fetch --all", { cwd: repoPath, stdio: "inherit" });
    }

    // Make sure we have all the tags
    execSync("git fetch --tags", { cwd: repoPath, stdio: "inherit" });
}

/**
 * Load issue cache from file
 */
function loadIssueCache(outputDir: string, owner: string, repo: string): IssueCache | null {
    const cacheFile = path.join(outputDir, "issue-cache.json");

    try {
        if (fs.existsSync(cacheFile)) {
            const cacheData = fs.readFileSync(cacheFile, "utf-8");
            const cache = JSON.parse(cacheData) as IssueCache;

            // Check if cache is for the same repository
            if (cache.repository === `${owner}/${repo}`) {
                // Check if cache is fresh (less than 24 hours old)
                const cacheAge = Date.now() - cache.timestamp;
                const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

                if (cacheAge < maxCacheAge) {
                    log(
                        `Using issue cache (${Object.keys(cache.issues).length} issues, ${Math.round(cacheAge / (60 * 60 * 1000))} hours old)`,
                        true,
                    );
                    return cache;
                } else {
                    log(
                        `Cache is too old (${Math.round(cacheAge / (60 * 60 * 1000))} hours), fetching fresh data`,
                        true,
                    );
                }
            } else {
                log(`Cache is for different repository (${cache.repository}), fetching fresh data`, true);
            }
        }
    } catch (error) {
        log(`Failed to load issue cache: ${(error as any).message}`, true);
    }

    return null;
}

/**
 * Save issue cache to file
 */
function saveIssueCache(outputDir: string, issues: Issue[], owner: string, repo: string): void {
    const issuesMap: Record<number, Issue> = {};
    issues.forEach((issue) => {
        issuesMap[issue.number] = issue;
    });

    const cache: IssueCache = {
        issues: issuesMap,
        timestamp: Date.now(),
        repository: `${owner}/${repo}`,
    };

    const cacheFile = path.join(outputDir, "issue-cache.json");
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), "utf-8");
    log(`Saved ${issues.length} issues to cache`, true);
}

/**
 * Get commits between two tags (using GitHub API when possible)
 */
async function getCommitsBetweenTags(
    repoPath: string,
    startTag: string,
    endTag: string,
    octokit?: Octokit,
    owner?: string,
    repo?: string,
): Promise<string[]> {
    log(`Getting commits between ${startTag} and ${endTag}`, true);

    // Try to use GitHub API first if we have credentials
    if (octokit && owner && repo) {
        try {
            log(`Attempting to fetch commits from GitHub API...`);

            const { data } = await octokit.repos.compareCommits({
                owner,
                repo,
                base: startTag,
                head: endTag,
            });

            if (data.commits && data.commits.length > 0) {
                log(`Found ${data.commits.length} commits via GitHub API`);
                return data.commits.map((commit) => commit.sha);
            } else {
                log(`No commits found between tags via GitHub API`);
            }
        } catch (error) {
            log(`Failed to get commits from GitHub API: ${(error as any).message}`);
            log("Falling back to local git command...");
        }
    }

    // Fallback to using local git
    log("Using local git to get commits");

    // Make sure the tags exist
    execSync(`git fetch --tags`, { cwd: repoPath });

    // Get commit range
    const range = `${startTag}..${endTag}`;
    const output = execSync(`git log ${range} --pretty=format:"%H"`, {
        cwd: repoPath,
        encoding: "utf-8",
    });

    if (!output.trim()) {
        console.warn(`⚠️ No commits found between tags ${startTag} and ${endTag}`);
        return [];
    }

    const commits = output.trim().split("\n").filter(Boolean);
    log(`Found ${commits.length} commits via git command`);
    return commits;
}

/**
 * Extract issue numbers from commit messages (using GitHub API when possible)
 */
async function extractIssueNumbers(
    repoPath: string,
    commits: string[],
    octokit?: Octokit,
    owner?: string,
    repo?: string,
): Promise<number[]> {
    log("Extracting issue numbers from commit messages");

    const issueNumbers = new Set<number>();

    // Try to use GitHub API first if we have credentials
    if (octokit && owner && repo && commits.length > 0) {
        try {
            log(`Attempting to fetch commit messages from GitHub API...`);

            // Process in batches to avoid API rate limits
            const batchSize = 5;
            for (let i = 0; i < commits.length; i += batchSize) {
                const batch = commits.slice(i, i + batchSize);

                // Create promises for each commit
                const commitPromises = batch.map((sha) =>
                    octokit.repos
                        .getCommit({
                            owner,
                            repo,
                            ref: sha,
                        })
                        .then((response) => {
                            const message = response.data.commit.message;

                            // Extract issue numbers from message
                            const matches = message.match(/#(\d+)/g);
                            if (matches) {
                                matches.forEach((match) => {
                                    const issueNumber = parseInt(match.substring(1), 10);
                                    issueNumbers.add(issueNumber);
                                });
                            }
                        })
                        .catch((error) => {
                            log(`Failed to fetch commit ${sha}: ${error.message}`);
                        }),
                );

                // Wait for all commits in this batch
                await Promise.all(commitPromises);

                // If we have more batches to go, wait a bit
                if (i + batchSize < commits.length) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }

            // If we found issue numbers, return them
            if (issueNumbers.size > 0) {
                log(`Found ${issueNumbers.size} issue references via GitHub API`);
                return Array.from(issueNumbers).sort((a, b) => a - b);
            }
        } catch (error) {
            log(`Failed to extract issue numbers from GitHub API: ${(error as any).message}`);
            log("Falling back to local git command...");
        }
    }

    // Fallback to using local git
    log("Using local git to extract issue numbers");

    for (const commit of commits) {
        const message = execSync(`git show -s --format=%B ${commit}`, {
            cwd: repoPath,
            encoding: "utf-8",
        });

        // Look for issue references like #123, issue #123, fixes #123, closes #123, etc.
        const matches = message.match(/#(\d+)/g);
        if (matches) {
            matches.forEach((match) => {
                const issueNumber = parseInt(match.substring(1), 10);
                issueNumbers.add(issueNumber);
            });
        }
    }

    return Array.from(issueNumbers).sort((a, b) => a - b);
}

/**
 * Fetch issue details from GitHub API with caching
 */
async function fetchIssues(
    octokit: Octokit,
    owner: string,
    repo: string,
    issueNumbers: number[],
    outputDir: string,
): Promise<Issue[]> {
    log(`Preparing to fetch ${issueNumbers.length} issues from GitHub API`);

    // Try to load cache first
    const cache = loadIssueCache(outputDir, owner, repo);
    const issues: Issue[] = [];

    // Separate issues that need to be fetched vs those in cache
    const issuesToFetch: number[] = [];

    if (cache) {
        for (const issueNumber of issueNumbers) {
            if (cache.issues[issueNumber]) {
                log(`Using cached issue #${issueNumber}`);
                issues.push(cache.issues[issueNumber]);
            } else {
                issuesToFetch.push(issueNumber);
            }
        }

        log(`Found ${issues.length} issues in cache, need to fetch ${issuesToFetch.length} more`);
    } else {
        issuesToFetch.push(...issueNumbers);
        log(`No usable cache found, fetching all ${issuesToFetch.length} issues`);
    }

    // If we have issues to fetch, do it
    if (issuesToFetch.length > 0) {
        // Check rate limits first
        try {
            const { data: rateLimit } = await octokit.rateLimit.get();
            log(
                `GitHub API rate limit: ${rateLimit.resources.core.remaining}/${rateLimit.resources.core.limit} remaining`,
            );

            if (rateLimit.resources.core.remaining < issuesToFetch.length) {
                const resetDate = new Date(rateLimit.resources.core.reset * 1000);
                console.warn(
                    `⚠️ Warning: GitHub API rate limit is low. Limit resets at ${resetDate.toLocaleTimeString()}`,
                );
            }
        } catch (error) {
            // Continue even if we can't check rate limits
            log("Could not check GitHub API rate limits");
        }

        // Batch issues in groups to avoid making too many sequential requests
        const batchSize = 10;
        const fetchedIssues: Issue[] = [];

        for (let i = 0; i < issuesToFetch.length; i += batchSize) {
            const batch = issuesToFetch.slice(i, i + batchSize);
            const batchPromises = batch.map((issueNumber) =>
                octokit.issues
                    .get({
                        owner,
                        repo,
                        issue_number: issueNumber,
                    })
                    .then((response) => {
                        log(`Fetched issue #${issueNumber}`);
                        return response.data as unknown as Issue;
                    })
                    .catch((error) => {
                        console.error(`Failed to fetch issue #${issueNumber}:`, error.message);
                        return null;
                    }),
            );

            // Wait for all requests in this batch to complete
            const batchResults = await Promise.all(batchPromises);
            const validIssues = batchResults.filter(Boolean) as Issue[];
            fetchedIssues.push(...validIssues);

            // If we have more batches to go, wait to avoid hitting rate limits
            if (i + batchSize < issuesToFetch.length) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        // Add the newly fetched issues to the result list
        issues.push(...fetchedIssues);

        // Update the cache with the new issues
        if (fetchedIssues.length > 0) {
            // If we have an existing cache, update it
            if (cache) {
                // Add newly fetched issues to the cached issues
                const updatedIssues = [...Object.values(cache.issues), ...fetchedIssues];
                saveIssueCache(outputDir, updatedIssues, owner, repo);
            } else {
                // Create a new cache
                saveIssueCache(outputDir, issues, owner, repo);
            }
        }
    }

    return issues;
}

/**
 * Save issues to files
 */
function saveIssuesToFiles(issues: Issue[], outputDir: string): void {
    console.log(`Saving ${issues.length} issues to files`);

    const issuesDir = path.join(outputDir, "issues");
    fs.mkdirSync(issuesDir, { recursive: true });

    // Save as JSON
    fs.writeFileSync(path.join(issuesDir, "issues.json"), JSON.stringify(issues, null, 2), "utf-8");
    // Save as individual markdown files
    for (const issue of issues) {
        const markdown = `# Issue #${issue.number}: ${issue.title}

## Details
- State: ${issue.state}
- Created: ${issue.created_at}
- Updated: ${issue.updated_at}
- Closed: ${issue.closed_at || "Not closed"}
- URL: ${issue.html_url}
- Author: ${issue.user.login}

## Labels
${issue.labels.map((label) => `- ${label.name}`).join("\n")}

## Description
${issue.body || "No description provided."}
`;
        fs.writeFileSync(path.join(issuesDir, `issue-${issue.number}.md`), markdown, "utf-8");
        console.log(`✅ Successfully saved issue #${issue.number} to file`);
    }
}

/**
 * Get and filter diffs between tags using GitHub API when possible
 */
async function getDiffsBetweenTags(
    repoPath: string,
    startTag: string,
    endTag: string,
    octokit?: Octokit,
    owner?: string,
    repo?: string,
): Promise<Diff[]> {
    log(`Getting diffs between ${startTag} and ${endTag}`);

    const diffs: Diff[] = [];

    // Define source file extensions to include
    const sourceFileExtensions = [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".java",
        ".py",
        ".rb",
        ".c",
        ".cpp",
        ".h",
        ".hpp",
        ".cs",
        ".go",
        ".rs",
        ".php",
        ".swift",
        ".kt",
        ".scala",
    ];

    // Filter directories to exclude
    const excludeDirs = [
        "node_modules/",
        "/dist/",
        "/build/",
        "/vendor/",
        "/generated/",
        ".git/",
        "/temp/",
        "/tmp/",
        "/cache/",
    ];

    // Try to get the compare data from GitHub API first if we have credentials
    if (octokit && owner && repo) {
        try {
            log(`Attempting to fetch diff from GitHub API...`);
            const { data } = await octokit.repos.compareCommits({
                owner,
                repo,
                base: startTag,
                head: endTag,
            });

            log(`GitHub API reports ${data.files?.length || 0} changed files`);

            // Filter and process the files from GitHub API
            if (data.files && data.files.length > 0) {
                for (const file of data.files) {
                    // Skip if filename is undefined
                    if (!file.filename) continue;

                    // Filter by extension
                    const ext = path.extname(file.filename).toLowerCase();
                    if (!sourceFileExtensions.includes(ext)) {
                        log(`Skipping non-source file: ${file.filename}`);
                        continue;
                    }

                    // Filter by directory
                    if (excludeDirs.some((dir) => file.filename.includes(dir))) {
                        log(`Skipping excluded directory file: ${file.filename}`);
                        continue;
                    }

                    // Get the diff content
                    let diffContent = "";

                    if (file.patch) {
                        diffContent = file.patch;
                    } else {
                        // If patch is not available, try to get the raw content
                        if (file.raw_url) {
                            try {
                                const response = await fetch(file.raw_url);
                                const content = await response.text();
                                diffContent = `@@ -0,0 +1,${content.split("\n").length} @@\n${content}`;
                            } catch (error) {
                                log(`Failed to fetch raw content: ${(error as any).message}`);
                            }
                        }
                    }

                    if (diffContent) {
                        diffs.push({
                            filename: file.filename,
                            content: diffContent,
                        });
                    }
                }

                if (diffs.length > 0) {
                    log(`Successfully fetched ${diffs.length} diffs from GitHub API`);
                    return diffs;
                }
            }
        } catch (error) {
            log(`Failed to get diffs from GitHub API: ${(error as any).message}`);
            log("Falling back to local git command...");
        }
    }

    // Fallback to using local git command
    log("Using local git to get diffs");

    // Get list of changed files
    const filesOutput = execSync(`git diff --name-only ${startTag} ${endTag}`, { cwd: repoPath, encoding: "utf-8" });

    const files = filesOutput.trim().split("\n").filter(Boolean);
    log(`Found ${files.length} changed files using git`);

    for (const file of files) {
        // Skip non-source files, build artifacts, etc.
        const ext = path.extname(file).toLowerCase();
        if (!sourceFileExtensions.includes(ext)) {
            log(`Skipping non-source file: ${file}`);
            continue;
        }

        // Skip files in excluded directories
        if (excludeDirs.some((dir) => file.includes(dir))) {
            log(`Skipping excluded directory file: ${file}`);
            continue;
        }

        try {
            // Get diff content
            const diffContent = execSync(`git diff ${startTag} ${endTag} -- "${file}"`, {
                cwd: repoPath,
                encoding: "utf-8",
            });

            diffs.push({
                filename: file,
                content: diffContent,
            });
        } catch (error) {
            console.error(`Failed to get diff for file ${file}:`, error);
        }
    }

    return diffs;
}

/**
 * Save diffs to files
 */
function saveDiffsToFiles(diffs: Diff[], outputDir: string): void {
    console.log(`Saving ${diffs.length} diffs to files`);

    const diffsDir = path.join(outputDir, "diffs");
    fs.mkdirSync(diffsDir, { recursive: true });

    // Save combined diff
    const combinedContent = diffs
        .map((diff) => `# ${diff.filename}\n\n\`\`\`diff\n${diff.content}\n\`\`\``)
        .join("\n\n---\n\n");

    fs.writeFileSync(path.join(diffsDir, "combined-diff.md"), combinedContent, "utf-8");

    // Save individual diff files
    for (const diff of diffs) {
        const safeFilename = diff.filename.replace(/\//g, "_");
        fs.writeFileSync(path.join(diffsDir, `${safeFilename}.diff`), diff.content, "utf-8");
    }
}

// Add a function to dynamically reduce content based on token count
function reduceContentToTokenLimit(
    issuesJson: string,
    diffJson: string,
    targetTokenLimit: number = 80000,
): { issues: string; diffs: string } {
    let issuesObj = JSON.parse(issuesJson);
    let diffsObj = JSON.parse(diffJson);

    let currentTokens = countTokens(issuesJson) + countTokens(diffJson);
    log(`Current token count: ${currentTokens}, target: ${targetTokenLimit}`, true);

    // If we're already under the limit, return unchanged
    if (currentTokens <= targetTokenLimit) {
        return { issues: issuesJson, diffs: diffJson };
    }

    // Reduction strategies in order of preference

    // 1. First, truncate issue bodies more aggressively
    if (currentTokens > targetTokenLimit) {
        const newBodyLength = 150;
        issuesObj = issuesObj.map((issue: any) => ({
            ...issue,
            body: issue.body?.length > newBodyLength ? issue.body.substring(0, newBodyLength) + "..." : issue.body,
        }));

        // Recompute tokens
        const newIssuesJson = JSON.stringify(issuesObj, null, 2);
        currentTokens = countTokens(newIssuesJson) + countTokens(diffJson);
        log(`After body truncation: ${currentTokens} tokens`, true);
        issuesJson = newIssuesJson;
    }

    // 2. Then, reduce the number of diffs
    if (currentTokens > targetTokenLimit && diffsObj.length > 5) {
        diffsObj = diffsObj.slice(0, 5);
        const newDiffJson = JSON.stringify(diffsObj, null, 2);
        currentTokens = countTokens(issuesJson) + countTokens(newDiffJson);
        log(`After reducing diffs to 5: ${currentTokens} tokens`, true);
        diffJson = newDiffJson;
    }

    // 3. Finally, if still too large, reduce the number of issues
    if (currentTokens > targetTokenLimit && issuesObj.length > 10) {
        issuesObj = issuesObj.slice(0, 10);
        const newIssuesJson = JSON.stringify(issuesObj, null, 2);
        currentTokens = countTokens(newIssuesJson) + countTokens(diffJson);
        log(`After reducing issues to 10: ${currentTokens} tokens`, true);
        issuesJson = newIssuesJson;
    }

    log(`Final token count: ${currentTokens}`, true);
    return { issues: issuesJson, diffs: diffJson };
}

/**
 * Get Vertesia auth token from various sources
 */
function getVertesiaAuthToken(): string | undefined {
    // First check if auth token is directly provided
    if (options.vertesiaAuthToken) {
        return options.vertesiaAuthToken;
    }

    // Check for environment variables
    return process.env.VERTESIA_AUTH_TOKEN;
}

/**
 * Generate release notes using Vertesia client
 */
async function generateReleaseNotesWithVertesia(
    issues: Issue[],
    diffs: Diff[],
    startTag: string,
    endTag: string,
    options: {
        tokenLimit?: number;
        model?: string;
        environment?: string;
    } = {},
): Promise<string> {
    log("Generating release notes using Vertesia client");
    const { tokenLimit = 80000, model, environment } = options;

    // Get auth token
    const apikey = getVertesiaAuthToken();
    if (!apikey) {
        throw new Error(
            "Vertesia auth token not found. Set VERTESIA_AUTH_TOKEN environment variable or use --vertesia-auth-token option",
        );
    }

    // Initialize client
    const client = new VertesiaClient({
        storeUrl: "https://api-preview.vertesia.io",
        serverUrl: "https://api-preview.vertesia.io",
        apikey,
    });

    // Filter and process issues
    const relevantIssues = issues
        .filter((issue) => issue.state === "closed")
        .map((issue) => ({
            number: issue.number,
            title: issue.title,
            body: issue.body?.length > 5000 ? issue.body.substring(0, 5000) + "..." : issue.body,
            labels: issue.labels.map((l) => l.name),
            author: issue.user.login,
            closed_at: issue.closed_at,
        }));

    // Sample diffs if there are too many
    let processedDiffs = diffs;
    if (diffs.length > 150) {
        processedDiffs = diffs.sort((a, b) => b.content.length - a.content.length).slice(0, 150);
    }

    // Process diffs to reduce size
    const diffSummaries = processedDiffs.map((diff) => {
        const lines = diff.content.split("\n");
        const addedLines = lines.filter((line) => line.startsWith("+")).length;
        const removedLines = lines.filter((line) => line.startsWith("-")).length;

        return {
            filename: diff.filename,
            added: addedLines,
            removed: removedLines,
            sample: diff.content.length > 5000 ? diff.content.substring(0, 5000) + "..." : diff.content,
        };
    });

    // Convert to strings to prepare for API and count tokens
    const issuesJson = JSON.stringify(relevantIssues, null, 2);
    const diffJson = JSON.stringify(diffSummaries, null, 2);

    // Count tokens for each field
    const issuesTokens = countTokens(issuesJson);
    const diffTokens = countTokens(diffJson);
    const startTagTokens = countTokens(startTag);
    const endTagTokens = countTokens(endTag);

    const totalTokens = issuesTokens + diffTokens + startTagTokens + endTagTokens;

    // Log token counts
    log("Token count breakdown:", true);
    log(`- Issues: ${issuesTokens} tokens`, true);
    log(`- Diffs: ${diffTokens} tokens`, true);
    log(`- Start tag: ${startTagTokens} tokens`, true);
    log(`- End tag: ${endTagTokens} tokens`, true);
    log(`- TOTAL: ${totalTokens} tokens`, true);

    // If total tokens are still too high, provide warning
    if (totalTokens > 180000) {
        log("⚠️ WARNING: Total token count is very high. Consider further reducing input size.", true);
    }

    // Reduce content to fit within token limits
    const { issues: finalIssuesJson, diffs: finalDiffJson } = reduceContentToTokenLimit(
        issuesJson,
        diffJson,
        tokenLimit,
    );

    // Prepare parameters for the interaction
    const params = {
        issues: finalIssuesJson,
        code_changes: finalDiffJson,
        release_version: endTag,
        from_version: startTag,
    };

    try {
        // Execute the interaction
        log("Calling Vertesia API...", true);
        const response = await client.interactions.executeByName("ReleaseNoteHighlights", {
            data: {
                ...params,
            },
            config: {
                model,
                environment,
            },
        });

        if (!response || !response.result) {
            throw new Error("Invalid response from Vertesia API");
        }

        return response.result;
    } catch (error) {
        console.error("Failed to generate release notes with Vertesia:", error);
        throw error;
    }
}

/**
 * Main function
 */
async function main() {
    try {
        const { owner, repo } = extractRepoInfo(options.repo);
        const repoUrl = `https://github.com/${owner}/${repo}.git`;
        const repoPath = path.join(process.cwd(), "repos", repo);
        const octokit = initGitHubClient(options.githubToken);

        // Create output directory
        fs.mkdirSync(options.outputDir, { recursive: true });

        log(`Working with repository: ${owner}/${repo}`, true);
        log(`Comparing tags: ${options.startTag} to ${options.endTag}`, true);

        // If we don't have a GitHub token but are using GitHub, offer a warning
        if (!options.githubToken && options.repo.includes("github.com")) {
            console.warn("⚠️ No GitHub token provided. API requests may be rate-limited.");
            console.warn("For better performance, set GITHUB_TOKEN environment variable or use -g option.");
        }

        // If we have a GitHub token, verify it by checking rate limits
        if (options.githubToken) {
            try {
                const { data: rateLimit } = await octokit.rateLimit.get();
                log(
                    `GitHub API authenticated successfully. Rate limit: ${rateLimit.resources.core.remaining}/${rateLimit.resources.core.limit}`,
                );
            } catch (error) {
                console.warn(`⚠️ GitHub token validation failed: ${(error as any).message}`);
                console.warn("Continuing with local Git operations when possible...");
            }
        }

        // Checkout or update repository
        checkoutRepo(repoUrl, repoPath);

        // Get commits between tags (using GitHub API when possible)
        const commits = await getCommitsBetweenTags(
            repoPath,
            options.startTag,
            options.endTag,
            options.githubToken ? octokit : undefined,
            owner,
            repo,
        );

        if (commits.length === 0) {
            console.log("No commits found between tags. Exiting.");
            process.exit(0);
        }

        log(`Found ${commits.length} commits between tags`, true);

        // Extract issue numbers (using GitHub API when possible)
        const issueNumbers = await extractIssueNumbers(
            repoPath,
            commits,
            options.githubToken ? octokit : undefined,
            owner,
            repo,
        );

        log(`Found ${issueNumbers.length} referenced issues`, true);

        // Fetch issues from GitHub API with caching
        const issues = await fetchIssues(octokit, owner, repo, issueNumbers, options.outputDir);
        log(`Successfully fetc ${issues.length} issues from GitHub`, true);

        // Save issues to files
        saveIssuesToFiles(issues, options.outputDir);

        // Get and filter diffs (using GitHub API when possible)
        const diffs = await getDiffsBetweenTags(
            repoPath,
            options.startTag,
            options.endTag,
            options.githubToken ? octokit : undefined,
            owner,
            repo,
        );

        log(`Found ${diffs.length} relevant source code changes`, true);

        // Save diffs to files
        saveDiffsToFiles(diffs, options.outputDir);

        let result: string | undefined = undefined;

        try {
            result = await generateReleaseNotesWithVertesia(issues, diffs, options.startTag, options.endTag, {
                tokenLimit: parseInt(options.tokenLimit),
                model: options.model,
                environment: options.environment,
            });
            log("Successfully generated release notes with Vertesia", true);
        } catch (error) {
            console.error(`Failed to generate release notes with Vertesia: ${(error as any).message}`);
        }

        // Save result as markdown
        const resultPath = path.join(options.outputDir, `release-highlights-${options.startTag}-${options.endTag}.md`);
        if (result) fs.writeFileSync(resultPath, result, "utf-8");

        console.log(`✅ Successfully generated release notes at: ${resultPath}`);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

// Run the script
main();
