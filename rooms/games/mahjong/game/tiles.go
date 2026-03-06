// Package game contains pure game logic for Chinese standard mahjong.
package game

import (
	"fmt"
	"sort"
	"strings"
)

// Tile notation: 1m-9m (man/characters), 1p-9p (pin/circles),
// 1s-9s (sou/bamboo), 1z-4z (winds E/S/W/N), 5z-7z (dragons Haku/Hatsu/Chun)

var TileUnicode = map[string]string{
	"1m": "🀇", "2m": "🀈", "3m": "🀉", "4m": "🀊", "5m": "🀋",
	"6m": "🀌", "7m": "🀍", "8m": "🀎", "9m": "🀏",
	"1p": "🀙", "2p": "🀚", "3p": "🀛", "4p": "🀜", "5p": "🀝",
	"6p": "🀞", "7p": "🀟", "8p": "🀠", "9p": "🀡",
	"1s": "🀐", "2s": "🀑", "3s": "🀒", "4s": "🀓", "5s": "🀔",
	"6s": "🀕", "7s": "🀖", "8s": "🀗", "9s": "🀘",
	"1z": "🀀", "2z": "🀁", "3z": "🀂", "4z": "🀃",
	"5z": "🀄", "6z": "🀅", "7z": "🀆",
}

var SeatWinds = map[string]string{
	"east": "1z", "south": "2z", "west": "3z", "north": "4z",
}

var Dragons = []string{"5z", "6z", "7z"}

var AllTileTypes []string

var suitOrder = map[byte]int{'m': 0, 'p': 1, 's': 2, 'z': 3}

func init() {
	for _, suit := range []string{"m", "p", "s"} {
		for n := 1; n <= 9; n++ {
			AllTileTypes = append(AllTileTypes, fmt.Sprintf("%d%s", n, suit))
		}
	}
	for n := 1; n <= 7; n++ {
		AllTileTypes = append(AllTileTypes, fmt.Sprintf("%dz", n))
	}
}

// TileValue parses a tile string into suit and number.
func TileValue(tile string) (suit byte, num int) {
	if len(tile) < 2 {
		return 0, 0
	}
	suit = tile[len(tile)-1]
	fmt.Sscanf(tile[:len(tile)-1], "%d", &num)
	return
}

func IsHonor(tile string) bool { return strings.HasSuffix(tile, "z") }
func IsTerminal(tile string) bool {
	if IsHonor(tile) {
		return false
	}
	_, n := TileValue(tile)
	return n == 1 || n == 9
}
func IsTerminalOrHonor(tile string) bool { return IsTerminal(tile) || IsHonor(tile) }

// SortTiles returns a sorted copy of tiles (m < p < s < z, numerically within suit).
func SortTiles(tiles []string) []string {
	out := make([]string, len(tiles))
	copy(out, tiles)
	sort.Slice(out, func(i, j int) bool {
		si, ni := TileValue(out[i])
		sj, nj := TileValue(out[j])
		oi, oj := suitOrder[si], suitOrder[sj]
		if oi != oj {
			return oi < oj
		}
		return ni < nj
	})
	return out
}

// DoraFromIndicator returns the actual dora tile for a given indicator tile.
func DoraFromIndicator(indicator string) string {
	suit, num := TileValue(indicator)
	if suit == 'z' {
		if num <= 4 {
			next := num%4 + 1
			return fmt.Sprintf("%dz", next)
		}
		next := (num-5)%3 + 5 + 1
		if next > 7 {
			next = 5
		}
		return fmt.Sprintf("%dz", next)
	}
	next := num%9 + 1
	return fmt.Sprintf("%d%c", next, suit)
}

// RenderTiles returns a Unicode string representation of a tile list.
func RenderTiles(tiles []string) string {
	var sb strings.Builder
	for _, t := range tiles {
		if u, ok := TileUnicode[t]; ok {
			sb.WriteString(u)
		} else {
			sb.WriteString(t)
		}
	}
	return sb.String()
}
