let socket;

const joinButton = document.getElementById("join-button");
const game = document.getElementById("game-container");

const messageBody = document.getElementById("message-body");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");

let wait = document.getElementById("waiting-box");
let table = document.getElementById("table-area");

let nickname, lobby;
let helpButton;
let popUpHelp = false;
let allInfoHolder;
let curPage = 1;

let startButton;
let canStart = false;

let joined = false;
let gamePlaying = false;
let inGameOver = false;

let animationId = null;
let running = false;
let previous = 0;

let joinFailed = false;

let backgroundOffset = 0;
const backgroundSpeed = 15;

if (!socket){
	const WS_URL = location.hostname === "localhost" ? "ws://localhost:5555" : "wss://unonline-production.up.railway.app";
	socket = new WebSocket(WS_URL);
}

hideGameContainer();

// functions

function startBackgroundAnimation(){
	if (running) return;

	running = true;
	previous = performance.now();
	animationId = requestAnimationFrame(animate);
}

function stopBackgroundAnimation(){
	running = false;

	if (animationId != null) {
		cancelAnimationFrame(animationId);
		animationId = null;
	}
}

function animate(now){
	if (!running) return;

	const dt = (now - previous) / 1000;
	previous = now;

	backgroundOffset = (backgroundOffset + backgroundSpeed * dt) % 1756;

	const holders = document.querySelectorAll(".three-holder");

	holders.forEach((holder, i) => {
		const rows = holder.children;

		const firstRow = rows[0];
		const secondRow = rows[1];
		const thirdRow = rows[2];

		if (i % 2 == 0){
			firstRow.style.transform = `translateY(-${backgroundOffset}px)`;
			secondRow.style.transform = `translateY(-${backgroundOffset}px)`;
			thirdRow.style.transform = `translateY(-${backgroundOffset}px)`;
		}
		else{
			firstRow.style.transform = `translateY(${backgroundOffset}px)`;
			secondRow.style.transform = `translateY(${backgroundOffset}px)`;
			thirdRow.style.transform = `translateY(${backgroundOffset}px)`;
		}
	});

	animationId = requestAnimationFrame(animate);
}

function hideJoinScreen() {
    const joinScreen = document.getElementById("join-screen");
    joinScreen.classList.add("hidden");
}

function hideGameContainer() {
    if(game.classList.contains("active")){game.classList.remove("active");}
    game.classList.add("hidden");
}

function showGameContainer() {
    if(game.classList.contains("hidden")){game.classList.remove("hidden");}
    game.classList.add("active");
}

function hideWaitingBox() {
    if(allInfoHolder.classList.contains("active")){allInfoHolder.classList.remove("active");}
    allInfoHolder.classList.add("hidden");
}

function showWaitingBox() {
    if(allInfoHolder.classList.contains("hidden")){allInfoHolder.classList.remove("hidden");}
    allInfoHolder.classList.add("active");

	startBackgroundAnimation();
}

