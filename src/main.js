import kaboom from "kaboom"

// Fixed logical resolution matching the background art's 16:9 aspect ratio,
// letterboxed so it scales cleanly to any window/screen size.
const k = kaboom({
	width: 960,
	height: 540,
	letterbox: true,
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

// Placeholder customer sprite until we have real customer art.
k.loadBean()

k.loadSound("click", "assets/audio/click.ogg")
k.loadSound("rollover", "assets/audio/rollover.ogg")

const BAR_FRAME = 69

k.scene("title", () => {
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

	// Nick behind the kitchen counter (the L-shaped counter art in the
	// top-left of the background), not floating in open floor space.
	k.add([
		k.sprite("nick", { width: 90, height: 180 }),
		k.pos(480, 287),
		k.anchor("botright"),
	])

	// XP counter, gained by delivering food to customers.
	let xp = 0
	const xpText = k.add([
		k.text("XP: 0", { size: 20 }),
		k.pos(20, 50),
	])

	// What Nick is currently holding, picked up from the food table.
	// Null means empty-handed. Shown as a small icon hovering over Nick.
	let carryingFrame = null
	const carryIcon = k.add([
		k.sprite("food", { frame: 0, width: 24, height: 24 }),
		k.pos(435, 90),
		k.anchor("center"),
		k.opacity(0),
	])

	function pickUp(frame) {
		carryingFrame = frame
		carryIcon.frame = frame
		carryIcon.opacity = 1
	}

	function clearHands() {
		carryingFrame = null
		carryIcon.opacity = 0
	}

	// The food table (the round brown table drawn mid-right in the
	// background). Click it to pick up a random dish, then click a waiting
	// customer to deliver it to them.
	const foodTable = k.add([
		k.sprite("food", { frame: 0, width: 32, height: 32 }),
		k.pos(700, 327),
		k.anchor("center"),
		k.area({ width: 60, height: 60 }),
		"table",
	])

	foodTable.onHoverUpdate(() => k.setCursor("pointer"))
	foodTable.onClick(() => {
		console.log("table clicked")
		if (carryingFrame !== null) return // hands full, deliver first

		const frame = k.randi(0, FOOD_FRAME_COUNT - 1)
		foodTable.frame = frame
		pickUp(frame)
		k.play("click")
	})

	// Customers seated at the two bench/table clusters drawn into the
	// background art, waiting for Nick to bring their order. Using kaboom's
	// built-in "bean" sprite as a placeholder until we have real customer art.
	const BENCH_CENTERS_X = [150, 475]
	const SEAT_SPACING = 70
	const CUSTOMER_Y = 456
	const PLATE_Y_OFFSET = 40

	for (const benchX of BENCH_CENTERS_X) {
		const seatStartX = benchX - SEAT_SPACING / 2
		for (let i = 0; i < 2; i++) {
			const x = seatStartX + i * SEAT_SPACING

			const customer = k.add([
				k.sprite("bean", { width: 48, height: 48 }),
				k.pos(x, CUSTOMER_Y),
				k.anchor("center"),
				k.area(),
				{ served: false },
				"customer",
			])

			customer.onHoverUpdate(() => k.setCursor("pointer"))
			customer.onClick(() => {
				console.log("customer clicked", x, customer.served, carryingFrame)
				if (customer.served) return
				if (carryingFrame === null) return // nothing to deliver yet

				k.add([
					k.sprite("food", { frame: carryingFrame, width: 32, height: 32 }),
					k.pos(x, CUSTOMER_Y + PLATE_Y_OFFSET),
					k.anchor("center"),
					"plate",
				])

				customer.served = true
				xp += 10
				xpText.text = `XP: ${xp}`
				clearHands()
				k.play("click")
			})
		}
	}

	const backButton = k.add([
		k.sprite("panels", { frame: BAR_FRAME, width: 120, height: 40 }),
		k.pos(k.width() - 20, 20),
		k.anchor("topright"),
		k.area(),
		"backButton",
	])

	backButton.add([
		k.text("Back", { size: 16 }),
		k.pos(-60, 20),
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

})

k.go("title")
