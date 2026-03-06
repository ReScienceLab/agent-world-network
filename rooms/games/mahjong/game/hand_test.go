package game

import (
	"testing"
)

func TestCanPeng(t *testing.T) {
	hand := []string{"1m", "1m", "3p", "5s"}
	if !CanPeng(hand, "1m") {
		t.Error("should be able to peng 1m")
	}
	if CanPeng(hand, "3p") {
		t.Error("should not peng 3p (only 1 copy)")
	}
}

func TestCanChi(t *testing.T) {
	hand := []string{"4m", "5m", "9p"}
	combos := CanChi(hand, "3m", "south", "east") // south's left is east
	if len(combos) == 0 {
		t.Error("should be able to chi 3m with 4m+5m")
	}
	// Wrong seat — west cannot chi from east
	combos2 := CanChi(hand, "3m", "west", "east")
	if len(combos2) != 0 {
		t.Error("west should not chi from east")
	}
	// Cannot chi honor tiles
	combos3 := CanChi(hand, "1z", "south", "east")
	if len(combos3) != 0 {
		t.Error("cannot chi honor tiles")
	}
}

func TestTryArrange_ValidHand(t *testing.T) {
	// Pinhu tenpai completed: 1m2m3m 4m5m6m 7m8m9m 1p2p3p + 5p5p
	hand := []string{"1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "5p", "5p"}
	arr := TryArrange(hand)
	if arr == nil {
		t.Fatal("should find valid arrangement")
	}
	if arr.Pair != "5p" {
		t.Errorf("pair should be 5p, got %s", arr.Pair)
	}
	if len(arr.Sets) != 4 {
		t.Errorf("should have 4 sets, got %d", len(arr.Sets))
	}
}

func TestTryArrange_Invalid(t *testing.T) {
	// Random tiles with no valid arrangement
	hand := []string{"1m", "3m", "5m", "7m", "9m", "1p", "3p", "5p", "7p", "9p", "1s", "3s", "5s", "7s"}
	arr := TryArrange(hand)
	if arr != nil {
		t.Error("should not find arrangement in garbage hand")
	}
}

func TestIsSevenPairs(t *testing.T) {
	hand := []string{"1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "1z", "1z"}
	if !IsSevenPairs(hand) {
		t.Error("should be seven pairs")
	}
	hand2 := []string{"1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "1z", "2z"}
	if IsSevenPairs(hand2) {
		t.Error("should not be seven pairs (unpaired 1z/2z)")
	}
}

func TestCanHu(t *testing.T) {
	// Valid complete hand
	hand := []string{"1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "5p"}
	if !CanHu(hand, nil, "5p") {
		t.Error("should be able to hu with 5p completing 5p pair")
	}
	// Seven pairs
	hand2 := []string{"1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "1z"}
	if !CanHu(hand2, nil, "1z") {
		t.Error("should hu with seven pairs")
	}
}

func TestGetWaitingTiles(t *testing.T) {
	// Tenpai hand — waiting for 5p (pair) to complete pinhu
	hand := []string{"1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "5p"}
	waiting := GetWaitingTiles(hand, nil)
	found := false
	for _, t := range waiting {
		if t == "5p" {
			found = true
		}
	}
	if !found {
		t.Errorf("5p should be a waiting tile, got: %v", waiting)
	}
}

func TestDeck(t *testing.T) {
	wall := CreateWall()
	if len(wall) != 136 {
		t.Errorf("wall should have 136 tiles, got %d", len(wall))
	}
	// Count each tile type
	counts := make(map[string]int)
	for _, tile := range wall {
		counts[tile]++
	}
	for tile, c := range counts {
		if c != 4 {
			t.Errorf("tile %s should appear 4 times, got %d", tile, c)
		}
	}
}

func TestShuffle(t *testing.T) {
	wall := CreateWall()
	orig := make([]string, len(wall))
	copy(orig, wall)
	Shuffle(wall)
	// Very unlikely to be identical after shuffle
	same := true
	for i := range wall {
		if wall[i] != orig[i] {
			same = false
			break
		}
	}
	if same {
		t.Error("shuffle produced identical order (extremely unlikely)")
	}
}

func TestDoraFromIndicator(t *testing.T) {
	cases := [][2]string{
		{"1m", "2m"}, {"9m", "1m"}, // number tiles wrap
		{"1z", "2z"}, {"4z", "1z"}, // winds wrap at 4
		{"5z", "6z"}, {"7z", "5z"}, // dragons wrap at 7
	}
	for _, c := range cases {
		got := DoraFromIndicator(c[0])
		if got != c[1] {
			t.Errorf("DoraFromIndicator(%s) = %s, want %s", c[0], got, c[1])
		}
	}
}

func TestCalculateFan_Tsumo(t *testing.T) {
	// Simple tsumo win
	hand := []string{"1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "5p", "5p"}
	res := CalculateFan(hand, nil, "5p", ScoringCtx{IsTsumo: true, Seat: "east", RoundWind: "east"})
	if res.Points < 8 {
		t.Errorf("points should be at least 8, got %d", res.Points)
	}
	hasZimo := false
	for _, y := range res.Yaku {
		if y == "自摸" {
			hasZimo = true
		}
	}
	if !hasZimo {
		t.Errorf("should have 自摸 yaku, got: %v", res.Yaku)
	}
}

func TestCalculateFan_SevenPairs(t *testing.T) {
	hand := []string{"1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "1z", "1z"}
	res := CalculateFan(hand, nil, "1z", ScoringCtx{IsTsumo: false, Seat: "south", RoundWind: "east"})
	found := false
	for _, y := range res.Yaku {
		if y == "七对子" {
			found = true
		}
	}
	if !found {
		t.Errorf("should have 七对子, got: %v", res.Yaku)
	}
}
