const deletedLogsId = "1353555735614849044";
const welcomeChannelId = '1262950864889319434';
const updatedMessagesChannelId = '1353558675855376384';
const nameLogChannelId = '1394761880366616657';
const banlogChannelid = '1256029364768997406';
const mutelogChannelid = '1311483105206472745';
const generalChannelid = '1231453115937587273';
const ruleschannelid = '1235295566356025354';
const mentalhealthid = '1390128922712342659';
const ticketappealsid = '1272261219805298729';
const staffguidesid = '1262533685002113155';
const getrolesid = '1235323618582466621';
const hobbiescatagorey = '1262972525642649610';
const mediacatagorey = '1311485962567548970';
const adultcatagorey = '1235309784685744308';
const countingchannelid = '1406810924806832218';
const evodeletedLogsId = "1403065389021270066";
const evowelcomeChannelId = '1403065196653842604';
const evoupdatedMessagesChannelId = '1403065299216891985';
const evonameLogChannelId = '1403065343202693181';
const evobanlogChannelid = '1403065225472643174';
const evomutelogChannelid = '1403065255126503537';
const evogeneralChannelid = '1347403115573542942';
const evoruleschannelid = '1347399775951257704';
const evogetrolesid = '1347227575998484538';
const evoadultcatagorey = '1347589981513711656';

export const guildModChannelMap = {
    "1231453115937587270": {
        mutelogChannel: mutelogChannelid,
        deletedlogChannel: deletedLogsId,
        welcomeChannel: welcomeChannelId,
        updatedlogChannel: updatedMessagesChannelId,
        namelogChannel: nameLogChannelId,
        banlogChannel: banlogChannelid,
    },
    "1347217846991851541": {
        mutelogChannel: evomutelogChannelid,
        banlogChannel: evobanlogChannelid,
        welcomeChannel: evowelcomeChannelId,
        deletedlogChannel: evodeletedLogsId,
        updatedlogChannel: evoupdatedMessagesChannelId,
        namelogChannel: evonameLogChannelId,
    }
};
export const guildChannelMap = {
    "1231453115937587270": {
        channels: {
            rules: ruleschannelid,
            mental: mentalhealthid,
            appeal: ticketappealsid,
            staffguide: staffguidesid,
            getroles: getrolesid,
            generalChannel: generalChannelid,
            counting: countingchannelid
        },
        exclusions: {
            hobbies: hobbiescatagorey,
            media: mediacatagorey,
            adultcatagorey: adultcatagorey
        }
    },
    "1347217846991851541": {
        channels: {
            rules: evoruleschannelid,
            getroles: evogetrolesid,
            generalChannel: evogeneralChannelid
        },
        exclusions: {
            adultcatagorey: evoadultcatagorey
        }
    }
}

export default guildChannelMap;
