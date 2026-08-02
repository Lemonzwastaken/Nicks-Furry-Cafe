import kaboom from "kaboom"

// Fixed logical resolution matching the background art's 16:9 aspect ratio,
// letterboxed so it scales cleanly to any window/screen size.
const k = kaboom({
	width: 960,
	height: 540,
	letterbox: true,
	background: [30, 24, 22],
	crisp: true, // keep the pixel art sharp when stretched
})

// Cafe backdrop, stretched to fill the canvas behind everything else.
// The art already paints the kitchen counter (top-left), the couches
// (bottom) and the door (right), so the gameplay is laid out to match it.
k.loadSprite("bg", "assets/background.png")

// Static Nick portrait (single image, not a sliced sheet).
k.loadSprite("nick", "sprites/nick.png")

// Food/drink icon sheet, 5x5 grid of 32x32 icons.
k.loadSprite("food", "sprites/food.png", { sliceX: 5, sliceY: 5 })

// Kenney "UI Pack" tilesheet; frame 69 is a horizontal bar used as a button bg.
k.loadSprite("panels", "assets/ui/panels.png", { sliceX: 13, sliceY: 7 })

// Placeholder customer sprite.
k.loadBean()

k.loadSound("click", "assets/audio/click.ogg")
k.loadSound("rollover", "assets/audio/rollover.ogg")

const BAR_FRAME = 69

// Which food-sheet frame each station produces.
const COFFEE_FRAME = 0 // a coffee cup
const PASTRY_FRAME = 14 // a baked pastry

