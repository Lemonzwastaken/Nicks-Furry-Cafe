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

// TEMP verification hook (guarded; removed after testing).
if (typeof window !== "undefined" && window.__VERIFY__) window.__k = k

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

// Kitchen appliances (320x320 art sitting inside transparent padding).
k.loadSprite("oven", "assets/oven.png")
k.loadSprite("coffee", "assets/coffee.png")

// The three regulars. These are downscaled copies of the photos in assets/
// (the originals are ~12MP — far too big to push to the GPU as-is).
k.loadSprite("arjav", "sprites/arjav.png")
k.loadSprite("neon", "sprites/neon.png")
k.loadSprite("aaradhya", "sprites/aaradhya.png")

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

// The cafe's three regulars. Only these three ever visit, one of each at a
// time — a fresh face only walks in once the previous one has left. `w`/`h`
// are the on-screen photo size (aspect-preserved from the source pictures).
const REGULARS = [
	{ id: "arjav", w: 42, h: 56 },
	{ id: "neon", w: 56, h: 42 },
	{ id: "aaradhya", w: 56, h: 42 },
]

// oven.png / coffee.png are 320x320 with the actual appliance sitting inside a
// transparent margin. These boxes locate that art within the image so we can
// center the *visible* appliance (not the padded frame) on the counter.
const APPLIANCE_ART = {
	oven: { cx: 150, cy: 175, h: 210 },
	coffee: { cx: 110, cy: 195, h: 190 },
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
		k.text("Nick's Furry Cafe :3", { size: 40 }),
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
	//   * KITCHEN  -> the tiled floor inside the red-bordered L-counter
	//   * QUEUE    -> the open floor just to the right of the counter
	//   * SEATS    -> the two yellow couches along the bottom
	//   * DOOR     -> the doorway on the right-hand wall
	const KITCHEN = { x1: 95, y1: 100, x2: 465, y2: 290 }
	const NICK_SPEED = 210
	const NICK_HALF = k.vec2(24, 48) // half-extents used to clamp Nick in the kitchen

	// Where each queued customer stands, front (index 0) nearest the counter.
	const QUEUE_X = 530
	const QUEUE_Y0 = 125
	const QUEUE_GAP = 78
	// Only the three regulars exist, so at most three are ever on screen at once.
	const MAX_CUSTOMERS = REGULARS.length

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
	// Real oven / coffee-machine sprites, sat on the brown countertop that runs
	// along the top of the kitchen. `center` is the visible appliance centre and
	// doubles as the point Nick has to stand near to use it.
	function makeStation(recipeKey, spriteName, name, center, artHeight) {
		const art = APPLIANCE_ART[spriteName]
		const scale = artHeight / art.h
		const boxSize = 320 * scale
		// The art is off-centre inside its 320px frame; shift so the visible
		// appliance (not the transparent padding) lands on `center`.
		const shift = k.vec2((art.cx - 160) * scale, (art.cy - 160) * scale)
		const station = k.add([
			k.sprite(spriteName, { width: boxSize, height: boxSize }),
			k.pos(center.sub(shift)),
			k.anchor("center"),
			k.z(6),
			{ recipe: recipeKey, center: center },
		])
		// Name plate, tucked just under the appliance.
		station.add([
			k.text(name, { size: 12 }),
			k.anchor("center"),
			k.pos(shift.x, shift.y + artHeight / 2 + 10),
			k.color(60, 44, 36),
		])
		return station
	}

	const oven = makeStation("pastry", "oven", "Oven", k.vec2(150, 100), 92)
	const coffeeMachine = makeStation("coffee", "coffee", "Coffee", k.vec2(350, 100), 92)
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
		// Never more than the three regulars, and never two of the same person.
		// (`person`, not `id` — kaboom objects already own a numeric `.id`.)
		if (k.get("customer").length >= MAX_CUSTOMERS) return
		const inUse = new Set(k.get("customer").map((c) => c.person))
		const who = REGULARS.find((r) => !inUse.has(r.id))
		if (!who) return

		const want = k.choose(["coffee", "pastry"])
		// The customer object is a white photo frame; the picture rides on top.
		const cust = k.add([
			k.rect(who.w + 6, who.h + 6, { radius: 4 }),
			k.pos(DOOR_POS.x, DOOR_POS.y),
			k.anchor("center"),
			k.color(255, 255, 255),
			k.outline(3, k.rgb(90, 70, 56)),
			k.area(),
			k.z(15),
			{ want, person: who.id, inQueue: true },
			"customer",
		])
		cust.add([
			k.sprite(who.id, { width: who.w, height: who.h }),
			k.anchor("center"),
		])

		// Order bubble above their head.
		const bubble = cust.add([
			k.rect(38, 38, { radius: 6 }),
			k.pos(0, -(who.h + 6) / 2 - 25),
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
		k.text("Nick's Furry Cafe :3", { size: 22 }),
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
	for (let i = 0; i < MAX_CUSTOMERS; i++) {
		k.wait(i * 0.7, spawnCustomer)
	}
	// Bring the next regular in whenever one has left and a seat at the
	// counter has opened up.
	k.loop(3, spawnCustomer)
})

k.go("title")
