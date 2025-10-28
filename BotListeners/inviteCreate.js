import { save, load } from "../utilities/jsonloaders.js"
export async function inviteCreate(invite) {
    const invitesfilepath = "./Botlisteners/Extravariables/invites.json"
    let invites = await load(invitesfilepath)
    const key = `${invite.guild.id}-${invite.code}`
    invites.push({ key: key, uses: invite.uses })
    await save(invitesfilepath, invites)
}