// The two things a customer can order, keyed by the station that makes them.
const RECIPES = {
	coffee: { frame: COFFEE_FRAME, label: "Coffee", price: 8 },
	pastry: { frame: PASTRY_FRAME, label: "Pastry", price: 12 },
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------
k.scene("title", () => {
	k.add([k.sprite("bg", { width: k.width(), height: k.height() }), k.pos(0, 0)])
	// Dim the backdrop so the menu text stays readable.
	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(20, 16, 14),
		k.opacity(0.5),
	])

	k.add([
		k.text("Nick's Furry Cafe", { size: 40 }),
		k.pos(k.width() / 2, k.height() / 2 - 120),
		k.anchor("center"),
	])

	k.add([
		k.text("Cook at the oven & coffee machine, then serve the queue.", {
			size: 16,
		}),
		k.pos(k.width() / 2, k.height() / 2 - 70),
		k.anchor("center"),
		k.color(230, 220, 210),
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

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
k.scene("game", () => {
	// --- Layout constants (960 x 540 logical space) -----------------------
	// Coordinates are tuned to sit on top of the background art:
	//   * KITCHEN  -> inside the red-bordered L-counter, top-left
	//   * QUEUE    -> the open floor just to the right of the counter
	//   * SEATS    -> the two yellow couches along the bottom
	//   * DOOR     -> the doorway on the right-hand wall
	const KITCHEN = { x1: 40, y1: 100, x2: 445, y2: 282 }
	const NICK_SPEED = 210
	const NICK_HALF = k.vec2(24, 48) // half-extents used to clamp Nick in the kitchen

	// Where each queued customer stands, front (index 0) nearest the counter.
	const QUEUE_X = 530
	const QUEUE_Y0 = 125
	const QUEUE_GAP = 78
	const MAX_QUEUE = 4

	// Doorway on the right wall that customers enter and leave through.
	const DOOR_POS = k.vec2(930, 195)

	// Couch seats a served customer relaxes on before leaving (two per couch).
	const SEATS = [
		{ pos: k.vec2(150, 440), taken: false },
		{ pos: k.vec2(250, 440), taken: false },
		{ pos: k.vec2(420, 440), taken: false },
		{ pos: k.vec2(520, 440), taken: false },
	]

	// --- Backdrop ---------------------------------------------------------
	k.add([k.sprite("bg", { width: k.width(), height: k.height() }), k.pos(0, 0)])

	// --- Appliances (cooking stations) ------------------------------------
	// Not present in the art, so they are drawn as little appliance boxes that
	// show the icon of the dish they produce.
	function makeStation(recipeKey, name, x, y, bodyColor, accentColor) {
		const recipe = RECIPES[recipeKey]
		const station = k.add([
			k.rect(84, 92, { radius: 6 }),
			k.pos(x, y),
			k.anchor("center"),
			k.color(...bodyColor),
			k.outline(4, k.rgb(34, 32, 40)),
			k.z(10),
			{ recipe: recipeKey, center: k.vec2(x, y) },
		])
		// A little front "window/screen" so it reads as an appliance.
		station.add([
			k.rect(60, 26, { radius: 4 }),
			k.pos(0, 20),
			k.anchor("center"),
			k.color(...accentColor),
		])
		// Icon of what it makes.
		station.add([
			k.sprite("food", { frame: recipe.frame, width: 34, height: 34 }),
			k.anchor("center"),
			k.pos(0, -14),
		])
		// Appliance name plate.
		station.add([
			k.text(name, { size: 12 }),
			k.anchor("center"),
			k.pos(0, 54),
			k.color(245, 245, 245),
		])
		return station
	}

	const oven = makeStation("pastry", "Oven", 135, 152, [66, 62, 72], [232, 150, 70])
	const coffeeMachine = makeStation("coffee", "Coffee", 355, 152, [150, 152, 162], [70, 60, 54])
	const stations = [oven, coffeeMachine]

	// Prompt shown above the station Nick is standing next to.
	const promptText = k.add([
		k.text("Press E", { size: 16 }),
		k.pos(0, 0),
		k.anchor("center"),
		k.color(255, 245, 180),
		k.opacity(0),
		k.z(50),
	])

	// --- Nick -------------------------------------------------------------
	const nick = k.add([
		k.sprite("nick", { width: 50, height: 96 }),
		k.pos((KITCHEN.x1 + KITCHEN.x2) / 2, 220),
		k.anchor("center"),
		k.z(20),
	])

	// Icon of what Nick is currently carrying, floating above his head.
	let carrying = null // recipe key string, or null
	const carryIcon = k.add([
		k.sprite("food", { frame: 0, width: 30, height: 30 }),
		k.pos(0, 0),
		k.anchor("center"),
		k.opacity(0),
		k.z(30),
	])

	function pickUp(recipeKey) {
		carrying = recipeKey
		carryIcon.frame = RECIPES[recipeKey].frame
		carryIcon.opacity = 1
		k.play("click")
	}

	function clearHands() {
		carrying = null
		carryIcon.opacity = 0
	}

	// Track which station Nick is close enough to use.
	let nearStation = null

	nick.onUpdate(() => {
		// Movement (WASD / arrows), kitchen-confined.
		let dx = 0
		let dy = 0
		if (k.isKeyDown("left") || k.isKeyDown("a")) dx -= 1
		if (k.isKeyDown("right") || k.isKeyDown("d")) dx += 1
		if (k.isKeyDown("up") || k.isKeyDown("w")) dy -= 1
		if (k.isKeyDown("down") || k.isKeyDown("s")) dy += 1
		const dir = k.vec2(dx, dy)
		if (dir.len() > 0) {
			nick.pos = nick.pos.add(dir.unit().scale(NICK_SPEED * k.dt()))
		}
		// Clamp inside the kitchen box.
		nick.pos.x = k.clamp(
			nick.pos.x,
			KITCHEN.x1 + NICK_HALF.x,
			KITCHEN.x2 - NICK_HALF.x,
		)
		nick.pos.y = k.clamp(
			nick.pos.y,
			KITCHEN.y1 + NICK_HALF.y,
			KITCHEN.y2 - NICK_HALF.y,
		)

		// Keep the carry icon glued above Nick.
		carryIcon.pos = nick.pos.sub(0, 64)

		// Find the nearest usable station.
		nearStation = null
		for (const s of stations) {
			if (nick.pos.dist(s.center) < 92) {
				nearStation = s
				break
			}
		}
		if (nearStation) {
			promptText.pos = nearStation.center.sub(0, 68)
			promptText.opacity = 1
		} else {
			promptText.opacity = 0
		}
	})

	// Cook at the station Nick is standing next to.
	k.onKeyPress("e", () => {
		if (!nearStation) return
		pickUp(nearStation.recipe)
	})

	// --- Customers --------------------------------------------------------
	const queue = [] // customers currently waiting at the counter

	function queueSlot(i) {
		return k.vec2(QUEUE_X, QUEUE_Y0 + i * QUEUE_GAP)
	}

	// Move an object toward a destination each frame, then run onArrive once.
	function walkTo(obj, dest, onArrive, speed = 130) {
		if (obj._walkEv) obj._walkEv.cancel()
		obj._walkEv = obj.onUpdate(() => {
			const diff = dest.sub(obj.pos)
			if (diff.len() < 4) {
				obj.pos = dest.clone()
				obj._walkEv.cancel()
				obj._walkEv = null
				if (onArrive) onArrive()
				return
			}
			obj.pos = obj.pos.add(diff.unit().scale(speed * k.dt()))
		})
	}

	function reflowQueue() {
		queue.forEach((c, i) => walkTo(c, queueSlot(i)))
	}

	function spawnCustomer() {
		if (queue.length >= MAX_QUEUE) return
		const want = k.choose(["coffee", "pastry"])
		const cust = k.add([
			k.sprite("bean", { width: 52, height: 52 }),
			k.pos(DOOR_POS.x, DOOR_POS.y),
			k.anchor("center"),
			k.area({ scale: 1.1 }),
			k.z(15),
			{ want, inQueue: true },
			"customer",
		])

		// Order bubble above their head.
		const bubble = cust.add([
			k.rect(38, 38, { radius: 6 }),
			k.pos(0, -44),
			k.anchor("center"),
			k.color(255, 255, 255),
			k.outline(3, k.rgb(120, 120, 130)),
		])
		bubble.add([
			k.sprite("food", { frame: RECIPES[want].frame, width: 28, height: 28 }),
			k.anchor("center"),
		])
		cust.bubble = bubble

		queue.push(cust)
		walkTo(cust, queueSlot(queue.length - 1))

		cust.onHoverUpdate(() => {
			if (cust.inQueue) k.setCursor("pointer")
		})
		cust.onClick(() => serveCustomer(cust))
	}

	function serveCustomer(cust) {
		if (!cust.inQueue) return
		if (carrying === null) {
			flash("Cook something first!")
			return
		}
		if (carrying !== cust.want) {
			flash(`They want ${RECIPES[cust.want].label.toLowerCase()}!`)
			return
		}

		// Sale!
		money += RECIPES[cust.want].price
		moneyText.text = `$${money}`
		clearHands()
		k.play("click")

		// Remove from queue and slide everyone forward.
		cust.inQueue = false
		if (cust.bubble) cust.bubble.destroy()
		const idx = queue.indexOf(cust)
		if (idx !== -1) queue.splice(idx, 1)
		reflowQueue()

		// Walk to a free couch, relax 10s, then leave through the door.
		const seat = SEATS.find((s) => !s.taken)
		if (seat) {
			seat.taken = true
			walkTo(cust, seat.pos, () => {
				k.wait(10, () => {
					seat.taken = false
					walkTo(cust, DOOR_POS, () => cust.destroy())
				})
			})
		} else {
			walkTo(cust, DOOR_POS, () => cust.destroy())
		}

		// Someone left the counter, so bring in a fresh face.
		k.wait(0.6, spawnCustomer)
	}

	// --- HUD --------------------------------------------------------------
	let money = 0

	k.add([
		k.text("Nick's Furry Cafe", { size: 22 }),
		k.pos(20, 16),
		k.color(250, 244, 235),
		k.z(40),
	])
	const moneyText = k.add([
		k.text("$0", { size: 26 }),
		k.pos(20, 48),
		k.color(150, 235, 170),
		k.z(40),
	])

	k.add([
		k.text("Move: WASD/Arrows   Cook: E near a station   Serve: click a customer", {
			size: 14,
		}),
		k.pos(20, k.height() - 26),
		k.color(60, 44, 36),
		k.z(40),
	])

	// Brief on-screen message (e.g. wrong order).
	const flashText = k.add([
		k.text("", { size: 18 }),
		k.pos(k.width() / 2, 70),
		k.anchor("center"),
		k.color(220, 80, 70),
		k.opacity(0),
		k.z(60),
	])
	let flashTimer = null
	function flash(msg) {
		flashText.text = msg
		flashText.opacity = 1
		if (flashTimer) flashTimer.cancel()
		flashTimer = k.wait(1.2, () => (flashText.opacity = 0))
	}

	// --- Back button ------------------------------------------------------
	const backButton = k.add([
		k.sprite("panels", { frame: BAR_FRAME, width: 120, height: 40 }),
		k.pos(k.width() - 20, 16),
		k.anchor("topright"),
		k.area(),
		k.z(60),
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

	// --- Kick things off --------------------------------------------------
	for (let i = 0; i < MAX_QUEUE; i++) {
		k.wait(i * 0.7, spawnCustomer)
	}
	// Keep the queue topped up over time.
	k.loop(3, spawnCustomer)
})

k.go("title")
