const axios = require("axios");
const github = require("@actions/github");
const core = require("@actions/core");
const gulp = require("gulp");
const jsonModify = require("gulp-json-modify");
const gap = require("gulp-append-prepend");

const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
const SLACK_WEBHOOK_URL = core.getInput("SLACK_WEBHOOK_URL");
const TARGET_BRANCH = core.getInput("TARGET_BRANCH");
const DESTINATION_BRANCH = core.getInput("DESTINATION_BRANCH");
const octokit = github.getOctokit(GITHUB_TOKEN);
const { context = {} } = github;

const run = async () => {
  // bump version
  let ver = require("../package.json").version; //version defined in the package.json file
  console.log("current version: ", ver);
  let splitString = ver.split(".", 3);

  let majorVersion = splitString[0].split('"', 1);
  let minorVersion = splitString[1].split('"', 1);
  let patchVersion = splitString[2].split('"', 1);

  let patchNumber = Number(patchVersion[0]);
  let minorNumber = Number(minorVersion[0]);
  let majorNumber = Number(majorVersion[0]);
  if (patchNumber < 9) {
    patchNumber++;
    splitString[2] = String(patchNumber);
  } else {
    splitString[2] = String(0);
    if (minorNumber < 9) {
      minorNumber++;
      splitString[1] = String(minorNumber);
    } else {
      splitString[1] = String(0);
      majorNumber++;
      splitString[0] = String(majorNumber);
    }
  }

  let new_version = splitString.join(".");
  process.env.VERSION = splitString.join(".");
  console.log(" new version : ", new_version);
  // save version
  if (new_version) {
    try {
      gulp
        .src(["./package.json"])
        .pipe(
          jsonModify({
            key: "version",
            value: new_version,
          })
        )
        .pipe(gulp.dest("./"));
    } catch (error) {
      console.log("up v", error.message);
    }

    // update changelog
    let commits = "";
    console.log(context.payload?.number);
    try {
      // fetch commits from pull request
      const pull_commits = await octokit.request(
        `GET /repos/${context.payload?.repository?.full_name}/pulls/${context.payload?.number}/commits`,
        {
          owner: context.payload?.repository?.owner?.login,
          repo: context.payload?.repository?.name,
          pull_number: context.payload?.number,
        }
      );

      pull_commits?.data?.forEach((e, i) => {
        if (
          !e?.commit?.message.includes("Merge") &&
          !e?.commit?.message.includes("Merged") &&
          !e?.commit?.message.includes("skip") &&
          !e?.commit?.message.includes("Skip")
        )
          commits =
            i === 0
              ? "* " + e.commit.message
              : commits + "\n\n" + "* " + e.commit.message;
      });
      console.log("commits", commits);
    } catch (error) {
      console.log("fetch commits", error?.message);
    }
    try {
      if (commits != "") {
        gulp
          .src("./changelog.md")
          .pipe(gap.prependText(commits))
          .pipe(gap.prependText(`# ${new_version}`))
          .pipe(gulp.dest("./"));
      } else {
        console.log("no commit messages");
      }
    } catch (error) {
      console.log("changelog", error?.message);
    }
  }
};

run();
