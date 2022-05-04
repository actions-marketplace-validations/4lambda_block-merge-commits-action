const { debug, error } = require("@actions/core");
const {
    context,
    getOctokit,
} = require("@actions/github");

vendor_dir_regex = /^\.?\/?vendor\/.*/

class PullRequestChecker {
    constructor(repoToken) {
        this.client = getOctokit(repoToken);
    }

    async process() {
        const commits = await this.client.paginate(
            "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
            {
                ...context.repo,
                pull_number: context.issue.number,
                per_page: 100,
            },
        );

        debug(`${commits.length} commit(s) in the pull request`);

        let blockedCommits = 0;
        for (const { sha, url, parents } of commits) {

            const isMergeCommit = parents.length > 1;
            if (isMergeCommit) {
                const commit = await this.client.paginate(
                    'GET /repos/{owner}/{repo}/commits/{ref}',
                    {
                        ...context.repo,
                        ref: sha,
                    },
                );

                for (const { files } of commit) {
                    for (const { filename } of files) {
                        const isVendorDir = vendor_dir_regex.test(filename);
                        if (isVendorDir) {
                            debug(filename);
                        } else {
                            error(`Commit ${sha} is a merge commit: ${url}`);

                            blockedCommits++;
                        }
                    }
                }
            }
        }

        if (blockedCommits) {
            throw Error(`${blockedCommits} commit(s) cannot be merged`);
        }
    }
}

module.exports = PullRequestChecker;