function positionPlayers() {
    if (!gamePlaying) {return;}

	const gBoard = document.getElementById("game-board");
    const players = document.querySelectorAll(".player");
    const pile = document.querySelector(".piles");

    const width = gBoard.clientWidth;
    const height = gBoard.clientHeight;

	const margin = 40;

	if (players.length == 2){
		players.forEach((player, i) => {
			player.style.left = "50%";

			if (i === 0){player.style.bottom = margin + "px";}
			else{player.style.top = margin + "px";}
		});
	}
	else if (players.length == 3){
		const player1 = players[0];
		const player2 = players[1];
		const player3 = players[2];

		player1.style.left = "50%";
		player1.style.bottom = margin + "px";

		const gap = 20;

		const w1 = player2.offsetWidth;
		const w2 = player3.offsetWidth;

		const total = w1 + gap + w2;

		player2.style.top = margin + "px";
		player3.style.top = margin + "px";

		player2.style.left = `calc(50% - ${total/2}px)`;
		player3.style.left = `calc(50% + ${total/2-w2}px)`;
	}
	else if(players.length == 4){
		const player1 = players[0];
		const player2 = players[1];
		const player3 = players[2];
		const player4 = players[3];

		player1.style.left = "50%";
		player1.style.bottom = margin + "px";

		player3.style.left = "50%";
		player3.style.top = margin + "px";

		player2.style.top = "50%";
		player2.style.left = margin + "px";

		player4.style.top = "50%";
		player4.style.right = margin + "px";
	}
	else if(players.length == 5){
		const player1 = players[0];
		const player2 = players[1];
		const player3 = players[2];
		const player4 = players[3];
		const player5 = players[4];

		player1.style.left = "50%";
		player1.style.bottom = margin + "px";

		player2.style.top = "50%";
		player2.style.left = margin + "px";

		const gap = 20;

		const w1 = player3.offsetWidth;
		const w2 = player4.offsetWidth;

		const total = w1 + gap + w2;

		player3.style.top = margin + "px";
		player4.style.top = margin + "px";

		player3.style.left = `calc(50% - ${total/2}px)`;
		player4.style.left = `calc(50% + ${total/2-w2}px)`;

		player5.style.top = "50%";
		player5.style.right = margin + "px";
	}

    pile.style.left = width/2 + "px";
    pile.style.top = height/2 + "px";
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

function addChatMessage(content) {
    const message = document.createElement("div");
    message.classList.add("message");
    message.textContent = content;
    messageBody.appendChild(message);
}

function showGameOver(winner) {
    inGameOver = true;
    table.innerHTML = "";

    const overlay = document.createElement("div");
    overlay.classList.add("game-over");

    overlay.innerHTML = `
        <h2>${winner} wins!</h2>
        <button id="play-again" class="play-again">Play Again</button>
        <button id="leave-lobby" class="leave-lobby">Leave Lobby</button>
    `;

    table.appendChild(overlay);

    document.getElementById("play-again").onclick = () => {
        inGameOver = false;

        socket.send(JSON.stringify({
            type: "play-again"
        }));
        overlay.remove();
    }
        
    document.getElementById("leave-lobby").onclick = () => {

        socket.send(JSON.stringify({
            type: "leave-lobby"
        }));
		
        socket.close();
        location.reload();
    };
}

function addHelpSection(text, imageSrc){
	const helpSec = document.createElement("div");
	helpSec.classList.add("help-section");

	const p = document.createElement("div");
	p.innerHTML = text;
	p.classList.add("help-para");

	const img = document.createElement("img");
	img.src = imageSrc;
	img.classList.add("help-image");

	const helpBody = document.getElementById("help-body");
	helpSec.append(p, img);

	helpBody.appendChild(helpSec);
}

function refreshPopup(){
	const helpBody = document.getElementById("help-body");
	helpBody.innerHTML = "";

	if (curPage == 1)
	{
		addHelpSection("Be the <b>first</b> player to get rid of all your cards.<br>Try to match the top discard card by <b>color, number, or symbol</b> during your turn.<br>If you cannot, draw one card.", 
			"assets/help/basic_controls.png");

		const imageHolder1 = document.createElement("div");
		imageHolder1.classList.add("image-holder");

		const image1 = document.createElement("img");
		image1.src = "assets/help/valid_cards.png";
		image1.classList.add("normal-help-image");

		imageHolder1.appendChild(image1);
		helpBody.appendChild(imageHolder1);
	}
	else if (curPage == 2)
	{
		addHelpSection("<b>Skip cards</b> skips the next player's turn.<br><b>Reverse cards</b> reverses the current direction of playing, and is a skip card with 2 players.<br><b>Draw Two cards</b> makes the next player draw two cards and skip their turn.<b>*</b>", 
			"assets/help/special_cards_1.png");

		addHelpSection("<b>Wild cards</b> lets the player playing it choose the next color to be played.<br><b>Wild Draw Four cards</b> act as both wild cards and \"Draw Four\" cards.<b>*</b>",
			"assets/help/special_cards_2.png");
	}
	else {
		const holder = document.createElement("div");
		holder.classList.add("last-holder");

		const text1 = document.createElement("div");
		const text2 = document.createElement("div");

		text1.classList.add("help-text");
		text2.classList.add("help-text");

		text1.innerHTML = "<b>*Stacking:</b> When this mode is enabled, a player playing a Draw Two or a Wild Draw Four card can let the next player 'stack' the card penalty with the same type of card (Draw Twos only stack on other Draw Twos, for example). The last person unable to play the same card will click on the draw pile to <b>take the penalty of all stacked cards.</b>";
		text2.innerHTML = "<b>**7-0 rule:</b> According to this rule, when a player plays a card with a number 7 on it, they can swap their hand with the person they choose. If they play a card with the number 0 on it, each player will pass on their hand to the player next to them in the current playing direction.";

		holder.append(text1, text2);
		helpBody.append(holder);
	}

	const headerNavig = document.getElementById("header-navig");
	const num = headerNavig.querySelector("div");

	num.textContent = curPage + "/3";
}

// event listeners
joinButton.addEventListener("click", () => {
    nickname = document.getElementById("nickname-input").value.trim();
    lobby = document.getElementById("lobby-input").value.trim();

    if (!nickname || nickname.length > 25) {return;}
    joinButton.disabled = true;

    socket.send(JSON.stringify({
        type: "join_lobby",
        nickname: nickname,
        lobby: lobby
    }));
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
    positionPlayers();
});

// socket
socket.onmessage = (event) => {
	const data = JSON.parse(event.data);
	switch(data.type) {
		case "join_success":
            joined = true;

			hideJoinScreen();
            showGameContainer();

            const top = document.getElementById('top-player');
			top.innerHTML = "";

			const text = document.createElement("span");
			text.textContent = "Lobby code: " + data["lobby"];

			helpButton = document.createElement("button");
			helpButton.disabled = false;
			helpButton.id = "help-button";
			helpButton.textContent = "?";
			
			top.appendChild(text);
			top.appendChild(helpButton);

			helpButton.addEventListener("click", () => {
				const helpPopup = document.getElementById("help-popup");
				if (popUpHelp == false){
					popUpHelp = true;
					helpPopup.classList.remove("hidden");
					helpButton.textContent = "x";
				}
				else{
					popUpHelp = false;
					helpPopup.classList.add("hidden");
					helpButton.textContent = "?";
				}
			})

			break;
		
		case "join_failed":
			socket.close(1000, "Join failed.");
			socket = null;
			joinButton.disabled = false;
			joinFailed = true;
			alert(data.reason);
			location.reload();
			break;

		case "chat":
			addChatMessage(data.message);
			break;

		case "waiting_update":
			gamePlaying = false;
		
			helpButton = document.getElementById("help-button");
			helpButton.disabled = false;

			allInfoHolder = document.createElement("div");
			allInfoHolder.id = "all-info-holder";

			table.innerHTML = "";
			table.style.backgroundColor = "rgba(17, 17, 17, 0.9)";

			const allCardSets = document.createElement("div");
			allCardSets.classList.add("all-cards");

			for (let ind = 0; ind <= 16; ind++){
				const tripleRow = document.createElement("div");
				tripleRow.classList.add("three-holder");

				for (let rep = 0; rep <= 2; rep++){
					const row = document.createElement("div");
					row.classList.add("row-box");

					const rowImage = document.createElement("img");
					rowImage.src = "assets/rows/row" + String(ind%13 + 1) + ".png";
					row.appendChild(rowImage);

					tripleRow.appendChild(row);
				}
				allCardSets.appendChild(tripleRow);
			}

			table.appendChild(allCardSets);

			table.appendChild(allInfoHolder);
			allInfoHolder.appendChild(wait);

			wait.innerHTML = "";
            showWaitingBox();

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

			wait.appendChild(lobbyRow);

			const descBoxes = document.createElement("div");
			descBoxes.id = "two-boxes";

			const playerDisplay = document.createElement("div");
			playerDisplay.id = "player-list";

			const playerhead = document.createElement("div");
			playerhead.innerHTML = "<b>Players:</b>"

			playerDisplay.appendChild(playerhead);

			const playerSec = document.createElement("div");
			playerSec.id = "player-show";
			for (const player of data.users){
				const div = document.createElement("div");
				div.textContent = "• " + player;
				playerSec.appendChild(div);
			}
			playerDisplay.appendChild(playerSec);

			const div1 = document.createElement("div");
			div1.innerHTML = "<b>" + String(data.users.length) + "/4 players joined.</b>";
			if(data.users.length < 2) {div1.style.color = "red"; canStart = false;}
			else {canStart = true;}
			playerDisplay.appendChild(div1);

			wait.appendChild(descBoxes);
			descBoxes.appendChild(playerDisplay);

			if(data.host == nickname){		
				const hostDisplay = document.createElement("div");
				hostDisplay.id = "host-display";

				const div = document.createElement("div");
				div.innerHTML = "<b>Host controls:</b>";
				hostDisplay.appendChild(div);

				const hostSec = document.createElement("div");
				hostSec.id = "host-show";
				
				const label = document.createElement('label');
				label.classList.add("checkbox-label");

				const zeroseven = document.createElement('input');
				zeroseven.type = 'checkbox';
				zeroseven.id = 'zeroseven';

				const text = document.createElement("span");
				text.textContent = "Enable 7-0 rule";

				label.appendChild(zeroseven);
				label.appendChild(text);

				hostSec.appendChild(label);

				const label2 = document.createElement('label');
				label2.classList.add("checkbox-label");

				const stack = document.createElement('input');
				stack.type = 'checkbox';
				stack.id = 'stack';

				const text2 = document.createElement("span");
				text2.textContent = "Enable stacking";

				label2.appendChild(stack);
				label2.appendChild(text2);

				hostSec.appendChild(label2);

				hostDisplay.appendChild(hostSec);

				let startButton = document.createElement("button");
				startButton.id = "start-button";
				startButton.innerHTML = canStart ? "<b>Play!</b>" : "<b>Waiting for players...</b>";
				startButton.classList.add("start-button");

				wait.appendChild(startButton);

				if(!canStart){startButton.disabled = true;}
				else {startButton.disabled = false;}

				startButton.addEventListener("click", () => {
					if(canStart){
						socket.send(JSON.stringify({
							type: "start_game",
							zeroseven: zeroseven.checked,
							stack: stack.checked
						}));
					}
				})

				descBoxes.appendChild(hostDisplay);
			}

			const popup = document.createElement("div");
			popup.id = "help-popup";

			const header = document.createElement("div");
			header.id = "help-header";

			const headerTitle = document.createElement("div");
			headerTitle.id = "header-title";
			headerTitle.textContent = ""

			const headerNavig = document.createElement("div");
			headerNavig.id = "header-navig";

			const prevButton = document.createElement("button");
			const nextButton = document.createElement("button");
			const pageNum = document.createElement("div");

			prevButton.textContent = "<";
			nextButton.textContent = ">";

			prevButton.addEventListener("click", () => {
				curPage = curPage == 1 ? 3 : curPage-1;
				refreshPopup();
			})
			nextButton.addEventListener("click", () => {
				curPage = curPage == 3 ? 1 : curPage+1;
				refreshPopup();
			})
			
			prevButton.classList.add("navig-button");
			nextButton.classList.add("navig-button");

			pageNum.textContent = curPage + "/3";

			headerNavig.appendChild(prevButton);
			headerNavig.appendChild(pageNum);
			headerNavig.appendChild(nextButton);

			header.appendChild(headerTitle);
			header.appendChild(headerNavig);

			const body = document.createElement("div");
			body.id = "help-body";

			popup.appendChild(header);
			popup.appendChild(body);
			allInfoHolder.appendChild(popup);

			refreshPopup();

			if (popUpHelp == false && popup.classList.contains("hidden") == false){popup.classList.add("hidden");}

			break;
		
		case "start_game":
			popUpHelp = false;
			helpButton = document.getElementById("help-button");
			helpButton.textContent = "?";
			helpButton.disabled = true;
			curPage = 1;

			if(data.players.includes(nickname))
			{
				gamePlaying = true;
				hideWaitingBox();
				break;
			}

		case "game_update":
			if(data.players.includes(nickname))
			{
				stopBackgroundAnimation();
				table.innerHTML = "";

				const gameBoard = document.createElement("div");
				gameBoard.id = "game-board";
				table.appendChild(gameBoard);

				const allPlayers = data["players"];
				const disCard = data["discard"];
				const curPlayer = data["curplayer"];
				const allCards = data["cards"];

				const piles = document.createElement("div");
				piles.classList.add("piles");

				const drawDiscard = document.createElement("div");
				drawDiscard.classList.add("draw-dis");

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

				drawDiscard.appendChild(drawPile);
				drawDiscard.appendChild(discardPile);   

				const moreInfo = document.createElement("div");
				moreInfo.classList.add("more-info");
				moreInfo.style.backgroundColor = data["color"].toLowerCase();

				let row2 = null;

				if (data["stack"]) {
					row2 = document.createElement("div");
					row2.innerHTML = "<b>+" + data["stack"] + " stacked!</b>";
					piles.appendChild(row2);
				}

				piles.appendChild(moreInfo);
				piles.append(drawDiscard);

				if (row2){
					piles.appendChild(row2);
				}

				let isCurPlayer = curPlayer == nickname;

				let index = allPlayers.indexOf(nickname);
				const cardList = allCards[index];

				let newAllPlayers = allPlayers.slice(index, allPlayers.length).concat(allPlayers.slice(0, index));
				let newAllCards = allCards.slice(index, allCards.length).concat(allCards.slice(0, index));

				let numPlayers = allPlayers.length;

				const width = gameBoard.clientWidth;
				const height = gameBoard.clientHeight;

				piles.style.left = width/2 + "px";
				piles.style.top = height/2 + "px";

				gameBoard.appendChild(piles);

				const margin = 40;

				for (let i = 0; i < numPlayers; i++){
					const playerDiv = document.createElement("div");
					playerDiv.classList.add("player")

					playerDiv.innerHTML = "";

					const playerHand = document.createElement("div");
					playerHand.classList.add("player-hand");

					let n = newAllCards[i].length;

					if(i != 0)
					{
						const playName = newAllPlayers[i];
						const nameSec = document.createElement("div");
						nameSec.textContent = playName;

						playerDiv.appendChild(nameSec);

						for (let j = 0; j < n; j++){
							const back = document.createElement("img");
							back.classList.add("card");

							const backholder = document.createElement("div");
							backholder.classList.add("card-holder");

							back.src = "assets/cards/backface.png";
							back.style.left = `${i * 20}px`;

							backholder.appendChild(back)
							playerHand.appendChild(backholder);
						}
					}
					
					playerDiv.appendChild(playerHand);
					gameBoard.appendChild(playerDiv);
				}

				const players = document.querySelectorAll(".player");

				if (numPlayers == 2){
					players.forEach((player, i) => {
						player.style.left = "50%";
						player.style.transform = `translateX(-50%)`;

						if (i === 0){player.style.bottom = margin + "px";}
						else{player.style.top = margin + "px";}
					});
				}
				else if (numPlayers == 3){
					const player1 = players[0];
					const player2 = players[1];
					const player3 = players[2];

					player1.style.left = "50%";
					player1.style.transform = `translateX(-50%)`;
					player1.style.bottom = margin + "px";

					const gap = 20;

					const w1 = player2.offsetWidth;
					const w2 = player3.offsetWidth;

					const total = w1 + gap + w2;

					player2.style.top = margin + "px";
					player3.style.top = margin + "px";

					player2.style.left = `calc(50% - ${total/2}px)`;
					player3.style.left = `calc(50% + ${total/2-w2}px)`;
				}
				else if (numPlayers == 4){
					const player1 = players[0];
					const player2 = players[1];
					const player3 = players[2];
					const player4 = players[3];

					player1.style.left = "50%";
					player1.style.transform = `translateX(-50%)`;
					player1.style.bottom = margin + "px";

					player3.style.left = "50%";
					player3.style.transform = `translateX(-50%)`;
					player3.style.top = margin + "px";

					player2.style.top = "50%";
					player2.style.transform = "translateY(-50%)";
					player2.style.left = margin + "px";

					player4.style.top = "50%";
					player4.style.transform = "translateY(-50%)";
					player4.style.right = margin + "px";
				}
				else if (numPlayers == 5){
					const player1 = players[0];
					const player2 = players[1];
					const player3 = players[2];
					const player4 = players[3];
					const player5 = players[4];

					player1.style.left = "50%";
					player1.style.transform = `translateX(-50%)`;
					player1.style.bottom = margin + "px";

					player2.style.top = "50%";
					player2.style.transform = "translateY(-50%)";
					player2.style.left = margin + "px";

					const gap = 20;

					const w1 = player3.offsetWidth;
					const w2 = player4.offsetWidth;

					const total = w1 + gap + w2;

					player3.style.top = margin + "px";
					player4.style.top = margin + "px";

					player3.style.left = `calc(50% - ${total/2}px)`;
					player4.style.left = `calc(50% + ${total/2-w2}px)`;

					player5.style.top = "50%";
					player5.style.transform = "translateY(-50%)";
					player5.style.right = margin + "px";
				}

				for(let k = 0; k < newAllCards.length; k++){
					if(curPlayer == newAllPlayers[k]){
						const curDiv = document.querySelectorAll(".player")[k];
						curDiv.style.borderColor = data.color.toLowerCase();
						break;
					}
				}

				const bottom = document.querySelectorAll(".player")[0];
				bottom.innerHTML = "";
				bottom.id = "my-player";

				function showColorPicker(button, cardIndex) {
					document.querySelector(".color-picker")?.remove();

					const picker = document.createElement("div");
					picker.classList.add("color-picker");

					const rect = button.getBoundingClientRect();
					picker.style.left = rect.left + rect.width/2 - 60 + "px";
					picker.style.top = rect.top - 70 + "px";

					const colors = ["Red", "Yellow", "Green", "Blue"]

					colors.forEach((name, i) => {
						const b = document.createElement("button");
						b.classList.add(name);
						b.classList.add("picker-button");
						
						b.addEventListener("click", () => {
							socket.send(JSON.stringify({
								type: "play_card",
								card_index: cardIndex,
								color: name,
								player: "none"
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

				function showPlayerPicker(button, cardIndex) {
					document.querySelector(".player-picker")?.remove();

					const picker = document.createElement("div");
					picker.classList.add("player-picker");

					const rect = button.getBoundingClientRect();
					picker.style.left = rect.left + rect.width/2 - 65 + "px";
					picker.style.top = rect.top - 10 - (10*newAllPlayers.length) + "px";

					for(let name of newAllPlayers){
						if(name == nickname){
							continue;
						}
						const b = document.createElement("button");
						b.classList.add("player-button");
						b.textContent = name;
						
						b.addEventListener("click", () => {
							socket.send(JSON.stringify({
								type: "play_card",
								card_index: cardIndex,
								color: "none",
								player: name
							}));

							picker.remove();
							return;
						});

						picker.appendChild(b);
					}

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

					button.addEventListener("click", () => {

						if (card.includes("Wild")) {
							showColorPicker(button, i);
						}
						else if (card.includes("7") && data["zeroseven"] == true) {
							showPlayerPicker(button, i);
						}
						else {
							socket.send(JSON.stringify({
								type: "play_card",
								card_index: i,
								color: "none",
								player: "none"
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
				table.style.background = "rgba(17, 17, 17, 0.9)";
				showGameOver(data.winner);
				break;
			}
	}
};