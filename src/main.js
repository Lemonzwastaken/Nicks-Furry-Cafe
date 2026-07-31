import kaboom from "kaboom"

const k = kaboom({
	background: [30, 24, 22],
	crisp: true, // keep pixel art tiles sharp when stretched
})

k.loadSprite("bean", "sprites/bean.png")

// Kenney "UI Pack: Pixel Adventure" tilesheet, 13x7 grid of 32x32 tiles.
// Frame indices found by inspecting the sheet (row * 13 + col):
//   0  = cream panel   1  = brown panel   2  = light-blue panel
//   21 = green-corner accent panel (used as a hover/selected highlight)
//   69 = horizontal bar (used as a button background)
k.loadSprite("panels", "assets/ui/panels.png", { sliceX: 13, sliceY: 7 })

k.loadSound("click", "assets/audio/click.ogg")
k.loadSound("rollover", "assets/audio/rollover.ogg")

const PANEL_FRAME = {
	cream: 0,
	brown: 1,
	lightBlue: 2,
	hover: 21,
}

const BAR_FRAME = 69

// Placeholder characters until real sprites (Nick, etc) are added.
const CHARACTERS = [
	{ id: "a", label: "A", key: "1", altKey: "a", panelFrame: PANEL_FRAME.cream },
	{ id: "b", label: "B", key: "2", altKey: "b", panelFrame: PANEL_FRAME.brown },
	{ id: "c", label: "C", key: "3", altKey: "c", panelFrame: PANEL_FRAME.lightBlue },
]

let chosenCharacter = CHARACTERS[0]

k.scene("select", () => {
	k.add([
		k.text("Choose your character", { size: 32 }),
		k.pos(k.width() / 2, 70),
		k.anchor("center"),
	])

	k.add([
		k.text("Click a card, or press 1/2/3", { size: 16 }),
		k.pos(k.width() / 2, 110),
		k.anchor("center"),
		k.color(200, 200, 200),
	])

	const cardWidth = 160
	const cardHeight = 200
	const spacing = 200
	const startX = k.width() / 2 - spacing
	const cardY = k.height() / 2

	function pickCharacter(character) {
		k.play("click")
		chosenCharacter = character
		k.go("game")
	}

	CHARACTERS.forEach((character, i) => {
		const x = startX + i * spacing

		const card = k.add([
			k.sprite("panels", { frame: character.panelFrame, width: cardWidth, height: cardHeight }),
			k.pos(x, cardY),
			k.anchor("center"),
			k.area(),
			k.scale(1),
			"characterCard",
		])

		card.add([
			k.sprite("bean"),
			k.pos(0, -30),
			k.anchor("center"),
			k.scale(1.4),
		])

		card.add([
			k.text(character.label, { size: 48 }),
			k.pos(0, 60),
			k.anchor("center"),
			k.color(20, 20, 20),
		])

		card.onHoverUpdate(() => {
			card.scaleTo(1.08)
			card.frame = PANEL_FRAME.hover
			k.setCursor("pointer")
		})

		card.onHoverEnd(() => {
			card.scaleTo(1)
			card.frame = character.panelFrame
		})

		card.onHover(() => {
			k.play("rollover", { volume: 0.5 })
		})

		card.onClick(() => pickCharacter(character))

		k.onKeyPress(character.key, () => pickCharacter(character))
		k.onKeyPress(character.altKey, () => pickCharacter(character))
	})
})

k.scene("game", () => {
	k.add([
		k.text(`Playing as: ${chosenCharacter.label}`, { size: 24 }),
		k.pos(20, 20),
	])

	k.add([
		k.sprite("bean"),
		k.pos(k.width() / 2, k.height() / 2),
		k.anchor("center"),
		k.scale(2),
	])

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
		k.go("select")
	}

	backButton.onHoverUpdate(() => k.setCursor("pointer"))
	backButton.onClick(goBack)

	k.onKeyPress("backspace", goBack)

	k.onClick(() => k.addKaboom(k.mousePos()))
})

k.go("select")
