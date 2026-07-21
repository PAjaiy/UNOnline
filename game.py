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

class Game:
    def __init__(self, players=[], zeroseven=False, stackable=False):
        self.players = players
        self.curind = random.randint(0, len(players)-1)
        self.curplayer = players[self.curind]
        self.discardpile = []
        self.direction = 1
        self.gameended = False
        self.winner = None

        self.zeroseven = zeroseven
        self.stackable = stackable

        self.stackamt = 0
        self.stacktype = 0

        self.drawpile = []
        
        self.create_drawpile()
        self.create_drawpile()

        while self.drawpile[-1-len(players)*7].special != "Number":
            self.drawpile = []
            self.create_drawpile()
        
        self.assign_cards()
        self.discardpile.append(self.drawpile.pop())

        self.color = self.discardpile[-1].color
    
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

    def twos_present(self):
        nextplayer = self.players[(self.curind + self.direction) % len(self.players)]
        return any("Draw Two" in self.display_card(card) for card in nextplayer.cards)

    def fours_present(self):
        nextplayer = self.players[(self.curind + self.direction) % len(self.players)]
        return any("Draw Four" in self.display_card(card) for card in nextplayer.cards)

    def play_card(self, card, servercolor = None, serverplayer = None, validmove = None):
        player = self.players[self.curind]

        valid = validmove
        
        if valid == "draw":
            if self.stackable == False or (self.stackable and not self.stacktype):
                self.draw_from_pile(self.curplayer)
                self.move_next()
                return True
            else:
                self.stacktype = 0
                for k in range(self.stackamt): self.draw_from_pile(self.curplayer)
                self.stackamt = 0
                self.move_next()
                return True

        if self.stackable == False or (self.stackable and not self.stacktype):
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
        else:
            if (card.special == "Draw Two" and self.stacktype == 2) or (card.special == "Draw Four" and self.stacktype == 4):
                valid = "hold"
        
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
                swapper = serverplayer
                swapper.cards, self.curplayer.cards = self.curplayer.cards, swapper.cards
        elif valid == "spl":
            if card.special == "Skip": self.move_next()
            elif card.special == "Reverse":
                if len(self.players) == 2:
                    self.move_next()
                else: self.direction *= -1
            elif card.special == "Draw Two":
                if self.stackable:
                    self.stacktype = 2
                    self.stackamt = self.stacktype
                else:
                    self.move_next()
                    self.draw_from_pile(self.curplayer)
                    self.draw_from_pile(self.curplayer)

        elif valid == "wild4":
            if self.stackable:
                self.stacktype = 4
                self.stackamt = self.stacktype
            else:
                self.move_next()
                for i in range(4): self.draw_from_pile(self.curplayer)
        
        elif valid == "hold":
            self.stackamt += self.stacktype
        
        self.move_next()
        return True