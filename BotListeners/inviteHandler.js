import { save, load } from "../utilities/fileeditors.js"
async function handleinvites(invite, action) {
    const invites = await load("Extravariables/invites.json")
    let guildinvites = invites[invite.guild.id]
    switch (action) {
        case 'add':
            guildinvites.push({ id: invite.code, uses: invite.uses })
            break;
        case 'remove':
            guildinvites = guildinvites.filter(inv => inv.id !== `${invite.code}`)
            break;
    }
    invites[invite.guild.id] = guildinvites
    save("Extravariables/invites.json", invites)
}
export async function inviteCreate(invite) {
    await handleinvites(invite, 'add')
}
export async function inviteDelete(invite) {
    await handleinvites(invite, 'remove')
}