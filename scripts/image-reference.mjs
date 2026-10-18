// Job outputs containing a repository owner's name can be suppressed by GitHub's secret masking.
// Reconstruct the reference from the official job context and pass only the digest between jobs.
const repository = process.env.GITHUB_REPOSITORY ?? "";
const digest = process.env.IMAGE_DIGEST ?? "";
if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
  console.error("Missing or invalid repository context / candidate digest");
  process.exit(1);
}
process.stdout.write(`ghcr.io/${repository.toLowerCase()}@${digest}`);
