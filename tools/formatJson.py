import json, re

with open('assets/layouts/config.json', encoding='utf-8-sig') as f:
    data = json.load(f)

text = json.dumps(data, indent=2, ensure_ascii=False)

# Collapse 2-element numeric arrays onto one line
text = re.sub(r'\[\s*\n\s*(-?[\d.]+),\s*\n\s*(-?[\d.]+)\s*\n\s*\]', r'[\1, \2]', text)
# Collapse 3-element numeric arrays onto one line
text = re.sub(r'\[\s*\n\s*(-?[\d.]+),\s*\n\s*(-?[\d.]+),\s*\n\s*(-?[\d.]+)\s*\n\s*\]', r'[\1, \2, \3]', text)

# Collapse simple single-char string arrays (keyboard rows like ["Q","W","E",...])
def collapse_str_array(m):
    items = re.findall(r'"([A-Z0-9])"', m.group(0))
    return '[' + ', '.join(f'"{i}"' for i in items) + ']'

text = re.sub(r'\[(?:\s*\n\s*"[A-Z0-9]",?)+\s*\n\s*\]', collapse_str_array, text)

with open('assets/layouts/config.json', 'w', encoding='utf-8') as f:
    f.write(text)

print('Done. Lines:', text.count('\n'))

