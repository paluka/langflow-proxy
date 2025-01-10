require("dotenv").config();

const axios = require("axios");

const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN_PR_BOT_CLASSIC;

const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;

const GITHUB_RAW_FILES_URL = "https://raw.githubusercontent.com/";

const LANGFLOW_API_URL =
  "https://api.langflow.astra.datastax.com/lf/7b1de301-a0dc-4b06-9757-831c74cfbaa1/api/v1/run/0e24ec91-31dd-4955-b0c3-648f5c8bd7eb?stream=false";

module.exports = async (req, res) => {
  console.log("About to post");
  if (req.method === "POST") {
    console.log("In post");
    try {
      if (
        req.body.action != "created" ||
        req.body.comment.user.login == "pr-gen-ai-bot"
      ) {
        return res
          .status(200)
          .send(`Ignoring GitHub webhook action: ${req.body.action}`);
      }
      console.log("In post past guards");
      // const payload = JSON.stringify({
      //   text: "GitHub webhook triggered a PR action",
      //   output_type: "text",
      //   input_type: "text",
      //   github_event: req.body, // Include GitHub webhook data if needed
      // });

      // const new_payload = JSON.stringify({
      //   input_value: "message",
      //   output_type: "chat",
      //   input_type: "chat",
      //   tweaks: {
      //     "Webhook-ZwJC2": {
      //       data: { github_event: req.body },
      //     },
      //   },
      // });

      // console.log("About to post: ", new_payload);

      // const response = await axios.post(
      //   LANGFLOW_API_URL,
      //   new_payload,
      //   {
      //     headers: {
      //       "Content-Type": "application/json",
      //       Authorization: `Bearer ${LANGFLOW_API_KEY}`,
      //     },
      //   }
      // );
      // const githubEventData = req.body;
      // delete githubEventData.comment.diff_hunk;

      const pullRequestObj = req.body.pull_request;
      const repoObj = req.body.repository;
      const commentObj = req.body.comment;

      const comment_id = commentObj.id;
      const comment_url = commentObj.url;
      const comment_reply_url = pullRequestObj.review_comments_url;
      const comment_body = commentObj.body;
      const comment_user = commentObj.user.login;

      console.log("\n\nNOT SENDING DIFF HUNK: ", commentObj.diff_hunk);

      const langflowData = JSON.stringify({
        input_value: "message",
        output_type: "chat",
        input_type: "chat",
        tweaks: {
          "Webhook-ZwJC2": {
            data: JSON.stringify({
              comment_id,
              comment_url,
              comment_reply_url,
              comment_body,
              comment_user,
              head_file_url: `${GITHUB_RAW_FILES_URL}${repoObj.full_name}/${pullRequestObj.head.sha}/${commentObj.path}`,
              base_file_url: `${GITHUB_RAW_FILES_URL}${repoObj.full_name}/${pullRequestObj.base.sha}/${commentObj.path}`,
            }),
          },
        },
      });

      const langflowConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: LANGFLOW_API_URL,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LANGFLOW_API_KEY}`,
        },
        data: langflowData,
      };

      const githubData = {
        body: "Be in the flow",
        in_reply_to: comment_id,
      };

      let githubConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: comment_reply_url,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${GITHUB_ACCESS_TOKEN}`,
        },
        data: githubData,
      };

      const config = langflowConfig;
      const data = langflowData;

      // const config = githubConfig;
      // const data = githubData;

      console.log(`\n\nAbout to post: ${data}\n\n`);

      const response = await axios.request(config);

      console.log(
        `After post status: ${response.status}, ${response.statusText}`
      );

      if (response.status >= 200 && response.status < 300) {
        console.log(`\n\nResponse data:\n${JSON.stringify(response.data)}`);
        res.status(200).send(response.data);
      } else {
        console.error(
          "Response not okay",
          response.status,
          response.statusText
        );
        res
          .status(500)
          .send(
            `Response not okay: ${response.status}, ${response.statusText}`
          );
      }
    } catch (error) {
      if (
        error &&
        error.response &&
        error.response.data &&
        error.response.data.detail
      ) {
        console.error("Error triggering LangFlow:", error.response.data.detail);
        res
          .status(500)
          .send(
            `Error triggering LangFlow. Error: ${error.response.data.detail}`
          );
      } else {
        console.error("Error triggering LangFlow:", error);
        res.status(500).send(`Error triggering LangFlow. Error: ${error}`);
      }
    }
  } else {
    res.status(405).send("Method Not Allowed");
  }
};
