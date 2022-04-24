const axios = require("axios");
const github = require("@actions/github");
const core = require("@actions/core");

const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
const SLACK_WEBHOOK_URL = core.getInput("SLACK_WEBHOOK_URL");
const TARGET_BRANCH = core.getInput("TARGET_BRANCH");
const DESTINATION_BRANCH = core.getInput("DESTINATION_BRANCH");
const SLACK_WEBHOOK_REVIEW_URL = core.getInput("SLACK_WEBHOOK_REVIEW_URL");
const octokit = github.getOctokit(GITHUB_TOKEN);
const { context = {} } = github;

const run = async () => {
  console.log("run");
};

run();
