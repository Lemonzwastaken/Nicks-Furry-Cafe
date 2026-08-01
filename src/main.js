import kaboom from "kaboom"

const k = kaboom({
	background: [30, 24, 22],
	crisp: true, // keep pixel art tiles sharp when stretched
})

// Cafe backdrop, stretched to fill the canvas behind everything else.
k.loadSprite("bg", "assets/background.png")

// Static Nick portrait (single image, not a sliced sheet).
k.loadSprite("nick", "sprites/nick.png")

// Food/drink icon sheet, 5x5 grid of 32x32 icons.
k.loadSprite("food", "sprites/food.png", { sliceX: 5, sliceY: 5 })
const FOOD_FRAME_COUNT = 25

// Kenney "UI Pack: Pixel Adventure" tilesheet, 13x7 grid of 32x32 tiles.
// Frame indices found by inspecting the sheet (row * 13 + col):
//   69 = horizontal bar (used as a button background)
k.loadSprite("panels", "assets/ui/panels.png", { sliceX: 13, sliceY: 7 })

k.loadSound("click", "assets/audio/click.ogg")
k.loadSound("rollover", "assets/audio/rollover.ogg")

const BAR_FRAME = 69

k.scene("title", () => {
	k.add([
		k.sprite("bg", { width: k.width(), height: k.height() }),
		k.pos(0, 0),
	])

	k.add([
		k.text("Nick's Furry Cafe", { size: 40 }),
		k.pos(k.width() / 2, k.height() / 2 - 100),
		k.anchor("center"),
	])

	function makeMenuButton(label, y, onClick) {
		const button = k.add([
			k.sprite("panels", { frame: BAR_FRAME, width: 160, height: 48 }),
			k.pos(k.width() / 2, y),
			k.anchor("center"),
			k.area(),
		])

		button.add([
			k.text(label, { size: 20 }),
			k.anchor("center"),
			k.color(20, 20, 20),
		])

		button.onHoverUpdate(() => k.setCursor("pointer"))
		button.onHover(() => k.play("rollover", { volume: 0.5 }))
		button.onClick(() => {
			k.play("click")
			onClick()
		})

		return button
	}

	makeMenuButton("Start", k.height() / 2, () => k.go("game"))
	makeMenuButton("Stop", k.height() / 2 + 64, () => k.quit())
})

k.scene("game", () => {
	k.add([
		k.sprite("bg", { width: k.width(), height: k.height() }),
		k.pos(0, 0),
	])

	k.add([
		k.text("Nick's Furry Cafe", { size: 24 }),
		k.pos(20, 20),
	])

	// Nick tucked in the corner, out of the way of the food display.
	k.add([
		k.sprite("nick", { width: 90, height: 180 }),
		k.pos(k.width() - 20, k.height() - 20),
		k.anchor("botright"),
	])

	// Scatter random food/drink icons around as cafe decoration.
	for (let i = 0; i < 12; i++) {
		k.add([
			k.sprite("food", { frame: k.randi(0, FOOD_FRAME_COUNT - 1), width: 48, height: 48 }),
			k.pos(k.rand(40, k.width() - 140), k.rand(80, k.height() - 60)),
			k.anchor("center"),
		])
	}

	const backButton = k.add([
		k.sprite("panels", { frame: BAR_FRAME, width: 120, height: 40 }),
		k.pos(20, k.height() - 20),
		k.anchor("botleft"),
		k.area(),
		"backButton",
	])

	backButton.add([
		k.text("Back", { size: 16 }),
		k.pos(60, -20),
		k.anchor("center"),
		k.color(20, 20, 20),
	])

	function goBack() {
		k.play("click")
		k.go("title")
	}

	backButton.onHoverUpdate(() => k.setCursor("pointer"))
	backButton.onClick(goBack)

	k.onKeyPress("backspace", goBack)

	k.onClick(() => k.addKaboom(k.mousePos()))
})

k.go("title")
