import invites from "./Extravariables/mapsandsets.js";
export function inviteDelete(invite) {
    const key = `${invite.guild.id}-${invite.code}`;
    if (invites.has(key))
        invites.delete(key)
}