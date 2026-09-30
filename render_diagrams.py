import subprocess
import os

temp_profile = r'C:\Users\HP\AppData\Local\Temp\chrome_diag_profile'
os.makedirs(temp_profile, exist_ok=True)

files = [
    (r'D:\Database\AI-Powered-Database-Query-Performance-Advisor-MERN\use_case_diagram.html', r'D:\Database\AI-Powered-Database-Query-Performance-Advisor-MERN\use_case_diagram.png'),
    (r'D:\Database\AI-Powered-Database-Query-Performance-Advisor-MERN\er_diagram.html', r'D:\Database\AI-Powered-Database-Query-Performance-Advisor-MERN\er_diagram.png')
]

for html_path, png_path in files:
    url = 'file:///' + html_path.replace('\\', '/')
    res = subprocess.run([
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        f'--user-data-dir={temp_profile}',
        f'--screenshot={png_path}',
        '--window-size=1400,920',
        url
    ], capture_output=True, text=True)
    print(f'Rendered {png_path}: {os.path.exists(png_path)}')
