
let socket;

const joinButton = document.getElementById("join-button");

const messageBody = document.getElementById("message-body");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");

let wait = document.getElementById("waiting-box");
let table = document.getElementById("table-area");

let isAdmin = false;
let startButton;
let canStart = false;

let gamePlaying = false;

function positionPlayers() {
    const players = document.querySelectorAll(".player");
    const pile = document.querySelector(".piles");
    const centerX = table.clientWidth / 2;
    const centerY = table.clientHeight / 2;

    const radius = Math.min(centerX, centerY) * 0.75;

    players.forEach((player, i) => {
        const angle = Math.PI/2 + i*(2*Math.PI/players.length);

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        player.style.left = x + "px";
        player.style.top = y + "px";
    });

    pile.style.left = centerX + "px";
    pile.style.top = centerY + "px";
}

function getCardImage(card) {
    if(card.includes("Wild Draw Four")){
        return "assets/cards/WildDrawFour.png";
    }
    else if(card.includes("Wild")){
        return "assets/cards/Wild.png";
    }

    const arr = card.split(",");

    if(!isNaN(arr[1])){
        return "assets/cards/" + arr[0] + arr[1] + ".png";
    }
    else{
        return "assets/cards/" + arr[0] + arr[1].replaceAll(" ", "") + ".png";
    }

}
joinButton.addEventListener("click", () => {

    function hideJoinScreen() {
        const joinScreen = document.getElementById("join-screen");
        const game = document.getElementById("game-container");

        game.classList.add("active");

        joinScreen.classList.add("hidden");
        setTimeout(() => {
            joinScreen.style.display = "none";
        }, 250);
    }

    function addChatMessage(content) {
        const message = document.createElement("div");
        message.classList.add("message");
        message.textContent = content;
        messageBody.appendChild(message);
    }

    function showGameOver(winner) {
        const overlay = document.createElement("div");
        overlay.classList.add("game-over");

        overlay.innerHTML = `
            <h2>${winner} wins!</h2>
            <button id="play-again" class="play-again">Play Again</button>
            <button id="leave-lobby" class="leave-lobby">Leave Lobby</button>
        `;

        table.appendChild(overlay);

        document.getElementById("play-again").onclick = () => {
            socket.send(JSON.stringify({
                type: "play-again"
            }));
            overlay.remove();

            table.innerHTML = "";
            table.appendChild(wait);
            wait.classList.remove("hidden");
            wait.style.display = "flex";
            wait.innerHTML = "";

        }
        
        document.getElementById("leave-lobby").onclick = () => {
            socket.close();
            location.reload();
        };
    }

    const nickname = document.getElementById("nickname-input").value.trim();
    const lobby = document.getElementById("lobby-input").value.trim();

    if (!nickname) {return;}

    const data = {
        type: "join_lobby",
        nickname: nickname,
        lobby: lobby
    };

    joinButton.disabled = true;

    if (!socket){
        socket = new WebSocket("ws://localhost:5555");
    }

    socket.onopen = () => {
        socket.send(JSON.stringify(data));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(data);
        switch(data.type) {
            case "join_success":
                if(!lobby) {isAdmin = true;}

                hideJoinScreen();
                wait.style.display = "flex";
                table.style.display = "flex";

                const top = document.getElementById('top-player');
                top.textContent = "Lobby code: " + data["lobby"];

                break;
            
            case "join_failed":
                socket.close(1000, "Join failed.");
                socket = null;
                joinButton.disabled = false;
                console.log(data.reason);
                alert(data.reason);

                if(data.reason == "Game is ongoing; this webpage will be shortly refreshed."){
                    console.log("Refreshing..")
                    location.reload();
                }
                break;

            case "chat":
                addChatMessage(data.message);
                break;

            case "waiting_update":
                if(wait.classList.contains("hidden")){wait.classList.remove("hidden");}
                wait.innerHTML = "";

                const lobbyRow = document.createElement("div");
                lobbyRow.classList.add("lobby-row");

                const waitLobby = document.createElement("span");
                waitLobby.textContent = "Lobby code: " + data["lobby"];

                const copyButton = document.createElement("button");
                copyButton.textContent = "⧉";
                copyButton.classList.add("copy-button");

                copyButton.addEventListener("click", () => {
                    navigator.clipboard.writeText(data["lobby"]);

                    copyButton.textContent = "Copied!";
                    setTimeout(() => {
                        copyButton.textContent = "⧉";
                    }, 1000);
                });

                lobbyRow.appendChild(waitLobby);
                lobbyRow.appendChild(copyButton);

                const playerDisplay = document.createElement("div");
                playerDisplay.id = "player-list";

                for (const player of data.players){
                    const div = document.createElement("div");
                    div.textContent = player;
                    playerDisplay.appendChild(div);
                }

                const div1 = document.createElement("div");
                div1.textContent = String(data.players.length) + "/4 players joined.";
                if(data.players.length < 2) {div1.style.color = "red"; canStart = false;}
                else {canStart = true;}
                playerDisplay.appendChild(div1);

                wait.appendChild(lobbyRow);
                wait.appendChild(playerDisplay);

                function hideWaitingBox() {
                    wait.classList.add("hidden");
                    setTimeout(() => {
                        wait.style.display = "none";
                    }, 250);
                }

                if(data.host == nickname){
                    const div = document.createElement("div");
                    div.textContent = "You are the host.";
                    playerDisplay.appendChild(div);

                    let startButton = document.createElement("button");
                    startButton.id = "start-button";
                    startButton.textContent = "Start Game";
                    startButton.classList.add("start-button");

                    wait.appendChild(startButton);

                    if(!canStart){startButton.disabled = true;}
                    else {startButton.disabled = false;}

                    startButton.addEventListener("click", () => {
                        if(canStart){
                            socket.send(JSON.stringify({
                                type: "start_game"
                            }));
                        }
                    })
                }
                break;
            
            case "start_game":
                if(data.players.includes(nickname))
                {
                    console.log(data);
                    gamePlaying = true;
                    hideWaitingBox();
                    break;
                }

            case "game_update":
                if(data.players.includes(nickname))
                {
                    table.innerHTML = "";

                    const allPlayers = data["players"];
                    const disCard = data["discard"];
                    const curPlayer = data["curplayer"];
                    const allCards = data["cards"];

                    const piles = document.createElement("div");
                    piles.classList.add("piles");

                    const drawPile = document.createElement("button");
                    drawPile.classList.add("draw-pile");
                    
                    const drawImage = document.createElement("img");
                    drawImage.src = "assets/cards/stack.png";

                    drawPile.appendChild(drawImage);

                    const discardPile = document.createElement("div");
                    discardPile.classList.add("discard-pile");

                    const disImage = document.createElement("img");
                    disImage.src = getCardImage(disCard);
                    
                    discardPile.appendChild(disImage);

                    piles.appendChild(drawPile);
                    piles.appendChild(discardPile);       

                    let isCurPlayer = curPlayer == nickname;

                    let index = allPlayers.indexOf(nickname);
                    const cardList = allCards[index];

                    let newAllPlayers = allPlayers.slice(index, allPlayers.length).concat(allPlayers.slice(0, index));
                    let newAllCards = allCards.slice(index, allCards.length).concat(allCards.slice(0, index));

                    let numPlayers = allPlayers.length;

                    const centerX = table.clientWidth/2;
                    const centerY = table.clientHeight/2;

                    piles.style.left = centerX + "px";
                    piles.style.top = centerY + "px";

                    table.appendChild(piles);

                    const radius = Math.min(centerX, centerY) * 0.75;

                    for (let i = 0; i < numPlayers; i++){
                        const angle = Math.PI/2 + i * (2 * Math.PI / numPlayers);
                        
                        const x = centerX + radius * Math.cos(angle);
                        const y = centerY + radius * Math.sin(angle);

                        const playerDiv = document.createElement("div");
                        playerDiv.classList.add("player")

                        playerDiv.innerHTML = "";

                        let n = newAllCards[i].length;

                        if(i != 0)
                        {
                            for (let j = 0; j < n; j++){
                                const back = document.createElement("img");
                                back.classList.add("card");

                                const backholder = document.createElement("div");
                                backholder.classList.add("card-holder");

                                back.src = "assets/cards/backface.png";
                                back.style.left = `${i * 20}px`;

                                backholder.appendChild(back)
                                playerDiv.appendChild(backholder);
                            }
                        }

                        playerDiv.style.left = x + "px";
                        playerDiv.style.top = y + "px";

                        const rotAngle = angle * 180/Math.PI - 90;
                        playerDiv.style.transform = `translate(-50%, -50%) rotate(${rotAngle}deg)`;
                        console.log(rotAngle);
                        table.appendChild(playerDiv);
                    }

                    const bottom = document.querySelectorAll(".player")[0];
                    bottom.innerHTML = "";
                    bottom.id = "my-player";

                    function showColorPicker(button, cardIndex) {
                        document.querySelector(".color-picker")?.remove();

                        const picker = document.createElement("div");
                        picker.classList.add("color-picker");

                        const rect = button.getBoundingClientRect();
                        picker.style.left = rect.left + rect.width/2 - 80 + "px";
                        picker.style.top = rect.top - 70 + "px";

                        const colors = ["Red", "Yellow", "Green", "Blue"]

                        colors.forEach((name, i) => {
                            const b = document.createElement("button");
                            b.textContent = name;
                            
                            b.addEventListener("click", () => {
                                socket.send(JSON.stringify({
                                    type: "play_card",
                                    card_index: cardIndex,
                                    color: name
                                }));

                                picker.remove();
                                return;
                            });

                            picker.appendChild(b);
                        });

                        setTimeout(() => {
                            document.addEventListener("click", function close(e) {
                                if(!picker.contains(e.target)) {
                                    picker.remove();
                                    document.removeEventListener("click", close);
                                }
                            });
                        }, 0);
                        document.body.appendChild(picker);
                    }

                    cardList.forEach((card, i) => {
                        const button = document.createElement("button");
                        button.classList.add("card-button");

                        const img = document.createElement("img");
                        img.src = getCardImage(card);
                        img.alt = card;

                        button.appendChild(img);

                        button.disabled = !isCurPlayer;

                        console.log(isCurPlayer);

                        button.addEventListener("click", () => {

                            if (card.includes("Wild")) {
                                showColorPicker(button, i);
                            }
                            else {
                                socket.send(JSON.stringify({
                                    type: "play_card",
                                    card_index: i,
                                    color: "none"
                                }));
                            }
                        })

                        bottom.appendChild(button);
                    });

                    drawPile.disabled = !isCurPlayer;
                    drawPile.addEventListener("click", () => {
                        socket.send(JSON.stringify({
                            type: "draw_card"
                        }));
                    });
                }
                break;
            
            case "game_over":
                if(data.players.includes(nickname))
                {
                    gamePlaying = false;
                    showGameOver(data.winner);
                    break;
                }
        }
    };
});

sendButton.addEventListener("click", () => {
    const message = messageInput.value;
    if (message){socket.send(JSON.stringify({
        type: "chat",
        message: message
    }));}
    messageInput.value = "";
});

messageInput.addEventListener("keydown", (event) => {
    if (event.key == "Enter"){
        sendButton.click();
    }
});

window.addEventListener("resize", () => {
    if(gamePlaying){positionPlayers();}
});