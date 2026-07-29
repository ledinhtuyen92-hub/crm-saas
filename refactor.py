import os
import re

PAGE_DIR = r"d:\LẬP TRÌNH\crm_saas\frontend\src\pages"

def refactor_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # We want to change the <Card title={...}> or <div display: flex...> to use PageHeader
    # But since every file is so different, let's just do a simple regex for the Antd Title
    
    # 1. Update Title level={3} to level={2}
    content = re.sub(r'<Title\s+level=\{[234]\}(.*?)>', r'<Title level={2}\1>', content)
    
    # 2. Enforce Inter font on Title
    if "fontFamily: " in content and "Outfit" in content:
        content = content.replace("Outfit", "Inter")
        
    # 3. Add font family to Title if it doesn't have it
    # Find <Title ... style={{ ... }}>
    def replace_title_style(match):
        attrs = match.group(1)
        if "style={{" in attrs and "fontFamily" not in attrs:
            return f'<Title {attrs.replace("style={{", "style={{ fontFamily: \'\\'Inter\\', sans-serif\', fontWeight: 700, ")}>'
        elif "style={{" not in attrs:
            return f'<Title {attrs} style={{{{ fontFamily: \'\\'Inter\\', sans-serif\', fontWeight: 700 }}}}>'
        return match.group(0)
        
    content = re.sub(r'<Title(.*?)>', replace_title_style, content)

    # 4. Enforce subtitle Inter font
    def replace_text_secondary(match):
        attrs = match.group(1)
        if "style={{" in attrs and "fontFamily" not in attrs:
            return f'<Text type="secondary"{attrs.replace("style={{", "style={{ fontFamily: \'\\'Inter\\', sans-serif\', ")}>'
        elif "style={{" not in attrs:
            return f'<Text type="secondary"{attrs} style={{{{ fontFamily: \'\\'Inter\\', sans-serif\' }}}}>'
        return match.group(0)
        
    content = re.sub(r'<Text\s+type="secondary"(.*?)>', replace_text_secondary, content)
    
    # 5. Enforce Card styles
    def replace_card(match):
        attrs = match.group(1)
        if "style={{" in attrs and "borderRadius" not in attrs:
            return f'<Card {attrs.replace("style={{", "style={{ borderRadius: 12, boxShadow: \'0 1px 2px rgba(0,0,0,0.03)\', ")}>'
        elif "style={{" not in attrs:
            return f'<Card {attrs} style={{{{ borderRadius: 12, boxShadow: \'0 1px 2px rgba(0,0,0,0.03)\' }}}}>'
        return match.group(0)

    content = re.sub(r'<Card(.*?)>', replace_card, content)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

for root, _, files in os.walk(PAGE_DIR):
    for file in files:
        if file.endswith(".jsx"):
            refactor_file(os.path.join(root, file))

print("Done")
