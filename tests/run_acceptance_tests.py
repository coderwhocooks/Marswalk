import os
import time
from playwright.sync_api import sync_playwright

chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
os.makedirs('screenshots', exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=chrome_path, headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    
    print('Navigating to http://localhost:8000...')
    page.goto('http://localhost:8000', wait_until='networkidle')
    page.wait_for_timeout(3500) # Allow WebGL textures to load
    
    # TEST 1: Initial Screen - Complete Spherical Mars Planet
    page.screenshot(path='screenshots/test1_spherical_mars_globe.png')
    print('Saved: screenshots/test1_spherical_mars_globe.png')
    
    # Canvas center for mouse drags
    canvas = page.query_selector('canvas')
    box = canvas.bounding_box()
    cx = box['x'] + box['width'] / 2
    cy = box['y'] + box['height'] / 2
    
    # TEST 2: Rotate Planet to Opposite Hemisphere
    page.mouse.move(cx - 200, cy)
    page.mouse.down()
    page.mouse.move(cx + 400, cy, steps=30)
    page.mouse.up()
    page.wait_for_timeout(2000)
    page.screenshot(path='screenshots/test2_opposite_hemisphere.png')
    print('Saved: screenshots/test2_opposite_hemisphere.png')
    
    # TEST 3: View North/South Pole View (Drag vertically down to tilt North Pole forward)
    page.mouse.move(cx, cy - 150)
    page.mouse.down()
    page.mouse.move(cx, cy + 300, steps=30)
    page.mouse.up()
    page.wait_for_timeout(2000)
    page.screenshot(path='screenshots/test3_polar_view.png')
    print('Saved: screenshots/test3_polar_view.png')
    
    # Reset view
    for b in page.query_selector_all('button'):
        if b.get_attribute('title') == 'Reset Camera Orientation':
            b.click()
            break
    page.wait_for_timeout(1500)
    
    # TEST 4: Zoom towards a selected geographical location (Olympus Mons)
    for b in page.query_selector_all('button'):
        if 'Olympus' in b.inner_text():
            b.click()
            break
    page.wait_for_timeout(2500)
    page.screenshot(path='screenshots/test4_zoom_landmark.png')
    print('Saved: screenshots/test4_zoom_landmark.png')
    
    # TEST 5: Regional Jezero 3D Terrain View
    for b in page.query_selector_all('button'):
        if 'Jezero 3D Terrain' in b.inner_text():
            b.click()
            break
    page.wait_for_timeout(2500)
    page.screenshot(path='screenshots/test5_jezero_3d_terrain.png')
    print('Saved: screenshots/test5_jezero_3d_terrain.png')
    
    # TEST 6: Return to Globe & Descent to Jezero
    for b in page.query_selector_all('button'):
        if '3D Mars Globe' in b.inner_text():
            b.click()
            break
    page.wait_for_timeout(1500)
    for b in page.query_selector_all('button'):
        if 'Descent to Jezero' in b.inner_text():
            b.click()
            break
    page.wait_for_timeout(3500)
    page.screenshot(path='screenshots/test6_regional_alignment.png')
    print('Saved: screenshots/test6_regional_alignment.png')
    
    print('TOTAL JAVASCRIPT ERRORS:', len(errors))
    for err in errors:
        print('JS Error:', err)
        
    browser.close()
