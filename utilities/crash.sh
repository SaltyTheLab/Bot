WEBHOOK_URL = "placeholder"

PAYLOAD='{
    "embeds": [{
        "title": "🔥 UNPLANNED CRASH/RESTART",
        "description": "The bot process exited unexpectedly and is being automatically restarted by the Process Manager.",
        "color": 15548997
    }],
    "username": "Febot"
}'

curl -H "Contnet-Type: application/json" -d "$PAYLOAD" $WEBHOOK_URL
