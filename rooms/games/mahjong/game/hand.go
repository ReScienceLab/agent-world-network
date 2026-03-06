package game

import "fmt"

// Meld represents an open (or closed gang) set of tiles.
type Meld struct {
	Type     string   `json:"type"` // chi | peng | gang
	Tiles    []string `json:"tiles"`
	FromSeat string   `json:"fromSeat,omitempty"`
	GangType string   `json:"gangType,omitempty"` // closed | open | added
}

// Arrangement is the result of successfully decomposing a hand.
type Arrangement struct {
	Sets []MeldSet `json:"sets"`
	Pair string    `json:"pair"`
}

type MeldSet struct {
	Type  string   `json:"type"` // triplet | sequence
	Tiles []string `json:"tiles"`
}

// ── Claim checks ─────────────────────────────────────────────────────────────

// CanPeng returns true if hand contains at least 2 copies of tile.
func CanPeng(hand []string, tile string) bool {
	return count(hand, tile) >= 2
}

// CanChi returns the valid (t1, t2) use-pairs for a sequence claim.
// Chi is only allowed from the left neighbor (zuojia).
func CanChi(hand []string, tile, seat, discardSeat string) [][]string {
	leftOf := map[string]string{
		"east": "north", "south": "east", "west": "south", "north": "west",
	}
	if leftOf[seat] != discardSeat {
		return nil
	}
	if IsHonor(tile) {
		return nil
	}
	suit, num := TileValue(tile)
	var combos [][]string
	check := func(a, b string) {
		if contains(hand, a) && contains(hand, b) {
			combos = append(combos, []string{a, b})
		}
	}
	if num >= 3 {
		check(fmt.Sprintf("%d%c", num-2, suit), fmt.Sprintf("%d%c", num-1, suit))
	}
	if num >= 2 && num <= 8 {
		check(fmt.Sprintf("%d%c", num-1, suit), fmt.Sprintf("%d%c", num+1, suit))
	}
	if num <= 7 {
		check(fmt.Sprintf("%d%c", num+1, suit), fmt.Sprintf("%d%c", num+2, suit))
	}
	return combos
}

// CanClosedGang returns true if hand has 4 copies of tile (暗杠).
func CanClosedGang(hand []string, tile string) bool {
	return count(hand, tile) == 4
}

// CanOpenGang returns true if hand has 3 copies of tile (大明杠).
func CanOpenGang(hand []string, tile string) bool {
	return count(hand, tile) == 3
}

// CanAddedGang returns true if hand has the tile to add to an existing peng (加杠).
func CanAddedGang(hand []string, melds []Meld, tile string) bool {
	for _, m := range melds {
		if m.Type == "peng" && len(m.Tiles) > 0 && m.Tiles[0] == tile {
			return contains(hand, tile)
		}
	}
	return false
}

// CanHu returns true if the hand (plus winTile if non-empty) forms a winning hand.
func CanHu(hand []string, melds []Meld, winTile string) bool {
	full := make([]string, len(hand))
	copy(full, hand)
	if winTile != "" {
		full = append(full, winTile)
	}
	return IsSevenPairs(full) || TryArrange(full) != nil
}

// GetWaitingTiles returns all tiles that would complete the hand (tenpai check).
func GetWaitingTiles(hand []string, melds []Meld) []string {
	var waiting []string
	for _, t := range AllTileTypes {
		if CanHu(hand, melds, t) {
			waiting = append(waiting, t)
		}
	}
	return waiting
}

// IsTenpai returns true if the hand is one tile away from winning.
func IsTenpai(hand []string, melds []Meld) bool {
	return len(GetWaitingTiles(hand, melds)) > 0
}

// ── Hand arrangement ──────────────────────────────────────────────────────────

// TryArrange attempts to decompose tiles into 4 sets + 1 pair using backtracking.
// Returns nil if no valid arrangement exists.
func TryArrange(tiles []string) *Arrangement {
	if len(tiles)%3 != 2 {
		return nil
	}
	sorted := SortTiles(tiles)
	arr := &Arrangement{}
	if solve(sorted, arr, false) {
		return arr
	}
	return nil
}

func solve(remaining []string, arr *Arrangement, pairUsed bool) bool {
	if len(remaining) == 0 {
		return pairUsed
	}
	if len(remaining) == 2 && !pairUsed {
		if remaining[0] == remaining[1] {
			arr.Pair = remaining[0]
			return true
		}
		return false
	}

	first := remaining[0]

	// Try as pair (only once)
	if !pairUsed {
		idx := indexOf(remaining, first, 1)
		if idx != -1 {
			rest := removeAt(remaining, 0, idx)
			savedPair := arr.Pair
			arr.Pair = first
			if solve(rest, arr, true) {
				return true
			}
			arr.Pair = savedPair
		}
	}

	// Try as triplet
	idx1 := indexOf(remaining, first, 1)
	if idx1 != -1 {
		idx2 := indexOf(remaining, first, idx1+1)
		if idx2 != -1 {
			rest := removeAt(remaining, 0, idx1, idx2)
			savedSets := arr.Sets
			arr.Sets = append(arr.Sets, MeldSet{Type: "triplet", Tiles: []string{first, first, first}})
			if solve(rest, arr, pairUsed) {
				return true
			}
			arr.Sets = savedSets
		}
	}

	// Try as sequence
	if !IsHonor(first) {
		suit, num := TileValue(first)
		if num <= 7 {
			t2 := fmt.Sprintf("%d%c", num+1, suit)
			t3 := fmt.Sprintf("%d%c", num+2, suit)
			j2 := indexOf(remaining, t2, 1)
			j3 := -1
			if j2 != -1 {
				j3 = indexOf(remaining, t3, 1)
			}
			if j3 != -1 {
				rest := removeAt(remaining, 0, j2, j3)
				savedSets := arr.Sets
				arr.Sets = append(arr.Sets, MeldSet{Type: "sequence", Tiles: []string{first, t2, t3}})
				if solve(rest, arr, pairUsed) {
					return true
				}
				arr.Sets = savedSets
			}
		}
	}

	return false
}

// IsSevenPairs returns true if tiles form exactly 7 distinct pairs (七対子).
func IsSevenPairs(tiles []string) bool {
	if len(tiles) != 14 {
		return false
	}
	counts := countMap(tiles)
	pairs := 0
	for _, c := range counts {
		if c == 2 {
			pairs++
		}
	}
	return pairs == 7
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func RemoveTile(hand []string, tile string) []string {
	for i, t := range hand {
		if t == tile {
			result := make([]string, 0, len(hand)-1)
			result = append(result, hand[:i]...)
			result = append(result, hand[i+1:]...)
			return result
		}
	}
	return hand
}

func count(hand []string, tile string) int {
	n := 0
	for _, t := range hand {
		if t == tile {
			n++
		}
	}
	return n
}

func contains(hand []string, tile string) bool {
	for _, t := range hand {
		if t == tile {
			return true
		}
	}
	return false
}

func indexOf(s []string, v string, from int) int {
	for i := from; i < len(s); i++ {
		if s[i] == v {
			return i
		}
	}
	return -1
}

// removeAt removes elements at the given indices (must be ascending) and index 0.
func removeAt(s []string, indices ...int) []string {
	remove := make(map[int]bool, len(indices))
	for _, i := range indices {
		remove[i] = true
	}
	result := make([]string, 0, len(s)-len(indices))
	for i, v := range s {
		if !remove[i] {
			result = append(result, v)
		}
	}
	return result
}

func countMap(tiles []string) map[string]int {
	m := make(map[string]int, len(tiles))
	for _, t := range tiles {
		m[t]++
	}
	return m
}
