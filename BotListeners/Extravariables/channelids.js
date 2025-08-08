export const deletedLogsId = "1353555735614849044";
export const welcomeChannelId = '1262950864889319434';
export const updatedMessagesChannelId = '1353558675855376384';
export const nameLogChannelId = '1394761880366616657';
export const banlogChannelid = '1256029364768997406';
export const mutelogChannelid = '1311483105206472745';
export const generalChannelid = '1231453115937587273';
export const ruleschannelid = '1235295566356025354';
export const mentalhealthid = '1390128922712342659';
export const ticketappealsid = '1272261219805298729';
export const staffguidesid = '1262533685002113155';
export const getrolesid = '1235323618582466621';
export const hobbiescatagorey = '1262972525642649610';
export const mediacatagorey = '1311485962567548970';
export const adultcatagorey = '1235309784685744308'
export const evodeletedLogsId = "1403065389021270066";
export const evowelcomeChannelId = '1403065196653842604';
export const evoupdatedMessagesChannelId ='1403065299216891985';
export const evonameLogChannelId = '1403065343202693181';
export const evobanlogChannelid = '1403065225472643174';
export const evomutelogChannelid = '1403065255126503537';
export const evogeneralChannelid = '1347403115573542942';
export const evoruleschannelid = '1347399775951257704';
export const evogetrolesid = '1347227575998484538';
export const evoadultcatagorey = '1347589981513711656';

export const guildModChannelMap = {
    "1231453115937587270": { // Salty's Guild ID
        mutelogChannel: mutelogChannelid,
        deletedlogChannel: deletedLogsId,
        welcomeChannel: welcomeChannelId,
        updatedlogChannel: updatedMessagesChannelId,
        namelogChannel: nameLogChannelId,
        banlogChannel: banlogChannelid,
        generalChannel: generalChannelid
    },
    "1347217846991851541": { // Evo's Guild ID
        mutelogChannel: evomutelogChannelid,
        banlogChannel: evobanlogChannelid,
        welcomeChannel : evowelcomeChannelId,
        deletedlogChannel: evodeletedLogsId,
        updatedlogChannel: evoupdatedMessagesChannelId,
        namelogChannel: evonameLogChannelId,
        generalChannel: evogeneralChannelid
    }
    // Add more guild mappings here if you have more servers
};
 export const guildChannelMap = {
    "1231453115937587270": { // Salty's Guild ID
        rules: ruleschannelid,
        mental: mentalhealthid,      // Using the shared mentalhealthid
        appeal: ticketappealsid,     // Using the shared ticketappealsid
        staffguide: staffguidesid,   // Using the shared staffguidesid
        getroles: getrolesid,
        // Add other channels for Salty's if they are unique to this guild
    },
    "1347217846991851541": { // Evo's Guild ID
        rules: evoruleschannelid,
        getroles: evogetrolesid,
    }
    // Add more guild mappings here if you have more servers
};
