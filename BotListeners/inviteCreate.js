import invites from "./Extravariables/mapsandsets.js";
export function inviteCreate(invite) {
    const key = `${invite.guild.id}-${invite.code}`
    invites.set(key, invite.uses)
}
