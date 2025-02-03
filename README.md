# Review Request Bot

Review Request Bot is a lightweight Node.js service that listens to GitLab merge request comment events and sends notifications to Slack channels. It ensures your team stays up-to-date with code reviews—whether by tagging specific reviewers or notifying the entire channel.

## Features

- **GitLab Webhook Listener:**  
  Monitors merge request comments in GitLab for specific commands.

- **Targeted Reviewer Notification:**  
  Use `/ping <team>` to notify specific reviewers based on the merge request data.

- **Channel-Wide Notification:**  
  Use `/ping-all <team>` to alert all active members in a designated Slack channel using `@here`.

- **Team-Specific Configuration:**  
  Easily map teams to Slack channels via a JSON configuration file.

- **Simple & Extensible:**  
  Designed for easy integration and future expansion to suit your workflow.

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/review-request-bot.git
   cd review-request-bot
   ```
2. **Install Dependencies:**

    ```bash
    npm install
    ````
3. **Set Up Environment Variables:**
   Create a .env file in the project root with the following content:
      ```code
    PORT=3000
    SLACK_TOKEN=your_slack_token_here
    GITLAB_TOKEN=your_gitlab_token_here
   ```
4. Configure Teams:
Update the config.json file to map team identifiers to Slack channels. For example:
    ```code
    {
    "team1": {
       "slack_channel": "#team1_channel"
    },
    "team2": {
       "slack_channel": "#team2_channel"
    }
   ```
---


## Usage

### Running the Service

Start the service with:

```bash
npm start
```

### GitLab Webhook Setup

1. **Navigate to Webhook Settings:**
    - In your GitLab project, go to **Settings** > **Webhooks**.

2. **Enter the Webhook URL:**
    - Set the URL to your service's `/notify` endpoint (e.g., `https://yourdomain.com/notify`).

3. **Select the Event:**
    - Enable the **Merge Request Comment** event (or the equivalent note event for merge requests).

4. **(Optional) Configure a Secret Token:**
    - For added security, you can specify a secret token. Make sure to validate this token in your service.

5. **Save the Webhook:**
    - Click **Add Webhook** to save your configuration.

6. **Test the Webhook:**
    - Add a comment starting with `/ping <team>` or `/ping-all <team>` on a merge request to verify that notifications are correctly sent to the designated Slack channel.
