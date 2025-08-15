import invites from "./Extravariables/invites.js";
export function inviteDelete(invite) {
    const key = `${invite.guild.id}-${invite.code}`;
    if (invites.has(key))
        invites.delete(key)
    console.log(`Deleted invite: ${invite.guild.id}-${invite.code} from the cache`)
    invites.forEach((uses, key) => {
        console.log(`${key}, Uses: ${uses}`);
    })
}