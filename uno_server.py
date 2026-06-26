import asyncio
import websockets
import random
import json

import game as uno

lobbies = {}

class Player:
    def __init__(self, nickname, lobby, websocket):
        self.nickname = nickname
        self.websocket = websocket
        self.lobby = lobby

class Lobby:
    def __init__(self):
        self.players = []
        self.activeplayers = []
        self.id = generate_lobby()
        self.game = None
        self.host = None

def generate_lobby():
    charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
    return "".join(random.choice(charset) for i in range(8))
    
async def handler(websocket):
    player_lobby = None

    async def broadcast(message, raw = False):
        disconnected = []

        for player in player_lobby.players:
            try:
                client = player.websocket
                if raw: await client.send(message)
                else:
                    await client.send(json.dumps({
                        "type": "chat",
                        "message": message
                    }))
            except:
                disconnected.append(player)
        
        for player in disconnected:
            player_lobby.players.remove(player)

    addr = websocket.remote_address

    try:
        async for message in websocket:
            data = json.loads(message)
            
            match data["type"]:
                case "play-again":
                    if player_lobby.game:
                        await websocket.send(json.dumps({
                            "type": "join_failed",
                            "reason": "Game is ongoing; this webpage will be shortly refreshed."
                        }))
                        print("Connection failed.")
                        return None
                    player_lobby.activeplayers.append(playerinf)
                    player_lobby.host = player_lobby.activeplayers[0]
                    await broadcast(json.dumps({
                        "type": "waiting_update",
                        "lobby": player_lobby.id,
                        "players": [player.nickname for player in player_lobby.activeplayers],
                        "host": player_lobby.host.nickname
                    }), raw = True)
                case "join_lobby":
                    print("request sent")
                    lobby = data["lobby"]
                    if lobby:
                        if lobby not in lobbies:
                            await websocket.send(json.dumps({
                                "type": "join_failed",
                                "reason": "Lobby does not exist."
                            }))
                            print("Connection fault.")
                            return None
                        elif len(lobbies[lobby][0].players) == 4:
                            await websocket.send(json.dumps({
                                "type": "join_failed",
                                "reason": "Lobby is full (4 members)."
                            }))         
                            print("Connection fault.")
                            return None
                        elif len(lobbies[lobby][0].players) != 0 and len(lobbies[lobby][0].activeplayers) == 0:
                            await websocket.send(json.dumps({
                                "type": "join_failed",
                                "reason": "Game is already in progress."
                            }))         
                            print("Connection fault.")
                            return None
                        else:
                            nick = data["nickname"]
                            old_lobby = lobbies[lobby][0]
                            playerinf = Player(nickname=nick, lobby=old_lobby, websocket=websocket)
                            old_lobby.players.append(playerinf)
                            old_lobby.activeplayers.append(playerinf)
                            player_lobby = old_lobby
                            await websocket.send(json.dumps({
                                "type": "join_success",
                                "lobby": old_lobby.id,
                            }))

                            await broadcast(json.dumps({
                                "type": "waiting_update",
                                "lobby": old_lobby.id,
                                "players": [player.nickname for player in old_lobby.activeplayers],
                                "host": old_lobby.host.nickname
                            }), raw = True)
                            print(f"New client connected with nickname {nick} at address {addr}.")
                            print(f"Lobby ID: {playerinf.lobby.id}")
                            await broadcast(f"{nick} has joined the chat.")
                    else:
                        nick = data["nickname"]
                        new_lobby = Lobby()
                        playerinf = Player(nickname=nick, lobby=new_lobby, websocket=websocket)
                        new_lobby.host = playerinf
                        new_lobby.players.append(playerinf)
                        new_lobby.activeplayers.append(playerinf)
                        lobbies[new_lobby.id] = [new_lobby, []]
                        player_lobby = new_lobby
                        await websocket.send(json.dumps({
                            "type": "join_success",
                            "lobby": new_lobby.id,
                        }))

                        await broadcast(json.dumps({
                            "type": "waiting_update",
                            "lobby": new_lobby.id,
                            "players": [player.nickname for player in new_lobby.players],
                            "host": new_lobby.host.nickname
                        }), raw = True)
                        print(f"New client connected with nickname {nick} at address {addr}.")
                        print(f"Lobby ID: {playerinf.lobby.id}")
                        await broadcast(f"{nick} has joined the chat.")
                
                case "start_game":
                    print("ALL LOBBIES:")
                    for lobby in lobbies:
                        print(f"Lobby name: {lobby}")
                        print(f"Members: {[player.nickname for player in lobbies[lobby][0].players]}")

                    await broadcast(json.dumps({
                        "type": "start_game",
                        "players": [player.nickname for player in player_lobby.activeplayers]
                    }), raw = True)

                    unoplayerlist = lobbies[player_lobby.id][1]
                    for player in player_lobby.activeplayers:
                        unoplayerlist.append(uno.Player(player.nickname))

                    player_lobby.activeplayers = []

                    player_lobby.game = uno.Game(unoplayerlist, zeroseven = False)

                    await broadcast(json.dumps({
                        "type": "game_update",
                        "players": [player.nickname for player in unoplayerlist],
                        "cards": [player_lobby.game.display_cards(player.cards) for player in unoplayerlist],
                        "discard": player_lobby.game.display_card(player_lobby.game.discardpile[-1]),
                        "curplayer": player_lobby.game.curplayer.nickname,
                        "color": player_lobby.game.color
                    }), raw = True)
                
                case "chat":
                    mess = data["message"]
                    await broadcast(f"{nick}: {mess}")

                case "play_card":
                    ind = data["card_index"]
                    card = player_lobby.game.display_card(player_lobby.game.curplayer.cards[ind])
                    res = player_lobby.game.play_card(player_lobby.game.curplayer.cards[ind], servercolor = data["color"] if "Wild" in card else None)
                    unoplayerlist = lobbies[player_lobby.id][1]
                    if res:
                        if player_lobby.game.gameended:
                            await broadcast(json.dumps({
                                "type": "game_over",
                                "players": [player.nickname for player in unoplayerlist],
                                "winner": player_lobby.game.winner.nickname
                            }), raw = True)

                            player_lobby.game = None
                            lobbies[player_lobby.id][1] = []
                        else:
                            await broadcast(json.dumps({
                                "type": "game_update",
                                "players": [player.nickname for player in unoplayerlist],
                                "cards": [player_lobby.game.display_cards(player.cards) for player in unoplayerlist],
                                "discard": player_lobby.game.display_card(player_lobby.game.discardpile[-1]),
                                "curplayer": player_lobby.game.curplayer.nickname,
                                "color": player_lobby.game.color
                            }), raw = True)
                
                case "draw_card":
                    player_lobby.game.draw_from_pile(player_lobby.game.curplayer)
                    player_lobby.game.move_next()
                    unoplayerlist = lobbies[player_lobby.id][1]
                    await broadcast(json.dumps({
                        "type": "game_update",
                        "players": [player.nickname for player in unoplayerlist],
                        "cards": [player_lobby.game.display_cards(player.cards) for player in unoplayerlist],
                        "discard": player_lobby.game.display_card(player_lobby.game.discardpile[-1]),
                        "curplayer": player_lobby.game.curplayer.nickname,
                        "color": player_lobby.game.color
                    }), raw = True)

            print("Received:", message)
    
    except websockets.ConnectionClosed:
        print(f"{nick} disconnected.")

    except Exception as e:
        print("Error:", e)

    finally:
        if playerinf in player_lobby.players: player_lobby.players.remove(playerinf)
        if len(player_lobby.players) == 0:
            lobbies.pop(player_lobby.id)
        else:
            '''if player_lobby.game:
                player_lobby.host = player_lobby.activeplayers[0]
                await broadcast(json.dumps({
                    "type": "waiting_update",
                    "lobby": player_lobby.id,
                    "players": [player.nickname for player in player_lobby.players],
                    "host": player_lobby.host.nickname
                }), raw = True)'''
            await broadcast(f"{nick} disconnected.")
        print(lobbies)

async def main():
    async with websockets.serve(handler, "localhost", 5555):
        print("Server running...")
        await asyncio.Future()

asyncio.run(main())