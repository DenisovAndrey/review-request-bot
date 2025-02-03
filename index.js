require('dotenv').config();
const express = require('express');
const axios = require('axios');
const config = require('./config.json');

const PORT = process.env.PORT || 3000;
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;

const app = express();
app.use(express.json());

/**
 * Retrieve Slack channel configuration for a given team.
 * @param {string} team - The team identifier.
 * @returns {Object} Configuration object containing SLACK_CHANNEL.
 */
const getConfigData = (team) => ({
    SLACK_CHANNEL: config[team]?.slack_channel,
});

/**
 * Fetch a GitLab user's public email by their user ID.
 * @param {number} userId - The GitLab user ID.
 * @returns {Promise<string|null>} The user's public email, or null if not found.
 */
const fetchGitLabUserEmailById = async (userId) => {
    try {
        const { data } = await axios.get(`https://git.deepl.dev/api/v4/users/${userId}`, {
            headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN },
        });
        return data.public_email || null;
    } catch (error) {
        console.error(`Error fetching email for user ID ${userId}:`, error.message);
        return null;
    }
};

/**
 * Fetch details for a GitLab merge request.
 * @param {number} projectId - The GitLab project ID.
 * @param {number|string} mrId - The merge request IID.
 * @returns {Promise<Object>} The merge request details.
 */
const fetchMergeRequestDetails = async (projectId, mrId) => {
    try {
        const response = await axios.get(
            `https://git.deepl.dev/api/v4/projects/${projectId}/merge_requests/${mrId}`,
            { headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN } }
        );
        return response.data;
    } catch (error) {
        console.error(
            `Error fetching MR details (project: ${projectId}, MR: ${mrId}):`,
            error.message
        );
        throw new Error('Failed to fetch merge request details');
    }
};

/**
 * Fetch Slack user ID by email.
 * @param {string} email - The user's email address.
 * @returns {Promise<string|null>} The Slack user ID or null if not found.
 */
const fetchSlackUserIdByEmail = async (email) => {
    try {
        const { data } = await axios.get('https://slack.com/api/users.lookupByEmail', {
            headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
            params: { email },
        });

        if (!data.ok) {
            console.warn(`User with email ${email} not found on Slack.`);
            return null;
        }
        return data.user.id;
    } catch (error) {
        console.error(`Error fetching Slack user for email ${email}:`, error.message);
        return null;
    }
};

/**
 * Convert an array of reviewer emails to a comma-separated string of Slack mentions.
 * @param {string[]} reviewerEmails - List of reviewer emails.
 * @returns {Promise<string>} Comma-separated Slack mentions.
 */
const tagReviewersInSlack = async (reviewerEmails) => {
    const mentions = await Promise.all(
        reviewerEmails.map(async (email) => {
            const slackUserId = await fetchSlackUserIdByEmail(email);
            return slackUserId ? `<@${slackUserId}>` : email; // Fallback to email if not found
        })
    );
    return mentions.filter(Boolean).join(', ');
};

// Main webhook endpoint for notifications
app.post('/notify', async (req, res) => {
    try {
        const { object_kind, project_id: projectId, object_attributes, merge_request } = req.body || {};

        // Validate that the event is a note on a merge request
        if (object_kind !== 'note' || object_attributes?.noteable_type !== 'MergeRequest') {
            return res.status(400).send('Unsupported event type');
        }

        const comment = object_attributes.note?.trim();
        if (!comment || !comment.startsWith('/ping')) {
            return res.status(200).send('No action required');
        }

        // Determine command type and extract team identifier
        const isPingAll = comment.startsWith('/ping-all');
        const team = comment.slice(isPingAll ? 9 : 6).trim().toLowerCase();

        // Get Slack channel configuration for the team
        const { SLACK_CHANNEL } = getConfigData(team);
        if (!SLACK_CHANNEL) {
            console.warn(`Missing configuration for team: ${team}`);
            return res.status(400).send('Invalid team or configuration');
        }

        // Fetch merge request details from GitLab
        const mergeRequestIid = merge_request.iid;
        const mrDetails = await fetchMergeRequestDetails(projectId, mergeRequestIid);
        const { reviewers = [], title: mrTitle, web_url: mrUrl } = mrDetails;

        let mentions = isPingAll ? '<!here>' : 'team';

        if (!isPingAll) {
            // Get reviewer emails and generate Slack mentions
            const reviewerEmails = (
                await Promise.all(
                    reviewers.map((reviewer) => fetchGitLabUserEmailById(reviewer.id))
                )
            ).filter(Boolean);

            if (reviewerEmails.length) {
                mentions = await tagReviewersInSlack(reviewerEmails);
                if (!mentions) {
                    console.info('No Slack users found for the reviewers.');
                }
            }
        }

        // Construct and send the Slack notification
        const message = `Hey ${mentions},\nMerge request *<${mrUrl}|${mrTitle}>* requires your attention.`;
        await axios.post(
            'https://slack.com/api/chat.postMessage',
            { channel: SLACK_CHANNEL, text: message },
            {
                headers: {
                    Authorization: `Bearer ${SLACK_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return res.status(200).send('Notification sent.');
    } catch (error) {
        console.error('Error processing webhook:', error.message);
        return res.status(500).send('Internal Server Error');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Service is running on port ${PORT}`);
});
