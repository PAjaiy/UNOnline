import asyncio
import websockets
import random
import json
import os

import game as uno

MAX_PLAYERS = 5
lobbies = {}

class User:
    def __init__(self, nickname, lobby, websocket):
        self.nickname = nickname
        self.websocket = websocket
        self.lobby = lobby

class Lobby:
    def __init__(self):
        self.users = [] # users can always chat in their lobby
        self.activeusers = [] # active users are involved in the game
        self.id = generate_lobby()
        self.game = None
        self.host = None

def generate_lobby():
    charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
    return "".join(random.choice(charset) for i in range(8))
    
async def handler(websocket):
    my_lobby = None
    my_user = None

    ingameover = [False]

    async def setgameover():
        nonlocal ingameover
        ingameover[0] = True
        await activebroadcast(json.dumps({
            "type": "game_over",
            "players": [player.nickname for player in lobbies[my_lobby.id][1]],
            "winner": my_lobby.game.winner.nickname
        }), raw = True)

        my_lobby.game = None
        lobbies[my_lobby.id][1] = []
        my_lobby.activeusers = []

    async def broadcast(message, raw = False):
        for user in my_lobby.users:
            client = user.websocket
            if raw:
                try: 
                    await client.send(message)
                except websockets.exceptions.ConnectionClosedOK:
                    pass
            else:
                try:
                    await client.send(json.dumps({
                        "type": "chat",
                        "message": message
                    }))
                except websockets.exceptions.ConnectionClosedOK:
                    pass

    async def activebroadcast(message, raw = False):
        for user in my_lobby.activeusers:
            client = user.websocket
            if raw:
                try: 
                    await client.send(message)
                except websockets.exceptions.ConnectionClosedOK:
                    pass
            else:
                try:
                    await client.send(json.dumps({
                        "type": "chat",
                        "message": message
                    }))
                except websockets.exceptions.ConnectionClosedOK:
                    pass

    addr = websocket.remote_address

    try:
        join_message = await websocket.recv()
    except websockets.exceptions.ConnectionClosedOK:
        print("The user disconnected.")
        return None

    join_data = json.loads(join_message)

    nick = join_data["nickname"]
    lobbyid = join_data["lobby"]

    if join_data["type"] == "join_lobby":
        print("join_lobby message received")
        if lobbyid:
            if lobbyid not in lobbies:
                await websocket.send(json.dumps({
                    "type": "join_failed",
                    "reason": "Lobby does not exist."
                }))
                await websocket.close()
                print("Connection fault.")
                return None
            elif len(lobbies[lobbyid][0].users) == MAX_PLAYERS:
                await websocket.send(json.dumps({
                    "type": "join_failed",
                    "reason": f"Lobby is full ({MAX_PLAYERS} members)."
                }))
                await websocket.close()
                print("Connection fault.")
                return None
            elif lobbies[lobbyid][0].game:
                await websocket.send(json.dumps({
                    "type": "join_failed",
                    "reason": "Game is already in progress."
                }))
                await websocket.close()
                print("Connection fault.")
                return None
            elif join_data["nickname"] in [user.nickname for user in lobbies[lobbyid][0].users]:
                await websocket.send(json.dumps({
                    "type": "join_failed",
                    "reason": "Nickname already used in lobby; choose a different one."
                }))
                await websocket.close()
                print("Connection fault.")
                return None
            else:
                my_lobby = lobbies[lobbyid][0]
        else:
            my_lobby = Lobby()

    if not lobbyid: 
        lobbyid = my_lobby.id
        lobbies[lobbyid] = [my_lobby, []]

    my_user = User(nick, my_lobby, websocket)
                
    my_lobby.users.append(my_user)
    my_lobby.activeusers.append(my_user)

    await websocket.send(json.dumps({
        "type": "join_success",
        "lobby": lobbyid
    }))
    
    print(f"New client connected with nickname {nick} at address {addr}.")
    print(f"Lobby ID: {lobbyid}")
    await broadcast(f"{nick} has joined the lobby.")

    my_lobby.host = my_lobby.activeusers[0]

    await activebroadcast(json.dumps({
        "type": "waiting_update",
        "lobby": lobbyid,
        "users": [user.nickname for user in my_lobby.activeusers],
        "host": my_lobby.host.nickname
    }), raw = True)
    
    try:
        print("user loop started")
        async for message in websocket:
            data = json.loads(message)
            
            match data["type"]:
                case "play-again":
                    if nick not in [user.nickname for user in my_lobby.users]:
                        await websocket.send(json.dumps({
                            "type": "join_failed",
                            "reason": "User did not join before game started; this webpage will be shortly refreshed."
                        }))
                        print("Connection failed.")
                        return None
                    
                    ingameover[0] = False
                    my_lobby.activeusers.append(my_user)
                    my_lobby.host = my_lobby.activeusers[0]

                    await activebroadcast(json.dumps({
                        "type": "waiting_update",
                        "lobby": my_lobby.id,
                        "users": [user.nickname for user in my_lobby.activeusers],
                        "host": my_lobby.host.nickname
                    }), raw = True)
                
                case "leave-lobby":
                    ingameover[0] = True
                    print("GAME OVER")
                    break

                case "start_game":
                    my_lobby.host = None

                    await activebroadcast(json.dumps({
                        "type": "start_game",
                        "players": [user.nickname for user in my_lobby.activeusers]
                    }), raw = True)

                    unoplayerlist = lobbies[my_lobby.id][1]
                    for user in my_lobby.activeusers:
                        player = uno.Player(user.nickname)
                        unoplayerlist.append(player)

                    my_lobby.users = my_lobby.activeusers.copy()

                    iszeroseven = data["zeroseven"]
                    isstack = data["stack"]

                    my_lobby.game = uno.Game(unoplayerlist, zeroseven = iszeroseven, stackable = isstack)

                    await activebroadcast(json.dumps({
                        "type": "game_update",
                        "players": [player.nickname for player in unoplayerlist],
                        "cards": [my_lobby.game.display_cards(player.cards) for player in unoplayerlist],
                        "discard": my_lobby.game.display_card(my_lobby.game.discardpile[-1]),
                        "curplayer": my_lobby.game.curplayer.nickname,
                        "color": my_lobby.game.color,
                        "zeroseven": my_lobby.game.zeroseven,
                        "stack": my_lobby.game.stackamt
                    }), raw = True)
                    
                    print("Broadcasted game update")
                
                case "chat":
                    mess = data["message"]
                    await broadcast(f"{nick}: {mess}")

                case "play_card":
                    ind = data["card_index"]
                    card = my_lobby.game.display_card(my_lobby.game.curplayer.cards[ind])
                    unoplayerlist = lobbies[my_lobby.id][1]
                    res = my_lobby.game.play_card(my_lobby.game.curplayer.cards[ind], servercolor = data["color"] if "Wild" in card else None, serverplayer = unoplayerlist[[player.nickname for player in unoplayerlist].index(data["player"])] if my_lobby.game.zeroseven and "7" in card else None)
                    if res:
                        if my_lobby.game.gameended:
                            await setgameover()
                        else:
                            await broadcast(json.dumps({
                                "type": "game_update",
                                "players": [player.nickname for player in unoplayerlist],
                                "cards": [my_lobby.game.display_cards(player.cards) for player in unoplayerlist],
                                "discard": my_lobby.game.display_card(my_lobby.game.discardpile[-1]),
                                "curplayer": my_lobby.game.curplayer.nickname,
                                "color": my_lobby.game.color,
                                "zeroseven": my_lobby.game.zeroseven,
                                "stack": my_lobby.game.stackamt
                            }), raw = True)
                
                case "draw_card":
                    my_lobby.game.play_card(None, validmove="draw")

                    unoplayerlist = lobbies[my_lobby.id][1]
                    await broadcast(json.dumps({
                        "type": "game_update",
                        "players": [player.nickname for player in unoplayerlist],
                        "cards": [my_lobby.game.display_cards(player.cards) for player in unoplayerlist],
                        "discard": my_lobby.game.display_card(my_lobby.game.discardpile[-1]),
                        "curplayer": my_lobby.game.curplayer.nickname,
                        "color": my_lobby.game.color,
                        "zeroseven": my_lobby.game.zeroseven,
                        "stack": my_lobby.game.stackamt
                    }), raw = True)
    finally:

        if ingameover[0]:
            if my_user in my_lobby.users: my_lobby.users.remove(my_user)
            return None

        if my_lobby.game:
            unoplayerlist = lobbies[lobbyid][1]
            for plyr in unoplayerlist:
                if plyr.nickname == nick:
                    my_player = plyr
                    break

            if len(my_lobby.users) > 2:
                if my_lobby.game.curplayer == my_player:
                    my_lobby.game.move_next()

                player_hand = my_player.cards

                if my_lobby.game.stackable and my_lobby.game.stacktype:
                    for u in range(my_lobby.game.stackamt):
                        my_lobby.game.draw_from_pile(my_player)
                    my_lobby.game.stacktype = 0
                    my_lobby.game.stackamt = 0
                
                my_lobby.game.drawpile.extend(player_hand)
                random.shuffle(my_lobby.game.drawpile)
                my_lobby.game.players.remove(my_player)

                new_curind = my_lobby.game.players.index(my_lobby.game.curplayer)
                my_lobby.game.curind = new_curind

                await broadcast(json.dumps({
                    "type": "game_update",
                    "players": [player.nickname for player in unoplayerlist],
                    "cards": [my_lobby.game.display_cards(player.cards) for player in unoplayerlist],
                    "discard": my_lobby.game.display_card(my_lobby.game.discardpile[-1]),
                    "curplayer": my_lobby.game.curplayer.nickname,
                    "color": my_lobby.game.color,
                    "zeroseven": my_lobby.game.zeroseven,
                    "stack": my_lobby.game.stackamt
                }), raw = True)

                my_lobby.users.remove(my_user)
                my_lobby.activeusers.remove(my_user)
                
            elif len(my_lobby.users) == 2:
                my_lobby.game = None
                lobbies[lobbyid][1] = []

                my_lobby.users.remove(my_user)
                my_lobby.activeusers.remove(my_user)

                my_lobby.host = my_lobby.activeusers[0]
                await activebroadcast(json.dumps({
                    "type": "waiting_update",
                    "lobby": lobbyid,
                    "users": [user.nickname for user in my_lobby.activeusers],
                    "host": my_lobby.host.nickname
                }), raw = True)

        else:
            my_lobby.users.remove(my_user)
            if len(my_lobby.users) == 0:
                lobbies.pop(lobbyid)
                return None
            
            try:
                my_lobby.activeusers.remove(my_user)
            except:
                return None
            
            my_lobby.host = my_lobby.activeusers[0]
            await activebroadcast(json.dumps({
                "type": "waiting_update",
                "lobby": lobbyid,
                "users": [user.nickname for user in my_lobby.activeusers],
                "host": my_lobby.host.nickname
            }), raw = True)

PORT = int(os.environ.get("PORT", 5555))

async def main():
    async with websockets.serve(handler, "0.0.0.0", PORT):
        print(f"Server running on port {PORT}...")
        await asyncio.Future()

asyncio.run(main())