"""Generate the fixture screenshots used by scripts/check-vision.ts."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path("fixtures")
OUT.mkdir(exist_ok=True)

CJK_FONT = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
LATIN_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def render(name: str, text: str, font_path: str, size=(1000, 260)) -> None:
    image = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(font_path, 64)
    box = draw.textbbox((0, 0), text, font=font)
    x = (size[0] - (box[2] - box[0])) // 2
    y = (size[1] - (box[3] - box[1])) // 2 - box[1]
    draw.text((x, y), text, fill="black", font=font)
    image.save(OUT / name)


render("sentence.png", "请问，洗手间在哪里？", CJK_FONT)
render("polyphone.png", "银行", CJK_FONT)
render("no-chinese.png", "Welcome to the app", LATIN_FONT)
print(f"Wrote fixtures to {OUT}/")
