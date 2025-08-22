import invites from "./Extravariables/invites.js";
export function inviteCreate(invite) {
    const key = `${invite.guild.id}-${invite.code}`
    invites.set(key, invite.uses)
}
