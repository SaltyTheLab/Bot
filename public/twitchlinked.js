document.addEventListener("DOMContentLoaded", () => {
    const linkBtn = document.getElementById("linkBtn");
    const twitchInput = document.getElementById("twitchInput");
    const messageDiv = document.getElementById("message");
    linkBtn.addEventListener("click", async () => {
        const username = twitchInput.value.trim().toLowerCase();

        if (!username) {
            messageDiv.innerText = "Please enter a username.";
            messageDiv.className = "error";
            return;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const discordCode = urlParams.get('code');
        linkBtn.disabled = true;
        linkBtn.innerText = "Linking...";
        try {
            const response = await fetch(`http://localhost:3000/api/auth/discord/redirect?username=${username}&code=${discordCode}`);
            if (!response.ok) {
                messageDiv.innerText = `Server error (${response.status}). Please try again later.`;
                messageDiv.className = "error";
                return;
            }
            const result = await response.json()
            console.log(result)
            if (result.success) {
                messageDiv.innerText = `Success! Linked to ${result.displayName}'s channel! You may now close the browser.`;
                messageDiv.className = "success";
            } else {
                messageDiv.innerText = "Error: Twitch channel not found.";
                messageDiv.className = "error";
            }
        } finally {
            linkBtn.disabled = false;
            linkBtn.innerText = "Link Account";
        }

    })
})