const axios = require("axios");
const github = require("@actions/github");
const core = require("@actions/core");
const gulp = require("gulp");
const jsonModify = require("gulp-json-modify");
const gap = require("gulp-append-prepend");

const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
const SLACK_WEBHOOK_URL = core.getInput("SLACK_WEBHOOK_URL");
const APP_NAME = core.getInput("APP_NAME");
const PACKAGE_VERSION = core.getInput("PACKAGE_VERSION");
const octokit = github.getOctokit(GITHUB_TOKEN);
const { context = {} } = github;

const run = async () => {
  console.log("old version", PACKAGE_VERSION);
  // fetch the latest pull request merged in target branch
  let pull = null;
  // get pull number
  let pull_number = context.payload?.head_commit?.message
    ?.split(" ")
    ?.find((o) => o?.includes("#"))
    ?.split("#")[1];
  try {
    const latestPull = await octokit.rest.pulls.get({
      owner: context.payload?.repository?.owner?.login,
      repo: context.payload?.repository?.name,
      pull_number,
    });
    // fetch pull request
    pull = latestPull?.data;
  } catch (error) {
    console.log("error", error.message);
  }
  // bump version
  // let ver = require("../package.json").version; //version defined in the package.json file
  let splitString = PACKAGE_VERSION.split(".", 3);

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
  console.log("new version", new_version);
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
    try {
      // fetch commits from pull request
      const pull_commits = await octokit.request(
        `GET /repos/${context.payload?.repository?.full_name}/pulls/${pull?.number}/commits`,
        {
          owner: context.payload?.repository?.owner?.login,
          repo: context.payload?.repository?.name,
          pull_number: pull?.number,
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
    } catch (error) {
      console.log("fetch commits", error?.message);
    }
    try {
      if (commits != "") {
        gulp
          .src(["./changelog.md"])
          .pipe(gap.prependText(commits))
          .pipe(gap.prependText(`# ${new_version}`))
          .pipe(gulp.dest("./"));
      } else {
        console.log("no commit messages");
        gulp
          .src(["./changelog.md"])
          .pipe(gap.prependText("* No message for these changes"))
          .pipe(gap.prependText(`# ${new_version}`))
          .pipe(gulp.dest("./"));
      }
    } catch (error) {
      console.log("changelog", error?.message);
    }
    // delete branch
    let branch_to_delete = pull?.head?.ref;
    try {
      // fetch branches list
      const branches = await octokit.rest.repos.listBranches({
        owner: context.payload?.repository?.owner?.login,
        repo: context.payload?.repository?.name,
      }); // if exists delete
      console.log(branch_to_delete, branches);
      if (
        branches?.data?.find((el) => el?.name === branch_to_delete) &&
        branch_to_delete !== "develop" &&
        branch_to_delete !== "staging" &&
        branch_to_delete !== "master" &&
        branch_to_delete !== "main"
      ) {
        await octokit.request(
          `DELETE /repos/${context.payload?.repository?.full_name}/git/refs/heads/${branch_to_delete}`,
          {
            owner: context.payload?.repository?.owner?.login,
            repo: context.payload?.repository?.name,
          }
        );
        console.log("branch deleted successfully");
      }
    } catch (error) {
      console.log("error", error?.message);
    }
    // send slack notification
    let newDate = new Date();
    newDate.setTime(new Date(newDate).getTime());
    let dateString = newDate.toDateString();
    let timeString = newDate.toLocaleTimeString();
    const RELEASE_DATE = dateString + " " + timeString;
    commits = commits?.split("*").join(">");
    let options = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🚀 New version released on *${
              APP_NAME ?? "Engineering-blog"
            }*`,
            emoji: true,
          },
        },
        {
          type: "context",
          elements: [
            {
              text: ` *${
                APP_NAME ?? "Engineering-blog"
              }*  |  *${RELEASE_DATE}* `,
              type: "mrkdwn",
            },
          ],
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*<https://github.com/${context.payload?.repository?.full_name}/ | ${new_version} >*`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${commits}`,
          },
        },
      ],
    };
    axios
      .post(SLACK_WEBHOOK_URL, JSON.stringify(options))
      .then((response) => {
        console.log("SUCCEEDED: Sent slack webhook", response.data);
      })
      .catch((error) => {
        console.log("FAILED: Send slack webhook", error);
      });
  }
};

run();
