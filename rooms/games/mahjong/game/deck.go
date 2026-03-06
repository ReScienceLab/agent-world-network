package game

import "math/rand"

// CreateWall returns a full unshuffled 136-tile wall (34 types × 4).
func CreateWall() []string {
	wall := make([]string, 0, 136)
	for _, t := range AllTileTypes {
		for i := 0; i < 4; i++ {
			wall = append(wall, t)
		}
	}
	return wall
}

// Shuffle performs an in-place Fisher-Yates shuffle.
func Shuffle(wall []string) {
	for i := len(wall) - 1; i > 0; i-- {
		j := rand.Intn(i + 1)
		wall[i], wall[j] = wall[j], wall[i]
	}
}

// DrawFromFront removes and returns the front tile. Returns "" if empty.
func DrawFromFront(wall *[]string) string {
	if len(*wall) == 0 {
		return ""
	}
	t := (*wall)[0]
	*wall = (*wall)[1:]
	return t
}

// DrawFromBack removes and returns the back tile (used for gang supplement).
func DrawFromBack(wall *[]string) string {
	if len(*wall) == 0 {
		return ""
	}
	n := len(*wall) - 1
	t := (*wall)[n]
	*wall = (*wall)[:n]
	return t
}
