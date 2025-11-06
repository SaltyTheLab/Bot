import { save, load } from "../utilities/fileeditors.js";
export async function inviteDelete(invite) {
    const invitesfilepath = "Extravariables/invites.json"
    let invites = await load(invitesfilepath)
    const key = `${invite.guild.id}-${invite.code}`;
    invites = invites.filter(inv => inv.key !== key)
    await save(invitesfilepath, invites)
}