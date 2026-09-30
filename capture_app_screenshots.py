import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--window-size=1400,900")

driver = webdriver.Chrome(options=chrome_options)
driver.get("https://client-black-pi-23.vercel.app")
time.sleep(3)

os.makedirs("screenshots_output", exist_ok=True)

# 1. Landing / Auth screen
driver.save_screenshot("screenshots_output/01_landing_screen.png")
print("Saved 01_landing_screen.png")

# Now inject session token in localStorage to see the authenticated workbench
script = """
localStorage.setItem('advisor_token', 'mock_jwt_token_for_preview');
localStorage.setItem('advisor_user', JSON.stringify({ email: 'developer@querypilot.io', role: 'user' }));
localStorage.setItem('advisor_role', 'user');
"""
driver.execute_script(script)
driver.refresh()
time.sleep(3)

# 2. Authenticated Workbench with default query
driver.save_screenshot("screenshots_output/02_workbench_ready.png")
print("Saved 02_workbench_ready.png")

# Try to click "Analyze Query" button if present
try:
    buttons = driver.find_elements(By.TAG_NAME, "button")
    for btn in buttons:
        if "analyze" in btn.text.lower():
            btn.click()
            print("Clicked analyze button")
            time.sleep(2)
            break
except Exception as e:
    print("Analyze click error:", e)

driver.save_screenshot("screenshots_output/03_workbench_analyzed.png")
print("Saved 03_workbench_analyzed.png")

# Switch to Analytics Dashboard tab
try:
    buttons = driver.find_elements(By.TAG_NAME, "button")
    for btn in buttons:
        if "dashboard" in btn.text.lower():
            btn.click()
            print("Clicked dashboard button")
            time.sleep(2)
            break
except Exception as e:
    print("Dashboard click error:", e)

driver.save_screenshot("screenshots_output/04_analytics_dashboard.png")
print("Saved 04_analytics_dashboard.png")

driver.quit()
print("All screenshots captured successfully!")
