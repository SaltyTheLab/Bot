import invites from "./Extravariables/invites.js";
export function inviteDelete(invite) {
    const key = `${invite.guild.id}-${invite.code}`;
    if (invites.has(key))
        invites.delete(key)
}