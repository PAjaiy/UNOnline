import random

class Card:
    def __init__(self, color, number, special="Number"):
        self.color = color
        self.number = number
        self.special = special

class Player:
    def __init__(self, nickname, cards=None):
        if cards is None:
            self.cards = []
            self.nickname = nickname
    
    def add_card(self, card):
        self.cards.append(card)
    
    def choose_player(self, playlist):
        nick = ""
        nicklist = [player.nickname for player in playlist]
        while nick not in nicklist:
            nick = input("Enter nickname: ")
        return playlist[nicklist.index(nick)]

class Game:
    def __init__(self, players=[], zeroseven=False):
        self.players = players
        self.curind = random.randint(0, len(players)-1)
        self.curplayer = players[self.curind]
        self.discardpile = []
        self.direction = 1
        self.gameended = False
        self.winner = None
        self.stackable = False

        self.zeroseven = zeroseven

        self.drawpile = []
        self.create_drawpile()
        while self.drawpile[-1-len(players)*7].special.startswith("Wild"):
            self.drawpile = []
            self.create_drawpile()
        
        self.assign_cards()
        self.discardpile.append(self.drawpile.pop())

        self.color = self.discardpile[-1].color
        
        if self.discardpile[-1].special == "Skip":
            self.move_next()
        elif self.discardpile[-1].special == "Reverse":
            self.direction *= -1
        elif self.discardpile[-1].special == "Draw Two":
            self.draw_from_pile(self.curplayer)
            self.draw_from_pile(self.curplayer)
            self.move_next()
    
    def create_drawpile(self):
        for color in ["Red", "Yellow", "Green", "Blue"]:
            for num in [0] + list(range(1, 10))*2:
                self.drawpile.append(Card(color, num))
            
            for i in range(2):
                self.drawpile.append(Card(color, -1, "Skip"))
                self.drawpile.append(Card(color, -1, "Reverse"))
                self.drawpile.append(Card(color, -1, "Draw Two"))
            
        for j in range(4):
            self.drawpile.append(Card(-1, -1, "Wild"))
            self.drawpile.append(Card(-1, -1, "Wild Draw Four"))
        
        random.shuffle(self.drawpile)

    def draw_from_pile(self, player):

        if self.drawpile == []:
            self.drawpile = self.discardpile[:-1]
            self.discardpile = [self.discardpile[-1]]
            random.shuffle(self.drawpile)
        
        card = self.drawpile.pop()
        player.add_card(card)
        return card
    
    def assign_cards(self):
        for player in self.players:
            for n in range(7):
                self.draw_from_pile(player)

    def display_cards(self, lst):
        return [self.display_card(card) for card in lst]

    def display_card(self, el):
        if el.special == "Number": return f"{el.color},{el.number}" 
        else: return f"{el.color},{el.special}"
    
    def move_next(self):
        self.curind = (self.curind + self.direction) % len(self.players)
        self.curplayer = self.players[self.curind]
  
    def play_card(self, card, servercolor = None):
        player = self.players[self.curind]

        valid = False
        if card.special == "Number":
            con1 = self.discardpile[-1].special not in ["Wild", "Wild Draw Four"] and (card.color == self.discardpile[-1].color or card.number == self.discardpile[-1].number)
            con2 = self.discardpile[-1].special in ["Wild", "Wild Draw Four"] and card.color == self.color
            if con1 or con2: 
                valid = "num"
                if self.zeroseven:
                    if card.number == 0: valid += "p"
                    elif card.number == 7: valid += "s"

        elif card.special in ["Skip", "Reverse", "Draw Two"]:
            con1 = self.discardpile[-1].special not in ["Wild", "Wild Draw Four"] and (card.color == self.discardpile[-1].color or self.discardpile[-1].special == card.special)
            con2 = self.discardpile[-1].special in ["Wild", "Wild Draw Four"] and card.color == self.color
            if con1 or con2: valid = "spl"
        
        elif card.special == "Wild": valid = "wild"
        elif card.special == "Wild Draw Four": valid = "wild4"
        
        if not valid: return False

        self.discardpile.append(card)
        player.cards.remove(card)

        if self.curplayer.cards == []:
            self.gameended = True
            self.winner = self.curplayer
            return True
        
        if self.drawpile == []:
            self.drawpile = self.discardpile[:-1]
            self.discardpile = [self.discardpile[-1]]
            random.shuffle(self.drawpile)

        self.color = self.discardpile[-1].color if valid[:4] != "wild" else servercolor

        if valid[:3] == "num":
            if valid[-1] == "p":
                cardlist = [player.cards for player in self.players]
                if self.direction == 1: newlist = [cardlist[-1]] + cardlist[:-1]
                else: newlist = cardlist[1:] + [cardlist[0]]
                for ind, player in enumerate(self.players): player.cards = newlist[ind]
            elif valid[-1] == "s":
                swapper = self.curplayer.choose_player(self.players)
                swapper.cards, self.curplayer.cards = self.curplayer.cards, swapper.cards
        elif valid == "spl":
            if card.special == "Skip": self.move_next()
            elif card.special == "Reverse":
                if len(self.players) == 2:
                    self.move_next()
                else: self.direction *= -1
            elif card.special == "Draw Two":
                self.move_next()
                self.draw_from_pile(self.curplayer)
                self.draw_from_pile(self.curplayer)
        elif valid == "wild4":
            self.move_next()
            for i in range(4): self.draw_from_pile(self.curplayer)
        
        self.move_next()
        return True