const chalk = require('chalk').default;

function timestamp() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

async function getChannel(client, channelId) {
  if (!channelId) return null;
  try {
    return client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
  } catch {
    return null;
  }
}

async function logInfo(client, message) {
  console.log(chalk.blue(`[${timestamp()}] [INFO]`), chalk.white(message));
  const channel = await getChannel(client, process.env.LOG_CHANNEL_ID);
  if (channel) channel.send(`ℹ️ ${message}`).catch(() => {});
}

async function logCritical(client, message) {
  console.log(chalk.red(`[${timestamp()}] [CRITICAL]`), chalk.white(message));
  const channel = await getChannel(client, process.env.CRITICAL_LOG_CHANNEL_ID);
  if (channel) channel.send(`🚨 **CRITIQUE**: ${message}`).catch(() => {});
}

async function logProfile(client, message) {
  console.log(chalk.green(`[${timestamp()}] [PROFILE]`), chalk.white(message));
  const channel = await getChannel(client, process.env.PROFILE_LOG_CHANNEL_ID);
  if (channel) channel.send(`👤 ${message}`).catch(() => {});
}

async function logReport(client, message) {
  console.log(chalk.yellow(`[${timestamp()}] [REPORT]`), chalk.white(message));
  const channel = await getChannel(client, process.env.REPORT_CHANNEL_ID);
  if (channel) channel.send(`⚠️ **Signalement**: ${message}`).catch(() => {});
}

module.exports = { logInfo, logCritical, logProfile, logReport };
