import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs('processed_screenshots', exist_ok=True)

configs = [
    {
        'src': 'screenshots_output/01_landing_screen.png',
        'dst': 'processed_screenshots/screen1_auth.png',
        'title': 'User Authentication & JWT Session Portal',
        'crop_box': (200, 100, 1200, 650) # focus on login modal / hero
    },
    {
        'src': 'screenshots_output/02_workbench_ready.png',
        'dst': 'processed_screenshots/screen2_workbench.png',
        'title': 'Interactive SQL Query Editor & Workbench',
        'crop_box': (260, 0, 1400, 600) # focus on editor area & controls
    },
    {
        'src': 'screenshots_output/03_workbench_analyzed.png',
        'dst': 'processed_screenshots/screen3_telemetry.png',
        'title': 'AI Diagnostics: Score Gauge & Risk Telemetry',
        'crop_box': (260, 150, 1400, 750) # focus on analysis gauges, score & advice
    },
    {
        'src': 'screenshots_output/04_analytics_dashboard.png',
        'dst': 'processed_screenshots/screen4_dashboard.png',
        'title': 'Analytics Dashboard & Report History Archive',
        'crop_box': (260, 0, 1400, 600) # focus on KPIs & reports list
    }
]

target_w, target_h = 1060, 390

for cfg in configs:
    src_img = Image.open(cfg['src'])
    w, h = src_img.size
    crop_box = cfg['crop_box']
    # clamp crop box
    crop_box = (
        max(0, min(crop_box[0], w)),
        max(0, min(crop_box[1], h)),
        max(0, min(crop_box[2], w)),
        max(0, min(crop_box[3], h))
    )
    cropped = src_img.crop(crop_box)
    resized = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # Add a clean top banner with title
    draw = ImageDraw.Draw(resized)
    # semi-transparent dark banner at top
    draw.rectangle([(0, 0), (target_w, 36)], fill=(15, 23, 42))
    draw.line([(0, 36), (target_w, 36)], fill=(0, 168, 150), width=2)
    
    try:
        # Use a standard font if available
        font = ImageFont.truetype("arial.ttf", 16)
    except:
        font = ImageFont.load_default()
        
    draw.text((14, 8), cfg['title'], fill=(255, 255, 255), font=font)
    
    resized.save(cfg['dst'], quality=95)
    print(f"Generated {cfg['dst']}")

# Also prepare a dedicated high-res workbench image for Slide 8 (UI Design / Wireframes)
slide8_src = Image.open('screenshots_output/03_workbench_analyzed.png')
# Target: 6.60 x 4.50 inches -> 1320 x 900 px
slide8_img = slide8_src.resize((1320, 900), Image.Resampling.LANCZOS)
slide8_draw = ImageDraw.Draw(slide8_img)
slide8_draw.rectangle([(0, 0), (1320, 42)], fill=(15, 23, 42))
slide8_draw.line([(0, 42), (1320, 42)], fill=(0, 168, 150), width=3)
try:
    font8 = ImageFont.truetype("arial.ttf", 18)
except:
    font8 = ImageFont.load_default()
slide8_draw.text((18, 10), "QueryPilot — Real-Time Query Performance Workbench & Diagnostic Engine", fill=(255, 255, 255), font=font8)
slide8_img.save('processed_screenshots/slide8_workbench.png', quality=95)
print("Generated processed_screenshots/slide8_workbench.png")
