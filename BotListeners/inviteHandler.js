import { save, load } from "../utilities/fileeditors.js"
async function handleinvites(invite, action) {
    let invites = await load("Extravariables/invites.json")
    switch (action) {
        case 'add':
            invites.push({ key: `${invite.guild.id}-${invite.code}`, uses: invite.uses })
            break;
        case 'remove':
            invites = invites.filter(inv => inv.key !== `${invite.guild.id}-${invite.code}`)
            break;
    }
    await save("Extravariables/invites.json", invites)
}
export async function inviteCreate(invite) {
    await handleinvites(invite, 'add')
}
export async function inviteDelete(invite) {
    await handleinvites(invite, 'remove')
}