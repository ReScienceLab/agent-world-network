package game

// ScoringCtx provides context needed for fan calculation.
type ScoringCtx struct {
	IsTsumo     bool
	Seat        string
	RoundWind   string // "east" | "south" | "west" | "north"
	DiscardSeat string
}

// ScoringResult holds the calculated fan and points.
type ScoringResult struct {
	Fan    int      `json:"fan"`
	Points int      `json:"points"`
	Yaku   []string `json:"yaku"`
}

// CalculateFan computes fan and points for a winning hand.
// hand must include the winning tile. melds are open sets.
func CalculateFan(hand []string, melds []Meld, winTile string, ctx ScoringCtx) ScoringResult {
	allTiles := append(append([]string{}, hand...), meldTiles(melds)...)
	var fan int
	var yaku []string

	add := func(f int, name string) {
		fan += f
		yaku = append(yaku, name)
	}

	// 自摸 (tsumo)
	if ctx.IsTsumo {
		add(1, "自摸")
	}

	// 七对子 (seven pairs) — short-circuit, incompatible with other yaku
	if IsSevenPairs(hand) {
		add(4, "七对子")
		return result(fan, yaku)
	}

	arr := TryArrange(hand)
	if arr == nil {
		return ScoringResult{Yaku: []string{"invalid hand"}}
	}

	allSets := append(arr.Sets, meldSets(melds)...)
	isOpen := len(melds) > 0

	// 平胡 (pinghu): all sequences, pair not a value tile, no open melds
	if !isOpen && allSequences(allSets) && !isValueTile(arr.Pair, ctx) {
		add(1, "平胡")
	}

	// 断幺 (tanyao): no terminals or honors
	if allFunc(allTiles, func(t string) bool { return !IsTerminalOrHonor(t) }) {
		add(1, "断幺")
	}

	// 碰碰胡 (all triplets)
	if allTriplets(allSets) {
		add(4, "碰碰胡")
	}

	// 役牌 (value tiles): dragons + seat wind + round wind triplets
	valueTiles := append([]string{}, Dragons...)
	if sw := SeatWinds[ctx.Seat]; sw != "" {
		valueTiles = append(valueTiles, sw)
	}
	if rw := SeatWinds[ctx.RoundWind]; rw != "" && rw != SeatWinds[ctx.Seat] {
		valueTiles = append(valueTiles, rw)
	}
	for _, vt := range valueTiles {
		for _, s := range allSets {
			if s.Type == "triplet" && len(s.Tiles) > 0 && s.Tiles[0] == vt {
				add(1, "役牌("+vt+")")
				break
			}
		}
	}

	// Flush detection (only non-honor tiles count for suit)
	suits := suitSet(allTiles)
	hasHonors := anyFunc(allTiles, IsHonor)
	if len(suits) == 1 {
		if hasHonors {
			add(3, "混一色")
		} else {
			add(6, "清一色")
		}
	}

	// 字一色 (all honors)
	if allFunc(allTiles, IsHonor) {
		add(8, "字一色")
	}

	return result(fan, yaku)
}

func result(fan int, yaku []string) ScoringResult {
	points := fan * 4
	if points < 8 {
		points = 8
	}
	return ScoringResult{Fan: fan, Points: points, Yaku: yaku}
}

func isValueTile(tile string, ctx ScoringCtx) bool {
	for _, d := range Dragons {
		if tile == d {
			return true
		}
	}
	if SeatWinds[ctx.Seat] == tile {
		return true
	}
	if SeatWinds[ctx.RoundWind] == tile {
		return true
	}
	return false
}

func allSequences(sets []MeldSet) bool {
	for _, s := range sets {
		if s.Type != "sequence" {
			return false
		}
	}
	return len(sets) > 0
}

func allTriplets(sets []MeldSet) bool {
	for _, s := range sets {
		if s.Type != "triplet" {
			return false
		}
	}
	return len(sets) > 0
}

func suitSet(tiles []string) map[byte]bool {
	m := make(map[byte]bool)
	for _, t := range tiles {
		if !IsHonor(t) {
			_, _, suit := tileComponents(t)
			m[suit] = true
		}
	}
	return m
}

func tileComponents(tile string) (num int, suitStr string, suit byte) {
	s, n := TileValue(tile)
	return n, string(s), s
}

func meldTiles(melds []Meld) []string {
	var tiles []string
	for _, m := range melds {
		tiles = append(tiles, m.Tiles...)
	}
	return tiles
}

func meldSets(melds []Meld) []MeldSet {
	var sets []MeldSet
	for _, m := range melds {
		t := m.Type
		if t == "gang" {
			t = "triplet"
		}
		sets = append(sets, MeldSet{Type: t, Tiles: m.Tiles})
	}
	return sets
}

func allFunc(tiles []string, fn func(string) bool) bool {
	for _, t := range tiles {
		if !fn(t) {
			return false
		}
	}
	return len(tiles) > 0
}

func anyFunc(tiles []string, fn func(string) bool) bool {
	for _, t := range tiles {
		if fn(t) {
			return true
		}
	}
	return false
}
